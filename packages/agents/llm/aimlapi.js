/**
 * Unified AIML API client.
 * Single OpenAI-compatible SDK instance routed through api.aimlapi.com.
 * Covers: LLMs (GPT, Claude, Gemini…), images, TTS, video, music.
 */
const OpenAI = require("openai");

const AIML_BASE_URL = "https://api.aimlapi.com/v1";

let _client = null;

function getClient() {
  if (_client) return _client;
  const apiKey = process.env.AIML_API_KEY;
  if (!apiKey) return null;
  _client = new OpenAI({ apiKey, baseURL: AIML_BASE_URL });
  return _client;
}

function isAvailable() {
  return Boolean(process.env.AIML_API_KEY);
}

function requireClient() {
  const client = getClient();
  if (!client) {
    throw new Error(
      "AIML_API_KEY is not configured. Add it to your .env file (get your key at aimlapi.com)."
    );
  }
  return client;
}

// ─── Text generation (LLMs) ──────────────────────────────────────────────────

async function generateText({ systemPrompt, userPrompt, model, maxTokens = 8000 }) {
  const client = requireClient();
  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error(`AIML API returned an empty response for model ${model}.`);
  return text;
}

// Vision analysis: send one or more images (Base64 data URLs or public URLs) to a
// multimodal LLM and get a TEXT answer back. Used to reverse-engineer the visual
// style of reference images into a reusable directive.
async function analyzeImages({ imageUrls, systemPrompt, userPrompt, model = "gpt-4o", maxTokens = 1200 }) {
  const client = requireClient();
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("analyzeImages requires at least one image.");
  }

  const userContent = [
    { type: "text", text: userPrompt },
    ...imageUrls.map((url) => ({ type: "image_url", image_url: { url } })),
  ];

  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error(`Vision analysis returned an empty response for model ${model}.`);
  return text;
}

// ─── Web search (Perplexity Sonar — grounded answers with citations) ──────────

async function searchWeb({ query, model = "sonar", maxTokens = 4000 }) {
  const client = requireClient();
  const completion = await client.chat.completions.create({
    model,
    max_tokens: maxTokens,
    messages: [
      {
        role: "system",
        content:
          "You are a precise research assistant. Answer the query using up-to-date, reliable web sources. " +
          "Be factual and concise. Prefer authoritative sources. Always ground claims in the sources you cite.",
      },
      { role: "user", content: query },
    ],
  });

  const content = completion.choices[0]?.message?.content?.trim() || "";
  return { content, citations: normalizeCitations(completion) };
}

// Perplexity exposes citations in several shapes across versions (top-level
// `citations`, message-level, or `search_results`), as plain URL strings or
// objects. Normalise to deduped { title, url } so the UI can render them cleanly.
function normalizeCitations(completion) {
  const raw =
    (Array.isArray(completion?.citations) && completion.citations) ||
    (Array.isArray(completion?.choices?.[0]?.message?.citations) && completion.choices[0].message.citations) ||
    (Array.isArray(completion?.search_results) && completion.search_results) ||
    [];

  const seen = new Set();
  const out = [];
  for (const item of raw) {
    let url = "";
    let title = "";
    if (typeof item === "string") {
      url = item.trim();
      title = url;
    } else if (item && typeof item === "object") {
      url = String(item.url || item.link || "").trim();
      title = String(item.title || item.name || url).trim();
    }
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ title: title.slice(0, 200) || url, url });
  }
  return out;
}

// ─── Image generation ────────────────────────────────────────────────────────

async function generateImage({ prompt, model, size = "1024x1024", n = 1 }) {
  const client = requireClient();
  const response = await client.images.generate({
    model,
    prompt,
    n,
    size,
    response_format: "url",
  });
  const urls = response.data.map((item) => item.url).filter(Boolean);
  if (urls.length === 0) throw new Error(`AIML API returned no image URL for model ${model}.`);
  return urls;
}

// Image-conditioned generation: feed reference images (locked style + subjects +
// previous scene for continuity) to Gemini's edit model so the output keeps the
// same character, environment and look. `imageUrls` accepts Base64 data URLs.
const AIML_V1_BASE = "https://api.aimlapi.com/v1";

async function generateImageEdit({ prompt, imageUrls, model = "google/gemini-2.5-flash-image-edit", aspectRatio = "1:1", n = 1 }) {
  const apiKey = process.env.AIML_API_KEY;
  if (!apiKey) throw new Error("AIML_API_KEY is not configured.");
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("generateImageEdit requires at least one reference image.");
  }

  const res = await fetch(`${AIML_V1_BASE}/images/generations`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, image_urls: imageUrls, aspect_ratio: aspectRatio, num_images: n }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Image edit failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const result = await res.json();
  const urls = (Array.isArray(result?.data) ? result.data : Array.isArray(result?.images) ? result.images : [])
    .map((item) => (typeof item === "string" ? item : item?.url || item?.image_url))
    .filter(Boolean);
  if (urls.length === 0) {
    throw new Error(`Image edit returned no URL. Response: ${JSON.stringify(result).slice(0, 200)}`);
  }
  return urls;
}

// ─── TTS (voice narration) ────────────────────────────────────────────────────

async function generateSpeech({ text, model, voice = "alloy", speed = 1.0 }) {
  const client = requireClient();
  // Returns a Response object — read as ArrayBuffer
  const response = await client.audio.speech.create({
    model,
    input: text,
    voice,
    speed,
    response_format: "mp3",
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer;
}

// ─── Async job pattern (video / music generation) ────────────────────────────
// AIML API uses a submit → poll pattern for heavy generation tasks.
// Endpoint: POST /v2/generate/{type}/... → { id }
// Poll:     GET  /v2/generate/{type}/...?generation_id={id} → { status, output }

const AIML_V2_BASE = "https://api.aimlapi.com/v2";

async function submitAsyncJob({ endpoint, body }) {
  const apiKey = process.env.AIML_API_KEY;
  if (!apiKey) throw new Error("AIML_API_KEY is not configured.");

  const res = await fetch(`${AIML_V2_BASE}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AIML API submit failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function pollAsyncJob({ endpoint, jobId, intervalMs = 4000, timeoutMs = 300000 }) {
  const apiKey = process.env.AIML_API_KEY;
  if (!apiKey) throw new Error("AIML_API_KEY is not configured.");

  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const res = await fetch(`${AIML_V2_BASE}${endpoint}?generation_id=${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`AIML API poll failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    const status = (data.status || "").toLowerCase();

    if (status === "completed" || status === "succeeded" || status === "success") {
      return data;
    }

    if (status === "failed" || status === "error") {
      throw new Error(`AIML API job failed: ${data.error || data.message || "unknown error"}`);
    }
    // status: "processing" | "queued" | "pending" → keep polling
  }

  throw new Error(`AIML API job timed out after ${timeoutMs / 1000}s.`);
}

// ─── Video generation (image-to-video) ───────────────────────────────────────
// Endpoint: POST /v2/video/generations  → { id }
// Poll:     GET  /v2/video/generations?generation_id={id} → { status, video:{url} }

function extractVideoUrl(result) {
  return (
    result?.video?.url ||
    result?.output?.url ||
    result?.output?.video_url ||
    result?.url ||
    result?.works?.[0]?.resource?.resource ||
    result?.generations?.[0]?.url ||
    null
  );
}

// Each engine only accepts a fixed set of clip durations (seconds). Sending an
// unsupported value (e.g. 5s to Hailuo, which only allows 6 or 10) can make the
// request fail, so we snap to the smallest supported value that still covers the
// requested scene length (falling back to the largest). The compositor later
// refits the clip to the exact scene duration, so an extra second is harmless.
const VIDEO_DURATION_OPTIONS = [
  { match: "hailuo", options: [6, 10] },
  { match: "wan",    options: [5, 10, 15] },
  { match: "kling",  options: [5, 10] },
  { match: "seedance", options: [5, 10] },
];

function resolveSupportedDuration(model = "", requested = 5) {
  const entry = VIDEO_DURATION_OPTIONS.find((e) => String(model).toLowerCase().includes(e.match));
  const options = entry ? entry.options : [5, 10];
  const want = Math.round(Number(requested) || 5);
  return options.find((opt) => opt >= want) ?? options[options.length - 1];
}

// Budget resolution per engine. CRITICAL for cost: some models (Wan) default to
// 1080p — twice the price — unless we pin the lower tier. Only sent for engines
// whose exact `resolution` param + casing is confirmed in the AIML docs; Kling /
// Seedance are left to their own defaults (no guessed param).
const VIDEO_RESOLUTION_OPTIONS = [
  { match: "hailuo", value: "768P" }, // enum ["768P","1080P"]
  { match: "wan",    value: "720p" }, // enum ["720p","1080p"] — default is 1080p!
];

function resolveBudgetResolution(model = "") {
  const entry = VIDEO_RESOLUTION_OPTIONS.find((e) => String(model).toLowerCase().includes(e.match));
  return entry ? entry.value : null;
}

async function generateVideo({ imageBuffer, imageMimeType = "image/png", prompt, model, duration = 5, aspectRatio = "16:9" }) {
  const imageDataUrl = `data:${imageMimeType};base64,${imageBuffer.toString("base64")}`;
  const clampedDuration = resolveSupportedDuration(model, duration);

  // NOTE: scene clips must stay silent for budget reasons. We intentionally do
  // NOT pass a model-side audio toggle here — the parameter name differs per
  // engine and an unknown field can make a request fail. The "no audio" intent
  // is carried entirely by the prompt (see videoPromptAgent.js + assets.js),
  // which every video model honors and never rejects.
  const body = { model, prompt, image_url: imageDataUrl, duration: clampedDuration, aspect_ratio: aspectRatio };
  const resolution = resolveBudgetResolution(model);
  if (resolution) {
    body.resolution = resolution; // pin budget tier (avoids Wan's 1080p default)
  }

  const submitResult = await submitAsyncJob({
    endpoint: "/video/generations",
    body,
  });

  const jobId = submitResult.id || submitResult.generation_id;
  if (!jobId) {
    throw new Error(`Video job submission returned no ID. Response: ${JSON.stringify(submitResult).slice(0, 200)}`);
  }

  const result = await pollAsyncJob({
    endpoint: "/video/generations",
    jobId,
    intervalMs: 6000,
    timeoutMs: 420000, // 7 minutes — Kling can be slow
  });

  const videoUrl = extractVideoUrl(result);
  if (!videoUrl) {
    throw new Error(`Video generation returned no URL. Response: ${JSON.stringify(result).slice(0, 200)}`);
  }
  return videoUrl;
}

// ─── Sound effect generation (ElevenLabs SFX) ────────────────────────────────
// POST /v1/sound-generation → returns raw audio bytes (mp3).
// Synchronous — no polling needed.

async function generateSoundEffect({ prompt, durationSeconds = 2, promptInfluence = 0.5 }) {
  const apiKey = process.env.AIML_API_KEY;
  if (!apiKey) throw new Error("AIML_API_KEY is not configured.");

  const clampedDuration = Math.max(0.5, Math.min(30, Number(durationSeconds) || 2));

  const res = await fetch(`${AIML_V1_BASE}/sound-generation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: String(prompt).slice(0, 450),
      model_id: "eleven_text_to_sound_v2",
      duration_seconds: clampedDuration,
      prompt_influence: Math.max(0, Math.min(1, Number(promptInfluence) || 0.5)),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Sound effect generation failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer()); // mp3 buffer
}

// ─── Music generation (async) ─────────────────────────────────────────────────
// Endpoint: POST /v2/generate/audio  → { id }
// Poll:     GET  /v2/generate/audio?generation_id={id} → { status, audio:{url} }

function extractAudioUrl(result) {
  return (
    result?.audio?.url ||
    result?.output?.url ||
    result?.output?.audio_url ||
    result?.url ||
    result?.generations?.[0]?.url ||
    null
  );
}

async function generateMusic({ prompt, model, duration = 30, referenceAudioUrl = null }) {
  const body = { model, prompt, duration };
  if (referenceAudioUrl) body.reference_audio_url = referenceAudioUrl;

  const submitResult = await submitAsyncJob({
    endpoint: "/generate/audio",
    body,
  });

  const jobId = submitResult.id || submitResult.generation_id;
  if (!jobId) {
    throw new Error(`Music job submission returned no ID. Response: ${JSON.stringify(submitResult).slice(0, 200)}`);
  }

  const result = await pollAsyncJob({
    endpoint: "/generate/audio",
    jobId,
    intervalMs: 5000,
    timeoutMs: 300000, // 5 minutes
  });

  const audioUrl = extractAudioUrl(result);
  if (!audioUrl) {
    throw new Error(`Music generation returned no URL. Response: ${JSON.stringify(result).slice(0, 200)}`);
  }
  return audioUrl;
}

module.exports = {
  isAvailable,
  getClient,
  requireClient,
  generateText,
  analyzeImages,
  searchWeb,
  generateImage,
  generateImageEdit,
  generateSpeech,
  generateVideo,
  generateMusic,
  generateSoundEffect,
  submitAsyncJob,
  pollAsyncJob,
  resolveSupportedDuration,
  resolveBudgetResolution,
};

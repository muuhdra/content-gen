const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const aimlapi = require("@cosyl/agents/llm/aimlapi");
const { MODEL_CONFIG } = require("@cosyl/config/models");
const { sanitizeFileSegment, formatFileSize } = require("../lib/files");
const { dataRoot } = require("../lib/paths");
const { referenceToImageUrls } = require("./reference-frames");

const execFileAsync = promisify(execFile);
const generatedMediaRoot = path.join(dataRoot, "generated-media");

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createContentFingerprint(parts = []) {
  return createHash("sha1")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 12);
}

function wrapText(value = "", maxLength = 38) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = candidate;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 6);
}

function inferDimensions(projectType = "") {
  const normalized = String(projectType || "").toLowerCase();
  return normalized.includes("short")
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

function getPaletteGradient(palette = "") {
  const normalized = String(palette || "").toLowerCase();

  if (normalized.includes("cyan")) return ["#06141f", "#0ea5e9"];
  if (normalized.includes("amber") || normalized.includes("gold")) return ["#1b1205", "#f59e0b"];
  if (normalized.includes("emerald") || normalized.includes("green")) return ["#07150f", "#10b981"];
  if (normalized.includes("rose") || normalized.includes("pink")) return ["#1a0b12", "#fb7185"];
  if (normalized.includes("violet") || normalized.includes("purple")) return ["#10071a", "#8b5cf6"];

  return ["#0b0f18", "#64748b"];
}

function createImageVariantFingerprint(variant = {}) {
  return createContentFingerprint([
    variant.prompt || "",
    variant.palette || "",
    variant.shot || "",
    variant.mood || "",
    variant.previewTitle || "",
    variant.status || "",
  ]);
}

function createVideoVariantFingerprint(variant = {}, imageVariant = null) {
  return createContentFingerprint([
    variant.prompt || "",
    variant.motion || "",
    variant.energy || "",
    variant.engine || "",
    variant.previewTitle || "",
    variant.sourceImageId || imageVariant?.id || "",
    imageVariant ? createImageVariantFingerprint(imageVariant) : "",
  ]);
}

function createNarrationFingerprint(project = {}, audio = {}) {
  const narration = audio?.narration || {};
  return createContentFingerprint([
    project.script?.content || "",
    narration.voiceId || "",
    narration.language || "",
    narration.direction || "",
  ]);
}

function createMusicFingerprint(project = {}, audio = {}) {
  const music = audio?.music || {};
  const totalDuration = Array.isArray(project.scenes)
    ? project.scenes.reduce((sum, scene) => sum + (Number(scene?.duration) || 0), 0)
    : 0;

  return createContentFingerprint([
    project.id || "",
    project.goal || "",
    project.script?.content || "",
    project.settings?.tone || "",
    project.settings?.visualStyle || "",
    project.type || "",
    totalDuration,
    music.trackName || "",
    music.mood || "",
    music.generationBrief || "",
    music.endingFadeEnabled !== false,
    music.endingFadeDuration || 0,
    music.dynamicVolume !== false,
  ]);
}

function createSfxFingerprint(project = {}, audio = {}) {
  const sfx = audio?.sfx || {};
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];

  return createContentFingerprint([
    project.id || "",
    project.script?.content || "",
    project.settings?.tone || "",
    project.settings?.visualStyle || "",
    sfx.density || "",
    Boolean(sfx.enabled),
    sfx.designBrief || "",
    ...(Array.isArray(sfx.cues) ? sfx.cues : []),
    ...scenes.flatMap((scene) => [
      scene.sceneId,
      scene.duration || 0,
      scene.visualIntent || "",
      scene.narration || "",
      scene.emotion || "",
      scene.approvedImageId || "",
      scene.approvedVideoId || "",
    ]),
  ]);
}

function buildImageSvg({ project, scene, variant }) {
  const { width, height } = inferDimensions(project.type);
  const [bgA, bgB] = getPaletteGradient(variant.palette);
  const sceneLabel = `${String(project.type || "").toLowerCase().includes("slideshow") ? "Slide" : "Scene"} ${scene.sceneId}`;
  const promptLines = wrapText(variant.prompt || scene.visualIntent || scene.narration, 40);
  const titleLines = wrapText(`${variant.previewTitle || "Visual"} · ${variant.shot || variant.motion || ""}`, 28);
  const subtitle = `${variant.mood || scene.emotion || "cinematic"} · ${variant.palette || "default"}`;

  const titleSvg = titleLines
    .map((line, index) => `<text x="96" y="${170 + index * 58}" font-size="44" font-weight="800" fill="white">${escapeXml(line)}</text>`)
    .join("");

  const promptSvg = promptLines
    .map((line, index) => `<text x="96" y="${height - 260 + index * 36}" font-size="28" font-weight="500" fill="rgba(255,255,255,0.82)">${escapeXml(line)}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgA}" />
      <stop offset="100%" stop-color="${bgB}" />
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="30%" r="55%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect width="${width}" height="${height}" fill="rgba(5,8,12,0.22)" />
  <circle cx="${Math.round(width * 0.76)}" cy="${Math.round(height * 0.22)}" r="${Math.round(Math.min(width, height) * 0.22)}" fill="url(#glow)" />
  <rect x="${Math.round(width * 0.66)}" y="${Math.round(height * 0.56)}" width="${Math.round(width * 0.24)}" height="${Math.round(height * 0.18)}" rx="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
  <rect x="72" y="72" width="170" height="42" rx="21" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.18)" />
  <text x="96" y="101" font-size="22" font-weight="700" fill="rgba(255,255,255,0.92)">${escapeXml(sceneLabel)}</text>
  ${titleSvg}
  <text x="96" y="${height - 320}" font-size="24" font-weight="700" fill="rgba(255,255,255,0.58)">${escapeXml(subtitle)}</text>
  ${promptSvg}
</svg>`;
}

// ─── Image generation helpers (AIML API) ─────────────────────────────────────

function resolveImageConfig(imageAgentModel = "") {
  const config =
    MODEL_CONFIG.image.providers[imageAgentModel] ||
    MODEL_CONFIG.image.providers[MODEL_CONFIG.image.default];
  return { aimlModel: config?.aimlModel || "nano-banana" };
}

function inferAIMLImageSize(projectType = "") {
  return String(projectType || "").toLowerCase().includes("short")
    ? "1024x1792"  // portrait  (shorts / reels)
    : "1792x1024"; // landscape (YouTube / long-form)
}

function inferImageAspectRatio(projectType = "") {
  return String(projectType || "").toLowerCase().includes("short") ? "9:16" : "16:9";
}

// Gemini's reference-conditioned editor — the budget model purpose-built for
// character/style consistency. Used whenever a scene has locked references.
const IMAGE_EDIT_MODEL = "google/gemini-2.5-flash-image-edit";
const MAX_REFERENCE_IMAGES = 4;

function bufferToDataUrl(buffer, mimeType = "image/png") {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function tokenizeForMatch(value) {
  return String(value || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
}

// Best-effort path to a scene's already-generated (cached) approved image, WITHOUT
// triggering generation — used to chain visual continuity to the next scene.
async function findCachedApprovedImagePath(project, scene) {
  if (!scene?.approvedImageId) return null;
  const variant = (scene.imageVariants || []).find((v) => v.id === scene.approvedImageId);
  if (!variant) return null;
  const baseName = sanitizeFileSegment(`${variant.id || `${project.id}-scene-${scene.sceneId}-image`}-${createImageVariantFingerprint(variant)}`);
  const pngPath = path.join(generatedMediaRoot, "images", sanitizeFileSegment(project.id), `${baseName}.png`);
  return (await fileExists(pngPath)) ? pngPath : null;
}

/**
 * Collect the reference images that should LOCK a scene's look:
 *   1. Editor LAB "style" references — the locked visual directive (always).
 *   2. Subject references (character/scene/object) the scene's text mentions.
 *   3. The previous scene's approved image — visual continuity (if cached).
 * Returns Base64 data URLs (capped). Never throws — locking is best-effort.
 */
async function collectSceneReferenceDataUrls({ project, scene }) {
  const references = Array.isArray(project?.references) ? project.references : [];
  const usable = references.filter((r) => r && (r.storagePath || r.kind === "reference-youtube"));

  const styleRefs = usable.filter((r) => r.label === "style");
  const sceneTokens = new Set([...tokenizeForMatch(scene?.narration), ...tokenizeForMatch(scene?.visualIntent)]);
  const subjectRefs = usable.filter(
    (r) => r.label !== "style" && tokenizeForMatch(r.name).some((t) => sceneTokens.has(t)),
  );

  const dataUrls = [];

  // Each reference → image(s): stills directly, video clips / motion design as a
  // single extracted frame, YouTube as its thumbnail. Order: locked style first,
  // previous-scene continuity, then matched subjects.
  for (const ref of styleRefs) {
    if (dataUrls.length >= MAX_REFERENCE_IMAGES) break;
    const urls = await referenceToImageUrls(ref, { maxFrames: 1 });
    if (urls[0]) dataUrls.push(urls[0]);
  }

  const prevScene = (project?.scenes || []).find((s) => s.sceneId === (scene?.sceneId || 0) - 1);
  const prevImagePath = prevScene ? await findCachedApprovedImagePath(project, prevScene) : null;
  if (prevImagePath && dataUrls.length < MAX_REFERENCE_IMAGES) {
    try {
      const buf = await fs.readFile(prevImagePath);
      dataUrls.push(bufferToDataUrl(buf, "image/png"));
    } catch { /* continuity is best-effort */ }
  }

  for (const ref of subjectRefs) {
    if (dataUrls.length >= MAX_REFERENCE_IMAGES) break;
    const urls = await referenceToImageUrls(ref, { maxFrames: 1 });
    if (urls[0]) dataUrls.push(urls[0]);
  }

  return dataUrls;
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// The AIML images endpoint (OpenAI-compatible) takes no separate negative field,
// so we fold quality negatives into the prompt — the single biggest cheap lever
// against the usual AI artefacts (bad hands, warped faces, clutter, watermarks).
const IMAGE_NEGATIVE_CLAUSE =
  "Avoid: warped anatomy, extra or missing limbs, distorted or asymmetric faces, broken hands, duplicated subjects, unstable or melting perspective, muddy or flat lighting, cluttered noisy background, visible text, captions, watermark, logo, signature, low detail, blurry, lowres.";

async function generateImageViaAIML(variant, project, pngPath, scene = null) {
  const { aimlModel } = resolveImageConfig(project.settings?.imageAgentModel);
  const size = inferAIMLImageSize(project.type);
  // Inject the reverse-engineered style brief (from analyzing the uploaded style
  // references) as a LOCKED directive on every scene — the consistency backbone.
  const styleBrief = typeof project.settings?.styleBrief === "string" ? project.settings.styleBrief.trim() : "";
  const styleSuffix = styleBrief ? ` LOCKED STYLE DIRECTIVE (match exactly across every scene): ${styleBrief}` : "";
  const prompt = `${variant.prompt}${styleSuffix} ${IMAGE_NEGATIVE_CLAUSE}`;

  // Reference-conditioned path: when the scene has locked references (Editor LAB
  // style + subjects + previous-scene continuity), route through Gemini's edit
  // model so the output truly preserves the locked look — not just a text hint.
  // Only Gemini/Nano-Banana models support this; Flux (ultra-budget) stays text
  // only, so we never silently override an explicit low-cost model choice.
  const supportsReferenceLock = /gemini|nano-banana/i.test(aimlModel);
  let referenceImages = [];
  if (scene && supportsReferenceLock) {
    try {
      referenceImages = await collectSceneReferenceDataUrls({ project, scene });
    } catch {
      referenceImages = [];
    }
  }

  let urls;
  if (referenceImages.length > 0) {
    const editPrompt = `${prompt} Use the provided reference images as the LOCKED visual directive: preserve the established art style, character identity, environment and color palette. Keep continuity with them while composing this scene.`;
    try {
      urls = await aimlapi.generateImageEdit({
        prompt: editPrompt,
        imageUrls: referenceImages,
        model: IMAGE_EDIT_MODEL,
        aspectRatio: inferImageAspectRatio(project.type),
        n: 1,
      });
    } catch {
      // Never break generation if the edit endpoint is unavailable — fall back
      // to plain text-to-image (the prompt still carries the style directive).
      urls = await aimlapi.generateImage({ prompt, model: aimlModel, size, n: 1 });
    }
  } else {
    try {
      urls = await aimlapi.generateImage({ prompt, model: aimlModel, size, n: 1 });
    } catch (err) {
      throw new Error(`Image generation failed (${aimlModel}): ${err.message}`);
    }
  }

  const buffer = await downloadBuffer(urls[0]);
  await fs.writeFile(pngPath, buffer);
}

async function ensureImageVariantAsset({ project, scene, variant }) {
  const { width, height } = inferDimensions(project.type);
  const outputDir = path.join(generatedMediaRoot, "images", sanitizeFileSegment(project.id));
  const baseName = sanitizeFileSegment(`${variant.id || `${project.id}-scene-${scene.sceneId}-image`}-${createImageVariantFingerprint(variant)}`);
  const svgPath = path.join(outputDir, `${baseName}.svg`);
  const pngPath = path.join(outputDir, `${baseName}.png`);

  await fs.mkdir(outputDir, { recursive: true });

  // Return cached PNG immediately if it exists
  if (await fileExists(pngPath)) {
    return {
      absolutePath: pngPath,
      fileName: `${baseName}.png`,
      contentType: "image/png",
      storagePath: `generated-media/images/${sanitizeFileSegment(project.id)}/${baseName}.png`,
    };
  }

  if (aimlapi.isAvailable()) {
    // ── Production path: real image generation via AIML API ───────────────
    await generateImageViaAIML(variant, project, pngPath, scene);
    return {
      absolutePath: pngPath,
      fileName: `${baseName}.png`,
      contentType: "image/png",
      storagePath: `generated-media/images/${sanitizeFileSegment(project.id)}/${baseName}.png`,
    };
  }

  // ── Dev fallback: SVG placeholder → FFmpeg → PNG ───────────────────────
  if (!await fileExists(svgPath)) {
    await fs.writeFile(svgPath, buildImageSvg({ project, scene, variant }), "utf8");
  }

  try {
    await execFileAsync("ffmpeg", [
      "-y", "-i", svgPath,
      "-frames:v", "1", "-vf", `scale=${width}:${height}`,
      pngPath,
    ]);
    return {
      absolutePath: pngPath,
      fileName: `${baseName}.png`,
      contentType: "image/png",
      storagePath: `generated-media/images/${sanitizeFileSegment(project.id)}/${baseName}.png`,
    };
  } catch {
    return {
      absolutePath: svgPath,
      fileName: `${baseName}.svg`,
      contentType: "image/svg+xml",
      storagePath: `generated-media/images/${sanitizeFileSegment(project.id)}/${baseName}.svg`,
    };
  }
}

function buildVideoFilter(variant = {}, width, height) {
  const motion = String(variant.motion || "").toLowerCase();
  const fps = 30;

  if (motion.includes("horizontal") || motion.includes("truck")) {
    return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)+on*1.8':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
  }

  if (motion.includes("vertical") || motion.includes("tilt") || motion.includes("pedestal")) {
    return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+on*1.2':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
  }

  if (motion.includes("zoom") || motion.includes("dolly")) {
    return `zoompan=z='min(zoom+0.0016,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
  }

  return `zoompan=z='1.04':x='iw/2-(iw/zoom/2)+sin(on/12)*8':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
}

// ─── Video generation helpers (AIML API) ─────────────────────────────────────

function resolveVideoModel(videoAgentModel = "") {
  const requested = MODEL_CONFIG.video.providers[videoAgentModel];
  const fallback = MODEL_CONFIG.video.providers[MODEL_CONFIG.video.default];
  // The requested entry may be the "none" adapter (no aimlModel) — fall back to
  // the catalog default's real model ID rather than a hard-coded stale string.
  return requested?.aimlModel || fallback?.aimlModel;
}

function inferVideoAspectRatio(projectType = "") {
  return String(projectType || "").toLowerCase().includes("short") ? "9:16" : "16:9";
}

async function ensureVideoVariantAsset({ project, scene, variant, imageVariant }) {
  const { width, height } = inferDimensions(project.type);
  const outputDir = path.join(generatedMediaRoot, "videos", sanitizeFileSegment(project.id));
  const baseName = sanitizeFileSegment(`${variant.id || `${project.id}-scene-${scene.sceneId}-video`}-${createVideoVariantFingerprint(variant, imageVariant)}`);
  const mp4Path = path.join(outputDir, `${baseName}.mp4`);
  const durationSeconds = Math.max(4, Math.min(12, Math.round(scene.duration || 6)));

  await fs.mkdir(outputDir, { recursive: true });

  if (await fileExists(mp4Path)) {
    return {
      absolutePath: mp4Path,
      fileName: `${baseName}.mp4`,
      contentType: "video/mp4",
      storagePath: `generated-media/videos/${sanitizeFileSegment(project.id)}/${baseName}.mp4`,
    };
  }

  const sourceImage = await ensureImageVariantAsset({
    project,
    scene,
    variant: imageVariant || variant,
  });

  if (aimlapi.isAvailable()) {
    // ── Production path: real image-to-video via AIML API ──────────────────
    const imageBuffer  = await fs.readFile(sourceImage.absolutePath);
    const aimlModel    = resolveVideoModel(project.settings?.videoAgentModel);
    const aspectRatio  = inferVideoAspectRatio(project.type);
    // No negative field on the video endpoint → fold motion negatives into the
    // prompt: the cheap lever against morphing, flicker and identity drift.
    // Budget: scene clips are ALWAYS silent. The audio stack (narration/music/
    // SFX) is produced and mixed separately at compose time, so we explicitly
    // forbid any model-side audio to avoid the surcharge audio-capable engines
    // add per second.
    const prompt = `${variant.prompt} Silent footage only — no audio, no sound, no music, no speech, no voice, no sound effects. Avoid: morphing, warping, flickering, jitter, identity drift, face or hand distortion, melting geometry, duplicated or extra limbs, sudden scene changes, abrupt camera jumps, text, watermark, logo.`;

    let videoUrl;
    try {
      videoUrl = await aimlapi.generateVideo({
        imageBuffer,
        imageMimeType: sourceImage.contentType,
        prompt,
        model: aimlModel,
        duration: durationSeconds,
        aspectRatio,
      });
    } catch (err) {
      throw new Error(`Video generation failed (${aimlModel}): ${err.message}`);
    }

    const videoBuffer = await downloadBuffer(videoUrl);
    await fs.writeFile(mp4Path, videoBuffer);
  } else {
    // ── Dev fallback: FFmpeg Ken Burns on source image ──────────────────────
    try {
      await execFileAsync("ffmpeg", [
        "-y", "-loop", "1", "-i", sourceImage.absolutePath,
        "-t", String(durationSeconds),
        "-vf", buildVideoFilter(variant, width, height),
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        mp4Path,
      ]);
    } catch {
      const fallbackColor = getPaletteGradient(variant.palette)[1];
      await execFileAsync("ffmpeg", [
        "-y", "-f", "lavfi",
        "-i", `color=c=${fallbackColor}:s=${width}x${height}:d=${durationSeconds}`,
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        mp4Path,
      ]);
    }
  }

  return {
    absolutePath: mp4Path,
    fileName: `${baseName}.mp4`,
    contentType: "video/mp4",
    storagePath: `generated-media/videos/${sanitizeFileSegment(project.id)}/${baseName}.mp4`,
  };
}

function mapVoiceIdToSayVoice(voiceId = "") {
  if (String(voiceId).startsWith("male")) {
    return "Alex";
  }

  return "Samantha";
}

// ─── TTS helpers (AIML API) ───────────────────────────────────────────────────

const TTS_MAX_CHARS = 1800;

function resolveVoiceConfig(voiceId = "") {
  const config =
    MODEL_CONFIG.voice.providers[voiceId] ||
    MODEL_CONFIG.voice.providers[MODEL_CONFIG.voice.default];
  return {
    aimlModel: config?.aimlModel || "tts-1-hd",
    voiceApiId: config?.voiceId || "alloy",
  };
}

function splitTextIntoChunks(text, maxChars = TTS_MAX_CHARS) {
  if (text.length <= maxChars) return [text];

  // Split on sentence boundaries first
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > maxChars && current) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(Boolean);
}

// Map the configured delivery direction to a TTS speed factor so the narration
// actually paces the way it was directed — `speed` is the one delivery control
// the OpenAI-compatible speech endpoint exposes.
function resolveNarrationSpeed(narration = {}, project = {}) {
  const text = `${narration.direction || ""} ${project.settings?.narrationStyle || ""} ${project.settings?.tone || ""}`.toLowerCase();
  if (/(slow|calm|reflective|gentle|relaxed|soothing|deliberate|pos[ée]|lent|calme)/.test(text)) return 0.92;
  if (/(fast|energetic|urgent|dynamic|punchy|excited|rapide|[ée]nergique|dynamique)/.test(text)) return 1.08;
  return 1.0;
}

async function generateNarrationViaAIML(scriptContent, voiceId, outputDir, baseName, speed = 1.0) {
  const { aimlModel, voiceApiId } = resolveVoiceConfig(voiceId);
  const chunks = splitTextIntoChunks(scriptContent);
  const chunkPaths = [];

  for (let i = 0; i < chunks.length; i++) {
    const buffer = await aimlapi.generateSpeech({
      text: chunks[i],
      model: aimlModel,
      voice: voiceApiId,
      speed,
    });
    const chunkPath = path.join(outputDir, `${baseName}-chunk-${i}.mp3`);
    await fs.writeFile(chunkPath, buffer);
    chunkPaths.push(chunkPath);
  }

  const mp3Path = path.join(outputDir, `${baseName}.mp3`);

  if (chunkPaths.length === 1) {
    await fs.rename(chunkPaths[0], mp3Path);
  } else {
    // Concatenate via FFmpeg for clean audio joins
    const concatListPath = path.join(outputDir, `${baseName}-concat.txt`);
    await fs.writeFile(concatListPath, chunkPaths.map((p) => `file '${p}'`).join("\n"), "utf8");
    await execFileAsync("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0",
      "-i", concatListPath, "-c:a", "copy", mp3Path,
    ]);
    await Promise.all([
      ...chunkPaths.map((p) => fs.rm(p, { force: true })),
      fs.rm(concatListPath, { force: true }),
    ]);
  }

  return mp3Path;
}

async function ensureGeneratedNarrationAsset({ project, audio }) {
  const narration = audio?.narration || {};
  const outputDir = path.join(generatedMediaRoot, "audio", sanitizeFileSegment(project.id));
  const fingerprint = createNarrationFingerprint(project, audio);
  const baseName = `${sanitizeFileSegment(project.title || project.id)}-narration-${fingerprint}`;
  const aiffPath = path.join(outputDir, `${baseName}.aiff`);
  const m4aPath = path.join(outputDir, `${baseName}.m4a`);
  const scriptContent = String(project.script?.content || "").trim();

  if (!scriptContent) {
    throw new Error("A script is required before generating a downloadable narration track.");
  }

  await fs.mkdir(outputDir, { recursive: true });

  if (!await fileExists(m4aPath)) {
    if (aimlapi.isAvailable()) {
      // ── Production path: real TTS via AIML API ──────────────────────────
      const mp3Path = await generateNarrationViaAIML(
        scriptContent,
        narration.voiceId,
        outputDir,
        baseName,
        resolveNarrationSpeed(narration, project),
      );
      await execFileAsync("ffmpeg", [
        "-y", "-i", mp3Path,
        "-c:a", "aac", "-b:a", "192k",
        m4aPath,
      ]);
      await fs.rm(mp3Path, { force: true });
    } else if (process.platform === "darwin") {
      // ── Dev fallback (macOS, no API key): use built-in 'say' ────────────
      await execFileAsync("say", [
        "-v", mapVoiceIdToSayVoice(narration.voiceId),
        "-o", aiffPath,
        scriptContent,
      ]);
      await execFileAsync("ffmpeg", [
        "-y", "-i", aiffPath,
        "-c:a", "aac", "-b:a", "192k",
        m4aPath,
      ]);
      await fs.rm(aiffPath, { force: true }).catch(() => {});
    } else {
      // ── Dev fallback (Linux, no API key): espeak-ng → silent placeholder ─
      const wavPath = path.join(outputDir, `${baseName}.wav`);
      let ttsSucceeded = false;

      try {
        await execFileAsync("espeak-ng", ["-w", wavPath, "-s", "150", scriptContent]);
        ttsSucceeded = true;
      } catch {
        try {
          await execFileAsync("bash", [
            "-c",
            `echo ${JSON.stringify(scriptContent)} | text2wave -o ${wavPath}`,
          ]);
          ttsSucceeded = true;
        } catch {
          const durationSeconds = Math.max(8, Math.round(scriptContent.split(/\s+/).filter(Boolean).length / 2.6));
          await execFileAsync("ffmpeg", [
            "-y", "-f", "lavfi",
            "-i", `anullsrc=r=44100:cl=stereo:d=${durationSeconds}`,
            "-c:a", "aac", "-b:a", "32k",
            m4aPath,
          ]);
        }
      }

      if (ttsSucceeded) {
        await execFileAsync("ffmpeg", [
          "-y", "-i", wavPath,
          "-c:a", "aac", "-b:a", "192k",
          m4aPath,
        ]);
        await fs.rm(wavPath, { force: true }).catch(() => {});
      }
    }
  }

  const stats = await fs.stat(m4aPath);
  return {
    id: `generated-narration-${sanitizeFileSegment(project.id)}-${fingerprint}`,
    name: `${baseName}.m4a`,
    sizeLabel: formatFileSize(stats.size),
    mimeType: "audio/mp4",
    storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
    uploadedAt: new Date(stats.mtimeMs).toISOString(),
  };
}

function resolveMusicBedConfig(mood = "cinematic") {
  const normalized = String(mood || "").toLowerCase();

  if (normalized.includes("uplifting")) {
    return { base: 220, accent: 440, texture: 660 };
  }

  if (normalized.includes("dark")) {
    return { base: 110, accent: 165, texture: 220 };
  }

  if (normalized.includes("ambient")) {
    return { base: 176, accent: 264, texture: 352 };
  }

  if (normalized.includes("editorial")) {
    return { base: 196, accent: 294, texture: 392 };
  }

  return { base: 147, accent: 294, texture: 440 };
}

function resolveMusicBedProfile(project = {}, music = {}) {
  const combined = `${music.mood || ""} ${music.generationBrief || ""} ${project.settings?.tone || ""} ${project.goal || ""}`.toLowerCase();
  const baseConfig = resolveMusicBedConfig(music.mood);

  if (/\b(dark|tense|threat|dramatic)\b/.test(combined)) {
    return {
      ...baseConfig,
      pulse: 0.18,
      masterVolume: 0.82,
      textureVolume: 0.05,
    };
  }

  if (/\b(uplifting|motivation|optimistic|launch)\b/.test(combined)) {
    return {
      ...baseConfig,
      pulse: 0.34,
      masterVolume: 0.94,
      textureVolume: 0.06,
    };
  }

  if (/\b(editorial|clear|educational|course|explainer)\b/.test(combined)) {
    return {
      ...baseConfig,
      pulse: 0.26,
      masterVolume: 0.88,
      textureVolume: 0.045,
    };
  }

  return {
    ...baseConfig,
    pulse: 0.24,
    masterVolume: 0.9,
    textureVolume: 0.05,
  };
}

function hashStringToFrequency(value = "", min = 220, range = 480) {
  const input = String(value || "");
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }

  return min + (Math.abs(hash) % range);
}

function buildSfxCueDescriptors(project = {}, audio = {}) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const density = String(audio?.sfx?.density || "medium").toLowerCase();
  const densityMultiplier = density === "light" ? 1 : density === "heavy" ? 2 : 1.5;
  let cursor = 0;

  return scenes.flatMap((scene) => {
    const sceneDuration = Math.max(1, Number(scene?.duration) || 5);
    const approvedVideo = Array.isArray(scene.videoVariants)
      ? scene.videoVariants.find((variant) => variant.id === scene.approvedVideoId)
      : null;
    const approvedImage = Array.isArray(scene.imageVariants)
      ? scene.imageVariants.find((variant) => variant.id === scene.approvedImageId)
      : null;
    const visualAnchor = approvedVideo?.motion || approvedImage?.shot || scene.visualIntent || scene.narration || `scene-${scene.sceneId}`;
    const cueAnchor = `${scene.sceneId}-${scene.emotion || ""}-${visualAnchor}`;
    const primaryCue = {
      start: cursor + Math.min(0.28 * densityMultiplier, Math.max(0.12, sceneDuration * 0.18)),
      duration: density === "heavy" ? 0.42 : density === "light" ? 0.2 : 0.3,
      frequency: hashStringToFrequency(cueAnchor, 240, 420),
      volume: density === "heavy" ? 0.18 : density === "light" ? 0.1 : 0.14,
    };
    const secondaryCue = density === "light"
      ? []
      : [{
          start: cursor + Math.min(sceneDuration - 0.18, Math.max(primaryCue.start + 0.4, sceneDuration * 0.72)),
          duration: density === "heavy" ? 0.32 : 0.22,
          frequency: hashStringToFrequency(`${cueAnchor}-tail`, 420, 520),
          volume: density === "heavy" ? 0.14 : 0.09,
        }];

    cursor += sceneDuration;
    return [primaryCue, ...secondaryCue].filter((cue) => cue.start >= 0 && cue.duration > 0);
  });
}

// ─── Music generation helpers (AIML API) ─────────────────────────────────────

function resolveMusicModel(musicAgentModel = "") {
  const config =
    MODEL_CONFIG.music.providers[musicAgentModel] ||
    MODEL_CONFIG.music.providers[MODEL_CONFIG.music.default];
  return config?.aimlModel || "minimax/music-2.6";
}

function buildMusicPrompt(project = {}, music = {}) {
  // Prefer the rich generation brief built by audio-generator.js; fall back to mood + tone.
  const brief = String(music.generationBrief || "").trim();
  if (brief) return brief.slice(0, 600);

  const mood = music.mood || "cinematic";
  const tone = project.settings?.tone || "";
  const goal = project.goal || project.title || "";
  return [`${mood} instrumental soundtrack`, tone, goal ? `for: ${goal}` : ""]
    .filter(Boolean)
    .join(", ")
    .slice(0, 600);
}

async function ensureGeneratedMusicAsset({ project, audio }) {
  const music = audio?.music || {};
  const outputDir = path.join(generatedMediaRoot, "audio", sanitizeFileSegment(project.id));
  const fingerprint = createMusicFingerprint(project, audio);
  const baseName = `${sanitizeFileSegment(project.title || project.id)}-soundtrack-${fingerprint}`;
  const m4aPath = path.join(outputDir, `${baseName}.m4a`);
  const totalDuration = Math.max(
    8,
    Math.round(
      Array.isArray(project.scenes)
        ? project.scenes.reduce((sum, scene) => sum + (Number(scene?.duration) || 0), 0)
        : 0
    ) || 12
  );

  await fs.mkdir(outputDir, { recursive: true });

  if (!await fileExists(m4aPath) && aimlapi.isAvailable()) {
    // ── Production path: real music generation via AIML API ────────────────
    const musicModel = resolveMusicModel(project.settings?.musicAgentModel);
    const musicPrompt = buildMusicPrompt(project, music);

    let audioUrl;
    try {
      audioUrl = await aimlapi.generateMusic({
        prompt: musicPrompt,
        model: musicModel,
        duration: totalDuration,
      });
    } catch (err) {
      throw new Error(`Music generation failed (${musicModel}): ${err.message}`);
    }

    const rawPath = path.join(outputDir, `${baseName}-raw`);
    const audioBuffer = await downloadBuffer(audioUrl);
    await fs.writeFile(rawPath, audioBuffer);

    // Transcode to AAC + apply ending fade for clean assembly
    const fadeDuration = music.endingFadeEnabled === false
      ? 0
      : Math.max(0.5, Math.min(Number(music.endingFadeDuration) || 2.5, Math.max(1, totalDuration - 1)));
    const fadeArgs = fadeDuration > 0
      ? ["-af", `afade=t=out:st=${Math.max(0, totalDuration - fadeDuration)}:d=${fadeDuration}`]
      : [];

    await execFileAsync("ffmpeg", [
      "-y", "-i", rawPath,
      ...fadeArgs,
      "-c:a", "aac", "-b:a", "192k",
      m4aPath,
    ]);
    await fs.rm(rawPath, { force: true });
  }

  if (!await fileExists(m4aPath)) {
    // ── Dev fallback: synthetic sine-wave music bed (FFmpeg oscillators) ───
    const { base, accent, texture, pulse, masterVolume, textureVolume } = resolveMusicBedProfile(project, music);

    const fadeDuration = music.endingFadeEnabled === false
      ? 0
      : Math.max(0.5, Math.min(Number(music.endingFadeDuration) || 2.5, Math.max(1, totalDuration - 1)));
    const fadeStart = Math.max(0, totalDuration - fadeDuration);
    // Per-input volume chains (separate filtergraph chains, joined by ";").
    const inputChains = [
      `[0:a]volume='0.16*(0.88+0.12*sin(2*PI*${pulse}*t))':eval=frame[a0]`,
      "[1:a]volume=0.08[a1]",
      `[2:a]volume=${textureVolume},lowpass=f=1200[a2]`,
    ];

    // Mix chain — amix, optional fade, and master volume must be ONE comma-chain
    // so each filter feeds the next (FFmpeg 8 rejects unlabeled cross-chain pads).
    const mixSteps = ["[a0][a1][a2]amix=inputs=3:normalize=0"];
    if (fadeDuration > 0) {
      mixSteps.push(`afade=t=out:st=${fadeStart}:d=${fadeDuration}`);
    }
    mixSteps.push(`volume=${music.dynamicVolume === false ? "0.8" : String(masterVolume)}`);
    const mixChain = `${mixSteps.join(",")}[outa]`;

    const filterComplex = [...inputChains, mixChain].join(";");

    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi", "-i", `sine=frequency=${base}:duration=${totalDuration}`,
      "-f", "lavfi", "-i", `sine=frequency=${accent}:duration=${totalDuration}`,
      "-f", "lavfi", "-i", `sine=frequency=${texture}:duration=${totalDuration}`,
      "-filter_complex", filterComplex,
      "-map", "[outa]",
      "-t", String(totalDuration),
      "-c:a", "aac", "-b:a", "192k",
      m4aPath,
    ]);
  }

  const stats = await fs.stat(m4aPath);
  return {
    absolutePath: m4aPath,
    fileName: `${baseName}.m4a`,
    contentType: "audio/mp4",
    storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
    source: {
      id: `generated-soundtrack-${sanitizeFileSegment(project.id)}-${fingerprint}`,
      name: `${baseName}.m4a`,
      sizeLabel: formatFileSize(stats.size),
      mimeType: "audio/mp4",
      storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
      uploadedAt: new Date(stats.mtimeMs).toISOString(),
    },
  };
}

async function ensureGeneratedSfxAsset({ project, audio }) {
  const sfx = audio?.sfx || {};

  if (sfx.enabled === false) {
    return null;
  }

  const outputDir = path.join(generatedMediaRoot, "audio", sanitizeFileSegment(project.id));
  const fingerprint = createSfxFingerprint(project, audio);
  const baseName = `${sanitizeFileSegment(project.title || project.id)}-sfx-${fingerprint}`;
  const m4aPath = path.join(outputDir, `${baseName}.m4a`);
  const totalDuration = Math.max(
    8,
    Math.round(
      Array.isArray(project.scenes)
        ? project.scenes.reduce((sum, scene) => sum + (Number(scene?.duration) || 0), 0)
        : 0
    ) || 12
  );

  await fs.mkdir(outputDir, { recursive: true });

  if (!await fileExists(m4aPath)) {
    const cueDescriptors = buildSfxCueDescriptors(project, audio);
    const inputArgs = [
      "-f",
      "lavfi",
      "-i",
      `anullsrc=r=44100:cl=stereo:d=${totalDuration}`,
    ];
    const filterParts = [
      "[0:a]volume=0.0001[base]",
    ];

    cueDescriptors.forEach((cue, index) => {
      inputArgs.push(
        "-f",
        "lavfi",
        "-i",
        `sine=frequency=${Math.round(cue.frequency)}:duration=${cue.duration}`,
      );
      filterParts.push(
        `[${index + 1}:a]volume=${cue.volume},afade=t=in:st=0:d=0.02,afade=t=out:st=${Math.max(0.01, cue.duration - 0.04)}:d=0.04,adelay=${Math.round(cue.start * 1000)}|${Math.round(cue.start * 1000)}[cue${index}]`
      );
    });

    const mixInputs = ["[base]", ...cueDescriptors.map((_, index) => `[cue${index}]`)].join("");
    filterParts.push(`${mixInputs}amix=inputs=${cueDescriptors.length + 1}:normalize=0,volume=1.3[outa]`);

    await execFileAsync("ffmpeg", [
      "-y",
      ...inputArgs,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      "[outa]",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      m4aPath,
    ]);
  }

  const stats = await fs.stat(m4aPath);
  return {
    absolutePath: m4aPath,
    fileName: `${baseName}.m4a`,
    contentType: "audio/mp4",
    storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
    source: {
      id: `generated-sfx-${sanitizeFileSegment(project.id)}-${fingerprint}`,
      name: `${baseName}.m4a`,
      sizeLabel: formatFileSize(stats.size),
      mimeType: "audio/mp4",
      storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
      uploadedAt: new Date(stats.mtimeMs).toISOString(),
    },
  };
}

async function sendGeneratedMediaFile(asset, res, options = {}) {
  const shouldDownload = options.download === true;
  const buffer = await fs.readFile(asset.absolutePath);
  res.setHeader("Content-Type", asset.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  if (shouldDownload) {
    res.setHeader("Content-Disposition", `attachment; filename="${asset.fileName}"`);
  }

  res.send(buffer);
}

module.exports = {
  ensureGeneratedMusicAsset,
  ensureGeneratedNarrationAsset,
  ensureGeneratedSfxAsset,
  ensureImageVariantAsset,
  ensureVideoVariantAsset,
  sendGeneratedMediaFile,
};

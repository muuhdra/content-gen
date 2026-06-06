/**
 * @file narrationDirectorAgent.js
 * Turns a flat script into an EXPRESSIVE, human-sounding narration by inserting
 * ElevenLabs v3 audio tags, pauses and emphasis — WITHOUT changing the words.
 *
 * The master register comes from the user's narration direction (Audio LAB →
 * Narration, persisted as audio.narration.direction / settings.narrationStyle),
 * e.g. "calm professional true-crime delivery". Per-scene emotions modulate
 * within that register so the read follows the story's arc.
 *
 * Only ElevenLabs v3 interprets `[tags]` as performance cues; other engines would
 * speak them aloud, so callers must gate on the voice model (see voiceSupportsAudioTags).
 * Any failure (no API key, error) returns the original text → never breaks TTS.
 */
const aimlapi = require("./llm/aimlapi");

const NARRATION_DIRECTOR_MODEL = "claude-sonnet-4-6";

/**
 * Only ElevenLabs v3 understands inline audio tags. Everything else (MiniMax,
 * OpenAI-style voices) would read "[calm]" out loud — so we must not tag them.
 */
function voiceSupportsAudioTags(aimlModel = "") {
  return /elevenlabs/i.test(String(aimlModel));
}

function buildSystemPrompt() {
  return `You are a NARRATION DIRECTOR preparing a script for ElevenLabs v3 text-to-speech.

Your job: make a flat script sound like a real human narrator by adding PERFORMANCE CUES — never by changing the words.

HARD RULES:
- Do NOT add, remove, reorder or reword ANY spoken word. The spoken words must be identical to the input.
- Only insert: ElevenLabs v3 audio tags in [square brackets], ellipses "…" for breaths/pauses, and light emphasis via *asterisks* on truly key words.
- Use tags SPARINGLY and tastefully (roughly one cue per 1–2 sentences, not every line). Over-tagging sounds fake.

AVAILABLE TAGS (pick what fits the register): [calm] [serious] [thoughtful] [warm] [tense] [excited] [sad] [curious] [whispers] [sighs] [pauses] [hesitates]. Use only tags that match the MASTER DIRECTION.

HOW TO DIRECT:
- The MASTER DIRECTION is the dominant register for the WHOLE narration — every line stays within it.
- Modulate gently with the per-scene EMOTIONS to follow the story arc (hook → rising → peak → resolution), but never break the master register.
- Questions: let punctuation carry intonation (keep the "?"); add a brief "…" before a rhetorical question if it lands better.
- Dramatic beats: an ellipsis or a [pauses] is usually enough — don't overdo it.

OUTPUT: return ONLY the annotated script text. No preamble, no explanation, no quotes.`;
}

function buildUserPrompt({ scriptContent, deliveryDirection, projectType, tone, sceneEmotions }) {
  const arc = Array.isArray(sceneEmotions) && sceneEmotions.length > 0
    ? `Per-scene emotional arc (in order): ${sceneEmotions.filter(Boolean).join(" → ")}.`
    : "No explicit per-scene arc — infer a natural one that stays within the master direction.";

  return [
    `MASTER DIRECTION (dominant register): ${deliveryDirection || "clear, natural, human delivery"}.`,
    projectType ? `Content type: ${projectType}.` : "",
    tone ? `Project tone: ${tone}.` : "",
    arc,
    "",
    "SCRIPT (annotate this verbatim — same words, add only performance cues):",
    scriptContent,
  ].filter(Boolean).join("\n");
}

/**
 * @param {object} args
 * @param {string} args.scriptContent - The raw narration text.
 * @param {string} [args.deliveryDirection] - User's master tone (the Audio LAB field).
 * @param {string} [args.projectType]
 * @param {string} [args.tone]
 * @param {string[]} [args.sceneEmotions]
 * @param {string} [args.model]
 * @returns {Promise<string>} expressive text (or the original on any failure)
 */
async function directNarration({ scriptContent, deliveryDirection = "", projectType = "", tone = "", sceneEmotions = [], model = NARRATION_DIRECTOR_MODEL }) {
  const text = String(scriptContent || "").trim();
  if (!text) return scriptContent;
  if (!aimlapi.isAvailable()) return scriptContent; // dev / no key → plain text

  try {
    const annotated = await aimlapi.generateText({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt({ scriptContent: text, deliveryDirection, projectType, tone, sceneEmotions }),
      model,
      maxTokens: Math.min(8000, Math.max(1500, Math.ceil(text.length / 2))),
    });
    const cleaned = String(annotated || "").trim();
    // Guard: if the model returned something implausibly short, keep the original.
    if (cleaned.length < text.length * 0.6) return scriptContent;
    return cleaned;
  } catch {
    return scriptContent; // never break narration generation
  }
}

module.exports = {
  directNarration,
  voiceSupportsAudioTags,
  NARRATION_DIRECTOR_MODEL,
};

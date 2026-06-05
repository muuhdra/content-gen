/**
 * Thumbnail prompt agent.
 *
 * Turns a video's title/script (+ optional style) into a concise, image-ready
 * prompt for a high-CTR thumbnail. Text-only: the chosen reference style is
 * folded into the prompt as a style clause.
 */
const aimlapi = require("./llm/aimlapi");
const { validateThumbnailPromptOutput } = require("./contracts");

function buildSystemPrompt() {
  return `You are a world-class YouTube thumbnail art director.

From the video's title and (optional) script, write ONE image-generation prompt for a high-click-through thumbnail.

RULES:
- Output ONLY the prompt text — no preamble, no quotes, no explanation.
- Keep it under 60 words.
- Describe: the main subject, the composition/framing, the mood and color palette, and a short punchy on-image text overlay (3-5 words max) in quotes.
- Make it bold, high-contrast and instantly readable at small sizes.
- Do NOT mention aspect ratio or resolution.`;
}

function buildUserPrompt({ title, script, style, format }) {
  const lines = [];
  if (title) lines.push(`VIDEO TITLE: ${title}`);
  if (script) lines.push(`SCRIPT (excerpt):\n${String(script).slice(0, 2000)}`);
  if (style) lines.push(`STYLE / GENRE to match: ${style}`);
  if (format) lines.push(`The thumbnail will be ${format}.`);
  lines.push("Write the thumbnail image prompt now.");
  return lines.join("\n\n");
}

async function generateThumbnailPrompt({ title, script, style, format, model }) {
  const hasInput = (title && title.trim()) || (script && script.trim());
  if (!hasInput) {
    throw new Error("A video title or script is required to generate a thumbnail prompt.");
  }

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({ title, script, style, format });
  const apiModel = model || "claude-sonnet-4-6";

  const prompt = await aimlapi.generateText({
    systemPrompt,
    userPrompt,
    model: apiModel,
    maxTokens: 400,
  });

  const cleaned = prompt.replace(/^["']|["']$/g, "").trim();
  validateThumbnailPromptOutput(cleaned);
  return cleaned;
}

module.exports = { generateThumbnailPrompt };

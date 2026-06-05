/**
 * Thumbnail generation — real text-to-image via the AIML image API.
 *
 * Resolves the format to an AIML image size, generates the image, downloads it
 * to data/generated-media/thumbnails/, and returns a thumbnail record.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const aimlapi = require("@cosyl/agents/llm/aimlapi");
const { MODEL_CONFIG } = require("@cosyl/config/models");
const { dataRoot } = require("../lib/paths");

const thumbnailsRoot = path.join(dataRoot, "generated-media/thumbnails");

const FORMAT_SIZE = {
  "16:9": "1792x1024",
  "9:16": "1024x1792",
  "1:1": "1024x1024",
};

function resolveSize(format) {
  return FORMAT_SIZE[format] || FORMAT_SIZE["16:9"];
}

function resolveImageModel(model) {
  const config = MODEL_CONFIG.image.providers[model] || MODEL_CONFIG.image.providers[MODEL_CONFIG.image.default];
  return config?.aimlModel || "nano-banana";
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Thumbnail download failed (${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate a thumbnail from a text prompt.
 * @returns {Promise<{ id, prompt, format, model, storagePath, createdAt }>}
 */
async function generateThumbnail({ prompt, format = "16:9", model }) {
  const cleanedPrompt = String(prompt || "").trim();
  if (!cleanedPrompt) {
    throw new Error("A prompt is required to generate a thumbnail.");
  }

  const aimlModel = resolveImageModel(model);
  const size = resolveSize(format);

  let urls;
  try {
    urls = await aimlapi.generateImage({ prompt: cleanedPrompt, model: aimlModel, size, n: 1 });
  } catch (err) {
    throw new Error(`Thumbnail generation failed (${aimlModel}): ${err.message}`);
  }

  const id = `thumb-${randomUUID()}`;
  const fileName = `${id}.png`;
  await fs.mkdir(thumbnailsRoot, { recursive: true });
  const absolutePath = path.join(thumbnailsRoot, fileName);

  const buffer = await downloadBuffer(urls[0]);
  await fs.writeFile(absolutePath, buffer);

  return {
    id,
    prompt: cleanedPrompt,
    format,
    model: model || MODEL_CONFIG.image.default,
    storagePath: `generated-media/thumbnails/${fileName}`,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { generateThumbnail, thumbnailsRoot };

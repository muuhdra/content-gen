const { MODEL_CONFIG } = require("@cosyl/config/models");

function createKlingImageVariant({ scene, prompt, palette, shot, mood, variantIndex }) {
  const config = MODEL_CONFIG.image.providers["kling-v1.6-pro"] || MODEL_CONFIG.image.providers["nano-banana"];
  return {
    provider: "kling",
    adapter: "aimlapi",
    aimlModel: config?.aimlModel || "klingai/image-o1",
    palette,
    shot,
    mood,
    previewTitle: `Variant ${variantIndex}`,
    prompt,
    sceneId: scene.sceneId,
  };
}

module.exports = { createKlingImageVariant };

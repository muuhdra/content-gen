const { MODEL_CONFIG } = require("@cosyl/config/models");

function createNanoBananaImageVariant({ scene, prompt, palette, shot, mood, variantIndex }) {
  const config = MODEL_CONFIG.image.providers["nano-banana"];
  return {
    provider: "nano-banana",
    adapter: "aimlapi",
    aimlModel: config?.aimlModel || "nano-banana",
    palette,
    shot,
    mood,
    previewTitle: `Variant ${variantIndex}`,
    prompt,
    sceneId: scene.sceneId,
  };
}

module.exports = { createNanoBananaImageVariant };

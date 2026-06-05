const { MODEL_CONFIG } = require("@cosyl/config/models");

function createMidjourneyImageVariant({ scene, prompt, palette, shot, mood, variantIndex }) {
  const config = MODEL_CONFIG.image.providers["midjourney"];
  return {
    provider: "midjourney",
    adapter: "aimlapi",
    aimlModel: config?.aimlModel || "midjourney",
    palette,
    shot,
    mood,
    previewTitle: `Variant ${variantIndex}`,
    prompt,
    sceneId: scene.sceneId,
  };
}

module.exports = { createMidjourneyImageVariant };

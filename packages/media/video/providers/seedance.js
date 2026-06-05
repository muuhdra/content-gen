const { MODEL_CONFIG } = require("@cosyl/config/models");

function createSeedanceVideoVariant({ scene, variant }) {
  const config = MODEL_CONFIG.video.providers["seedance-2.0"];
  return {
    provider: "seedance",
    adapter: "aimlapi",
    aimlModel: config?.aimlModel || "bytedance/seedance-2-0",
    engine: variant.engine,
    motion: variant.motion,
    energy: variant.energy,
    previewTitle: variant.previewTitle,
    prompt: variant.prompt,
    sceneId: scene.sceneId,
  };
}

module.exports = { createSeedanceVideoVariant };

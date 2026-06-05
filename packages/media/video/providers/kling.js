const { MODEL_CONFIG } = require("@cosyl/config/models");

function createKlingVideoVariant({ scene, variant }) {
  const modelKey = variant.engine || "kling-v1.6-pro";
  const config =
    MODEL_CONFIG.video.providers[modelKey] ||
    MODEL_CONFIG.video.providers["kling-v1.6-pro"];

  return {
    provider: "kling",
    adapter: "aimlapi",
    aimlModel: config?.aimlModel || "kling-video/v1.6/pro/image-to-video",
    engine: variant.engine,
    motion: variant.motion,
    energy: variant.energy,
    previewTitle: variant.previewTitle,
    prompt: variant.prompt,
    sceneId: scene.sceneId,
  };
}

module.exports = { createKlingVideoVariant };

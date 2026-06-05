const { MODEL_CONFIG } = require("@cosyl/config/models");
const { createKlingVideoVariant } = require("./providers/kling");
const { createSeedanceVideoVariant } = require("./providers/seedance");

const SEEDANCE_MODELS = new Set(["seedance-2.0", "seedance-2.0-fast"]);

function generateVideoVariant({ scene, project, variant }) {
  const modelKey = project.settings?.videoAgentModel || MODEL_CONFIG.video.default;
  const modelConfig =
    MODEL_CONFIG.video.providers[modelKey] ||
    MODEL_CONFIG.video.providers[MODEL_CONFIG.video.default];

  const render = SEEDANCE_MODELS.has(modelKey)
    ? createSeedanceVideoVariant({ scene, variant })
    : createKlingVideoVariant({ scene, variant });

  return {
    ...render,
    aimlModel: modelConfig?.aimlModel || render.aimlModel,
    model: modelKey,
    modelLabel: modelConfig?.label || "Video Model",
  };
}

module.exports = { generateVideoVariant };

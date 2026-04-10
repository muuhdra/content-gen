const { MODEL_CONFIG } = require("../../../config/models");
const { createKlingVideoVariant } = require("./providers/kling");
const { createSeedanceVideoVariant } = require("./providers/seedance");

function generateVideoVariant({ scene, project, variant }) {
  const modelKey = project.settings?.videoAgentModel || MODEL_CONFIG.video.default;
  const modelConfig = MODEL_CONFIG.video.providers[modelKey] || MODEL_CONFIG.video.providers[MODEL_CONFIG.video.default];
  const providerKey = modelConfig?.adapter || "kling";

  const render = providerKey === "seedance"
    ? createSeedanceVideoVariant({ scene, variant })
    : createKlingVideoVariant({ scene, variant });

  return {
    ...render,
    model: modelKey,
    modelLabel: modelConfig?.label || "Video Model",
  };
}

module.exports = {
  generateVideoVariant,
};

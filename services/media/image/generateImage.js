const { MODEL_CONFIG } = require("../../../config/models");
const { createNanoBananaImageVariant } = require("./providers/nanoBanana");
const { createKlingImageVariant } = require("./providers/kling");

function generateImageVariant({ scene, project, variant }) {
  const modelKey = project.settings?.imageAgentModel || MODEL_CONFIG.image.default;
  const modelConfig = MODEL_CONFIG.image.providers[modelKey] || MODEL_CONFIG.image.providers[MODEL_CONFIG.image.default];
  const providerKey = modelConfig?.adapter || "nano-banana";

  const basePayload = {
    scene,
    prompt: variant.prompt,
    palette: variant.palette,
    shot: variant.shot,
    mood: variant.mood,
    variantIndex: variant.variantIndex,
  };

  const render = providerKey === "kling"
    ? createKlingImageVariant(basePayload)
    : createNanoBananaImageVariant(basePayload);

  return {
    ...render,
    model: modelKey,
    modelLabel: modelConfig?.label || "Image Model",
  };
}

module.exports = {
  generateImageVariant,
};

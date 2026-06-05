const { MODEL_CONFIG } = require("@cosyl/config/models");
const { createNanoBananaImageVariant } = require("./providers/nanoBanana");
const { createKlingImageVariant } = require("./providers/kling");
const { createMidjourneyImageVariant } = require("./providers/midjourney");

const PROVIDER_FACTORIES = {
  "nano-banana":     createNanoBananaImageVariant,
  "nano-banana-pro": createNanoBananaImageVariant,
  "flux-2-pro":      createNanoBananaImageVariant,
  "flux-2-max":      createNanoBananaImageVariant,
  midjourney:        createMidjourneyImageVariant,
  "kling-v1.6-pro":  createKlingImageVariant,
};

function generateImageVariant({ scene, project, variant }) {
  const modelKey = project.settings?.imageAgentModel || MODEL_CONFIG.image.default;
  const modelConfig =
    MODEL_CONFIG.image.providers[modelKey] ||
    MODEL_CONFIG.image.providers[MODEL_CONFIG.image.default];

  const factory = PROVIDER_FACTORIES[modelKey] || createNanoBananaImageVariant;

  const render = factory({
    scene,
    prompt: variant.prompt,
    palette: variant.palette,
    shot: variant.shot,
    mood: variant.mood,
    variantIndex: variant.variantIndex,
  });

  return {
    ...render,
    aimlModel: modelConfig?.aimlModel || "nano-banana",
    model: modelKey,
    modelLabel: modelConfig?.label || "Image Model",
  };
}

module.exports = { generateImageVariant };

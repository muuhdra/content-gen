const { runImagePromptAgent } = require("../../../../services/agents");
const { generateImageVariant } = require("../../../../services/media/image/generateImage");
const { buildImageGenerationHandoff } = require("../../../../services/agents/productionHandoff");

function generateImageVariantsForScene(scene, project, count = 3) {
  const agentResult = runImagePromptAgent({ scene, project, count });
  return agentResult.output.variants.map((variant) => ({
    ...variant,
    render: generateImageVariant({ scene, project, variant }),
    productionGeneration: buildImageGenerationHandoff({
      scene,
      project,
      variant,
    }),
  }));
}

function approveImageVariant(scene, imageId) {
  const imageVariants = scene.imageVariants.map((variant) => ({
    ...variant,
    status: variant.id === imageId ? "approved" : "pending",
  }));

  return {
    ...scene,
    approvedImageId: imageId,
    imageVariants,
  };
}

function regenerateImageVariant(scene, imageId, project) {
  const targetIndex = scene.imageVariants.findIndex((variant) => variant.id === imageId);

  if (targetIndex === -1) {
    return scene;
  }

  const previousVariant = scene.imageVariants[targetIndex];
  const refreshedVariant = runImagePromptAgent({
    scene,
    project,
    count: previousVariant.variantIndex,
  }).output.variants[previousVariant.variantIndex - 1];
  const nextVariant = {
    ...refreshedVariant,
    render: generateImageVariant({ scene, project, variant: refreshedVariant }),
    id: previousVariant.id,
    previewTitle: `${previousVariant.previewTitle} Refresh`,
    prompt: `${refreshedVariant.prompt} Regenerated to explore a new visual direction.`,
    status: scene.approvedImageId === previousVariant.id ? "approved" : "pending",
  };
  nextVariant.productionGeneration = buildImageGenerationHandoff({
    scene,
    project,
    variant: nextVariant,
  });

  const imageVariants = [...scene.imageVariants];
  imageVariants[targetIndex] = nextVariant;

  return {
    ...scene,
    imageVariants,
  };
}

module.exports = {
  generateImageVariantsForScene,
  approveImageVariant,
  regenerateImageVariant,
};

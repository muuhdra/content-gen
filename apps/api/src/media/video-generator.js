const { runVideoPromptAgent } = require("@cosyl/agents");
const { generateVideoVariant } = require("@cosyl/media/video/generateVideo");

function generateVideoVariantsForScene(scene, project, count = 1) {
  const sourceImageVariant = Array.isArray(scene.imageVariants)
    ? scene.imageVariants.find((variant) => variant.id === scene.approvedImageId) || null
    : null;
  const agentResult = runVideoPromptAgent({ scene, project, count });
  return agentResult.output.variants.map((variant) => ({
    ...variant,
    sourceImageId: sourceImageVariant?.id || scene.approvedImageId || null,
    render: generateVideoVariant({ scene, project, variant }),
  }));
}

function approveVideoVariant(scene, videoId) {
  const videoVariants = (scene.videoVariants || []).map((variant) => ({
    ...variant,
    status: variant.id === videoId ? "approved" : "pending",
  }));

  return {
    ...scene,
    approvedVideoId: videoId,
    videoVariants,
  };
}

// Regenerate a single video variant in place (same id, fresh render) — used by
// the "regenerate output" button when the user isn't happy with the result.
function regenerateVideoVariant(scene, videoId, project) {
  const targetIndex = (scene.videoVariants || []).findIndex((variant) => variant.id === videoId);
  if (targetIndex === -1) {
    return scene;
  }

  const previousVariant = scene.videoVariants[targetIndex];
  const sourceImageVariant = Array.isArray(scene.imageVariants)
    ? scene.imageVariants.find((variant) => variant.id === scene.approvedImageId) || null
    : null;

  const poolCount = Math.max(2, previousVariant.variantIndex || 1);
  const pool = runVideoPromptAgent({ scene, project, count: poolCount }).output.variants;
  const refreshed = pool[(previousVariant.variantIndex || 1) - 1] ?? pool[0];

  const nextVariant = {
    ...refreshed,
    id: previousVariant.id,
    sourceImageId: sourceImageVariant?.id || scene.approvedImageId || null,
    render: generateVideoVariant({ scene, project, variant: refreshed }),
    previewTitle: `${previousVariant.previewTitle} Refresh`,
    status: scene.approvedVideoId === previousVariant.id ? "approved" : "pending",
  };

  const videoVariants = [...scene.videoVariants];
  videoVariants[targetIndex] = nextVariant;

  return { ...scene, videoVariants };
}

module.exports = {
  generateVideoVariantsForScene,
  approveVideoVariant,
  regenerateVideoVariant,
};

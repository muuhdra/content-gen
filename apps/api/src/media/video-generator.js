const { runVideoPromptAgent } = require("../../../../services/agents");
const { generateVideoVariant } = require("../../../../services/media/video/generateVideo");

function generateVideoVariantsForScene(scene, project, count = 3) {
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

module.exports = {
  generateVideoVariantsForScene,
  approveVideoVariant,
};

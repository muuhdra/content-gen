function createSeedanceVideoVariant({ scene, variant }) {
  return {
    provider: "seedance",
    engine: variant.engine,
    motion: variant.motion,
    energy: variant.energy,
    previewTitle: variant.previewTitle,
    prompt: `${variant.prompt} Provider pipeline: Seedance motion render.`,
    sceneId: scene.sceneId,
  };
}

module.exports = {
  createSeedanceVideoVariant,
};

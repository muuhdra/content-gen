function createKlingVideoVariant({ scene, variant }) {
  return {
    provider: "kling",
    engine: variant.engine,
    motion: variant.motion,
    energy: variant.energy,
    previewTitle: variant.previewTitle,
    prompt: `${variant.prompt} Provider pipeline: Kling motion render.`,
    sceneId: scene.sceneId,
  };
}

module.exports = {
  createKlingVideoVariant,
};

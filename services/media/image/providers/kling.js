function createKlingImageVariant({ scene, prompt, palette, shot, mood, variantIndex }) {
  return {
    provider: "kling",
    palette,
    shot,
    mood,
    previewTitle: `Variant ${variantIndex}`,
    prompt: `${prompt} Provider pipeline: Kling 3.0 image render.`,
    sceneId: scene.sceneId,
  };
}

module.exports = {
  createKlingImageVariant,
};

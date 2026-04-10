function createNanoBananaImageVariant({ scene, prompt, palette, shot, mood, variantIndex }) {
  return {
    provider: "nano-banana",
    palette,
    shot,
    mood,
    previewTitle: `Variant ${variantIndex}`,
    prompt: `${prompt} Provider pipeline: Nano Banana cinematic image stack.`,
    sceneId: scene.sceneId,
  };
}

module.exports = {
  createNanoBananaImageVariant,
};

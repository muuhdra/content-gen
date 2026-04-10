const {
  createStructuredAgentResult,
  validateImagePromptOutput,
} = require("./contracts");
const { buildImagePromptHandoff } = require("./productionHandoff");
const { buildReferenceDirective, selectSceneReferenceAnchors } = require("./referenceAnchors");

const palettes = ["violet", "cyan", "amber", "emerald", "rose"];
const shots = ["wide frame", "close portrait", "editorial mid-shot", "cinematic overhead"];
const moods = ["dramatic", "clean", "premium", "high-energy"];

function createImageVariantId(sceneId, variantIndex) {
  return `${sceneId}-image-${variantIndex + 1}`;
}

function buildReferencePromptNote(project, scene) {
  const anchors = selectSceneReferenceAnchors(project, {
    sceneText: scene?.narration || "",
    visualIntent: scene?.visualIntent || "",
    maxItems: 4,
  });

  if (anchors.length === 0) {
    return "";
  }

  return `Use these reference anchors when relevant: ${buildReferenceDirective(anchors)}. Preserve identity, environment logic and visual continuity even if the original file names are generic.`;
}

function buildVariantPrompt(scene, project, variantIndex) {
  const isSlideshow = (project.type || "").toLowerCase().includes("slideshow");
  const palette = palettes[variantIndex % palettes.length];
  const referenceNote = buildReferencePromptNote(project, scene);
  const shot = isSlideshow
    ? ["clean slide layout", "split-screen slide", "diagram slide", "text-led hero slide"][variantIndex % 4]
    : shots[variantIndex % shots.length];
  const mood = isSlideshow
    ? ["clear", "editorial", "premium", "educational"][variantIndex % 4]
    : moods[variantIndex % moods.length];

  return {
    id: createImageVariantId(scene.id, variantIndex),
    variantIndex: variantIndex + 1,
    status: "pending",
    palette,
    shot,
    mood,
    previewTitle: isSlideshow ? `Slide ${variantIndex + 1}` : `Variant ${variantIndex + 1}`,
    prompt: isSlideshow
      ? `${scene.visualIntent} Build a ${mood} ${shot} with presentation clarity, readable hierarchy and a ${palette} accent. Match project style: ${project.settings.visualStyle}. ${referenceNote}`.trim()
      : `${scene.visualIntent} Render as a ${mood} ${shot} with a ${palette} accent. Match project style: ${project.settings.visualStyle}. ${referenceNote}`.trim(),
  };
}

function runImagePromptAgent({ scene, project, count = 3 }) {
  const variants = Array.from({ length: count }, (_, index) => {
    const variant = buildVariantPrompt(scene, project, index);

    return {
      ...variant,
      productionPrompt: buildImagePromptHandoff({
        scene,
        project,
        variant,
      }),
    };
  });

  return createStructuredAgentResult({
    agent: "imagePromptAgent",
    schema: "cosyl.image-prompts.v1",
    model: project.settings?.imageAgentModel || "structured-image-agent",
    output: {
      variants,
    },
    validate: validateImagePromptOutput,
    production: {
      schema: "03-image-prompt.schema.json",
      outputs: variants.map((variant) => variant.productionPrompt.output),
    },
  });
}

module.exports = {
  runImagePromptAgent,
};

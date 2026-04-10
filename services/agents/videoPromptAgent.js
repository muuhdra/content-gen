const {
  createStructuredAgentResult,
  validateVideoPromptOutput,
} = require("./contracts");
const { buildMotionVideoHandoff } = require("./productionHandoff");
const { buildReferenceDirective, selectSceneReferenceAnchors } = require("./referenceAnchors");

function analyzeCinematicContext(textContext) {
  const normalized = textContext.toLowerCase();
  
  // Défaut
  let motion = "slow push-in";
  let energy = "cinematic";
  let action = "natural ambient movement";
  let framing = "medium shot";

  // Analyse Mouvement de Caméra
  if (normalized.match(/(sky|fly|bird|drone|above|high)/)) motion = "aerial drone pull-away";
  else if (normalized.match(/(run|fast|speed|chase|dynamic|action)/)) motion = "fast tracking shot";
  else if (normalized.match(/(walk|follow|behind)/)) motion = "tracking follow shot";
  else if (normalized.match(/(face|eyes|look|portrait|character)/)) motion = "subtle parallax zoom";
  else if (normalized.match(/(wide|landscape|city|world)/)) motion = "slow horizontal pan";

  // Analyse Énergie
  if (normalized.match(/(peace|calm|quiet|slow|steady|nature)/)) energy = "calm";
  else if (normalized.match(/(epic|dramatic|grand|huge)/)) energy = "cinematic";
  else if (normalized.match(/(bold|modern|tech|fashion)/)) energy = "editorial";
  else if (normalized.match(/(fight|crash|jump|burst)/)) energy = "punchy";

  // Analyse Action du Sujet
  if (normalized.match(/(speak|talk|say)/)) action = "subject speaking naturally";
  else if (normalized.match(/(look|stare|watch)/)) action = "subject looking directly at the camera";
  else if (normalized.match(/(walk|run|move)/)) action = "subject moving across the frame";
  else if (normalized.match(/(wind|breeze|blow)/)) action = "hair and clothing blowing gently in the wind";

  // Cadrage
  if (normalized.match(/(close up|detail|face|eyes)/)) framing = "extreme close-up";
  else if (normalized.match(/(wide|landscape|panorama)/)) framing = "wide establishing shot";

  return { motion, energy, action, framing };
}

function createVideoVariantId(sceneId, variantIndex) {
  return `${sceneId}-video-${variantIndex + 1}`;
}

function buildReferenceMotionNote(project, scene, approvedImage) {
  const anchors = selectSceneReferenceAnchors(project, {
    sceneText: scene?.narration || "",
    visualIntent: approvedImage?.prompt || scene?.visualIntent || "",
    maxItems: 4,
  });

  if (anchors.length === 0) {
    return "";
  }

  return ` Preserve continuity with these image references when relevant: ${buildReferenceDirective(anchors)}.`;
}

function runVideoPromptAgent({ scene, project, count = 3 }) {
  const approvedImage = (scene.imageVariants || []).find((variant) => variant.id === scene.approvedImageId);
  const isSlideshow = (project.type || "").toLowerCase().includes("slideshow");
  const referenceNote = buildReferenceMotionNote(project, scene, approvedImage);

  // Contexte combiné de la scène (narration du script + image approuvée)
  const textContext = `${scene.narration || ""} ${approvedImage?.prompt || scene.visualIntent || ""}`;
  const inferred = analyzeCinematicContext(textContext);

  const variants = Array.from({ length: count }, (_, index) => {
    const variantMotion = index === 1 ? "orbit pan" : index === 2 ? "static locked-off" : inferred.motion;
    const variant = {
      id: createVideoVariantId(scene.id, index),
      variantIndex: index + 1,
      status: "pending",
      engine: project.settings?.videoAgentModel || "kling-3.0",
      motion: isSlideshow ? "gentle parallax" : variantMotion,
      energy: inferred.energy,
      previewTitle: isSlideshow ? `Motion ${index + 1}` : `Clip ${index + 1}`,
      prompt: isSlideshow
        ? `Animate the slide. Presentation style: ${inferred.energy}. Gentle movement. Base visual: ${approvedImage?.prompt || scene.visualIntent}.${referenceNote}`
        : `Animate this scene. Framing: ${inferred.framing}. Subject action: ${inferred.action}. Camera motion: ${variantMotion}. Energy: ${inferred.energy}. Base visual: ${approvedImage?.prompt || scene.visualIntent}.${referenceNote}`,
    };

    return {
      ...variant,
      productionMotion: buildMotionVideoHandoff({
        scene,
        project,
        variant,
        approvedImage,
      }),
    };
  });

  return createStructuredAgentResult({
    agent: "videoPromptAgent",
    schema: "cosyl.video-prompts.v1",
    model: project.settings?.videoAgentModel || "structured-video-agent",
    output: {
      variants,
    },
    validate: validateVideoPromptOutput,
    production: {
      schema: "05-motion-video.schema.json",
      outputs: variants.map((variant) => variant.productionMotion.output),
    },
  });
}

module.exports = {
  runVideoPromptAgent,
};

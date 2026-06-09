const {
  createStructuredAgentResult,
  validateVideoPromptOutput,
} = require("./contracts");
const { buildMotionVideoHandoff } = require("./productionHandoff");
const { buildReferenceDirective, selectSceneReferenceAnchors } = require("./referenceAnchors");
const {
  findMatchingMotionGraphicRef,
  buildMotionGraphicVideoPrompt,
  getMotionGraphicVariantStyles,
  detectMotionGraphicType,
} = require("./motionGraphic");

function analyzeCinematicContext(textContext) {
  const normalized = textContext.toLowerCase();
  
  // Défaut
  let motion = "slow push-in";
  let energy = "cinematic";
  let action = "natural ambient movement";
  let framing = "medium shot";

  // Analyse Mouvement de Caméra (EN + FR)
  if (normalized.match(/(sky|fly|bird|drone|above|high|ciel|voler|oiseau|drone|au-dessus|haut)/)) motion = "aerial drone pull-away";
  else if (normalized.match(/(run|fast|speed|chase|dynamic|action|courir|rapide|vitesse|poursuite|dynamique)/)) motion = "fast tracking shot";
  else if (normalized.match(/(walk|follow|behind|marcher|suivre|derri[èe]re)/)) motion = "tracking follow shot";
  else if (normalized.match(/(face|eyes|look|portrait|character|visage|yeux|regard|portrait|personnage)/)) motion = "subtle parallax zoom";
  else if (normalized.match(/(wide|landscape|city|world|large|paysage|ville|monde)/)) motion = "slow horizontal pan";

  // Analyse Énergie (EN + FR)
  if (normalized.match(/(peace|calm|quiet|slow|steady|nature|paix|calme|lent|posé|nature|sérénité)/)) energy = "calm";
  else if (normalized.match(/(epic|dramatic|grand|huge|épique|dramatique|grand|immense)/)) energy = "cinematic";
  else if (normalized.match(/(bold|modern|tech|fashion|audacieux|moderne|tech|mode)/)) energy = "editorial";
  else if (normalized.match(/(fight|crash|jump|burst|combat|choc|saut|explosion)/)) energy = "punchy";

  // Analyse Action du Sujet (EN + FR)
  if (normalized.match(/(speak|talk|say|parle|parler|dit)/)) action = "subject speaking naturally";
  else if (normalized.match(/(look|stare|watch|regarde|fixe|observe)/)) action = "subject looking directly at the camera";
  else if (normalized.match(/(walk|run|move|marche|court|bouge|déplace)/)) action = "subject moving across the frame";
  else if (normalized.match(/(wind|breeze|blow|vent|brise|souffle)/)) action = "hair and clothing blowing gently in the wind";

  // Cadrage (EN + FR)
  if (normalized.match(/(close up|detail|face|eyes|gros plan|détail|visage|yeux)/)) framing = "extreme close-up";
  else if (normalized.match(/(wide|landscape|panorama|large|paysage|panorama)/)) framing = "wide establishing shot";

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

// Motion-graphic detection and prompt building are provided by ./motionGraphic.

// Budget note: 2 variants per scene keeps generation cost low while still
// offering a "safe" and a "creative" option for manual editing workflows.
function runVideoPromptAgent({ scene, project, count = 2 }) {
  const approvedImage = (scene.imageVariants || []).find((variant) => variant.id === scene.approvedImageId);
  const isSlideshow = (project.type || "").toLowerCase().includes("slideshow");
  const referenceNote = buildReferenceMotionNote(project, scene, approvedImage);

  // Motion-graphic override: when a motion-graphic reference matches this scene
  // (geo→map, stats→data, dates→timeline, process→diagram, or name tokens),
  // generate type-specific animation variants instead of cinematic defaults.
  const mgRef = findMatchingMotionGraphicRef(scene, project);

  // Contexte combiné de la scène : narration + image approuvée + signaux
  // utilisateur agnostiques à la langue (emotion/tone + visualStyle) pour que
  // l'analyse reste pertinente même quand la narration n'est pas en anglais.
  const textContext = [
    scene.narration || "",
    approvedImage?.prompt || scene.visualIntent || "",
    scene.emotion || project.settings?.tone || "",
    project.settings?.visualStyle || "",
  ].join(" ");
  const inferred = analyzeCinematicContext(textContext);

  // Get motion from previous scene to avoid back-to-back repetitions
  const currentIndex = Array.isArray(project.scenes) ? project.scenes.findIndex((s) => s.id === scene.id) : -1;
  const previousScene = currentIndex > 0 ? project.scenes[currentIndex - 1] : null;
  let previousMotion = "";
  if (previousScene) {
    const prevApprovedVideo = (previousScene.videoVariants || []).find(v => v.id === previousScene.approvedVideoId);
    if (prevApprovedVideo) {
      previousMotion = prevApprovedVideo.motion;
    } else if (previousScene.videoVariants?.[0]) {
      previousMotion = previousScene.videoVariants[0].motion;
    }
  }

  // Adjust motion if it collides with previous motion (standard scenes only)
  let primaryMotion = inferred.motion;
  if (!mgRef && primaryMotion === previousMotion) {
    if (primaryMotion === "slow push-in") primaryMotion = "slow horizontal pan";
    else if (primaryMotion === "slow horizontal pan") primaryMotion = "subtle parallax zoom";
    else primaryMotion = "slow push-in";
  }

  // Speed ramping / Timing notes based on energy
  let timingNote = "linear steady pace";
  if (inferred.energy === "punchy" || inferred.energy === "high-energy") {
    timingNote = "dynamic acceleration ramp, fast motion";
  } else if (inferred.energy === "calm") {
    timingNote = "ultra slow speed, dreamlike ambient flow";
  }

  // Motion-graphic: when a motion-graphic reference matches the scene,
  // the module provides 2 type-specific variants (Flyover/Reveal for maps,
  // Counter/Chart for data, Scroll/Zoom for timelines, Build/Flow for diagrams).
  const mgVariantStyles = mgRef
    ? getMotionGraphicVariantStyles(detectMotionGraphicType(mgRef.name || ""))
    : null;

  // Variant 0 — "Signature" (primary inferred motion, safe and polished)
  // Variant 1 — "Dynamic" (contrasting motion, more editorial energy)
  // Both are built to be directly usable in Capcut / DaVinci / After Effects without
  // further post-processing, so prompts are as rich and explicit as possible.
  const VARIANT_STYLES = [
    {
      label: "Signature",
      motion: primaryMotion,
      description: "Polished, on-brand motion aligned with the scene's visual identity",
    },
    {
      label: "Dynamic",
      motion: primaryMotion === "slow push-in" ? "fast tracking shot"
            : primaryMotion === "fast tracking shot" ? "subtle parallax zoom"
            : primaryMotion === "slow horizontal pan" ? "orbit pan"
            : "slow push-in",
      description: "Higher-energy alternative, bolder editorial cut for maximum impact",
    },
  ];

  const variants = Array.from({ length: count }, (_, index) => {
    // Motion-graphic scenes get type-specific variants (map, data, timeline, diagram…).
    if (mgRef && mgVariantStyles) {
      const mgStyle = mgVariantStyles[index] || mgVariantStyles[0];
      const duration = scene.duration ? `${scene.duration}s` : null;
      const richPrompt = buildMotionGraphicVideoPrompt(scene, mgRef, mgStyle.label, duration);
      const mgType = detectMotionGraphicType(mgRef.name || "");
      const variant = {
        id: createVideoVariantId(scene.id, index),
        variantIndex: index + 1,
        status: "pending",
        engine: project.settings?.videoAgentModel || "kling-3.0",
        motion: mgStyle.motion,
        energy: "cinematic",
        previewTitle: `${mgType.charAt(0).toUpperCase() + mgType.slice(1)} ${mgStyle.label}`,
        prompt: richPrompt,
      };
      return {
        ...variant,
        productionMotion: buildMotionVideoHandoff({ scene, project, variant, approvedImage }),
      };
    }

    const style = VARIANT_STYLES[index] || VARIANT_STYLES[0];
    const variantMotion = isSlideshow ? "gentle parallax" : style.motion;

    // Rich, production-ready prompt designed to output premium footage that
    // can be directly imported into a NLE (Capcut / DaVinci / After Effects).
    const baseVisual = approvedImage?.prompt || scene.visualIntent || "";
    const sceneSubject = project.title || project.goal || "the main subject";
    const projectStyle = project.settings?.visualStyle || "cinematic realism";
    const duration = scene.duration ? `${scene.duration}s clip` : "5-8s clip";

    const richPrompt = isSlideshow
      ? [
          `SLIDE ANIMATION — ${style.label} variant.`,
          `Style: ${projectStyle}. Energy: ${inferred.energy}. Motion: ${variantMotion}. Timing: ${timingNote}.`,
          `Base visual: ${baseVisual}.`,
          referenceNote,
          `Output spec: ${duration}, presentation-ready, smooth easing, legible text areas untouched.`,
          `AUDIO: Silent clip only — no audio, no sound, no music, no speech, no sound effects (the soundtrack is produced and mixed separately).`,
          `CORE DIRECTIVE: Lock onto Visual Continuity Indices (lighting, anchor objects, core subject) from the approved image. Preserve structural coherence and environment geometry throughout the animation.`,
        ].filter(Boolean).join(" ")
      : [
          `SCENE VIDEO — ${style.label} variant. ${style.description}.`,
          `Subject: ${sceneSubject}. Scene narration context: "${scene.narration?.slice(0, 100) || ""}".`,
          `Visual style: ${projectStyle}. Framing: ${inferred.framing}. Subject action: ${inferred.action}.`,
          `Camera motion: ${variantMotion} — executed with precise, cinematic control (no handheld shake unless energy=punchy).`,
          `Energy: ${inferred.energy}. Timing: ${timingNote}. Lighting: preserve the approved image's ${approvedImage?.prompt ? "established" : "natural"} lighting scheme.`,
          `Base visual (approved image to animate): ${baseVisual}.`,
          referenceNote,
          `Output spec: ${duration}, photorealistic, ultra-detailed, 4K-ready composition, color-graded for direct NLE import (Capcut / DaVinci / After Effects). No watermarks, no overlays.`,
          `AUDIO: Silent footage only — no audio, no sound, no music, no speech, no voice, no sound effects (the soundtrack is produced and mixed separately at compose time).`,
          `CORE DIRECTIVE: Lock onto Visual Continuity Indices (lighting, anchor objects, core subject identity) from the base image. Do NOT reinvent the environment, subject appearance, or color palette — animate faithfully within the established visual world.`,
        ].filter(Boolean).join(" ");

    const variant = {
      id: createVideoVariantId(scene.id, index),
      variantIndex: index + 1,
      status: "pending",
      engine: project.settings?.videoAgentModel || "kling-3.0",
      motion: variantMotion,
      energy: inferred.energy,
      previewTitle: isSlideshow ? `Slide Motion ${index + 1}` : `${style.label} Clip`,
      prompt: richPrompt,
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
    // Deterministic rule-based agent (no LLM call) → the producer is the agent itself.
    // (The downstream generation engine lives in each variant's `engine` field.)
    model: "structured-video-agent",
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

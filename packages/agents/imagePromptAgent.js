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

function analyzeImageStyle(scene, project, variantIndex) {
  const text = `${scene.narration || ""} ${scene.visualIntent || ""}`.toLowerCase();
  const settings = project.settings || {};
  const visualStyle = (settings.visualStyle || "").toLowerCase();
  
  // 1. Determine palette
  let selectedPalette = null;
  if (visualStyle.includes("violet") || visualStyle.includes("purple")) selectedPalette = "violet";
  else if (visualStyle.includes("cyan") || visualStyle.includes("blue")) selectedPalette = "cyan";
  else if (visualStyle.includes("gold") || visualStyle.includes("amber") || visualStyle.includes("yellow")) selectedPalette = "amber";
  else if (visualStyle.includes("green") || visualStyle.includes("emerald")) selectedPalette = "emerald";
  else if (visualStyle.includes("rose") || visualStyle.includes("pink") || visualStyle.includes("red")) selectedPalette = "rose";

  if (!selectedPalette) {
    if (text.match(/(grow|money|finance|success|green|nature|forest|eco|wealth|argent|finance|richesse|nature|for[êe]t|[ée]colo|croissance)/)) {
      selectedPalette = "emerald";
    } else if (text.match(/(fire|warmth|sun|desert|gold|warning|alert|danger|feu|soleil|chaleur|or|d[ée]sert|alerte|danger)/)) {
      selectedPalette = "amber";
    } else if (text.match(/(tech|future|digital|space|cool|ocean|water|sky|futur|num[ée]rique|espace|oc[ée]an|eau|ciel)/)) {
      selectedPalette = "cyan";
    } else if (text.match(/(love|passion|human|emotion|art|design|amour|passion|humain|[ée]motion|art)/)) {
      selectedPalette = "rose";
    } else {
      selectedPalette = palettes[variantIndex % palettes.length];
    }
  }

  // 2. Determine shot
  let selectedShot = null;
  if (visualStyle.includes("close-up") || visualStyle.includes("portrait")) selectedShot = "close portrait";
  else if (visualStyle.includes("wide") || visualStyle.includes("landscape")) selectedShot = "wide frame";

  if (!selectedShot) {
    if (text.match(/(face|eyes|look|person|feel|emotion|sad|happy|visage|yeux|regard|personne|[ée]motion|triste|heureux)/)) {
      selectedShot = "close portrait";
    } else if (text.match(/(city|world|sky|landscape|view|panoramic|space|ville|monde|ciel|paysage|vue|panoramique|espace)/)) {
      selectedShot = "wide frame";
    } else if (text.match(/(map|diagram|concept|chart|flatlay|carte|sch[ée]ma|graphique|diagramme)/)) {
      selectedShot = "cinematic overhead";
    } else {
      selectedShot = shots[variantIndex % shots.length];
    }
  }

  // 3. Determine mood
  let selectedMood = null;
  const tone = (scene.emotion || settings.tone || "").toLowerCase();
  if (tone.includes("dramatic") || tone.includes("dark")) selectedMood = "dramatic";
  else if (tone.includes("clean") || tone.includes("minimal")) selectedMood = "clean";
  else if (tone.includes("premium") || tone.includes("luxurious")) selectedMood = "premium";
  else if (tone.includes("energetic") || tone.includes("bold")) selectedMood = "high-energy";

  if (!selectedMood) {
    if (text.match(/(dark|secret|mystery|shadow|grave|heavy|sombre|secret|myst[èe]re|ombre|grave|lourd)/)) {
      selectedMood = "dramatic";
    } else if (text.match(/(simple|plain|clear|easy|simple|clair|facile|[ée]pur[ée])/)) {
      selectedMood = "clean";
    } else if (text.match(/(gold|exclusive|high-end|luxury|executive|or|exclusif|luxe|premium|haut de gamme)/)) {
      selectedMood = "premium";
    } else if (text.match(/(fast|dynamic|power|explode|launch|run|rapide|dynamique|puissance|explose|lance|cours)/)) {
      selectedMood = "high-energy";
    } else {
      selectedMood = moods[variantIndex % moods.length];
    }
  }

  return { palette: selectedPalette, shot: selectedShot, mood: selectedMood };
}

// Shared premium quality layer — concept-art grade, clean and render-faithful.
const CINEMATIC_QUALITY =
  "ultra-detailed, sharp focus, professional concept-art quality, cohesive art direction, believable materials and depth, no text, no watermark, no logo";

// Composition guidance derived from the chosen shot.
function buildCompositionNote(shot = "") {
  const s = shot.toLowerCase();
  if (s.includes("close") || s.includes("portrait")) {
    return "tight framing on the subject, shallow depth of field, expressive detail, strong subject-to-background separation";
  }
  if (s.includes("wide")) {
    return "wide establishing composition with clear foreground, midground and background layering and a strong sense of scale";
  }
  if (s.includes("overhead")) {
    return "elevated top-down composition, clean graphic layout, balanced negative space";
  }
  return "balanced cinematic composition using the rule of thirds with deliberate depth layering";
}

// Scene-to-scene continuity: from the 2nd scene onward, tell the model to keep
// the sequence coherent with the previous beat (recurring subjects, same world,
// consistent lighting/time progression) — what makes a film feel continuous.
function buildSequenceContinuityNote(scene, project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const index = scenes.findIndex((s) => s && s.id === scene.id);
  if (index <= 0) {
    return ""; // first scene (or standalone) — nothing to carry over
  }
  return "Maintain visual continuity with the previous scene: keep recurring characters, key objects and the environment consistent, with a coherent lighting and time-of-day progression so the sequence reads as one continuous film.";
}

// Lighting guidance derived from the mood.
function buildLightingNote(mood = "") {
  if (mood === "dramatic") return "dramatic high-contrast lighting, directional key light, deep shadows and a cinematic rim light";
  if (mood === "clean") return "soft even lighting, gentle contrast and a clean minimal atmosphere";
  if (mood === "premium") return "polished studio-grade lighting, controlled highlights and rich but restrained contrast";
  if (mood === "high-energy") return "bold dynamic lighting, vivid highlights and an energetic atmosphere";
  return "natural cinematic lighting with believable light direction and soft falloff";
}

// Give each variant a genuinely DIFFERENT framing so the 3 options are real
// art-director choices (variant 0 = best-fit shot, 1+ = distinct alternatives),
// while the locked palette/style stays consistent across all variants.
const SHOT_ALTERNATIVES = ["wide frame", "editorial mid-shot", "close portrait", "cinematic overhead"];

function pickVariantShot(analyzedShot, variantIndex) {
  if (variantIndex === 0) return analyzedShot;
  const others = SHOT_ALTERNATIVES.filter((s) => s !== analyzedShot);
  return others[(variantIndex - 1) % others.length];
}

function buildVariantPrompt(scene, project, variantIndex) {
  const isSlideshow = (project.type || "").toLowerCase().includes("slideshow");
  const referenceNote = buildReferencePromptNote(project, scene);
  const continuityNote = buildSequenceContinuityNote(scene, project);

  const analyzed = analyzeImageStyle(scene, project, variantIndex);
  const palette = analyzed.palette;
  const shot = isSlideshow
    ? ["clean slide layout", "split-screen slide", "diagram slide", "text-led hero slide"][variantIndex % 4]
    : pickVariantShot(analyzed.shot, variantIndex);
  const mood = isSlideshow
    ? ["clear", "editorial", "premium", "educational"][variantIndex % 4]
    : analyzed.mood;

  return {
    id: createImageVariantId(scene.id, variantIndex),
    variantIndex: variantIndex + 1,
    status: "pending",
    palette,
    shot,
    mood,
    previewTitle: isSlideshow ? `Slide ${variantIndex + 1}` : `Variant ${variantIndex + 1}`,
    prompt: isSlideshow
      ? `${scene.visualIntent} Design a ${mood} ${shot} with presentation clarity: strong visual hierarchy, generous negative space, an aligned grid and a ${palette} color accent for a polished editorial finish. Locked project style: ${project.settings?.visualStyle || "consistent branded visuals"}. ${referenceNote} ${continuityNote} ${CINEMATIC_QUALITY}. CORE DIRECTIVE: end the prompt with explicit Visual Continuity Indices — Lighting, Anchor Objects, Core Subject — so the Video Agent can lock onto them.`
      : `${scene.visualIntent} Render as a ${mood} ${shot}: ${buildCompositionNote(shot)}. ${buildLightingNote(mood)}, with a ${palette} color accent and a cohesive cinematic color grade. Locked project style: ${project.settings?.visualStyle || "consistent branded visuals"}. ${referenceNote} ${continuityNote} ${CINEMATIC_QUALITY}. CORE DIRECTIVE: end the prompt with explicit Visual Continuity Indices — Lighting, Anchor Objects, Core Subject — so the Video Agent can lock onto them.`,
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
    // Deterministic rule-based agent (no LLM call) → the producer is the agent itself.
    model: "structured-image-agent",
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

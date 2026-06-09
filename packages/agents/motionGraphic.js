/**
 * Motion Graphic reference engine
 * ─────────────────────────────────────────────────────────────────────────────
 * When the user uploads a motion-graphic reference in Editor LAB, the system
 * must decide:
 *  1. WHAT kind of motion graphic it is (type detection from the reference name)
 *  2. WHEN to activate it (scene content matching per type)
 *  3. HOW to prompt for it (type-aware image + video prompts)
 *
 * Types:
 *   map       → animated geographic / cartographic visualization
 *   data      → animated stats, counters, charts, infographics
 *   timeline  → animated chronological / historical sequence
 *   diagram   → animated process, flow, system or step diagram
 *   profile   → character dossier / intelligence file card (portrait + career
 *               list + panels). Structure: framed card, name label, descriptor
 *               tags, animated detail build. Visual style is driven entirely by
 *               the uploaded reference — no default palette or texture assumed.
 *   generic   → any other motion graphic — matched via token overlap
 *
 * The reference NAME is the primary signal for type detection — the user
 * should name their references descriptively ("animated-map", "stats-counter",
 * "process-diagram"). If the name is generic, falls back to token matching.
 */

"use strict";

// ── Geo-location extraction (used for map-type matching) ──────────────────────
// Captures capitalized proper-noun sequences preceded by geographic prepositions
// (EN + FR). Stops at the first lowercase word to avoid dragging in the rest of
// the sentence (e.g. "au Cameroun qui a tout" → "Cameroun").

const GEO_PREP_PATTERN =
  /\b(?:in|at|from|to|near|across|through|into|over|above|around|dans|en|au|aux|à|de|vers|sur|par)\s+([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][A-Za-zÀ-ÖØ-öø-ÿ\-']+(?:,?\s+[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][A-Za-zÀ-ÖØ-öø-ÿ\-']+){0,4})/g;

const GEO_STANDALONE_PATTERN =
  /\b(Africa|Europe|Asia|Americas?|Australia|Océanie|Middle East|Moyen[- ]Orient|Sub[- ]Saharan|Sahara|Sahel)\b/i;

function extractGeoLocation(narration) {
  const text = String(narration || "");
  GEO_PREP_PATTERN.lastIndex = 0;
  const prepMatch = GEO_PREP_PATTERN.exec(text);
  if (prepMatch) return prepMatch[1].replace(/[,\s]+$/, "").trim();
  const standaloneMatch = text.match(GEO_STANDALONE_PATTERN);
  if (standaloneMatch) return standaloneMatch[0];
  return null;
}

// ── Type detection ─────────────────────────────────────────────────────────────
// Infers the motion graphic type from the reference name + description.
// The user should name references descriptively — "animated-map", "data-chart",
// "process-flow", etc. Type drives both the scene-matching signal and the prompt.

const MG_TYPE_PATTERNS = [
  {
    // Profile / dossier FIRST — must win over "data" when name contains
    // "dossier-infographic", "historical-profile", "character-dossier", etc.
    type: "profile",
    pattern: /dossier|profil(?:e|ing)?|fiche|fichier|character.*card|portrait.*card|bio(?:graphy|graphie)?|persona|criminal.*profile|historical.*profile|intel.*card|intelligence.*file/i,
  },
  {
    type: "map",
    pattern: /map|carte|geographic|geo|location|pays|ville|country|city|territoire|region|atlas|world|globe/i,
  },
  {
    type: "data",
    pattern: /chart|graph|stat|data|percent|counter|infograph|metric|kpi|gauge|bar|pie|donut|number|chiffre|compte|compteur/i,
  },
  {
    type: "timeline",
    pattern: /timeline|chronolog|history|date|epoch|period|historical|annee|année|decade|siècle|century|sequence|chronos/i,
  },
  {
    type: "diagram",
    pattern: /diagram|schema|process|flow|workflow|step|etape|étape|funnel|cycle|system|architecture|organigramme/i,
  },
];

/**
 * Returns "map" | "data" | "timeline" | "diagram" | "profile" | "generic"
 */
function detectMotionGraphicType(referenceName) {
  const name = String(referenceName || "");
  for (const { type, pattern } of MG_TYPE_PATTERNS) {
    if (pattern.test(name)) return type;
  }
  return "generic";
}

// ── Scene signal extraction ────────────────────────────────────────────────────
// Per-type tests against the scene's narration text.

function sceneHasStats(narration) {
  return /\d+\s*[%x]|\b\d{1,3}(?:[.,]\d+)*\s*(?:million|billion|thousand|k)\b|\b(?:percent|statistics|statistic|figures?|data|rate|ratio|nombre|chiffre|taux|proportion)\b/i
    .test(narration);
}

function sceneHasDate(narration) {
  return /\b(?:in\s+\d{4}|\d{4}\s*(?:s|es)?|\d+\s*(?:years?|months?|decades?|centuries|siècles?|ans?|années?)\s*(?:ago|later|avant|après|more)?|history|historical|century|decade|siècle)\b/i
    .test(narration);
}

function sceneHasProcess(narration) {
  return /\b(?:process|step|stage|phase|how(?:\s+it)?\s+works?|system|flow|method|approach|mechanism|étape|processus|étapes|fonctionnement|comment)\b/i
    .test(narration);
}

// Profile: scene mentions a person by name (multi-word proper noun that is NOT
// a geographic location). When the user uploads a "character-dossier" reference
// they've already expressed intent — we just need a named subject in the scene
// to know which person to profile. No bio-keyword checklist required.
function sceneHasPersonProfile(narration) {
  const text = String(narration || "");

  // A multi-word capitalized sequence — at least two capitalized words.
  // We exclude pure geo-location patterns (preceded by spatial prepositions)
  // to avoid false-positives like "in Paris, France".
  const multiWordNamePattern =
    /(?<![iI]n |[aA]t |[fF]rom |[tT]o |[nN]ear |dans |en |au |à )\b([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][a-zàâäéèêëîïôùûüç\-']{1,}(?:\s+(?:de\s+|the\s+|of\s+|el\s+|al\s+)?[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][a-zàâäéèêëîïôùûüç\-']{1,}){1,4})\b/;

  return multiWordNamePattern.test(text);
}

// Simple tokenizer (matches referenceAnchors.js / assets.js)
function tokenizeForMatch(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3);
}

/**
 * Returns true when the scene's content signals a match for the motion graphic
 * reference's type. Each type uses its own heuristic:
 *   map      → scene has a geo-location (city / country / region)
 *   data     → scene mentions statistics, numbers, percentages, counters
 *   timeline → scene mentions dates, years, historical periods
 *   diagram  → scene describes a process, steps, system or workflow
 *   generic  → scene tokens overlap with the reference's name tokens
 */
function doesSceneMatchMotionGraphic(scene, reference) {
  const type = detectMotionGraphicType(reference?.name || "");
  const narration = String(scene?.narration || "");

  switch (type) {
    case "map":
      // Re-extract on the fly if scene.geoLocation wasn't set (e.g. old data).
      return (
        (typeof scene?.geoLocation === "string" && scene.geoLocation.trim().length > 0) ||
        extractGeoLocation(narration) !== null
      );

    case "data":
      return sceneHasStats(narration);

    case "timeline":
      return sceneHasDate(narration);

    case "diagram":
      return sceneHasProcess(narration);

    case "profile":
      return sceneHasPersonProfile(narration);

    default: {
      // Generic: require at least one name token present in the scene text.
      const refTokens = tokenizeForMatch(reference?.name || "");
      const sceneTokens = new Set([
        ...tokenizeForMatch(narration),
        ...tokenizeForMatch(scene?.visualIntent || ""),
      ]);
      return refTokens.some((t) => sceneTokens.has(t));
    }
  }
}

/**
 * Returns the first motion-graphic reference from the project that matches the
 * current scene, or null if none match. Used to gate the override path.
 */
function findMatchingMotionGraphicRef(scene, project) {
  const refs = Array.isArray(project?.references) ? project.references : [];
  const mgRefs = refs.filter((r) => r?.label === "motion-graphic");
  if (mgRefs.length === 0) return null;
  return mgRefs.find((ref) => doesSceneMatchMotionGraphic(scene, ref)) ?? null;
}

// ── Subject extraction ─────────────────────────────────────────────────────────
// Extracts the "subject" for the motion graphic based on scene + type.
// This is what appears in the generated prompt (e.g. "Paris, France" for maps,
// "47%" for data, "1994" for timeline).

function extractSceneSubjectForType(scene, type) {
  const narration = String(scene?.narration || "");

  if (type === "map") {
    return (
      (typeof scene?.geoLocation === "string" && scene.geoLocation.trim()) ||
      extractGeoLocation(narration) ||
      "the location mentioned in the script"
    );
  }

  if (type === "data") {
    // Capture the most prominent stat/number in the narration.
    const match = narration.match(/(\d[\d.,]*\s*(?:%|million|billion|thousand|k)?)/i);
    return match ? match[1].trim() : "the key statistic";
  }

  if (type === "timeline") {
    // Capture a year or period.
    const match = narration.match(/\b(\d{4}|\d+\s*(?:years?|decades?|centuries|siècles?)(?:\s*ago)?)\b/i);
    return match ? match[1].trim() : "the historical period";
  }

  if (type === "diagram") {
    return "the process described in the script";
  }

  if (type === "profile") {
    // Try to pull the person's name from the narration — first multi-word proper
    // noun sequence (e.g. "Julius Caesar", "Napoleon Bonaparte").
    const nameMatch = narration.match(
      /\b([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][a-zàâäéèêëîïôùûüç]+(?:\s+(?:de\s+|the\s+|of\s+)?[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][a-zàâäéèêëîïôùûüç]+)+)\b/,
    );
    return nameMatch ? nameMatch[1] : "the historical figure";
  }

  return "the subject described in the script";
}

// ── Prompt builders ────────────────────────────────────────────────────────────

const TYPE_IMAGE_TEMPLATES = {
  map: (subject, styleBrief) =>
    [
      `Motion graphic map visualization of ${subject}.`,
      "Animated cartographic design: clean geographic map with the target region highlighted,",
      "smooth zoom/flyover framing centered on the location, stylized terrain or urban boundaries,",
      "place name label or marker pin, motion-design aesthetic with elegant animation cues.",
      "No photorealistic photography — this is a graphic / illustrated map visual.",
      styleBrief ? `Style reference: ${styleBrief.slice(0, 300)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),

  data: (subject, styleBrief) =>
    [
      `Motion graphic data visualization featuring ${subject}.`,
      "Animated infographic style: bold numbers or charts (bar, counter, gauge or pie),",
      "clean minimal design, strong typographic hierarchy, data points animating in with motion.",
      "No photorealistic photography — this is a graphic / illustrated data visual.",
      styleBrief ? `Style reference: ${styleBrief.slice(0, 300)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),

  timeline: (subject, styleBrief) =>
    [
      `Motion graphic timeline visualization of ${subject}.`,
      "Animated chronological design: horizontal or vertical timeline, dates and events",
      "appearing with smooth motion, clean typographic markers, editorial design aesthetic.",
      "No photorealistic photography — this is a graphic / illustrated timeline visual.",
      styleBrief ? `Style reference: ${styleBrief.slice(0, 300)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),

  diagram: (subject, styleBrief) =>
    [
      `Motion graphic process diagram visualizing ${subject}.`,
      "Animated flow design: steps or nodes connected by animated arrows,",
      "clean flat or line-art style, labels appearing with staggered motion, editorial clarity.",
      "No photorealistic photography — this is a graphic / illustrated diagram visual.",
      styleBrief ? `Style reference: ${styleBrief.slice(0, 300)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),

  profile: (subject, styleBrief) =>
    [
      `Character profile dossier card for ${subject}.`,
      // Structure (layout/composition — visual style comes from the reference)
      "CARD STRUCTURE: a framed character card, centered or left-anchored.",
      "The card contains: a portrait of the subject (illustration, engraving, painting or photo-collage",
      "depending on the project's visual style), a name label at the top, and a short descriptor tag below.",
      "To the right: a bordered information panel with a section title and a list of key facts,",
      "dates or career milestones beginning to appear.",
      // Style is driven entirely by the project/reference — no hardcoded palette
      "VISUAL STYLE: match the reference style exactly.",
      "The background texture, color palette, typography, border treatment and overall aesthetic",
      "must follow the uploaded reference and the project's visual style — do NOT default to any",
      "specific look (dark/light, color/monochrome, vintage/modern) unless the reference dictates it.",
      "No photorealism unless the reference is photorealistic.",
      styleBrief ? `LOCKED STYLE DIRECTIVE from reference analysis: ${styleBrief.slice(0, 400)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),

  generic: (subject, styleBrief, refName) =>
    [
      `Motion graphic visualization — ${refName || "custom motion graphic"} style — depicting ${subject}.`,
      "Clean, editorial motion-design aesthetic, shapes and elements animating in,",
      "bold graphic treatment, strong visual identity matching the reference style.",
      "No photorealistic photography — this is a graphic / illustrated motion visual.",
      styleBrief ? `Style reference: ${styleBrief.slice(0, 300)}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
};

/**
 * Builds the image generation prompt for a motion-graphic scene.
 * @param {object} scene  — scene object (narration, geoLocation…)
 * @param {object} mgRef  — the matched motion-graphic reference
 * @param {string} styleBrief — optional reverse-engineered style brief
 */
function buildMotionGraphicImagePrompt(scene, mgRef, styleBrief = "") {
  const type = detectMotionGraphicType(mgRef?.name || "");
  const subject = extractSceneSubjectForType(scene, type);
  const builder = TYPE_IMAGE_TEMPLATES[type] || TYPE_IMAGE_TEMPLATES.generic;
  return builder(subject, styleBrief, mgRef?.name || "");
}

// Video variant labels + motion per type
const MG_VIDEO_VARIANTS = {
  map: [
    {
      label: "Flyover",
      motion: "map zoom flyover",
      description: (subject) =>
        `Smooth aerial zoom-in from country/continent level to ${subject}, easing deceleration as the target fills the frame. Clean cartographic design.`,
    },
    {
      label: "Reveal",
      motion: "map pan reveal",
      description: (subject) =>
        `Slow horizontal pan across the map, settling on ${subject} with an animated location label or callout fading in. Editorial cartographic style.`,
    },
  ],
  data: [
    {
      label: "Counter",
      motion: "data counter animate",
      description: (subject) =>
        `Animated counter or chart filling/rolling up to ${subject}. Bold typographic treatment, clean minimal background, numbers animate with easing.`,
    },
    {
      label: "Chart",
      motion: "data chart build",
      description: (subject) =>
        `Bar or pie chart building up to ${subject} with staggered bar animation, smooth easing, clean data-viz aesthetic.`,
    },
  ],
  timeline: [
    {
      label: "Scroll",
      motion: "timeline scroll",
      description: (subject) =>
        `Horizontal timeline scrolling to highlight ${subject}, events and dates appearing with fade-in motion, clean editorial design.`,
    },
    {
      label: "Zoom",
      motion: "timeline zoom",
      description: (subject) =>
        `Camera zooms into the ${subject} period on the timeline, surrounding context blurring out, focal point label animating in.`,
    },
  ],
  diagram: [
    {
      label: "Build",
      motion: "diagram node build",
      description: () =>
        "Process nodes and connectors appearing one-by-one with staggered animation, arrows drawing in, labels fading up. Clean flat design.",
    },
    {
      label: "Flow",
      motion: "diagram flow animate",
      description: () =>
        "Animated arrows and flow lines traveling through the diagram, highlighting each step in sequence. Motion-design editorial aesthetic.",
    },
  ],
  profile: [
    {
      label: "Card Drop",
      motion: "dossier card drop",
      description: (subject) =>
        [
          `DOSSIER CARD DROP animation for ${subject}.`,
          // Motion / structure — style-agnostic
          "The character profile card SLIDES IN from the right with a slight rotation,",
          "then SNAPS to position with elastic easing — like a file being placed on a surface.",
          "The name label at the top animates in first (stamp or fade, matching reference style).",
          "The portrait of the subject fades or wipes in inside its frame.",
          "Below the portrait, a descriptor tag TYPES IN letter by letter (typewriter effect,",
          `cursor visible) — a short defining phrase about ${subject}.`,
          "The card border draws in last. Subtle background texture / grain matching the reference.",
          // Style: fully driven by the reference — NOT prescriptive
          "VISUAL STYLE: match the uploaded reference exactly — background, palette, typography,",
          "border treatment and overall aesthetic all follow the reference. Do not impose any",
          "default look (dark/light, color/monochrome, vintage/modern).",
          "No audio.",
        ].join(" "),
    },
    {
      label: "Panel Reveal",
      motion: "dossier panel expand",
      description: (subject) =>
        [
          `DOSSIER PANEL EXPAND animation for ${subject}.`,
          // Motion / structure — style-agnostic
          "The profile card is anchored on the left side of the frame.",
          "A thin divider line DRAWS OUTWARD from the card's right edge,",
          "then a bordered information panel expands to the right (border animates: top → right → bottom).",
          "Inside the panel: a section title fades in (uppercase, stencil or matching project font).",
          "Below the title, list items APPEAR ONE BY ONE from top to bottom —",
          "each entry: a bullet or dot, a title line, a subtitle or date below it.",
          "When items overflow the panel, the list SCROLLS UPWARD smoothly revealing more entries.",
          `All items relate to ${subject}'s biography, career, actions or key milestones.`,
          "Optionally: a second panel slides in further right showing a stylized map or visual",
          "representing the subject's geographic activity or reach.",
          // Style: fully driven by the reference
          "VISUAL STYLE: match the uploaded reference exactly — do not impose any default",
          "color scheme, background or typography. Follow the reference aesthetic throughout.",
          "No audio.",
        ].join(" "),
    },
  ],

  generic: [
    {
      label: "Appear",
      motion: "motion graphic appear",
      description: (subject, refName) =>
        `${refName || "Motion graphic"} elements animating in around ${subject}. Shapes, lines and labels appear with staggered motion-design easing.`,
    },
    {
      label: "Transition",
      motion: "motion graphic transition",
      description: (subject, refName) =>
        `${refName || "Motion graphic"} overlay transitioning in to represent ${subject}. Cross-dissolve with animated graphic elements, editorial motion-design.`,
    },
  ],
};

/**
 * Builds the video generation prompt for a motion-graphic scene.
 * @param {object} scene        — scene object
 * @param {object} mgRef        — matched motion-graphic reference
 * @param {string} variantLabel — "Flyover"|"Reveal"|"Counter"|"Chart"…
 * @param {string|null} duration — e.g. "6s" or null
 */
function buildMotionGraphicVideoPrompt(scene, mgRef, variantLabel, duration) {
  const type = detectMotionGraphicType(mgRef?.name || "");
  const subject = extractSceneSubjectForType(scene, type);
  const durationNote = duration ? `${duration} clip` : "5-8s clip";
  const variants = MG_VIDEO_VARIANTS[type] || MG_VIDEO_VARIANTS.generic;
  const variant = variants.find((v) => v.label === variantLabel) || variants[0];
  const refName = mgRef?.name || "motion graphic";

  return [
    `MOTION GRAPHIC VIDEO — ${type.toUpperCase()} / ${variant.label} variant.`,
    `Subject: ${subject}. Reference style: ${refName}.`,
    variant.description(subject, refName),
    `Output spec: ${durationNote}, motion-design quality, no watermarks, no overlays, no photorealism.`,
    "AUDIO: Silent footage only — no audio, no sound, no music, no speech, no sound effects (the soundtrack is produced and mixed separately).",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Returns the two video variant descriptors (label + motion) for a given
 * motion-graphic type. Used by videoPromptAgent to build the variant list.
 */
function getMotionGraphicVariantStyles(type) {
  return (MG_VIDEO_VARIANTS[type] || MG_VIDEO_VARIANTS.generic).slice(0, 2);
}

module.exports = {
  detectMotionGraphicType,
  doesSceneMatchMotionGraphic,
  findMatchingMotionGraphicRef,
  extractGeoLocation,
  buildMotionGraphicImagePrompt,
  buildMotionGraphicVideoPrompt,
  getMotionGraphicVariantStyles,
};

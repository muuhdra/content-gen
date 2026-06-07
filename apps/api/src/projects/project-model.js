/**
 * Project model layer — pure shape normalization, defaults, template application
 * and reference-signature comparison.
 *
 * No Express, no I/O. Everything here is deterministic transformation of project
 * data so the route handlers stay thin.
 */
const { randomUUID } = require("node:crypto");

const { MODEL_CONFIG } = require("@cosyl/config/models");
const { createTemplateSnapshot, getTemplateById } = require("@cosyl/config/templates");
const { PROJECT_STATUSES } = require("@cosyl/shared/types/production");
const { normalizeAssembly, defaultAssembly } = require("@cosyl/shared");
const { defaultCaptions, normalizeCaptions } = require("./caption-generator");

// ─── Audio readiness ──────────────────────────────────────────────────────────

function isMusicReady(audio = {}) {
  const mode = audio?.music?.mode || "auto";

  if (mode === "none") {
    return true;
  }

  if (mode === "uploaded") {
    return Array.isArray(audio?.music?.uploadedTracks)
      && audio.music.uploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0);
  }

  return audio?.music?.status === "generated";
}

function isNarrationReady(audio = {}) {
  const voiceId = audio?.narration?.voiceId || "";
  const status = audio?.narration?.status || "draft";

  if (voiceId === "custom-audio-upload") {
    return status === "uploaded"
      && typeof audio?.narration?.uploadedSource?.storagePath === "string"
      && audio.narration.uploadedSource.storagePath.length > 0;
  }

  return status === "generated";
}

function isSfxReady(audio = {}) {
  if (audio?.sfx?.enabled === false) {
    return true;
  }

  return audio?.sfx?.status === "generated";
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const defaultSettings = {
  scriptAgentModel: MODEL_CONFIG.script.default,
  imageAgentModel: MODEL_CONFIG.image.default,
  videoAgentModel: MODEL_CONFIG.video.default,
  voiceId: MODEL_CONFIG.voice.default,
  projectLanguage: "english",
  tone: "",
  narrationStyle: "",
  visualStyle: "",
  targetDuration: "Determined by script length",
  // "auto"   → AI assembles & renders the final video (full pipeline)
  // "manual" → outputs (images/videos/audio) are exported as individual files
  //             for manual editing in Capcut / DaVinci / After Effects / etc.
  assemblyMode: "auto",
  graphics: {
    enabled: true,
    focusedModuleId: "text-reveal",
    moduleState: {
      "text-reveal": true,
      "lower-third": false,
      "stat-counter": false,
    },
    variantState: {
      "text-reveal": "Viral",
      "lower-third": "Minimal",
      "stat-counter": "Burst",
    },
  },
  effects: {
    clipMode: "static",
    motionStyle: "vertical-pan",
    kenBurnsIntensity: "medium",
    hybridAnimateRatio: 0.4,
    moduleState: {
      "reactive-fx": true,
      "hook-effect": false,
      "video-ending": true,
    },
    videoEndingDuration: 2,
  },
};

const defaultScript = {
  mode: "ai",
  topic: "",
  content: "",
  model: MODEL_CONFIG.script.default,
  source: "draft",
  updatedAt: null,
};

const defaultScenes = [];

const defaultAudio = {
  narration: {
    voiceId: MODEL_CONFIG.voice.default,
    language: "english",
    status: "draft",
    textPreview: "",
    estimatedDuration: "00:00",
    stemType: "dry-voice",
    generatedSource: null,
    uploadedSource: null,
  },
  music: {
    mode: "auto",
    trackName: "",
    mood: "cinematic",
    generationBrief: "",
    uploadedTracks: [],
    generatedSource: null,
    endingFadeEnabled: true,
    endingFadeDuration: 2.5,
    dynamicVolume: true,
    status: "draft",
  },
  sfx: {
    enabled: true,
    density: "medium",
    status: "draft",
    designBrief: "",
    generatedSource: null,
    cues: [],
  },
  generatedAt: null,
};

const defaultCaptionsState = defaultCaptions;

const defaultReview = {
  scenePlan: {
    status: "pending",
    approvedAt: null,
  },
  finalAssembly: {
    status: "pending",
    approvedAt: null,
  },
};

// ─── Review ──────────────────────────────────────────────────────────────────

function normalizeReview(review = {}) {
  return {
    ...defaultReview,
    ...review,
    scenePlan: {
      ...defaultReview.scenePlan,
      ...(review.scenePlan || {}),
    },
    finalAssembly: {
      ...defaultReview.finalAssembly,
      ...(review.finalAssembly || {}),
    },
  };
}

function withReviewReset(review, stages) {
  const normalizedReview = normalizeReview(review);
  const nextReview = { ...normalizedReview };

  stages.forEach((stage) => {
    nextReview[stage] = {
      status: "pending",
      approvedAt: null,
    };
  });

  return nextReview;
}

// ─── References ────────────────────────────────────────────────────────────────

function normalizeReferences(references = []) {
  if (!Array.isArray(references)) {
    return [];
  }

  return references
    .filter((reference) => reference && typeof reference === "object")
    .map((reference, index) => ({
      id: typeof reference.id === "string" && reference.id.length > 0 ? reference.id : `reference-${index + 1}`,
      name: typeof reference.name === "string" ? reference.name : `Reference ${index + 1}`,
      kind: typeof reference.kind === "string" ? reference.kind : "reference-image",
      label: typeof reference.label === "string" ? reference.label : "style",
      scopeId: typeof reference.scopeId === "string" ? reference.scopeId : null,
      preview: typeof reference.preview === "string" ? reference.preview : null,
      storagePath: typeof reference.storagePath === "string" ? reference.storagePath : null,
      mimeType: typeof reference.mimeType === "string" ? reference.mimeType : null,
      sizeLabel: typeof reference.sizeLabel === "string" ? reference.sizeLabel : null,
      uploadedAt: typeof reference.uploadedAt === "string" ? reference.uploadedAt : null,
    }));
}

function getReferenceStructureSignature(references = []) {
  return normalizeReferences(references).map((reference) => ({
    id: reference.id,
    kind: reference.kind,
    storagePath: reference.storagePath || null,
  }));
}

function referencesStructureChanged(previousReferences = [], nextReferences = []) {
  const previousSignature = getReferenceStructureSignature(previousReferences);
  const nextSignature = getReferenceStructureSignature(nextReferences);

  if (previousSignature.length !== nextSignature.length) {
    return true;
  }

  return previousSignature.some((reference, index) => {
    const nextReference = nextSignature[index];

    return (
      reference.id !== nextReference.id
      || reference.kind !== nextReference.kind
      || reference.storagePath !== nextReference.storagePath
    );
  });
}

function normalizeReferenceSemanticName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getReferenceSemanticSignature(references = []) {
  return normalizeReferences(references).map((reference) => ({
    id: reference.id,
    label: reference.label,
    name: normalizeReferenceSemanticName(reference.name),
  }));
}

function referencesSemanticChanged(previousReferences = [], nextReferences = []) {
  const previousSignature = getReferenceSemanticSignature(previousReferences);
  const nextSignature = getReferenceSemanticSignature(nextReferences);

  if (previousSignature.length !== nextSignature.length) {
    return true;
  }

  return previousSignature.some((reference, index) => {
    const nextReference = nextSignature[index];

    return (
      reference.id !== nextReference.id
      || reference.label !== nextReference.label
      || reference.name !== nextReference.name
    );
  });
}

// ─── Settings ──────────────────────────────────────────────────────────────────

function normalizeGraphicsSettings(graphics = {}) {
  return {
    ...defaultSettings.graphics,
    ...(graphics || {}),
    moduleState: {
      ...defaultSettings.graphics.moduleState,
      ...(graphics.moduleState || {}),
    },
    variantState: {
      ...defaultSettings.graphics.variantState,
      ...(graphics.variantState || {}),
    },
  };
}

function normalizeEffectsSettings(effects = {}) {
  return {
    ...defaultSettings.effects,
    ...(effects || {}),
    moduleState: {
      ...defaultSettings.effects.moduleState,
      ...(effects.moduleState || {}),
    },
    videoEndingDuration:
      typeof effects.videoEndingDuration === "number"
        ? effects.videoEndingDuration
        : defaultSettings.effects.videoEndingDuration,
  };
}

function normalizeSettings(settings = {}) {
  return {
    ...defaultSettings,
    ...(settings || {}),
    graphics: normalizeGraphicsSettings(settings.graphics || {}),
    effects: normalizeEffectsSettings(settings.effects || {}),
  };
}

// ─── Scenes ────────────────────────────────────────────────────────────────────

function normalizeScene(scene, index = 0, projectId = "project") {
  const normalizedSceneId = scene.id || `${projectId}-scene-${scene.sceneId || index + 1}`;
  return {
    id: normalizedSceneId,
    sceneId: scene.sceneId || index + 1,
    narration: scene.narration || "",
    visualIntent: scene.visualIntent || "",
    emotion: scene.emotion || "neutral",
    duration: typeof scene.duration === "number" ? scene.duration : 5,
    // Hybrid render mode: "animate" → motion clip required; "static" → Ken Burns image only.
    // Default "animate" preserves legacy behavior (every scene needed a clip).
    motionMode: scene.motionMode === "static" ? "static" : "animate",
    approvedImageId: scene.approvedImageId || null,
    imageVariants: Array.isArray(scene.imageVariants)
      ? scene.imageVariants.map((variant, variantIndex) => ({
          variantIndex: variantIndex + 1,
          status: "pending",
          palette: "violet",
          shot: "wide frame",
          mood: "dramatic",
          previewTitle: `Variant ${variantIndex + 1}`,
          prompt: "",
          ...variant,
          id: variant.id || `${normalizedSceneId}-image-${variantIndex + 1}`,
        }))
      : [],
    approvedVideoId: scene.approvedVideoId || null,
    videoVariants: Array.isArray(scene.videoVariants)
      ? scene.videoVariants.map((variant, variantIndex) => ({
          variantIndex: variantIndex + 1,
          status: "pending",
          engine: "kling-3.0",
          motion: "slow push-in",
          energy: "cinematic",
          previewTitle: `Clip ${variantIndex + 1}`,
          prompt: "",
          ...variant,
          id: variant.id || `${normalizedSceneId}-video-${variantIndex + 1}`,
        }))
      : [],
  };
}

// ─── Identity / type ────────────────────────────────────────────────────────────

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createProjectId(title) {
  return `${slugify(title) || "project"}-${randomUUID().slice(0, 8)}`;
}

function resolveProjectStatus(status) {
  return PROJECT_STATUSES.includes(status) ? status : PROJECT_STATUSES[0];
}

function resolveProjectType(type, templateId) {
  if (typeof type === "string" && type.trim().length > 0) {
    return type;
  }

  const template = getTemplateById(templateId);

  if (!template) {
    return "Long Form / YouTube";
  }

  if (template.type === "short") {
    return "Short Form / TikTok";
  }

  if (template.type === "slideshow") {
    return "Slideshow / VSL";
  }

  return "Long Form / YouTube";
}

function isSlideshowProjectType(type = "") {
  return type.toLowerCase().includes("slideshow");
}

// ─── Project assembly (defaults + full normalization) ────────────────────────────

function applyTemplateDefaults(template, payload) {
  const templateAudio = template?.defaults?.audio || {};
  const templateCaptions = template?.defaults?.captions || {};

  return {
    ...payload,
    goal: payload.goal || template?.description || template?.style || "",
    type: resolveProjectType(payload.type, template?.id || ""),
    templateId: template?.id || payload.templateId || null,
    templateSnapshot: template ? createTemplateSnapshot(template) : payload.templateSnapshot || null,
    script: {
      ...defaultScript,
      ...(template?.defaults?.script || {}),
      ...(payload.script || {}),
    },
    audio: {
      ...defaultAudio,
      ...templateAudio,
      ...(payload.audio || {}),
      narration: {
        ...defaultAudio.narration,
        ...(templateAudio.narration || {}),
        ...(payload.audio?.narration || {}),
      },
      music: {
        ...defaultAudio.music,
        ...(templateAudio.music || {}),
        ...(payload.audio?.music || {}),
      },
      sfx: {
        ...defaultAudio.sfx,
        ...(templateAudio.sfx || {}),
        ...(payload.audio?.sfx || {}),
        cues: Array.isArray(payload.audio?.sfx?.cues) ? payload.audio.sfx.cues : [],
      },
    },
    captions: normalizeCaptions({
      ...defaultCaptionsState,
      ...(templateCaptions || {}),
      ...(payload.captions || {}),
      style: {
        ...defaultCaptionsState.style,
        ...(templateCaptions.style || {}),
        ...(payload.captions?.style || {}),
      },
    }),
    settings: {
      ...normalizeSettings({
        ...(template?.defaults?.settings || {}),
        ...(payload.settings || {}),
      }),
    },
    review: normalizeReview(payload.review),
    // Seed the template's foundation style references (name+label descriptors)
    // when the project doesn't bring its own — carries the visual DNA.
    references: normalizeReferences(
      Array.isArray(payload.references) && payload.references.length > 0
        ? payload.references
        : (template?.defaults?.references || [])
    ),
    scriptLinkedReferences: normalizeReferences(payload.scriptLinkedReferences),
    isAdvanceContent: typeof payload.isAdvanceContent === "boolean" ? payload.isAdvanceContent : false,
    advanceLinks: Array.isArray(payload.advanceLinks) ? payload.advanceLinks : [],
    advanceAssets: Array.isArray(payload.advanceAssets) ? payload.advanceAssets : [],
    research: payload.research && typeof payload.research === "object" ? payload.research : null,
  };
}

function normalizeProject(project) {
  return {
    ...project,
    templateId: project.templateId || null,
    templateSnapshot: project.templateSnapshot || null,
    sceneProduction: project.sceneProduction || null,
    review: normalizeReview(project.review),
    references: normalizeReferences(project.references),
    scriptLinkedReferences: normalizeReferences(project.scriptLinkedReferences),
    isAdvanceContent: typeof project.isAdvanceContent === "boolean" ? project.isAdvanceContent : false,
    advanceLinks: Array.isArray(project.advanceLinks) ? project.advanceLinks : [],
    advanceAssets: Array.isArray(project.advanceAssets) ? project.advanceAssets : [],
    research: project.research && typeof project.research === "object" ? project.research : null,
    script: {
      ...defaultScript,
      ...(project.script || {}),
    },
    settings: {
      ...normalizeSettings(project.settings || {}),
    },
    audio: {
      ...defaultAudio,
      ...(project.audio || {}),
      narration: {
        ...defaultAudio.narration,
        ...(project.audio?.narration || {}),
      },
      music: {
        ...defaultAudio.music,
        ...(project.audio?.music || {}),
      },
      sfx: {
        ...defaultAudio.sfx,
        ...(project.audio?.sfx || {}),
        cues: Array.isArray(project.audio?.sfx?.cues) ? project.audio.sfx.cues : [],
      },
    },
    captions: normalizeCaptions(project.captions),
    assembly: normalizeAssembly(project.assembly),
    scenes: Array.isArray(project.scenes)
      ? project.scenes.map((scene, index) => normalizeScene(scene, index, project.id))
      : defaultScenes,
  };
}

module.exports = {
  // defaults
  defaultSettings,
  defaultScript,
  defaultScenes,
  defaultAudio,
  defaultCaptionsState,
  defaultReview,
  defaultAssembly,
  // audio readiness
  isMusicReady,
  isNarrationReady,
  isSfxReady,
  // review
  normalizeReview,
  withReviewReset,
  // references
  normalizeReferences,
  referencesStructureChanged,
  referencesSemanticChanged,
  // settings
  normalizeSettings,
  // scenes
  normalizeScene,
  // identity / type
  slugify,
  createProjectId,
  resolveProjectStatus,
  resolveProjectType,
  isSlideshowProjectType,
  // project assembly
  applyTemplateDefaults,
  normalizeProject,
};

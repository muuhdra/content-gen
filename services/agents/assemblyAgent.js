const { randomUUID } = require("node:crypto");
const {
  createStructuredAgentResult,
  validateAssemblyOutput,
} = require("./contracts");
const { buildAssemblyHandoff } = require("./productionHandoff");

function sanitizeFileSegment(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferAspectRatio(projectType = "") {
  const normalizedType = projectType.toLowerCase();

  if (normalizedType.includes("short")) {
    return "9:16";
  }

  if (normalizedType.includes("slideshow")) {
    return "16:9";
  }

  return "16:9";
}

function inferResolution(projectType = "") {
  return inferAspectRatio(projectType) === "9:16" ? "1080x1920" : "1920x1080";
}

function isSlideshowProject(projectType = "") {
  return projectType.toLowerCase().includes("slideshow");
}

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function splitNarrationIntoSentences(narration = "") {
  return narration
    .split(/[.!?]\s+|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function createSlideHeadline(scene) {
  const firstSentence = splitNarrationIntoSentences(scene.narration)[0] || scene.narration || `Slide ${scene.sceneId}`;
  return firstSentence
    .split(/\s+/)
    .slice(0, 7)
    .join(" ")
    .replace(/[,:;]+$/g, "");
}

function createSlideBullets(scene) {
  const parts = splitNarrationIntoSentences(scene.narration);

  return parts
    .slice(0, 3)
    .map((part) => part.replace(/[,:;]+$/g, "").trim())
    .filter(Boolean);
}

function inferTextDensity(scene) {
  const wordCount = (scene.narration || "")
    .split(/\s+/)
    .filter(Boolean).length;

  if (wordCount <= 12) {
    return "headline";
  }

  if (wordCount <= 28) {
    return "balanced";
  }

  return "dense";
}

function inferSlideLayout(scene) {
  const bullets = createSlideBullets(scene);
  const narration = (scene.narration || "").toLowerCase();

  if (bullets.length >= 3) {
    return "bullet-stack";
  }

  if (/\bversus\b|\bvs\b|\bcompare\b|\bdifference\b/.test(narration)) {
    return "comparison";
  }

  if (/\bhow\b|\bwhy\b|\bsteps\b|\bprocess\b/.test(narration)) {
    return "explainer";
  }

  if (/\bresult\b|\bproof\b|\bdata\b|\bstat\b/.test(narration)) {
    return "proof-card";
  }

  return "hero-statement";
}

function inferSlideTransition(scene) {
  return ["cut", "fade", "lift", "swipe"][scene.sceneId % 4];
}

function inferSlideshowMotion(scene, approvedImage) {
  if (!approvedImage) {
    return "Pending visual source";
  }

  return [
    "Ken Burns slow push",
    "Ken Burns gentle pan",
    "Ken Burns soft drift",
    "Ken Burns focus pull",
  ][scene.sceneId % 4];
}

function inferPacingStrategy(scene) {
  const density = inferTextDensity(scene);

  if (density === "headline") {
    return "hold headline, then quick transition";
  }

  if (density === "balanced") {
    return "headline first, then staggered support lines";
  }

  return "headline hold, then progressive bullet reveal";
}

function hasUploadedNarrationSource(audio = {}) {
  return typeof audio?.narration?.uploadedSource?.storagePath === "string"
    && audio.narration.uploadedSource.storagePath.length > 0;
}

function isNarrationReady(audio = {}) {
  const voiceId = audio?.narration?.voiceId || "";
  const status = audio?.narration?.status || "draft";

  if (voiceId === "custom-audio-upload") {
    return status === "uploaded" && hasUploadedNarrationSource(audio);
  }

  return status === "generated";
}

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

function isSfxReady(audio = {}) {
  if (audio?.sfx?.enabled === false) {
    return true;
  }

  return audio?.sfx?.status === "generated";
}

function getAudioLayerLabel(audio = {}, slideshowProject = false) {
  const narrationReady = isNarrationReady(audio);
  const musicReady = isMusicReady(audio);
  const sfxReady = isSfxReady(audio);

  if (narrationReady && musicReady && sfxReady) {
    return slideshowProject ? "Narration-led slide pacing" : "Narration + music mix";
  }

  if (narrationReady && musicReady) {
    return "Narration + music ready, SFX pending";
  }

  if (narrationReady) {
    return "Narration ready, music pending";
  }

  if (musicReady) {
    return "Music ready, narration pending";
  }

  return "Visual-only preview";
}

function runAssemblyAgent({ project, previousHistory = [] }) {
  const now = new Date().toISOString();
  const slideshowProject = isSlideshowProject(project.type);
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const approvedImages = scenes.filter((scene) => scene.approvedImageId).length;
  const approvedVideos = scenes.filter((scene) => scene.approvedVideoId).length;
  const audioReady = isNarrationReady(project.audio) && isMusicReady(project.audio) && isSfxReady(project.audio);
  const captionsReady = Boolean(project.captions?.generatedAt) && Array.isArray(project.captions?.cues) && project.captions.cues.length > 0;
  const captionCueCount = Array.isArray(project.captions?.cues) ? project.captions.cues.length : 0;

  const timeline = scenes.map((scene) => {
    const approvedVideo = (scene.videoVariants || []).find((variant) => variant.id === scene.approvedVideoId) || null;
    const approvedImage = (scene.imageVariants || []).find((variant) => variant.id === scene.approvedImageId) || null;
    const sourceType = slideshowProject
      ? approvedImage ? "image" : approvedVideo ? "video" : "placeholder"
      : approvedVideo ? "video" : approvedImage ? "image" : "placeholder";

    return {
      id: `${project.id}-assembly-scene-${scene.sceneId}`,
      sceneId: scene.sceneId,
      duration: scene.duration,
      sourceType,
      sourceLabel: approvedVideo
        ? approvedVideo.previewTitle
        : approvedImage
          ? approvedImage.previewTitle
          : `${slideshowProject ? "Slide" : "Scene"} ${scene.sceneId} pending approval`,
      visualDirective: scene.visualIntent,
      narrationPreview: scene.narration.slice(0, 120),
      motion: approvedVideo
        ? approvedVideo.motion
        : approvedImage
          ? slideshowProject ? inferSlideshowMotion(scene, approvedImage) : approvedImage.shot
          : "Pending visual source",
      audioLayer: getAudioLayerLabel(project.audio, slideshowProject),
      slideHeadline: slideshowProject ? createSlideHeadline(scene) : null,
      slideBullets: slideshowProject ? createSlideBullets(scene) : [],
      slideLayout: slideshowProject ? inferSlideLayout(scene) : null,
      textDensity: slideshowProject ? inferTextDensity(scene) : null,
      pacingStrategy: slideshowProject ? inferPacingStrategy(scene) : null,
      transition: slideshowProject ? inferSlideTransition(scene) : null,
    };
  });

  const totalDurationSeconds = timeline.reduce((sum, item) => sum + item.duration, 0);
  const placeholderCount = timeline.filter((item) => item.sourceType === "placeholder").length;
  const fallbackImages = timeline.filter((item) => item.sourceType === "image").length;
  const warnings = [];

  if (scenes.length === 0) {
    warnings.push(slideshowProject
      ? "Generate slides before assembling the final output."
      : "Generate scenes before assembling the final output.");
  }

  if (!audioReady) {
    warnings.push("Generate the audio stack before locking the final assembly.");
  }

  if (!captionsReady) {
    warnings.push("Generate captions before locking the final assembly.");
  }

  if (placeholderCount > 0) {
    warnings.push(
      slideshowProject
        ? `${placeholderCount} slide${placeholderCount > 1 ? "s are" : " is"} still missing an approved visual source.`
        : `${placeholderCount} scene${placeholderCount > 1 ? "s are" : " is"} still missing an approved visual source.`
    );
  }

  if (!slideshowProject && fallbackImages > 0) {
    warnings.push(`${fallbackImages} scene${fallbackImages > 1 ? "s use" : " uses"} approved images as fallback instead of video clips.`);
  }

  const status = scenes.length === 0 || !audioReady || !captionsReady || placeholderCount > 0
    ? "draft"
    : !slideshowProject && fallbackImages > 0
      ? "ready_with_fallbacks"
      : "ready";

  const totalDurationLabel = formatDuration(totalDurationSeconds);
  const historyEntry = {
    id: `render-${randomUUID().slice(0, 8)}`,
    createdAt: now,
    status: status === "draft" ? "draft" : "ready",
    label: slideshowProject ? `${project.title} VSL Assembly` : `${project.title} Final Cut`,
    duration: totalDurationLabel,
    notes: warnings[0] || "Assembly package prepared for render.",
  };

  const output = {
    status,
    generatedAt: now,
    aspectRatio: inferAspectRatio(project.type),
    resolution: inferResolution(project.type),
    totalDurationSeconds,
    totalDurationLabel,
    readiness: {
      hasScenes: scenes.length > 0,
      hasAudio: audioReady,
      hasCaptions: captionsReady,
      hasVisualCoverage: scenes.length > 0 && placeholderCount === 0,
      readyToRender: status !== "draft",
    },
    summary: {
      sceneCount: scenes.length,
      approvedImages,
      approvedVideos,
      captionCueCount,
      fallbackImages,
      placeholders: placeholderCount,
      musicEnabled: project.audio?.music?.mode !== "none",
      sfxEnabled: Boolean(project.audio?.sfx?.enabled),
    },
    timeline,
    warnings,
    output: {
      title: slideshowProject ? `${project.title} VSL Assembly` : `${project.title} Final Cut`,
      fileName: slideshowProject
        ? `${sanitizeFileSegment(project.title || "project")}-vsl-deck.mp4`
        : `${sanitizeFileSegment(project.title || "project")}-final-cut.mp4`,
      format: "mp4",
      previewLabel: status === "draft"
        ? slideshowProject ? "Slide deck draft" : "Assembly draft"
        : slideshowProject ? "Render-ready VSL deck" : "Render-ready preview",
    },
    history: [historyEntry, ...previousHistory].slice(0, 8),
  };

  return createStructuredAgentResult({
    agent: "assemblyAgent",
    schema: "cosyl.assembly.v1",
    model: "structured-assembly-agent",
    output,
    validate: validateAssemblyOutput,
    production: buildAssemblyHandoff({
      project,
      output,
    }),
  });
}

module.exports = {
  runAssemblyAgent,
};

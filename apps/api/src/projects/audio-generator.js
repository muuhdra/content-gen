const { MODEL_CONFIG } = require("../../../../config/models");
const { generateVoice } = require("../../../../services/media/audio/generateVoice");
const {
  buildSoundtrackDirectionHandoff,
  buildVoiceDirectionHandoff,
} = require("../../../../services/agents/productionHandoff");

function inferMusicTrack(project) {
  const tone = (project.settings?.tone || "").toLowerCase();

  if (tone.includes("motivation") || tone.includes("uplifting")) {
    return "Momentum Pulse";
  }

  if (tone.includes("educational") || tone.includes("clear")) {
    return "Editorial Underscore";
  }

  if (tone.includes("dramatic") || tone.includes("cyberpunk")) {
    return "Noir Voltage Bed";
  }

  return "Factory Signature Bed";
}

function buildSfxCues(project) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const isSlideshowProject = (project.type || "").toLowerCase().includes("slideshow");

  return scenes.map((scene) =>
    `${isSlideshowProject ? "Slide" : "Scene"} ${scene.sceneId}: accent cue for ${scene.emotion}`
  );
}

function resolveGenerationType(overrides = {}) {
  if (overrides.type === "voice" || overrides.type === "music") {
    return overrides.type;
  }

  return "full";
}

function isBuiltCloneVoiceId(voiceId = "") {
  return typeof voiceId === "string" && voiceId.startsWith("clone-");
}

function isUploadOnlyVoiceId(voiceId = "") {
  return voiceId === "custom-audio-upload";
}

function isSupportedNarrationVoiceId(voiceId = "") {
  return Boolean(MODEL_CONFIG.voice.providers[voiceId]) || isBuiltCloneVoiceId(voiceId);
}

function hasUploadedNarrationSource(audio = {}) {
  return typeof audio?.narration?.uploadedSource?.storagePath === "string"
    && audio.narration.uploadedSource.storagePath.length > 0;
}

function isNarrationReady(audio = {}) {
  const voiceId = audio?.narration?.voiceId || "";
  const status = audio?.narration?.status || "draft";

  if (isUploadOnlyVoiceId(voiceId)) {
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

function isAudioStackReady(audio = {}) {
  return isNarrationReady(audio) && isMusicReady(audio) && isSfxReady(audio);
}

function generateAudioStack(project, overrides = {}) {
  const scriptContent = project.script?.content || "";
  const currentAudio = project.audio || {};
  const generationType = resolveGenerationType(overrides);
  const requestedMusicMode = overrides.music?.mode || currentAudio.music?.mode || "auto";
  const resolvedNarrationVoiceId =
    overrides.narration?.voiceId ||
    currentAudio.narration?.voiceId ||
    project.settings.voiceId;
  const hasUploadedNarrationSource = isUploadOnlyVoiceId(resolvedNarrationVoiceId)
    && typeof (overrides.narration?.uploadedSource || currentAudio.narration?.uploadedSource)?.storagePath === "string"
    && (overrides.narration?.uploadedSource || currentAudio.narration?.uploadedSource).storagePath.length > 0;
  const shouldGenerateNarration =
    (generationType === "full" || generationType === "voice") && !hasUploadedNarrationSource;
  const shouldGenerateMusic =
    (generationType === "full" || generationType === "music")
    && requestedMusicMode !== "uploaded"
    && requestedMusicMode !== "none";
  const shouldGenerateSfx = generationType === "full" || generationType === "music";
  const resolvedNarrationLanguage =
    overrides.narration?.language ||
    currentAudio.narration?.language ||
    project.settings.projectLanguage;
  const resolvedNarrationDirection =
    overrides.narration?.direction ||
    currentAudio.narration?.direction ||
    project.settings.narrationStyle ||
    "";

  if ((generationType === "voice" || generationType === "full") && isUploadOnlyVoiceId(resolvedNarrationVoiceId) && !hasUploadedNarrationSource) {
    throw new Error("Narration is configured for uploaded audio. Upload your custom narration source instead of generating a voice.");
  }

  if (generationType === "voice" && isUploadOnlyVoiceId(resolvedNarrationVoiceId) && hasUploadedNarrationSource) {
    throw new Error("Narration already uses an uploaded source. Replace the uploaded file instead of generating a voice.");
  }

  if (shouldGenerateNarration) {
    if (!isSupportedNarrationVoiceId(resolvedNarrationVoiceId)) {
      throw new Error(`Unsupported narration voice: ${resolvedNarrationVoiceId}`);
    }
  }

  const nextNarration = shouldGenerateNarration
    ? generateVoice({
        scriptContent,
        voiceId: resolvedNarrationVoiceId,
        language: resolvedNarrationLanguage,
        deliveryStyle: resolvedNarrationDirection,
      })
    : {
        ...(currentAudio.narration || {}),
        ...(overrides.narration || {}),
        direction: resolvedNarrationDirection,
      };

  const nextMusic = shouldGenerateMusic
    ? {
        ...(currentAudio.music || {}),
        ...(overrides.music || {}),
        status: "generated",
        mode: requestedMusicMode,
        trackName: overrides.music?.trackName || currentAudio.music?.trackName || inferMusicTrack(project),
        mood: overrides.music?.mood || currentAudio.music?.mood || "cinematic",
      }
    : {
        ...(currentAudio.music || {}),
        ...(overrides.music || {}),
        mode: requestedMusicMode,
        trackName: requestedMusicMode === "none" ? "" : currentAudio.music?.trackName || "",
        generatedSource:
          requestedMusicMode === "none" || requestedMusicMode === "uploaded"
            ? null
            : currentAudio.music?.generatedSource || null,
        status:
          requestedMusicMode === "none"
            ? "disabled"
            : requestedMusicMode === "uploaded"
              && Array.isArray(currentAudio.music?.uploadedTracks)
              && currentAudio.music.uploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0)
            ? "uploaded"
            : requestedMusicMode === "uploaded"
              ? "draft"
              : currentAudio.music?.status || "draft",
      };

  const nextSfx = shouldGenerateSfx
    ? {
        ...(currentAudio.sfx || {}),
        ...(overrides.sfx || {}),
        status: "generated",
        enabled: typeof overrides.sfx?.enabled === "boolean"
          ? overrides.sfx.enabled
          : typeof currentAudio.sfx?.enabled === "boolean"
            ? currentAudio.sfx.enabled
            : true,
        density: overrides.sfx?.density || currentAudio.sfx?.density || "medium",
        cues: typeof overrides.sfx?.enabled === "boolean" && overrides.sfx.enabled === false
          ? []
          : buildSfxCues(project),
      }
    : {
        ...(currentAudio.sfx || {}),
        ...(overrides.sfx || {}),
      };

  const nextAudio = {
    ...currentAudio,
    ...overrides,
    type: generationType,
    narration: {
      ...(currentAudio.narration || {}),
      ...(overrides.narration || {}),
      ...nextNarration,
    },
    music: nextMusic,
    sfx: nextSfx,
    generatedAt: null,
  };

  nextAudio.generatedAt = isAudioStackReady(nextAudio) ? new Date().toISOString() : null;
  nextAudio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project,
      audio: nextAudio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project,
      audio: nextAudio,
    }),
  };

  return nextAudio;
}

module.exports = {
  generateAudioStack,
};

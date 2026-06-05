/**
 * @file audioReadiness.js
 * Centralized audio readiness helpers shared across:
 *  - apps/api/src/projects/routes.js
 *  - apps/api/src/projects/audio-generator.js
 *  - packages/renderer/exportVideo.js
 *
 * Previously these functions were copy-pasted across three modules with slightly
 * different signatures. Single source of truth prevents silent divergence.
 */

/**
 * Checks if the project has a valid uploaded narration file.
 * @param {object} audio - The project.audio object.
 * @returns {boolean}
 */
function hasUploadedNarrationSource(audio = {}) {
  return (
    typeof audio?.narration?.uploadedSource?.storagePath === "string" &&
    audio.narration.uploadedSource.storagePath.length > 0
  );
}

/**
 * Checks if narration is ready for rendering.
 * Handles both custom-upload mode and AI-generated mode.
 * @param {object} audio - The project.audio object.
 * @returns {boolean}
 */
function isNarrationReady(audio = {}) {
  const narration = audio?.narration || {};

  if (narration.voiceId === "custom-audio-upload") {
    return narration.status === "uploaded" && hasUploadedNarrationSource(audio);
  }

  return narration.status === "generated";
}

/**
 * Checks if the music track is ready for rendering.
 * A disabled music mode is considered ready.
 * @param {object} audio - The project.audio object.
 * @returns {boolean}
 */
function isMusicReady(audio = {}) {
  const music = audio?.music || {};

  if (music.mode === "none") {
    return true;
  }

  if (music.mode === "uploaded") {
    return (
      Array.isArray(music.uploadedTracks) &&
      music.uploadedTracks.some(
        (track) =>
          typeof track?.storagePath === "string" && track.storagePath.length > 0,
      )
    );
  }

  return music.status === "generated";
}

/**
 * Checks if SFX is ready for rendering.
 * Disabled SFX is considered ready.
 * @param {object} audio - The project.audio object.
 * @returns {boolean}
 */
function isSfxReady(audio = {}) {
  const sfx = audio?.sfx || {};

  if (sfx.enabled === false) {
    return true;
  }

  return sfx.status === "generated";
}

/**
 * Returns true when all audio layers (narration, music, sfx) are render-ready.
 * @param {object} audio - The project.audio object.
 * @returns {boolean}
 */
function isFullAudioReady(audio = {}) {
  return isNarrationReady(audio) && isMusicReady(audio) && isSfxReady(audio);
}

module.exports = {
  hasUploadedNarrationSource,
  isNarrationReady,
  isMusicReady,
  isSfxReady,
  isFullAudioReady,
};

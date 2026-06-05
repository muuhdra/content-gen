/**
 * @file renderValidation.js
 * Render pre-flight validation helpers. Moved from apps/api/src/projects/render-validation.js
 * to packages/shared so the render worker (packages/orchestrator) can import it
 * without violating monorepo workspace boundaries.
 *
 * Rule: packages/* must never import from apps/*
 */

/**
 * Returns true when the project type is a slideshow variant.
 * @param {string} projectType
 * @returns {boolean}
 */
function isSlideshowProject(projectType = "") {
  return String(projectType || "").toLowerCase().includes("slideshow");
}

/**
 * Effects LAB exposes a clip mode toggle:
 *   - "static" → render every scene from its approved image (Ken Burns), no clips
 *   - "hybrid" → mix: each scene's `motionMode` decides (animate vs static)
 *   - "video"  → generate an animated clip for every scene
 * Default is "video" so existing projects keep requiring motion.
 * @param {object} project
 * @returns {"static" | "hybrid" | "video"}
 */
function resolveClipMode(project = {}) {
  const mode = project?.settings?.effects?.clipMode;
  return mode === "static" || mode === "hybrid" || mode === "video" ? mode : "video";
}

/**
 * Whether a single scene needs an approved motion clip to render.
 * Slideshow + "static" mode never need motion. "video" mode always does.
 * "hybrid" mode defers to the per-scene `motionMode` flag (default "animate").
 * @param {object} project
 * @param {object} scene
 * @returns {boolean}
 */
function sceneRequiresMotion(project, scene) {
  if (isSlideshowProject(project?.type || "")) return false;
  const mode = resolveClipMode(project);
  if (mode === "static") return false;
  if (mode === "video") return true;
  return scene?.motionMode !== "static"; // hybrid
}

/**
 * True when approved images alone are enough for the WHOLE project — i.e. no
 * scene requires a motion clip. True for slideshow and full "static" mode.
 * (Hybrid returns false because at least some scenes are meant to animate.)
 * @param {object} project
 * @returns {boolean}
 */
function motionIsOptional(project = {}) {
  return isSlideshowProject(project.type || "") || resolveClipMode(project) === "static";
}

/**
 * Validates whether a project can be safely queued for rendering.
 * Returns an error string describing the blocking condition, or null if ready.
 *
 * @param {object} project - Full project record.
 * @param {{ assembly?: object }} [options]
 * @returns {string|null}
 */
function getRenderQueueError(project, options = {}) {
  const slideshowProject = isSlideshowProject(project.type || "");
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const review = project.review || {};
  const assembly = options.assembly || project.assembly || {};
  const readiness = assembly.readiness || {};

  const allScenesHaveImages =
    scenes.length > 0 && scenes.every((scene) => Boolean(scene.approvedImageId));

  // Each scene only needs a clip if it requires motion (per clip mode / per-scene
  // flag in hybrid). Static scenes are satisfied by their approved image alone.
  const allScenesHaveVideos =
    scenes.length === 0
      ? false
      : scenes.every((scene) => !sceneRequiresMotion(project, scene) || Boolean(scene.approvedVideoId));

  if (review.scenePlan?.status !== "approved") {
    return slideshowProject
      ? "Approve the slide plan before queueing the render."
      : "Approve the scene plan before queueing the render.";
  }

  if (!allScenesHaveImages) {
    return slideshowProject
      ? "Approve one image for every slide before queueing the render."
      : "Approve one image for every scene before queueing the render.";
  }

  // Note: when images suffice (slideshow or "static" clip mode) allScenesHaveVideos
  // is always true (see above), so this branch only fires when motion is required.
  if (!allScenesHaveVideos) {
    return "Approve one clip for every scene before queueing the render.";
  }

  if (review.finalAssembly?.status !== "approved") {
    return "Approve the final assembly before queueing the render.";
  }

  if (!readiness.readyToRender) {
    return "Generate a render-ready final assembly before queueing the render.";
  }

  return null;
}

module.exports = {
  isSlideshowProject,
  resolveClipMode,
  sceneRequiresMotion,
  motionIsOptional,
  getRenderQueueError,
};

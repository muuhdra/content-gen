function isSlideshowProject(projectType = "") {
  return projectType.toLowerCase().includes("slideshow");
}

function getRenderQueueError(project, options = {}) {
  const slideshowProject = isSlideshowProject(project.type || "");
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const review = project.review || {};
  const assembly = options.assembly || project.assembly || {};
  const readiness = assembly.readiness || {};

  const allScenesHaveImages = scenes.length > 0 && scenes.every((scene) => Boolean(scene.approvedImageId));
  const allScenesHaveVideos = slideshowProject
    ? true
    : scenes.length > 0 && scenes.every((scene) => Boolean(scene.approvedVideoId));

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

  if (!allScenesHaveVideos) {
    return slideshowProject
      ? "Optional motion is available, but slideshow scenes only require approved images before rendering."
      : "Approve one clip for every scene before queueing the render.";
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
  getRenderQueueError,
  isSlideshowProject,
};

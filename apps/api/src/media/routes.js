const express = require("express");

const { createProjectsRepository } = require("../projects/repository");
const { invalidateAssembly } = require("../projects/assembly-generator");
const {
  generateImageVariantsForScene,
  approveImageVariant,
  regenerateImageVariant,
} = require("./image-generator");
const {
  generateVideoVariantsForScene,
  approveVideoVariant,
} = require("./video-generator");
const {
  ensureImageVariantAsset,
  ensureVideoVariantAsset,
  sendGeneratedMediaFile,
} = require("./assets");

const router = express.Router();
const projectsRepository = createProjectsRepository();

function resetFinalAssemblyReview(review) {
  return {
    ...(review || {}),
    finalAssembly: {
      status: "pending",
      approvedAt: null,
    },
  };
}

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    }
  };
}

async function findProjectBySceneId(sceneId) {
  const projects = await projectsRepository.listProjects();

  for (const project of projects) {
    const scene = (project.scenes || []).find((item) => item.id === sceneId);
    if (scene) {
      return { project, scene };
    }
  }

  return null;
}

async function findProjectByImageId(imageId) {
  const projects = await projectsRepository.listProjects();

  for (const project of projects) {
    for (const scene of project.scenes || []) {
      const imageVariant = (scene.imageVariants || []).find((item) => item.id === imageId);
      if (imageVariant) {
        return { project, scene, imageVariant };
      }
    }
  }

  return null;
}

async function findProjectByVideoId(videoId) {
  const projects = await projectsRepository.listProjects();

  for (const project of projects) {
    for (const scene of project.scenes || []) {
      const videoVariant = (scene.videoVariants || []).find((item) => item.id === videoId);
      if (videoVariant) {
        return { project, scene, videoVariant };
      }
    }
  }

  return null;
}

function replaceScene(project, sceneId, nextScene, reason) {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    review: resetFinalAssemblyReview(project.review),
    assembly: invalidateAssembly(project, reason),
    scenes: (project.scenes || []).map((scene) => scene.id === sceneId ? nextScene : scene),
  };
}

function getVisualChangeReason(project) {
  return project.type?.toLowerCase().includes("slideshow")
    ? "Slide visuals changed. Regenerate final assembly."
    : "Scene visuals changed. Regenerate final assembly.";
}

function getMotionChangeReason(project) {
  return project.type?.toLowerCase().includes("slideshow")
    ? "Slide motion changed. Regenerate final assembly."
    : "Scene clips changed. Regenerate final assembly.";
}

router.get("/media/images/:imageId", withErrorHandling(async (req, res) => {
  const match = await findProjectByImageId(req.params.imageId);

  if (!match) {
    res.status(404).json({ error: "Image variant not found" });
    return;
  }

  const asset = await ensureImageVariantAsset({
    project: match.project,
    scene: match.scene,
    variant: match.imageVariant,
  });

  await sendGeneratedMediaFile(asset, res, {
    download: req.query.download === "1",
  });
}));

router.get("/media/videos/:videoId", withErrorHandling(async (req, res) => {
  const match = await findProjectByVideoId(req.params.videoId);

  if (!match) {
    res.status(404).json({ error: "Video variant not found" });
    return;
  }

  const imageVariant = (match.scene.imageVariants || []).find((item) => item.id === match.videoVariant.sourceImageId)
    || (match.scene.imageVariants || []).find((item) => item.id === match.scene.approvedImageId)
    || (match.scene.imageVariants || [])[0]
    || null;
  const asset = await ensureVideoVariantAsset({
    project: match.project,
    scene: match.scene,
    variant: match.videoVariant,
    imageVariant,
  });

  await sendGeneratedMediaFile(asset, res, {
    download: req.query.download === "1",
  });
}));

router.post("/scenes/:sceneId/images/generate", withErrorHandling(async (req, res) => {
  const match = await findProjectBySceneId(req.params.sceneId);

  if (!match) {
    res.status(404).json({ error: "Scene not found" });
    return;
  }

  const nextScene = {
    ...match.scene,
    approvedImageId: null,
    imageVariants: generateImageVariantsForScene(match.scene, match.project, 3),
    approvedVideoId: null,
    videoVariants: [],
  };

  const updatedProject = replaceScene(match.project, match.scene.id, nextScene, getVisualChangeReason(match.project));
  await projectsRepository.updateProject(updatedProject.id, updatedProject);

  res.json({ data: nextScene });
}));

router.post("/images/:imageId/approve", withErrorHandling(async (req, res) => {
  const match = await findProjectByImageId(req.params.imageId);

  if (!match) {
    res.status(404).json({ error: "Image variant not found" });
    return;
  }

  const nextScene = approveImageVariant(match.scene, req.params.imageId);
  nextScene.approvedVideoId = null;
  nextScene.videoVariants = [];
  const updatedProject = replaceScene(match.project, match.scene.id, nextScene, getVisualChangeReason(match.project));
  await projectsRepository.updateProject(updatedProject.id, updatedProject);

  res.json({ data: nextScene });
}));

router.post("/images/:imageId/regenerate", withErrorHandling(async (req, res) => {
  const match = await findProjectByImageId(req.params.imageId);

  if (!match) {
    res.status(404).json({ error: "Image variant not found" });
    return;
  }

  const nextScene = regenerateImageVariant(match.scene, req.params.imageId, match.project);
  nextScene.approvedVideoId = null;
  nextScene.videoVariants = [];
  const updatedProject = replaceScene(match.project, match.scene.id, nextScene, getVisualChangeReason(match.project));
  await projectsRepository.updateProject(updatedProject.id, updatedProject);

  res.json({ data: nextScene });
}));

router.post("/scenes/:sceneId/videos/generate", withErrorHandling(async (req, res) => {
  const match = await findProjectBySceneId(req.params.sceneId);

  if (!match) {
    res.status(404).json({ error: "Scene not found" });
    return;
  }

  if (!match.scene.approvedImageId) {
    res.status(400).json({
      error: match.project.type?.toLowerCase().includes("slideshow")
        ? "Approve a slide image before generating motion"
        : "Approve an image before generating videos",
    });
    return;
  }

  if (match.project.type?.toLowerCase().includes("slideshow") && match.project.settings?.videoAgentModel === "none") {
    res.status(400).json({ error: "Slide motion is disabled for this project. Enable a motion engine before generating motion variants." });
    return;
  }

  const nextScene = {
    ...match.scene,
    approvedVideoId: null,
    videoVariants: generateVideoVariantsForScene(
      match.scene,
      match.project,
      match.project.type?.toLowerCase().includes("slideshow") ? 2 : 3
    ),
  };

  const updatedProject = replaceScene(match.project, match.scene.id, nextScene, getMotionChangeReason(match.project));
  await projectsRepository.updateProject(updatedProject.id, updatedProject);

  res.json({ data: nextScene });
}));

router.post("/videos/:videoId/approve", withErrorHandling(async (req, res) => {
  const projects = await projectsRepository.listProjects();

  for (const project of projects) {
    for (const scene of project.scenes || []) {
      const videoVariant = (scene.videoVariants || []).find((item) => item.id === req.params.videoId);

      if (videoVariant) {
        const nextScene = approveVideoVariant(scene, req.params.videoId);
        const updatedProject = replaceScene(project, scene.id, nextScene, getMotionChangeReason(project));
        await projectsRepository.updateProject(updatedProject.id, updatedProject);
        res.json({ data: nextScene });
        return;
      }
    }
  }

  res.status(404).json({ error: "Video variant not found" });
}));

module.exports = {
  mediaRouter: router,
};

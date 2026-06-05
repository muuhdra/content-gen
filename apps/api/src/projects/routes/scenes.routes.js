/**
 * Scene routes — read the scene plan and generate it from the locked script.
 */
const express = require("express");

const { withErrorHandling } = require("../../lib/http");
const { resolveWorkingStatus } = require("@cosyl/shared/types/production");
const { invalidateAssembly } = require("@cosyl/shared");
const { generateScenesFromScript } = require("../scene-generator");
const { invalidateCaptions } = require("../caption-generator");
const {
  normalizeProject,
  normalizeReview,
  isSlideshowProjectType,
} = require("../project-model");
const { projectsRepository } = require("./context");

const router = express.Router();

router.get("/:id/scenes", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).scenes });
}));

router.post("/:id/scenes/generate", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);

  if (!normalizedProject.script.content || normalizedProject.script.content.trim().length === 0) {
    res.status(400).json({ error: "Generate or save a script before generating scenes" });
    return;
  }

  const nextScenePackage = await generateScenesFromScript(normalizedProject);
  const now = new Date().toISOString();
  const updatedProject = {
    ...project,
    updatedAt: now,
    status: resolveWorkingStatus(project.status),
    review: {
      ...normalizeReview(project.review),
      scenePlan: {
        // Scene plan starts in 'pending' — requires explicit user approval before rendering.
        // This preserves the human-in-the-loop validation enforced by getRenderQueueError.
        status: "pending",
        approvedAt: null,
      },
      finalAssembly: {
        status: "pending",
        approvedAt: null,
      },
    },
    sceneProduction: nextScenePackage.production || null,
    scenes: nextScenePackage.scenes,
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(
      project,
      isSlideshowProjectType(normalizedProject.type)
        ? "Slides changed. Regenerate final assembly."
        : "Scenes changed. Regenerate final assembly."
    ),
  };

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: normalizeProject(updatedProject) });
}));

module.exports = router;

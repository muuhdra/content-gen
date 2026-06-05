/**
 * Caption routes — read the cue track, regenerate it from the locked audio.
 */
const express = require("express");

const { withErrorHandling } = require("../../lib/http");
const { resolveWorkingStatus } = require("@cosyl/shared/types/production");
const { invalidateAssembly } = require("@cosyl/shared");
const { generateCaptionsTrack } = require("../caption-generator");
const { normalizeProject, withReviewReset } = require("../project-model");
const { projectsRepository } = require("./context");

const router = express.Router();

router.get("/:id/captions", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).captions });
}));

router.post("/:id/captions/generate", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const styleOverrides = req.body.style && typeof req.body.style === "object" ? req.body.style : {};
  const nextCaptions = generateCaptionsTrack(normalizedProject, styleOverrides);
  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: resolveWorkingStatus(project.status),
    review: withReviewReset(project.review, ["finalAssembly"]),
    captions: nextCaptions,
    assembly: invalidateAssembly(project, "Captions changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: nextCaptions });
}));

module.exports = router;

/**
 * Final assembly + render routes.
 *
 * Assembly is the locked manifest the renderer reads from; the render endpoints
 * enqueue a job (`POST /:id/render`), expose its status, and serve the produced
 * MP4 file when the job is complete.
 */
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { withErrorHandling } = require("../../lib/http");
const { dataRoot } = require("../../lib/paths");
const { resolveWorkingStatus } = require("@cosyl/shared/types/production");
const {
  generateProjectAssembly,
  getRenderQueueError,
} = require("@cosyl/shared");
const { normalizeProject, withReviewReset } = require("../project-model");
const {
  projectsRepository,
  renderJobsRepository,
  orchestratorQueue,
} = require("./context");

const router = express.Router();

const renderOutputsRoot = path.join(dataRoot, "render-outputs");

router.get("/:id/assembly", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).assembly });
}));

router.post("/:id/assembly/generate", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const nextAssembly = generateProjectAssembly(normalizedProject);
  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: resolveWorkingStatus(project.status),
    review: withReviewReset(project.review, ["finalAssembly"]),
    assembly: nextAssembly,
  };

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: nextAssembly });
}));

router.post("/:id/render", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const renderQueueError = getRenderQueueError(normalizedProject);

  if (renderQueueError) {
    res.status(400).json({ error: renderQueueError });
    return;
  }

  const queuedJob = await orchestratorQueue.enqueueRenderJob(project.id, {
    requestedAt: new Date().toISOString(),
    requestedFrom: typeof req.body.source === "string" ? req.body.source : "project-details",
    requestedBy: "local-user",
  });

  res.status(202).json({
    data: {
      job: queuedJob,
      driver: orchestratorQueue.driver,
    },
  });
}));

router.post("/:id/render/:jobId/retry", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const existingJob = await renderJobsRepository.getJob(req.params.jobId);

  if (!existingJob || existingJob.projectId !== project.id) {
    res.status(404).json({ error: "Render job not found" });
    return;
  }

  if (existingJob.status !== "failed") {
    res.status(400).json({ error: "Only failed jobs can be retried." });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const renderQueueError = getRenderQueueError(normalizedProject);

  if (renderQueueError) {
    res.status(400).json({ error: renderQueueError });
    return;
  }

  const queuedJob = await orchestratorQueue.enqueueRenderJob(project.id, {
    ...(existingJob.payload || {}),
    retriedAt: new Date().toISOString(),
    retryOf: existingJob.id,
    attempts: (existingJob.attempts || 1) + 1,
    requestedFrom: "render-retry",
  });

  res.status(202).json({
    data: {
      job: queuedJob,
      driver: orchestratorQueue.driver,
    },
  });
}));

router.get("/:id/render/status", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const jobs = await renderJobsRepository.listJobsByProject(project.id);

  res.json({
    data: {
      driver: orchestratorQueue.driver,
      latestJob: jobs[0] ?? null,
      jobs,
    },
  });
}));

router.get("/:id/render/file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Resolve the most recent completed render for this project.
  const jobs = await renderJobsRepository.listJobsByProject(project.id);
  const completedJob = jobs.find((job) => job.status === "completed" && job.output?.finalAsset?.storagePath);

  if (!completedJob) {
    res.status(404).json({ error: "No completed render is available yet." });
    return;
  }

  const storagePath = String(completedJob.output.finalAsset.storagePath || "");
  const relativePath = storagePath.replace(/^render-outputs[\\/]/, "");
  const absolutePath = path.resolve(renderOutputsRoot, relativePath);

  // Guard against path traversal outside the render-outputs root.
  if (!absolutePath.startsWith(renderOutputsRoot)) {
    res.status(404).json({ error: "Render output not found." });
    return;
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Cache-Control", "private, max-age=3600");

    if (req.query.download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(absolutePath)}"`);
    }

    res.send(buffer);
  } catch {
    res.status(404).json({ error: "Render output not found." });
  }
}));

module.exports = router;

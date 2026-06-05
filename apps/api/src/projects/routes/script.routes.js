/**
 * Script routes — read, manual save, save (mode-aware), and AI generation.
 *
 * Every write path runs the script-change cascade:
 *   review reset, scenes wiped, audio/captions invalidated, assembly invalidated,
 *   and status promoted to "Active" (or kept on "Rendering").
 */
const express = require("express");

const { withErrorHandling } = require("../../lib/http");
const { resolveWorkingStatus } = require("@cosyl/shared/types/production");
const { invalidateAssembly } = require("@cosyl/shared");
const { buildScriptAnalysisHandoff } = require("@cosyl/agents/productionHandoff");
const { generateScriptFromTopic } = require("../script-generator");
const { invalidateAudioForScriptChange } = require("../audio-generator");
const { invalidateCaptions } = require("../caption-generator");
const { defaultScript, normalizeProject, withReviewReset } = require("../project-model");
const { projectsRepository } = require("./context");

const router = express.Router();

router.get("/:id/script", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).script });
}));

router.post("/:id/script/manual", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const nextScript = {
    ...defaultScript,
    ...project.script,
    mode: "manual",
    content: typeof req.body.content === "string" ? req.body.content : project.script?.content ?? "",
    topic: typeof req.body.topic === "string" ? req.body.topic : project.script?.topic ?? "",
    model: typeof req.body.model === "string" ? req.body.model : project.script?.model ?? project.settings.scriptAgentModel,
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
  nextScript.production = nextScript.content.trim().length > 0
    ? buildScriptAnalysisHandoff({
        topic: nextScript.topic || project.goal || project.title || "project",
        project,
        output: nextScript,
      })
    : null;

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: resolveWorkingStatus(project.status),
    review: withReviewReset(project.review, ["scenePlan", "finalAssembly"]),
    script: nextScript,
    sceneProduction: null,
    scenes: [],
    audio: invalidateAudioForScriptChange(project.audio),
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Script changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: nextScript });
}));

router.post("/:id/script/save", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const nextMode = req.body.mode === "manual" ? "manual" : "ai";
  const nextContent = typeof req.body.content === "string" ? req.body.content : project.script?.content ?? "";
  const nextTopic = typeof req.body.topic === "string" ? req.body.topic : project.script?.topic ?? "";
  const nextModel = typeof req.body.model === "string" ? req.body.model : project.script?.model ?? project.settings.scriptAgentModel;
  const nextScript = {
    ...defaultScript,
    ...project.script,
    mode: nextMode,
    topic: nextTopic,
    content: nextContent,
    model: nextModel,
    source: nextMode === "manual"
      ? "manual"
      : nextContent.trim().length > 0
        ? "generated"
        : "draft",
    updatedAt: new Date().toISOString(),
  };
  nextScript.production = nextContent.trim().length > 0
    ? buildScriptAnalysisHandoff({
        topic: nextTopic || project.goal || project.title || "project",
        project,
        output: nextScript,
      })
    : null;

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: resolveWorkingStatus(project.status),
    review: withReviewReset(project.review, ["scenePlan", "finalAssembly"]),
    script: nextScript,
    sceneProduction: null,
    scenes: [],
    audio: invalidateAudioForScriptChange(project.audio),
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Script changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: nextScript });
}));

router.post("/:id/script/generate", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const topic = typeof req.body.topic === "string" && req.body.topic.trim().length > 0
    ? req.body.topic
    : project.script?.topic || project.goal;

  if (!topic || topic.trim().length === 0) {
    res.status(400).json({ error: "A topic is required to generate the script" });
    return;
  }

  const duration = typeof req.body.duration === "string" ? req.body.duration : project.settings.targetDuration;

  const nextScript = await generateScriptFromTopic({
    topic,
    project,
    model: typeof req.body.model === "string" ? req.body.model : project.settings.scriptAgentModel,
    duration,
  });

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    review: withReviewReset(project.review, ["scenePlan", "finalAssembly"]),
    script: nextScript,
    settings: {
      ...project.settings,
      targetDuration: duration,
    },
    sceneProduction: null,
    scenes: [],
    audio: invalidateAudioForScriptChange(project.audio),
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Script changed. Regenerate final assembly."),
  };
  updatedProject.status = resolveWorkingStatus(project.status);

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: nextScript });
}));

module.exports = router;

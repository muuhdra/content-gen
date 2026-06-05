/**
 * Research engine routes (Advance Content 2.0).
 *
 *   GET  /:id/research           → the saved research dossier (or null)
 *   POST /:id/research/generate  → run the engine (read links + web search +
 *                                  synthesise), save the dossier, return it
 *
 * The dossier's `brief` is later used to ground script generation.
 */
const express = require("express");

const { withErrorHandling } = require("../../lib/http");
const { runResearchAgent } = require("@cosyl/agents");
const { normalizeProject } = require("../project-model");
const { projectsRepository } = require("./context");

const router = express.Router();

router.get("/:id/research", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).research });
}));

router.post("/:id/research/generate", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);

  // Topic: explicit body → script topic → project goal/title.
  const topic = (typeof req.body.topic === "string" && req.body.topic.trim())
    || normalizedProject.script?.topic
    || normalizedProject.goal
    || normalizedProject.title
    || "";

  if (!topic.trim()) {
    res.status(400).json({ error: "A topic is required to run the research engine." });
    return;
  }

  const hasLinks = Array.isArray(normalizedProject.advanceLinks) && normalizedProject.advanceLinks.length > 0;

  let research;
  try {
    research = await runResearchAgent({
      topic,
      project: normalizedProject,
      model: typeof req.body.model === "string" ? req.body.model : normalizedProject.settings?.scriptAgentModel,
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "The research engine failed.",
    });
    return;
  }

  // If nothing usable came back (no links read AND web search failed), surface it.
  if (research.status !== "completed" && !research.brief) {
    res.status(502).json({
      error: research.webSearch?.error
        || research.error
        || (hasLinks
          ? "Could not read the provided sources and web search returned nothing."
          : "Web search returned nothing. Add source links or check your AIML_API_KEY."),
      data: research,
    });
    return;
  }

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    research,
  };
  await projectsRepository.updateProject(project.id, updatedProject);

  res.json({ data: research });
}));

module.exports = router;

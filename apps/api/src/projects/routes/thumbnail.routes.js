/**
 * Thumbnail prompt route (project → Thumbnail Studio bridge).
 *
 *   POST /:id/thumbnail-prompt  → generate a thumbnail prompt from the project's
 *                                 title/script, plus a format suggestion derived
 *                                 from the project type.
 */
const express = require("express");

const { withErrorHandling } = require("../../lib/http");
const { generateThumbnailPrompt } = require("@cosyl/agents");
const { normalizeProject, isSlideshowProjectType } = require("../project-model");
const { projectsRepository } = require("./context");

const router = express.Router();

// Thumbnail aspect ratio derived from the project type.
function suggestFormat(projectType = "") {
  const t = String(projectType || "").toLowerCase();
  if (t.includes("short")) return "9:16"; // TikTok / Reels / Shorts
  return "16:9"; // YouTube long-form & slideshow/VSL decks
}

router.post("/:id/thumbnail-prompt", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const title = normalizedProject.title || normalizedProject.script?.topic || "";
  const script = normalizedProject.script?.content || "";
  const style = typeof req.body.style === "string" ? req.body.style.trim() : "";

  if (!title.trim() && !script.trim()) {
    res.status(400).json({ error: "Add a title or generate a script before creating a thumbnail prompt." });
    return;
  }

  const format = suggestFormat(normalizedProject.type);

  let prompt;
  try {
    prompt = await generateThumbnailPrompt({
      title,
      script,
      style,
      format,
      model: normalizedProject.settings?.scriptAgentModel,
    });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Unable to generate a thumbnail prompt.",
    });
    return;
  }

  res.json({
    data: {
      prompt,
      suggestedFormat: format,
      isSlideshow: isSlideshowProjectType(normalizedProject.type),
    },
  });
}));

module.exports = router;

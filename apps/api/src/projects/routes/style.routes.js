/**
 * Style analysis route — reverse-engineers the uploaded "style" reference images
 * into a reusable LOCKED style directive ("style brief"), merged with the user's
 * own descriptive style prompt (settings.visualStyle).
 *
 *   POST /:id/style/analyze  → analyze style refs, store settings.styleBrief
 */
const express = require("express");
const { createHash } = require("node:crypto");

const { withErrorHandling } = require("../../lib/http");
const { analyzeStyleReferences } = require("@cosyl/agents");
const aimlapi = require("@cosyl/agents/llm/aimlapi");
const { normalizeProject } = require("../project-model");
const { referenceToImageUrls } = require("../../media/reference-frames");
const { projectsRepository } = require("./context");

const router = express.Router();

function styleSignature(styleRefs, visualStyle) {
  const basis = JSON.stringify({
    refs: styleRefs.map((r) => r.storagePath),
    style: visualStyle || "",
  });
  return createHash("sha1").update(basis).digest("hex").slice(0, 16);
}

router.post("/:id/style/analyze", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalized = normalizeProject(project);
  const styleRefs = (normalized.references || []).filter(
    (ref) => ref.label === "style"
      && (Boolean(ref.storagePath) || ref.kind === "reference-youtube"),
  );

  if (styleRefs.length === 0) {
    res.status(400).json({ error: "Upload at least one Style reference (image, video clip or link) in Editor LAB first." });
    return;
  }

  if (!aimlapi.isAvailable()) {
    res.status(503).json({ error: "Style analysis requires the AIML API key to be configured." });
    return;
  }

  const visualStyle = normalized.settings?.visualStyle || "";
  const signature = styleSignature(styleRefs, visualStyle);

  // Skip re-analysis when nothing changed since the last brief.
  if (normalized.settings?.styleBriefSignature === signature && normalized.settings?.styleBrief) {
    res.json({ data: { brief: normalized.settings.styleBrief, cached: true } });
    return;
  }

  // Normalize each reference into image(s): still images directly, video clips /
  // motion design into extracted frames, YouTube into its thumbnail. Cap the
  // total payload sent to the vision model.
  const MAX_VISION_IMAGES = 6;
  const imageUrls = [];
  for (const ref of styleRefs) {
    if (imageUrls.length >= MAX_VISION_IMAGES) break;
    const urls = await referenceToImageUrls(ref, { maxFrames: 2 });
    for (const url of urls) {
      if (imageUrls.length >= MAX_VISION_IMAGES) break;
      imageUrls.push(url);
    }
  }

  if (imageUrls.length === 0) {
    res.status(422).json({ error: "Could not read the uploaded style references (file or video frames)." });
    return;
  }

  let brief;
  try {
    ({ brief } = await analyzeStyleReferences({ imageUrls, userStyleText: visualStyle }));
  } catch (err) {
    res.status(502).json({ error: `Style analysis failed: ${err.message}` });
    return;
  }

  const updatedProject = {
    ...normalized,
    updatedAt: new Date().toISOString(),
    settings: {
      ...normalized.settings,
      styleBrief: brief,
      styleBriefSignature: signature,
    },
  };
  await projectsRepository.updateProject(updatedProject.id, updatedProject);

  res.json({ data: { brief, cached: false } });
}));

module.exports = router;

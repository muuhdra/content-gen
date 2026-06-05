/**
 * Thumbnail Studio routes.
 *
 *   GET    /thumbnails              → list saved thumbnails (newest first)
 *   POST   /thumbnails/generate     → generate a real thumbnail from a prompt
 *   GET    /thumbnails/:id/file     → serve / download the PNG
 *   DELETE /thumbnails/:id          → delete a thumbnail (record + file)
 */
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { withErrorHandling } = require("../lib/http");
const { readThumbnails, createThumbnail, deleteThumbnail } = require("./store");
const { generateThumbnail, thumbnailsRoot } = require("./generator");

const router = express.Router();

router.get("/", withErrorHandling(async (_req, res) => {
  const thumbnails = await readThumbnails();
  res.json({ data: thumbnails });
}));

router.post("/generate", withErrorHandling(async (req, res) => {
  const prompt = typeof req.body.prompt === "string" ? req.body.prompt : "";
  const format = typeof req.body.format === "string" ? req.body.format : "16:9";
  const model = typeof req.body.model === "string" ? req.body.model : undefined;

  if (!prompt.trim()) {
    res.status(400).json({ error: "A prompt is required to generate a thumbnail." });
    return;
  }

  let thumbnail;
  try {
    thumbnail = await generateThumbnail({ prompt, format, model });
  } catch (error) {
    res.status(502).json({
      error: error instanceof Error ? error.message : "Thumbnail generation failed.",
    });
    return;
  }

  await createThumbnail(thumbnail);
  res.json({ data: thumbnail });
}));

router.get("/:id/file", withErrorHandling(async (req, res) => {
  const thumbnails = await readThumbnails();
  const thumbnail = thumbnails.find((t) => t.id === req.params.id);

  if (!thumbnail) {
    res.status(404).json({ error: "Thumbnail not found." });
    return;
  }

  const relativePath = String(thumbnail.storagePath || "").replace(/^generated-media[\\/]thumbnails[\\/]/, "");
  const absolutePath = path.resolve(thumbnailsRoot, relativePath);

  // Guard against path traversal outside the thumbnails root.
  if (!absolutePath.startsWith(thumbnailsRoot)) {
    res.status(404).json({ error: "Thumbnail not found." });
    return;
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (req.query.download === "1") {
      res.setHeader("Content-Disposition", `attachment; filename="${thumbnail.id}.png"`);
    }
    res.send(buffer);
  } catch {
    res.status(404).json({ error: "Thumbnail file not found." });
  }
}));

router.delete("/:id", withErrorHandling(async (req, res) => {
  const thumbnails = await readThumbnails();
  const thumbnail = thumbnails.find((t) => t.id === req.params.id);

  const wasDeleted = await deleteThumbnail(req.params.id);
  if (!wasDeleted) {
    res.status(404).json({ error: "Thumbnail not found." });
    return;
  }

  // Best-effort file cleanup.
  if (thumbnail?.storagePath) {
    const relativePath = String(thumbnail.storagePath).replace(/^generated-media[\\/]thumbnails[\\/]/, "");
    const absolutePath = path.resolve(thumbnailsRoot, relativePath);
    if (absolutePath.startsWith(thumbnailsRoot)) {
      await fs.rm(absolutePath, { force: true }).catch(() => {});
    }
  }

  res.status(204).send();
}));

module.exports = { thumbnailsRouter: router };

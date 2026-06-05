/**
 * Reference asset routes — uploads, manifests and serving of style references
 * shared by the script / scene / image agents.
 *
 * Mounted before the CRUD router so `/reference-assets` does not get caught by
 * `GET /:id`.
 */
const express = require("express");
const { randomUUID } = require("node:crypto");

const { withErrorHandling } = require("../../lib/http");
const { formatFileSize } = require("../../lib/files");
const { normalizeProject } = require("../project-model");
const {
  getFileStem,
  createReferenceAssetResponse,
  readReferenceManifest,
  writeReferenceManifest,
  deleteReferenceManifest,
  storeReferenceAsset,
  sendReferenceAsset,
  deleteReferenceAsset,
  purgeReferenceScope,
} = require("../asset-storage");
const { projectsRepository } = require("./context");

const router = express.Router();

router.get("/reference-assets/file", withErrorHandling(async (req, res) => {
  const storagePath = typeof req.query.path === "string" ? req.query.path.trim() : "";

  if (!storagePath) {
    res.status(400).json({ error: "A reference asset path is required." });
    return;
  }

  await sendReferenceAsset(storagePath, res);
}));

router.post(
  "/reference-assets/upload-binary",
  express.raw({ type: "application/octet-stream", limit: "25mb" }),
  withErrorHandling(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId.trim() : "";
    const draftId = typeof req.query.draftId === "string" ? req.query.draftId.trim() : "";
    const fileName = typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
    const mimeType = typeof req.query.mimeType === "string" ? req.query.mimeType.trim() : "application/octet-stream";
    const label = typeof req.query.label === "string" ? req.query.label.trim() : "style";
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!fileName || fileBuffer.length === 0) {
      res.status(400).json({ error: "A reference image file is required." });
      return;
    }

    if (!mimeType.startsWith("image/") && !mimeType.startsWith("video/")) {
      res.status(400).json({ error: "Only image and video references are supported." });
      return;
    }

    if (projectId) {
      const project = await projectsRepository.getProject(projectId);

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
    }

    const scopeId = projectId || draftId || `draft-${randomUUID()}`;
    const storedAsset = await storeReferenceAsset({
      scopeKey: scopeId,
      fileName,
      mimeType,
      fileBuffer,
    });
    const uploadedAt = new Date().toISOString();
    const asset = createReferenceAssetResponse(req, {
      id: `reference-${randomUUID()}`,
      name: getFileStem(fileName),
      kind: mimeType.startsWith("video/") ? "reference-video" : "reference-image",
      label,
      scopeId,
      storagePath: storedAsset.storagePath,
      mimeType,
      sizeLabel: formatFileSize(fileBuffer.length),
      uploadedAt,
    });
    const nextManifest = [...await readReferenceManifest(scopeId), {
      id: asset.id,
      name: asset.name,
      kind: asset.kind,
      label: asset.label,
      scopeId: asset.scopeId,
      storagePath: asset.storagePath,
      mimeType: asset.mimeType,
      sizeLabel: asset.sizeLabel,
      uploadedAt: asset.uploadedAt,
    }];

    await writeReferenceManifest(scopeId, nextManifest);

    res.json({
      data: {
        asset,
        draftId: projectId ? null : scopeId,
      },
    });
  }),
);

router.get("/reference-assets", withErrorHandling(async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId.trim() : "";
  const draftId = typeof req.query.draftId === "string" ? req.query.draftId.trim() : "";

  if (projectId) {
    const project = await projectsRepository.getProject(projectId);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({
      data: normalizeProject(project).references.map((reference) => createReferenceAssetResponse(req, reference)),
    });
    return;
  }

  if (!draftId) {
    res.status(400).json({ error: "A draftId or projectId is required." });
    return;
  }

  const manifest = await readReferenceManifest(draftId);
  res.json({
    data: manifest.map((asset) => createReferenceAssetResponse(req, asset)),
  });
}));

router.delete("/reference-assets", withErrorHandling(async (req, res) => {
  const storagePath = typeof req.body.storagePath === "string" ? req.body.storagePath.trim() : "";
  const draftId = typeof req.body.draftId === "string" ? req.body.draftId.trim() : "";
  const referenceId = typeof req.body.referenceId === "string" ? req.body.referenceId.trim() : "";

  if (!storagePath) {
    res.status(400).json({ error: "A reference asset path is required." });
    return;
  }

  await deleteReferenceAsset(storagePath);

  if (draftId) {
    const manifest = await readReferenceManifest(draftId);
    const nextManifest = referenceId
      ? manifest.filter((asset) => asset?.id !== referenceId)
      : manifest.filter((asset) => asset?.storagePath !== storagePath);

    if (nextManifest.length > 0) {
      await writeReferenceManifest(draftId, nextManifest);
    } else {
      await deleteReferenceManifest(draftId);
    }
  }

  res.status(204).end();
}));

router.delete("/reference-assets/scope", withErrorHandling(async (req, res) => {
  const draftId = typeof req.body.draftId === "string" ? req.body.draftId.trim() : "";

  if (!draftId) {
    res.status(400).json({ error: "A draftId is required." });
    return;
  }

  await purgeReferenceScope(draftId);
  res.status(204).end();
}));

router.delete("/reference-assets/manifest", withErrorHandling(async (req, res) => {
  const draftId = typeof req.body.draftId === "string" ? req.body.draftId.trim() : "";

  if (!draftId) {
    res.status(400).json({ error: "A draftId is required." });
    return;
  }

  await deleteReferenceManifest(draftId);
  res.status(204).end();
}));

module.exports = router;

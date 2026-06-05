/**
 * Asset storage layer — local filesystem I/O for project assets.
 *
 * Storage policy: heavy project content (reference binaries, narration, music,
 * generated media) is kept on local disk. Supabase holds only lightweight
 * metadata rows and templates — never this binary content. New writes therefore
 * always go local; `sendReferenceAsset` / `deleteReferenceAsset` still understand
 * the legacy `supabase:` prefix so any previously-uploaded asset keeps working.
 *
 * Owns the upload roots and the read/write/delete/serve logic for:
 *   - reference images & videos (local `uploads/references`)
 *   - uploaded narration sources and music tracks (local `uploads/...`)
 *   - the pending-upload cleanup queue
 *
 * Route handlers stay thin by delegating every disk/bucket operation here.
 * `__dirname` is `apps/api/src/projects`, so `../../data` resolves to
 * `apps/api/data` (same base the rest of the API uses).
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const { createSupabaseAdminClient } = require("@cosyl/shared/db/supabase");
const { sanitizeFileSegment } = require("../lib/files");
const { dataRoot } = require("../lib/paths");

const narrationUploadsRoot = path.join(dataRoot, "uploads/narration");
const musicUploadsRoot = path.join(dataRoot, "uploads/music");
const referenceUploadsRoot = path.join(dataRoot, "uploads/references");
const uploadsCleanupManifestPath = path.join(dataRoot, "uploads/_cleanup.json");
const referenceManifestFileName = "_manifest.json";

// ─── File naming ────────────────────────────────────────────────────────────

function getFileStem(fileName = "") {
  const trimmed = String(fileName).trim();
  const parsed = path.parse(trimmed);
  return parsed.name || trimmed || "reference";
}

function createSanitizedUploadFileName(fileName = "") {
  const extension = path.extname(String(fileName).trim()).toLowerCase().replace(/[^.a-z0-9]/g, "");
  const stem = sanitizeFileSegment(getFileStem(fileName));
  return `${randomUUID()}-${stem}${extension}`;
}

function buildReferencePreviewUrl(req, storagePath) {
  return `${req.protocol}://${req.get("host")}/projects/reference-assets/file?path=${encodeURIComponent(storagePath)}`;
}

function createReferenceAssetResponse(req, asset) {
  return {
    ...asset,
    preview: asset.preview || (asset.storagePath ? buildReferencePreviewUrl(req, asset.storagePath) : null),
  };
}

function guessMimeTypeFromFileName(fileName = "") {
  const extension = path.extname(fileName).toLowerCase();

  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  if (extension === ".avif") return "image/avif";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".mp4") return "video/mp4";
  if (extension === ".webm") return "video/webm";
  if (extension === ".mov") return "video/quicktime";
  if (extension === ".ogg") return "video/ogg";
  if (extension === ".mkv") return "video/x-matroska";
  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".aiff" || extension === ".aif") return "audio/aiff";

  return "application/octet-stream";
}

// ─── Reference manifest (local file) ──────────────────────────────────────────
// Reference asset binaries and their manifest are stored locally to keep
// Supabase storage free of heavy project content (templates only live in Supabase).

function buildReferenceManifestLocalPath(scopeKey) {
  return path.join(referenceUploadsRoot, sanitizeFileSegment(scopeKey), referenceManifestFileName);
}

async function readReferenceManifest(scopeKey) {
  const normalizedScopeKey = sanitizeFileSegment(scopeKey);

  try {
    const manifestRaw = await fs.readFile(buildReferenceManifestLocalPath(normalizedScopeKey), "utf8");
    const manifest = JSON.parse(manifestRaw);
    return Array.isArray(manifest) ? manifest : [];
  } catch {
    return [];
  }
}

async function writeReferenceManifest(scopeKey, manifest) {
  const normalizedScopeKey = sanitizeFileSegment(scopeKey);
  const serializedManifest = JSON.stringify(manifest, null, 2);

  const manifestPath = buildReferenceManifestLocalPath(normalizedScopeKey);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, serializedManifest, "utf8");
}

async function deleteReferenceManifest(scopeKey) {
  const normalizedScopeKey = sanitizeFileSegment(scopeKey);

  const manifestPath = buildReferenceManifestLocalPath(normalizedScopeKey);

  try {
    await fs.rm(manifestPath, { force: true });
    await fs.rmdir(path.dirname(manifestPath)).catch(() => {});
  } catch {
    // Ignore missing local draft manifests.
  }
}

// ─── Reference asset store / serve / delete ───────────────────────────────────

async function storeReferenceAsset({ scopeKey, fileName, fileBuffer }) {
  const normalizedScopeKey = sanitizeFileSegment(scopeKey);
  const sanitizedFileName = createSanitizedUploadFileName(fileName);

  const uploadDir = path.join(referenceUploadsRoot, normalizedScopeKey);
  await fs.mkdir(uploadDir, { recursive: true });

  const absolutePath = path.join(uploadDir, sanitizedFileName);
  await fs.writeFile(absolutePath, fileBuffer);

  return {
    storagePath: `local:${path.posix.join(normalizedScopeKey, sanitizedFileName)}`,
  };
}

async function sendReferenceAsset(storagePath, res) {
  if (storagePath.startsWith("supabase:")) {
    const bucketAndPath = storagePath.slice("supabase:".length);
    const firstSlashIndex = bucketAndPath.indexOf("/");

    if (firstSlashIndex === -1) {
      res.status(404).json({ error: "Reference asset not found." });
      return;
    }

    const bucket = bucketAndPath.slice(0, firstSlashIndex);
    const objectPath = bucketAndPath.slice(firstSlashIndex + 1);
    const supabaseClient = createSupabaseAdminClient();

    if (!supabaseClient) {
      res.status(404).json({ error: "Reference asset storage is unavailable." });
      return;
    }

    const { data, error } = await supabaseClient.storage.from(bucket).download(objectPath);

    if (error || !data) {
      res.status(404).json({ error: "Reference asset not found." });
      return;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    res.setHeader("Content-Type", data.type || guessMimeTypeFromFileName(objectPath));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
    return;
  }

  if (!storagePath.startsWith("local:")) {
    res.status(404).json({ error: "Reference asset not found." });
    return;
  }

  const relativePath = storagePath.slice("local:".length);
  const absolutePath = path.resolve(referenceUploadsRoot, relativePath);

  if (!absolutePath.startsWith(referenceUploadsRoot)) {
    res.status(404).json({ error: "Reference asset not found." });
    return;
  }

  try {
    const buffer = await fs.readFile(absolutePath);
    res.setHeader("Content-Type", guessMimeTypeFromFileName(absolutePath));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buffer);
  } catch {
    res.status(404).json({ error: "Reference asset not found." });
  }
}

/**
 * Read a reference asset into memory (for passing to image-conditioned
 * generation as a Base64 data URL). Returns { buffer, mimeType } or null when
 * the asset can't be read. Never throws — reference locking is best-effort.
 */
async function readReferenceAssetBuffer(storagePath) {
  if (!storagePath || typeof storagePath !== "string") return null;

  try {
    if (storagePath.startsWith("supabase:")) {
      const bucketAndPath = storagePath.slice("supabase:".length);
      const firstSlashIndex = bucketAndPath.indexOf("/");
      if (firstSlashIndex === -1) return null;
      const bucket = bucketAndPath.slice(0, firstSlashIndex);
      const objectPath = bucketAndPath.slice(firstSlashIndex + 1);
      const supabaseClient = createSupabaseAdminClient();
      if (!supabaseClient) return null;
      const { data, error } = await supabaseClient.storage.from(bucket).download(objectPath);
      if (error || !data) return null;
      return { buffer: Buffer.from(await data.arrayBuffer()), mimeType: data.type || guessMimeTypeFromFileName(objectPath) };
    }

    if (!storagePath.startsWith("local:")) return null;
    const relativePath = storagePath.slice("local:".length);
    const absolutePath = path.resolve(referenceUploadsRoot, relativePath);
    if (!absolutePath.startsWith(referenceUploadsRoot)) return null;
    const buffer = await fs.readFile(absolutePath);
    return { buffer, mimeType: guessMimeTypeFromFileName(absolutePath) };
  } catch {
    return null;
  }
}

async function deleteReferenceAsset(storagePath) {
  if (storagePath.startsWith("supabase:")) {
    const bucketAndPath = storagePath.slice("supabase:".length);
    const firstSlashIndex = bucketAndPath.indexOf("/");

    if (firstSlashIndex === -1) {
      return;
    }

    const bucket = bucketAndPath.slice(0, firstSlashIndex);
    const objectPath = bucketAndPath.slice(firstSlashIndex + 1);
    const supabaseClient = createSupabaseAdminClient();

    if (!supabaseClient) {
      return;
    }

    await supabaseClient.storage.from(bucket).remove([objectPath]);
    return;
  }

  if (!storagePath.startsWith("local:")) {
    return;
  }

  const relativePath = storagePath.slice("local:".length);
  const absolutePath = path.resolve(referenceUploadsRoot, relativePath);

  if (!absolutePath.startsWith(referenceUploadsRoot)) {
    return;
  }

  try {
    await fs.unlink(absolutePath);
  } catch {
    // Ignore missing local reference files.
  }
}

// ─── Uploaded narration / music serving ───────────────────────────────────────

async function sendNarrationSourceAsset(source, res, options = {}) {
  if (!source?.storagePath) {
    res.status(404).json({ error: "Narration source not found." });
    return;
  }

  const relativeStoragePath = String(source.storagePath || "").trim();
  const absoluteStoragePath = path.resolve(dataRoot, relativeStoragePath);

  if (!absoluteStoragePath.startsWith(narrationUploadsRoot) && !absoluteStoragePath.includes(`${path.sep}generated-media${path.sep}`)) {
    res.status(404).json({ error: "Narration source not found." });
    return;
  }

  try {
    const buffer = await fs.readFile(absoluteStoragePath);
    res.setHeader("Content-Type", source.mimeType || guessMimeTypeFromFileName(source.name || absoluteStoragePath));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    if (options.download) {
      res.setHeader("Content-Disposition", `attachment; filename="${source.name || path.basename(absoluteStoragePath)}"`);
    }

    res.send(buffer);
  } catch {
    res.status(404).json({ error: "Narration source not found." });
  }
}

async function sendMusicTrackAsset(source, res, options = {}) {
  if (!source?.storagePath) {
    res.status(404).json({ error: "Music track not found." });
    return;
  }

  const relativeStoragePath = String(source.storagePath || "").trim();
  const absoluteStoragePath = path.resolve(dataRoot, relativeStoragePath);

  if (!absoluteStoragePath.startsWith(musicUploadsRoot) && !absoluteStoragePath.includes(`${path.sep}generated-media${path.sep}`)) {
    res.status(404).json({ error: "Music track not found." });
    return;
  }

  try {
    const buffer = await fs.readFile(absoluteStoragePath);
    res.setHeader("Content-Type", source.mimeType || guessMimeTypeFromFileName(source.name || absoluteStoragePath));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    if (options.download) {
      res.setHeader("Content-Disposition", `attachment; filename="${source.name || path.basename(absoluteStoragePath)}"`);
    }

    res.send(buffer);
  } catch {
    res.status(404).json({ error: "Music track not found." });
  }
}

// ─── Pending-upload cleanup queue ──────────────────────────────────────────────

function getUploadRootKey(rootPath) {
  if (rootPath === narrationUploadsRoot) return "narration";
  if (rootPath === musicUploadsRoot) return "music";
  return "unknown";
}

function resolveUploadRootByKey(rootKey) {
  if (rootKey === "narration") return narrationUploadsRoot;
  if (rootKey === "music") return musicUploadsRoot;
  return null;
}

async function readPendingUploadCleanupEntries() {
  try {
    const raw = await fs.readFile(uploadsCleanupManifestPath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writePendingUploadCleanupEntries(entries) {
  await fs.mkdir(path.dirname(uploadsCleanupManifestPath), { recursive: true });
  await fs.writeFile(uploadsCleanupManifestPath, JSON.stringify(entries, null, 2), "utf8");
}

async function enqueuePendingUploadCleanup(rootPath, relativeStoragePath) {
  const rootKey = getUploadRootKey(rootPath);

  if (rootKey === "unknown" || !relativeStoragePath) {
    return;
  }

  const currentEntries = await readPendingUploadCleanupEntries();
  const alreadyQueued = currentEntries.some((entry) => entry?.rootKey === rootKey && entry?.storagePath === relativeStoragePath);

  if (alreadyQueued) {
    return;
  }

  currentEntries.push({
    rootKey,
    storagePath: relativeStoragePath,
    queuedAt: new Date().toISOString(),
  });
  await writePendingUploadCleanupEntries(currentEntries);
}

async function flushPendingUploadCleanupEntries() {
  const currentEntries = await readPendingUploadCleanupEntries();

  if (currentEntries.length === 0) {
    return;
  }

  const remainingEntries = [];

  for (const entry of currentEntries) {
    const rootPath = resolveUploadRootByKey(entry?.rootKey);

    if (!rootPath || typeof entry?.storagePath !== "string") {
      continue;
    }

    const absoluteStoragePath = path.resolve(dataRoot, entry.storagePath);

    if (!absoluteStoragePath.startsWith(rootPath)) {
      continue;
    }

    try {
      await fs.rm(absoluteStoragePath, { force: true });
    } catch {
      remainingEntries.push(entry);
    }
  }

  if (remainingEntries.length === 0) {
    await fs.rm(uploadsCleanupManifestPath, { force: true }).catch(() => {});
    return;
  }

  await writePendingUploadCleanupEntries(remainingEntries);
}

async function deleteLocalUploadIfPresent(rootPath, relativeStoragePath) {
  if (!relativeStoragePath || typeof relativeStoragePath !== "string") {
    return;
  }

  const absoluteStoragePath = path.resolve(dataRoot, relativeStoragePath);

  if (!absoluteStoragePath.startsWith(rootPath)) {
    return;
  }

  try {
    await fs.rm(absoluteStoragePath, { force: true });
  } catch {
    await enqueuePendingUploadCleanup(rootPath, relativeStoragePath);
  }
}

async function purgeReferenceScope(scopeKey) {
  const manifest = await readReferenceManifest(scopeKey);

  await Promise.all(
    manifest
      .filter((asset) => asset?.storagePath)
      .map((asset) => deleteReferenceAsset(asset.storagePath).catch(() => {})),
  );

  await deleteReferenceManifest(scopeKey);
}

module.exports = {
  // upload roots (handlers write/serve relative to these)
  narrationUploadsRoot,
  musicUploadsRoot,
  referenceUploadsRoot,
  // file naming + responses
  getFileStem,
  createSanitizedUploadFileName,
  createReferenceAssetResponse,
  guessMimeTypeFromFileName,
  // reference manifest
  readReferenceManifest,
  writeReferenceManifest,
  deleteReferenceManifest,
  // reference asset store/serve/delete
  storeReferenceAsset,
  sendReferenceAsset,
  readReferenceAssetBuffer,
  deleteReferenceAsset,
  // uploaded narration / music serving
  sendNarrationSourceAsset,
  sendMusicTrackAsset,
  // cleanup
  flushPendingUploadCleanupEntries,
  deleteLocalUploadIfPresent,
  purgeReferenceScope,
};

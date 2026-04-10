const express = require("express");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { MODEL_CONFIG } = require("../../../../config/models");
const { createSupabaseAdminClient } = require("../../../../libs/db/supabase");
const { PROJECT_STATUSES } = require("../../../../libs/types/production");
const { createTemplateSnapshot, getTemplateById } = require("../../../../config/templates");
const { createProjectsRepository } = require("./repository");
const { createRenderJobsRepository } = require("../render-jobs/repository");
const { generateScriptFromTopic } = require("./script-generator");
const { generateScenesFromScript } = require("./scene-generator");
const { generateAudioStack } = require("./audio-generator");
const { defaultCaptions, normalizeCaptions, generateCaptionsTrack, invalidateCaptions } = require("./caption-generator");
const {
  defaultAssembly,
  normalizeAssembly,
  invalidateAssembly,
  generateProjectAssembly,
} = require("./assembly-generator");
const { getRenderQueueError } = require("./render-validation");
const { createOrchestratorQueue } = require("../../../../services/orchestrator/queue");
const {
  buildScriptAnalysisHandoff,
  buildSoundtrackDirectionHandoff,
  buildVoiceDirectionHandoff,
} = require("../../../../services/agents/productionHandoff");
const {
  ensureGeneratedMusicAsset,
  ensureGeneratedNarrationAsset,
  sendGeneratedMediaFile,
} = require("../media/assets");

const router = express.Router();
const projectsRepository = createProjectsRepository();
const renderJobsRepository = createRenderJobsRepository();
const orchestratorQueue = createOrchestratorQueue({
  jobsRepository: renderJobsRepository,
  projectsRepository,
});
const narrationUploadsRoot = path.resolve(__dirname, "../../data/uploads/narration");
const musicUploadsRoot = path.resolve(__dirname, "../../data/uploads/music");
const referenceUploadsRoot = path.resolve(__dirname, "../../data/uploads/references");
const uploadsCleanupManifestPath = path.resolve(__dirname, "../../data/uploads/_cleanup.json");
const referenceAssetsBucket = "project-assets";
const referenceManifestFileName = "_manifest.json";
const maxScriptLinkedReferences = 12;

function withErrorHandling(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    }
  };
}

function normalizeScriptLinkedReferences(references) {
  return normalizeReferences(references);
}

function exceedsScriptLinkedReferencesLimit(references) {
  return normalizeScriptLinkedReferences(references).length > maxScriptLinkedReferences;
}

function sanitizeFileSegment(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "asset";
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

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

function buildReferenceManifestObjectPath(scopeKey) {
  return path.posix.join("references", sanitizeFileSegment(scopeKey), referenceManifestFileName);
}

function buildReferenceManifestLocalPath(scopeKey) {
  return path.join(referenceUploadsRoot, sanitizeFileSegment(scopeKey), referenceManifestFileName);
}

async function readReferenceManifest(scopeKey) {
  const normalizedScopeKey = sanitizeFileSegment(scopeKey);
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    const objectPath = buildReferenceManifestObjectPath(normalizedScopeKey);
    const { data, error } = await supabaseClient.storage.from(referenceAssetsBucket).download(objectPath);

    if (error || !data) {
      return [];
    }

    try {
      const manifest = JSON.parse(await data.text());
      return Array.isArray(manifest) ? manifest : [];
    } catch {
      return [];
    }
  }

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
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    const objectPath = buildReferenceManifestObjectPath(normalizedScopeKey);
    const { error } = await supabaseClient.storage
      .from(referenceAssetsBucket)
      .upload(objectPath, Buffer.from(serializedManifest, "utf8"), {
        contentType: "application/json",
        upsert: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const manifestPath = buildReferenceManifestLocalPath(normalizedScopeKey);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, serializedManifest, "utf8");
}

async function deleteReferenceManifest(scopeKey) {
  const normalizedScopeKey = sanitizeFileSegment(scopeKey);
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    const objectPath = buildReferenceManifestObjectPath(normalizedScopeKey);
    const { error } = await supabaseClient.storage
      .from(referenceAssetsBucket)
      .remove([objectPath]);

    if (error && !/not found/i.test(error.message || "")) {
      throw new Error(error.message);
    }

    return;
  }

  const manifestPath = buildReferenceManifestLocalPath(normalizedScopeKey);

  try {
    await fs.rm(manifestPath, { force: true });
    await fs.rmdir(path.dirname(manifestPath)).catch(() => {});
  } catch {
    // Ignore missing local draft manifests.
  }
}

async function storeReferenceAsset({ scopeKey, fileName, mimeType, fileBuffer }) {
  const supabaseClient = createSupabaseAdminClient();
  const normalizedScopeKey = sanitizeFileSegment(scopeKey);
  const sanitizedFileName = createSanitizedUploadFileName(fileName);

  if (supabaseClient) {
    const objectPath = path.posix.join("references", normalizedScopeKey, sanitizedFileName);
    const { error } = await supabaseClient.storage
      .from(referenceAssetsBucket)
      .upload(objectPath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    return {
      storagePath: `supabase:${referenceAssetsBucket}/${objectPath}`,
    };
  }

  const uploadDir = path.join(referenceUploadsRoot, normalizedScopeKey);
  await fs.mkdir(uploadDir, { recursive: true });

  const absolutePath = path.join(uploadDir, sanitizedFileName);
  await fs.writeFile(absolutePath, fileBuffer);

  return {
    storagePath: `local:${path.posix.join(normalizedScopeKey, sanitizedFileName)}`,
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
  if (extension === ".m4a") return "audio/mp4";
  if (extension === ".mp3") return "audio/mpeg";
  if (extension === ".wav") return "audio/wav";
  if (extension === ".aiff" || extension === ".aif") return "audio/aiff";

  return "application/octet-stream";
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

async function sendNarrationSourceAsset(source, res, options = {}) {
  if (!source?.storagePath) {
    res.status(404).json({ error: "Narration source not found." });
    return;
  }

  const relativeStoragePath = String(source.storagePath || "").trim();
  const absoluteStoragePath = path.resolve(__dirname, "../../data", relativeStoragePath);

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
  const absoluteStoragePath = path.resolve(__dirname, "../../data", relativeStoragePath);

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

    const absoluteStoragePath = path.resolve(__dirname, "../../data", entry.storagePath);

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

  const absoluteStoragePath = path.resolve(__dirname, "../../data", relativeStoragePath);

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

function isMusicReady(audio = {}) {
  const mode = audio?.music?.mode || "auto";

  if (mode === "none") {
    return true;
  }

  if (mode === "uploaded") {
    return Array.isArray(audio?.music?.uploadedTracks)
      && audio.music.uploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0);
  }

  return audio?.music?.status === "generated";
}

function isNarrationReady(audio = {}) {
  const voiceId = audio?.narration?.voiceId || "";
  const status = audio?.narration?.status || "draft";

  if (voiceId === "custom-audio-upload") {
    return status === "uploaded"
      && typeof audio?.narration?.uploadedSource?.storagePath === "string"
      && audio.narration.uploadedSource.storagePath.length > 0;
  }

  return status === "generated";
}

function isSfxReady(audio = {}) {
  if (audio?.sfx?.enabled === false) {
    return true;
  }

  return audio?.sfx?.status === "generated";
}

const defaultSettings = {
  scriptAgentModel: MODEL_CONFIG.script.default,
  imageAgentModel: MODEL_CONFIG.image.default,
  videoAgentModel: MODEL_CONFIG.video.default,
  voiceId: MODEL_CONFIG.voice.default,
  projectLanguage: "english",
  tone: "",
  narrationStyle: "",
  visualStyle: "",
  targetDuration: "Determined by script length",
  graphics: {
    focusedModuleId: "text-reveal",
    moduleState: {
      "text-reveal": true,
      "lower-third": false,
      "stat-counter": false,
    },
    variantState: {
      "text-reveal": "Viral",
      "lower-third": "Minimal",
      "stat-counter": "Burst",
    },
  },
  effects: {
    clipMode: "static",
    motionStyle: "vertical-pan",
    moduleState: {
      "reactive-fx": true,
      "hook-effect": false,
      "video-ending": true,
    },
    videoEndingDuration: 2,
  },
};

const defaultScript = {
  mode: "ai",
  topic: "",
  content: "",
  model: MODEL_CONFIG.script.default,
  source: "draft",
  updatedAt: null,
};

const defaultScenes = [];

const defaultAudio = {
  narration: {
    voiceId: MODEL_CONFIG.voice.default,
    language: "english",
    status: "draft",
    textPreview: "",
    estimatedDuration: "00:00",
    generatedSource: null,
    uploadedSource: null,
  },
  music: {
    mode: "auto",
    trackName: "",
    mood: "cinematic",
    generationBrief: "",
    uploadedTracks: [],
    generatedSource: null,
    endingFadeEnabled: true,
    endingFadeDuration: 2.5,
    dynamicVolume: true,
    status: "draft",
  },
  sfx: {
    enabled: true,
    density: "medium",
    status: "draft",
    cues: [],
  },
  generatedAt: null,
};

const defaultCaptionsState = defaultCaptions;
const defaultReview = {
  scenePlan: {
    status: "pending",
    approvedAt: null,
  },
  finalAssembly: {
    status: "pending",
    approvedAt: null,
  },
};

function normalizeReview(review = {}) {
  return {
    ...defaultReview,
    ...review,
    scenePlan: {
      ...defaultReview.scenePlan,
      ...(review.scenePlan || {}),
    },
    finalAssembly: {
      ...defaultReview.finalAssembly,
      ...(review.finalAssembly || {}),
    },
  };
}

function normalizeReferences(references = []) {
  if (!Array.isArray(references)) {
    return [];
  }

  return references
    .filter((reference) => reference && typeof reference === "object")
    .map((reference, index) => ({
      id: typeof reference.id === "string" && reference.id.length > 0 ? reference.id : `reference-${index + 1}`,
      name: typeof reference.name === "string" ? reference.name : `Reference ${index + 1}`,
      kind: "reference-image",
      label: typeof reference.label === "string" ? reference.label : "style",
      scopeId: typeof reference.scopeId === "string" ? reference.scopeId : null,
      preview: typeof reference.preview === "string" ? reference.preview : null,
      storagePath: typeof reference.storagePath === "string" ? reference.storagePath : null,
      mimeType: typeof reference.mimeType === "string" ? reference.mimeType : null,
      sizeLabel: typeof reference.sizeLabel === "string" ? reference.sizeLabel : null,
      uploadedAt: typeof reference.uploadedAt === "string" ? reference.uploadedAt : null,
    }));
}

function getReferenceStructureSignature(references = []) {
  return normalizeReferences(references).map((reference) => ({
    id: reference.id,
    kind: reference.kind,
    storagePath: reference.storagePath || null,
  }));
}

function referencesStructureChanged(previousReferences = [], nextReferences = []) {
  const previousSignature = getReferenceStructureSignature(previousReferences);
  const nextSignature = getReferenceStructureSignature(nextReferences);

  if (previousSignature.length !== nextSignature.length) {
    return true;
  }

  return previousSignature.some((reference, index) => {
    const nextReference = nextSignature[index];

    return (
      reference.id !== nextReference.id
      || reference.kind !== nextReference.kind
      || reference.storagePath !== nextReference.storagePath
    );
  });
}

function normalizeReferenceSemanticName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getReferenceSemanticSignature(references = []) {
  return normalizeReferences(references).map((reference) => ({
    id: reference.id,
    label: reference.label,
    name: normalizeReferenceSemanticName(reference.name),
  }));
}

function referencesSemanticChanged(previousReferences = [], nextReferences = []) {
  const previousSignature = getReferenceSemanticSignature(previousReferences);
  const nextSignature = getReferenceSemanticSignature(nextReferences);

  if (previousSignature.length !== nextSignature.length) {
    return true;
  }

  return previousSignature.some((reference, index) => {
    const nextReference = nextSignature[index];

    return (
      reference.id !== nextReference.id
      || reference.label !== nextReference.label
      || reference.name !== nextReference.name
    );
  });
}

function normalizeGraphicsSettings(graphics = {}) {
  return {
    ...defaultSettings.graphics,
    ...(graphics || {}),
    moduleState: {
      ...defaultSettings.graphics.moduleState,
      ...(graphics.moduleState || {}),
    },
    variantState: {
      ...defaultSettings.graphics.variantState,
      ...(graphics.variantState || {}),
    },
  };
}

function normalizeEffectsSettings(effects = {}) {
  return {
    ...defaultSettings.effects,
    ...(effects || {}),
    moduleState: {
      ...defaultSettings.effects.moduleState,
      ...(effects.moduleState || {}),
    },
    videoEndingDuration:
      typeof effects.videoEndingDuration === "number"
        ? effects.videoEndingDuration
        : defaultSettings.effects.videoEndingDuration,
  };
}

function normalizeSettings(settings = {}) {
  return {
    ...defaultSettings,
    ...(settings || {}),
    graphics: normalizeGraphicsSettings(settings.graphics || {}),
    effects: normalizeEffectsSettings(settings.effects || {}),
  };
}

function withReviewReset(review, stages) {
  const normalizedReview = normalizeReview(review);
  const nextReview = { ...normalizedReview };

  stages.forEach((stage) => {
    nextReview[stage] = {
      status: "pending",
      approvedAt: null,
    };
  });

  return nextReview;
}

function normalizeScene(scene, index = 0, projectId = "project") {
  const normalizedSceneId = scene.id || `${projectId}-scene-${scene.sceneId || index + 1}`;
  return {
    id: normalizedSceneId,
    sceneId: scene.sceneId || index + 1,
    narration: scene.narration || "",
    visualIntent: scene.visualIntent || "",
    emotion: scene.emotion || "neutral",
    duration: typeof scene.duration === "number" ? scene.duration : 5,
    approvedImageId: scene.approvedImageId || null,
    imageVariants: Array.isArray(scene.imageVariants)
      ? scene.imageVariants.map((variant, variantIndex) => ({
          id: "",
          variantIndex: 1,
          status: "pending",
          palette: "violet",
          shot: "wide frame",
          mood: "dramatic",
          previewTitle: "Variant 1",
          prompt: "",
          ...variant,
          id: variant.id || `${normalizedSceneId}-image-${variantIndex + 1}`,
        }))
      : [],
    approvedVideoId: scene.approvedVideoId || null,
    videoVariants: Array.isArray(scene.videoVariants)
      ? scene.videoVariants.map((variant, variantIndex) => ({
          id: "",
          variantIndex: 1,
          status: "pending",
          engine: "kling-3.0",
          motion: "slow push-in",
          energy: "cinematic",
          previewTitle: "Clip 1",
          prompt: "",
          ...variant,
          id: variant.id || `${normalizedSceneId}-video-${variantIndex + 1}`,
        }))
      : [],
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function createProjectId(title) {
  return `${slugify(title) || "project"}-${randomUUID().slice(0, 8)}`;
}

function resolveProjectStatus(status) {
  return PROJECT_STATUSES.includes(status) ? status : PROJECT_STATUSES[0];
}

function resolveProjectType(type, templateId) {
  if (typeof type === "string" && type.trim().length > 0) {
    return type;
  }

  const template = getTemplateById(templateId);

  if (!template) {
    return "Long Form / YouTube";
  }

  if (template.type === "short") {
    return "Short Form / TikTok";
  }

  if (template.type === "slideshow") {
    return "Slideshow / VSL";
  }

  return "Long Form / YouTube";
}

function isSlideshowProjectType(type = "") {
  return type.toLowerCase().includes("slideshow");
}

function applyTemplateDefaults(template, payload) {
  const templateAudio = template?.defaults?.audio || {};
  const templateCaptions = template?.defaults?.captions || {};

  return {
    ...payload,
    goal: payload.goal || template?.description || template?.style || "",
    type: resolveProjectType(payload.type, template?.id || ""),
    templateId: template?.id || payload.templateId || null,
    templateSnapshot: template ? createTemplateSnapshot(template) : payload.templateSnapshot || null,
    script: {
      ...defaultScript,
      ...(template?.defaults?.script || {}),
      ...(payload.script || {}),
    },
    audio: {
      ...defaultAudio,
      ...templateAudio,
      ...(payload.audio || {}),
      narration: {
        ...defaultAudio.narration,
        ...(templateAudio.narration || {}),
        ...(payload.audio?.narration || {}),
      },
      music: {
        ...defaultAudio.music,
        ...(templateAudio.music || {}),
        ...(payload.audio?.music || {}),
      },
      sfx: {
        ...defaultAudio.sfx,
        ...(templateAudio.sfx || {}),
        ...(payload.audio?.sfx || {}),
        cues: Array.isArray(payload.audio?.sfx?.cues) ? payload.audio.sfx.cues : [],
      },
    },
    captions: normalizeCaptions({
      ...defaultCaptionsState,
      ...(templateCaptions || {}),
      ...(payload.captions || {}),
      style: {
        ...defaultCaptionsState.style,
        ...(templateCaptions.style || {}),
        ...(payload.captions?.style || {}),
      },
    }),
    settings: {
      ...normalizeSettings({
        ...(template?.defaults?.settings || {}),
        ...(payload.settings || {}),
      }),
    },
    review: normalizeReview(payload.review),
    references: normalizeReferences(payload.references),
    scriptLinkedReferences: normalizeReferences(payload.scriptLinkedReferences),
  };
}

function normalizeProject(project) {
  return {
    ...project,
    templateId: project.templateId || null,
    templateSnapshot: project.templateSnapshot || null,
    sceneProduction: project.sceneProduction || null,
    review: normalizeReview(project.review),
    references: normalizeReferences(project.references),
    scriptLinkedReferences: normalizeReferences(project.scriptLinkedReferences),
    script: {
      ...defaultScript,
      ...(project.script || {}),
    },
    settings: {
      ...normalizeSettings(project.settings || {}),
    },
    audio: {
      ...defaultAudio,
      ...(project.audio || {}),
      narration: {
        ...defaultAudio.narration,
        ...(project.audio?.narration || {}),
      },
      music: {
        ...defaultAudio.music,
        ...(project.audio?.music || {}),
      },
      sfx: {
        ...defaultAudio.sfx,
        ...(project.audio?.sfx || {}),
        cues: Array.isArray(project.audio?.sfx?.cues) ? project.audio.sfx.cues : [],
      },
    },
    captions: normalizeCaptions(project.captions),
    assembly: normalizeAssembly(project.assembly),
    scenes: Array.isArray(project.scenes)
      ? project.scenes.map((scene, index) => normalizeScene(scene, index, project.id))
      : defaultScenes,
  };
}

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

    if (!mimeType.startsWith("image/")) {
      res.status(400).json({ error: "Only image references are supported." });
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
      kind: "reference-image",
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

router.get("/", withErrorHandling(async (_req, res) => {
  const projects = await projectsRepository.listProjects();
  res.json({ data: projects.map(normalizeProject) });
}));

router.get("/:id", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project) });
}));

router.post("/", withErrorHandling(async (req, res) => {
  const now = new Date().toISOString();
  const incomingSettings = req.body.settings && typeof req.body.settings === "object" ? req.body.settings : {};
  const incomingScript = req.body.script && typeof req.body.script === "object" ? req.body.script : {};
  const incomingAudio = req.body.audio && typeof req.body.audio === "object" ? req.body.audio : {};
  const incomingCaptions = req.body.captions && typeof req.body.captions === "object" ? req.body.captions : {};
  const incomingReview = req.body.review && typeof req.body.review === "object" ? req.body.review : {};
  const incomingReferences = Array.isArray(req.body.references) ? req.body.references : [];
  const rawScriptLinkedReferences = Array.isArray(req.body.scriptLinkedReferences)
    ? req.body.scriptLinkedReferences
    : [];

  if (exceedsScriptLinkedReferencesLimit(rawScriptLinkedReferences)) {
    res.status(400).json({ error: `Script-linked references are limited to ${maxScriptLinkedReferences} images.` });
    return;
  }

  const incomingScriptLinkedReferences = normalizeScriptLinkedReferences(rawScriptLinkedReferences);
  const templateId = typeof req.body.templateId === "string" ? req.body.templateId : "";
  const matchedTemplate = getTemplateById(templateId);
  const title = typeof req.body.title === "string" && req.body.title.trim().length > 0 ? req.body.title.trim() : "Untitled Project";
  const project = applyTemplateDefaults(matchedTemplate, {
    id: createProjectId(title),
    title,
    goal: typeof req.body.goal === "string" ? req.body.goal : "",
    type: typeof req.body.type === "string" ? req.body.type : "",
    status: resolveProjectStatus(typeof req.body.status === "string" ? req.body.status : PROJECT_STATUSES[0]),
    createdAt: now,
    updatedAt: now,
    templateId: matchedTemplate?.id || null,
    templateSnapshot: matchedTemplate ? createTemplateSnapshot(matchedTemplate) : null,
    review: normalizeReview(incomingReview),
    references: normalizeReferences(incomingReferences),
    scriptLinkedReferences: incomingScriptLinkedReferences,
    script: incomingScript,
    scenes: Array.isArray(req.body.scenes) ? req.body.scenes : [],
    audio: incomingAudio,
    captions: incomingCaptions,
    assembly: normalizeAssembly(req.body.assembly || defaultAssembly),
    settings: incomingSettings,
  });
  project.script.production = project.script.content.trim().length > 0
    ? buildScriptAnalysisHandoff({
        topic: project.script.topic || project.goal || project.title || "project",
        project,
        output: project.script,
      })
    : null;
  project.audio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project,
      audio: project.audio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project,
      audio: project.audio,
    }),
  };

  await projectsRepository.createProject(project);

  res.status(201).json({ data: normalizeProject(project) });
}));

router.patch("/:id", withErrorHandling(async (req, res) => {
  const currentProject = await projectsRepository.getProject(req.params.id);

  if (!currentProject) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const incomingSettings = req.body.settings && typeof req.body.settings === "object" ? req.body.settings : {};
  const incomingScript = req.body.script && typeof req.body.script === "object" ? req.body.script : {};
  const incomingAudio = req.body.audio && typeof req.body.audio === "object" ? req.body.audio : {};
  const incomingCaptions = req.body.captions && typeof req.body.captions === "object" ? req.body.captions : {};
  const incomingReview = req.body.review && typeof req.body.review === "object" ? req.body.review : {};
  const incomingReferences = Array.isArray(req.body.references) ? req.body.references : currentProject.references;
  const rawScriptLinkedReferences = Array.isArray(req.body.scriptLinkedReferences)
    ? req.body.scriptLinkedReferences
    : currentProject.scriptLinkedReferences;

  if (Array.isArray(req.body.scriptLinkedReferences) && exceedsScriptLinkedReferencesLimit(rawScriptLinkedReferences)) {
    res.status(400).json({ error: `Script-linked references are limited to ${maxScriptLinkedReferences} images.` });
    return;
  }

  const incomingScriptLinkedReferences = Array.isArray(req.body.scriptLinkedReferences)
    ? normalizeScriptLinkedReferences(rawScriptLinkedReferences)
    : currentProject.scriptLinkedReferences;
  const incomingScenes = Array.isArray(req.body.scenes) ? req.body.scenes : currentProject.scenes;
  const incomingAssembly = req.body.assembly && typeof req.body.assembly === "object" ? req.body.assembly : {};
  const scenePlanTouched = Array.isArray(req.body.scenes);
  const foundationReferencesTouched = Array.isArray(req.body.references);
  const foundationReferencesMeaningChanged = foundationReferencesTouched
    ? referencesStructureChanged(currentProject.references, incomingReferences)
      || referencesSemanticChanged(currentProject.references, incomingReferences)
    : false;
  const scriptLinkedReferencesTouched = Array.isArray(req.body.scriptLinkedReferences);
  const scriptLinkedReferenceStructureChanged = scriptLinkedReferencesTouched
    ? referencesStructureChanged(currentProject.scriptLinkedReferences, incomingScriptLinkedReferences)
    : false;
  const scriptLinkedReferenceMeaningChanged = scriptLinkedReferencesTouched
    ? referencesSemanticChanged(currentProject.scriptLinkedReferences, incomingScriptLinkedReferences)
    : false;
  const scriptTouched = Boolean(
    req.body.script
    && typeof req.body.script === "object"
    && ["content", "topic", "mode", "model", "source"].some((key) => Object.prototype.hasOwnProperty.call(req.body.script, key))
  );
  const nextTemplateId = typeof req.body.templateId === "string"
    ? req.body.templateId
    : currentProject.templateId || "";
  const matchedTemplate = getTemplateById(nextTemplateId);

  const updatedProject = applyTemplateDefaults(matchedTemplate, {
    ...currentProject,
    title: typeof req.body.title === "string" ? req.body.title : currentProject.title,
    goal: typeof req.body.goal === "string" ? req.body.goal : currentProject.goal,
    type: typeof req.body.type === "string" ? req.body.type : currentProject.type,
    status: resolveProjectStatus(typeof req.body.status === "string" ? req.body.status : currentProject.status),
    updatedAt: new Date().toISOString(),
    templateId: matchedTemplate?.id || null,
    templateSnapshot: matchedTemplate ? createTemplateSnapshot(matchedTemplate) : currentProject.templateSnapshot || null,
    review: normalizeReview({
      ...(currentProject.review || {}),
      ...incomingReview,
    }),
    references: normalizeReferences(incomingReferences),
    scriptLinkedReferences: incomingScriptLinkedReferences,
    script: {
      ...currentProject.script,
      ...incomingScript,
    },
    scenes: incomingScenes,
    audio: {
      ...(currentProject.audio || {}),
      ...incomingAudio,
      narration: {
        ...(currentProject.audio?.narration || {}),
        ...(incomingAudio.narration || {}),
      },
      music: {
        ...(currentProject.audio?.music || {}),
        ...(incomingAudio.music || {}),
      },
      sfx: {
        ...(currentProject.audio?.sfx || {}),
        ...(incomingAudio.sfx || {}),
        cues: Array.isArray(incomingAudio.sfx?.cues)
          ? incomingAudio.sfx.cues
          : Array.isArray(currentProject.audio?.sfx?.cues)
            ? currentProject.audio.sfx.cues
            : [],
      },
    },
    captions: normalizeCaptions({
      ...(currentProject.captions || {}),
      ...incomingCaptions,
    }),
    assembly: normalizeAssembly({
      ...(currentProject.assembly || {}),
      ...incomingAssembly,
    }),
    settings: {
      ...normalizeSettings({
        ...(currentProject.settings || {}),
        ...incomingSettings,
      }),
    },
  });
  updatedProject.script.production = updatedProject.script.content.trim().length > 0
    ? buildScriptAnalysisHandoff({
        topic: updatedProject.script.topic || updatedProject.goal || updatedProject.title || "project",
        project: updatedProject,
        output: updatedProject.script,
      })
    : null;
  updatedProject.audio.production = {
    audioPlanRef: `audio-plan-${updatedProject.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project: updatedProject,
      audio: updatedProject.audio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project: updatedProject,
      audio: updatedProject.audio,
    }),
  };
  updatedProject.sceneProduction = scenePlanTouched || scriptTouched || foundationReferencesMeaningChanged || scriptLinkedReferenceMeaningChanged
    ? null
    : currentProject.sceneProduction || null;

  if (scriptTouched) {
    updatedProject.review = withReviewReset(updatedProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.scenes = [];
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(currentProject, "Script changed. Regenerate final assembly.");
  } else if (scenePlanTouched) {
    updatedProject.review = withReviewReset(updatedProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(
      currentProject,
      isSlideshowProjectType(updatedProject.type)
        ? "Slides changed. Regenerate final assembly."
        : "Scenes changed. Regenerate final assembly."
    );
  } else if (foundationReferencesMeaningChanged) {
    updatedProject.review = withReviewReset(currentProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.sceneProduction = null;
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(
      currentProject,
      "Foundation references changed. Regenerate scenes and final assembly."
    );
  } else if (scriptLinkedReferenceStructureChanged || scriptLinkedReferenceMeaningChanged) {
    updatedProject.review = withReviewReset(currentProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.sceneProduction = null;
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(
      currentProject,
      "Script-linked references changed. Regenerate scenes and final assembly."
    );
  } else if (scriptLinkedReferencesTouched) {
    updatedProject.sceneProduction = currentProject.sceneProduction || null;
  }

  await projectsRepository.updateProject(req.params.id, updatedProject);

  const previousNarrationUploadPath = currentProject.audio?.narration?.uploadedSource?.storagePath || null;
  const nextNarrationUploadPath = updatedProject.audio?.narration?.uploadedSource?.storagePath || null;

  if (previousNarrationUploadPath && previousNarrationUploadPath !== nextNarrationUploadPath) {
    await deleteLocalUploadIfPresent(narrationUploadsRoot, previousNarrationUploadPath);
  }

  res.json({ data: normalizeProject(updatedProject) });
}));

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
    review: withReviewReset(project.review, ["scenePlan", "finalAssembly"]),
    script: nextScript,
    sceneProduction: null,
    scenes: [],
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
    review: withReviewReset(project.review, ["scenePlan", "finalAssembly"]),
    script: nextScript,
    sceneProduction: null,
    scenes: [],
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

  const nextScript = generateScriptFromTopic({
    topic,
    project,
    model: typeof req.body.model === "string" ? req.body.model : project.settings.scriptAgentModel,
  });

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    review: withReviewReset(project.review, ["scenePlan", "finalAssembly"]),
    script: nextScript,
    sceneProduction: null,
    scenes: [],
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Script changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: nextScript });
}));

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

  const nextScenePackage = generateScenesFromScript(normalizedProject);
  const now = new Date().toISOString();
  const updatedProject = {
    ...project,
    updatedAt: now,
    review: {
      ...normalizeReview(project.review),
      scenePlan: {
        status: "approved",
        approvedAt: now,
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

router.get("/:id/audio", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).audio });
}));

router.get("/:id/audio/narration-file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const narration = normalizedProject.audio?.narration || {};

  if (
    narration.voiceId === "custom-audio-upload"
    && typeof narration.uploadedSource?.storagePath === "string"
    && narration.uploadedSource.storagePath.length > 0
  ) {
    await sendNarrationSourceAsset(narration.uploadedSource, res, {
      download: req.query.download === "1",
    });
    return;
  }

  let generatedSource = narration.generatedSource || null;

  if (narration.status === "generated") {
    generatedSource = await ensureGeneratedNarrationAsset({
      project: normalizedProject,
      audio: normalizedProject.audio,
    });

    if (
      !narration.generatedSource
      || narration.generatedSource.storagePath !== generatedSource.storagePath
      || narration.generatedSource.id !== generatedSource.id
    ) {
      const updatedProject = {
        ...project,
        updatedAt: new Date().toISOString(),
        audio: {
          ...normalizedProject.audio,
          narration: {
            ...normalizedProject.audio.narration,
            generatedSource,
          },
        },
      };

      await projectsRepository.updateProject(project.id, updatedProject);
    }
  }

  if (!generatedSource) {
    res.status(404).json({ error: "No downloadable narration track is available yet." });
    return;
  }

  await sendNarrationSourceAsset(generatedSource, res, {
    download: req.query.download === "1",
  });
}));

router.get("/:id/audio/music-file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const music = normalizedProject.audio?.music || {};

  if (music.mode === "uploaded" || music.mode === "none" || music.status !== "generated") {
    res.status(404).json({ error: "No downloadable soundtrack is available yet." });
    return;
  }

  const asset = await ensureGeneratedMusicAsset({
    project: normalizedProject,
    audio: normalizedProject.audio,
  });

  if (
    !music.generatedSource
    || music.generatedSource.storagePath !== asset.source.storagePath
    || music.generatedSource.id !== asset.source.id
  ) {
    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      audio: {
        ...normalizedProject.audio,
        music: {
          ...normalizedProject.audio.music,
          generatedSource: asset.source,
        },
      },
    };

    await projectsRepository.updateProject(project.id, updatedProject);
  }

  await sendGeneratedMediaFile(asset, res, {
    download: req.query.download === "1",
  });
}));

router.post(
  "/:id/audio/music-tracks/upload-binary",
  express.raw({ type: "application/octet-stream", limit: "25mb" }),
  withErrorHandling(async (req, res) => {
    await flushPendingUploadCleanupEntries();
    const project = await projectsRepository.getProject(req.params.id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const fileName = typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
    const mimeType = typeof req.query.mimeType === "string" ? req.query.mimeType.trim() : "application/octet-stream";
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!fileName || fileBuffer.length === 0) {
      res.status(400).json({ error: "A music track file is required." });
      return;
    }

    if (!mimeType.startsWith("audio/")) {
      res.status(400).json({ error: "Only audio files are supported for uploaded tracks." });
      return;
    }

    const projectUploadDir = path.join(musicUploadsRoot, sanitizeFileSegment(project.id));
    await fs.mkdir(projectUploadDir, { recursive: true });

    const sanitizedFileName = `${randomUUID()}-${sanitizeFileSegment(fileName)}`;
    const relativeStoragePath = path.join("uploads", "music", sanitizeFileSegment(project.id), sanitizedFileName);
    const absoluteStoragePath = path.join(projectUploadDir, sanitizedFileName);
    await fs.writeFile(absoluteStoragePath, fileBuffer);

    const normalizedProject = normalizeProject(project);
    const nextTrack = {
      id: `music-track-${randomUUID()}`,
      name: fileName,
      sizeLabel: formatFileSize(fileBuffer.length),
      mimeType,
      storagePath: relativeStoragePath,
      uploadedAt: new Date().toISOString(),
    };
    const nextUploadedTracks = [
      ...(normalizedProject.audio?.music?.uploadedTracks || []),
      nextTrack,
    ];
    const nextAudio = {
      ...normalizedProject.audio,
      generatedAt: null,
      music: {
        ...normalizedProject.audio.music,
        mode: "uploaded",
        uploadedTracks: nextUploadedTracks,
        trackName: nextUploadedTracks.map((track) => track.name).join(", "),
        generatedSource: null,
        status: nextUploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0)
          ? "uploaded"
          : "draft",
      },
    };

    nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
      ? new Date().toISOString()
      : null;
    nextAudio.production = {
      audioPlanRef: `audio-plan-${project.id}-v1`,
      voiceDirection: buildVoiceDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
      soundtrackDirection: buildSoundtrackDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
    };

    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      review: withReviewReset(project.review, ["finalAssembly"]),
      audio: nextAudio,
      captions: invalidateCaptions(project.captions),
      assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
    };
    try {
      await projectsRepository.updateProject(project.id, updatedProject);
    } catch (error) {
      await deleteLocalUploadIfPresent(musicUploadsRoot, relativeStoragePath);
      throw error;
    }

    res.json({
      data: {
        audio: nextAudio,
        track: nextTrack,
      },
    });
  }),
);

router.get("/:id/audio/music-tracks/:trackId/file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const track = (normalizedProject.audio?.music?.uploadedTracks || []).find((item) => item.id === req.params.trackId);

  if (!track?.storagePath) {
    res.status(404).json({ error: "Music track not found." });
    return;
  }

  await sendMusicTrackAsset(track, res, {
    download: req.query.download === "1",
  });
}));

router.delete("/:id/audio/music-tracks", withErrorHandling(async (req, res) => {
  await flushPendingUploadCleanupEntries();
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const currentTracks = normalizedProject.audio?.music?.uploadedTracks || [];
  const nextMode = typeof req.query.nextMode === "string" && req.query.nextMode === "auto"
    ? "auto"
    : "uploaded";
  const nextAudio = {
    ...normalizedProject.audio,
    generatedAt: null,
    music: {
      ...normalizedProject.audio.music,
      mode: nextMode,
      uploadedTracks: [],
      trackName: "",
      generatedSource: null,
      status: "draft",
    },
  };

  nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
    ? new Date().toISOString()
    : null;
  nextAudio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
  };

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    review: withReviewReset(project.review, ["finalAssembly"]),
    audio: nextAudio,
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);

  await Promise.all(
    currentTracks
      .map((track) => deleteLocalUploadIfPresent(musicUploadsRoot, track.storagePath)),
  );

  res.json({ data: nextAudio });
}));

router.delete("/:id/audio/music-tracks/:trackId", withErrorHandling(async (req, res) => {
  await flushPendingUploadCleanupEntries();
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const currentTracks = normalizedProject.audio?.music?.uploadedTracks || [];
  const removedTrack = currentTracks.find((item) => item.id === req.params.trackId);

  if (!removedTrack) {
    res.status(404).json({ error: "Music track not found." });
    return;
  }

  const nextUploadedTracks = currentTracks.filter((item) => item.id !== req.params.trackId);
  const nextAudio = {
    ...normalizedProject.audio,
    generatedAt: null,
    music: {
      ...normalizedProject.audio.music,
      uploadedTracks: nextUploadedTracks,
      trackName: nextUploadedTracks.map((track) => track.name).join(", "),
      generatedSource: null,
      status: nextUploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0)
        ? "uploaded"
        : "draft",
    },
  };

  nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
    ? new Date().toISOString()
    : null;
  nextAudio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
  };

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    review: withReviewReset(project.review, ["finalAssembly"]),
    audio: nextAudio,
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);

  await deleteLocalUploadIfPresent(musicUploadsRoot, removedTrack.storagePath);

  res.json({ data: nextAudio });
}));

router.post(
  "/:id/audio/narration-source",
  express.raw({ type: "application/octet-stream", limit: "25mb" }),
  withErrorHandling(async (req, res) => {
    await flushPendingUploadCleanupEntries();
    const project = await projectsRepository.getProject(req.params.id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const fileName = typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
    const mimeType = typeof req.query.mimeType === "string" ? req.query.mimeType.trim() : "application/octet-stream";
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!fileName || fileBuffer.length === 0) {
      res.status(400).json({ error: "A narration source file is required." });
      return;
    }

    if (!mimeType.startsWith("audio/")) {
      res.status(400).json({ error: "Only audio files are supported for uploaded narration." });
      return;
    }

    const projectUploadDir = path.join(narrationUploadsRoot, sanitizeFileSegment(project.id));
    await fs.mkdir(projectUploadDir, { recursive: true });

    const sanitizedFileName = `${randomUUID()}-${sanitizeFileSegment(fileName)}`;
    const relativeStoragePath = path.join("uploads", "narration", sanitizeFileSegment(project.id), sanitizedFileName);
    const absoluteStoragePath = path.join(projectUploadDir, sanitizedFileName);
    await fs.writeFile(absoluteStoragePath, fileBuffer);

    const normalizedProject = normalizeProject(project);
    const previousUploadedSource = normalizedProject.audio?.narration?.uploadedSource || null;
    const nextAudio = {
      ...normalizedProject.audio,
      generatedAt: null,
      narration: {
        ...normalizedProject.audio?.narration,
        voiceId: "custom-audio-upload",
        status: "uploaded",
        textPreview: `Uploaded narration source: ${fileName}`,
        generatedSource: null,
        uploadedSource: {
          id: `narration-source-${randomUUID()}`,
          name: fileName,
          sizeLabel: formatFileSize(fileBuffer.length),
          mimeType,
          storagePath: relativeStoragePath,
          uploadedAt: new Date().toISOString(),
        },
      },
    };

    nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
      ? new Date().toISOString()
      : null;
    nextAudio.production = {
      audioPlanRef: `audio-plan-${project.id}-v1`,
      voiceDirection: buildVoiceDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
      soundtrackDirection: buildSoundtrackDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
    };

    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      review: withReviewReset(project.review, ["finalAssembly"]),
      audio: nextAudio,
      captions: invalidateCaptions(project.captions),
      assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
    };

    try {
      await projectsRepository.updateProject(project.id, updatedProject);
    } catch (error) {
      await deleteLocalUploadIfPresent(narrationUploadsRoot, relativeStoragePath);
      throw error;
    }

    if (previousUploadedSource?.storagePath && previousUploadedSource.storagePath !== relativeStoragePath) {
      await deleteLocalUploadIfPresent(narrationUploadsRoot, previousUploadedSource.storagePath);
    }

    res.json({ data: nextAudio });
  }),
);

router.get("/:id/captions", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).captions });
}));

router.get("/:id/assembly", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).assembly });
}));

router.post("/:id/audio/generate", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const overrides = req.body.audio && typeof req.body.audio === "object" ? req.body.audio : {};
  const normalizedProject = normalizeProject(project);
  let nextAudio;

  try {
    nextAudio = generateAudioStack(normalizedProject, overrides);

    if (nextAudio?.narration?.status === "generated" && nextAudio?.narration?.voiceId !== "custom-audio-upload") {
      nextAudio.narration.generatedSource = await ensureGeneratedNarrationAsset({
        project: normalizedProject,
        audio: nextAudio,
      });
      nextAudio.narration.uploadedSource = null;
    }

    if (nextAudio?.music?.status === "generated" && nextAudio?.music?.mode !== "uploaded" && nextAudio?.music?.mode !== "none") {
      const soundtrackAsset = await ensureGeneratedMusicAsset({
        project: normalizedProject,
        audio: nextAudio,
      });
      nextAudio.music.generatedSource = soundtrackAsset.source;
    } else if (nextAudio?.music) {
      nextAudio.music.generatedSource = null;
    }
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to generate audio for this project.",
    });
    return;
  }

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    review: withReviewReset(project.review, ["finalAssembly"]),
    audio: nextAudio,
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);

  const previousNarrationUploadPath = normalizedProject.audio?.narration?.uploadedSource?.storagePath || null;
  const nextNarrationUploadPath = nextAudio?.narration?.uploadedSource?.storagePath || null;

  if (previousNarrationUploadPath && previousNarrationUploadPath !== nextNarrationUploadPath) {
    await deleteLocalUploadIfPresent(narrationUploadsRoot, previousNarrationUploadPath);
  }

  res.json({ data: nextAudio });
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
    review: withReviewReset(project.review, ["finalAssembly"]),
    captions: nextCaptions,
    assembly: invalidateAssembly(project, "Captions changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);
  res.json({ data: nextCaptions });
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

router.delete("/:id", withErrorHandling(async (req, res) => {
  const wasDeleted = await projectsRepository.deleteProject(req.params.id);

  if (!wasDeleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.status(204).send();
}));

module.exports = {
  projectsRouter: router,
};

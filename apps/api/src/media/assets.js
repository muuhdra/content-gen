const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const generatedMediaRoot = path.resolve(__dirname, "../../data/generated-media");

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

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function createContentFingerprint(parts = []) {
  return createHash("sha1")
    .update(JSON.stringify(parts))
    .digest("hex")
    .slice(0, 12);
}

function wrapText(value = "", maxLength = 38) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word;

    if (candidate.length > maxLength && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      return;
    }

    currentLine = candidate;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.slice(0, 6);
}

function inferDimensions(projectType = "") {
  const normalized = String(projectType || "").toLowerCase();
  return normalized.includes("short")
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

function getPaletteGradient(palette = "") {
  const normalized = String(palette || "").toLowerCase();

  if (normalized.includes("cyan")) return ["#06141f", "#0ea5e9"];
  if (normalized.includes("amber") || normalized.includes("gold")) return ["#1b1205", "#f59e0b"];
  if (normalized.includes("emerald") || normalized.includes("green")) return ["#07150f", "#10b981"];
  if (normalized.includes("rose") || normalized.includes("pink")) return ["#1a0b12", "#fb7185"];
  if (normalized.includes("violet") || normalized.includes("purple")) return ["#10071a", "#8b5cf6"];

  return ["#0b0f18", "#64748b"];
}

function createImageVariantFingerprint(variant = {}) {
  return createContentFingerprint([
    variant.prompt || "",
    variant.palette || "",
    variant.shot || "",
    variant.mood || "",
    variant.previewTitle || "",
    variant.status || "",
  ]);
}

function createVideoVariantFingerprint(variant = {}, imageVariant = null) {
  return createContentFingerprint([
    variant.prompt || "",
    variant.motion || "",
    variant.energy || "",
    variant.engine || "",
    variant.previewTitle || "",
    variant.sourceImageId || imageVariant?.id || "",
    imageVariant ? createImageVariantFingerprint(imageVariant) : "",
  ]);
}

function createNarrationFingerprint(project = {}, audio = {}) {
  const narration = audio?.narration || {};
  return createContentFingerprint([
    project.script?.content || "",
    narration.voiceId || "",
    narration.language || "",
    narration.direction || "",
  ]);
}

function createMusicFingerprint(project = {}, audio = {}) {
  const music = audio?.music || {};
  const sfx = audio?.sfx || {};
  const totalDuration = Array.isArray(project.scenes)
    ? project.scenes.reduce((sum, scene) => sum + (Number(scene?.duration) || 0), 0)
    : 0;

  return createContentFingerprint([
    project.id || "",
    totalDuration,
    music.trackName || "",
    music.mood || "",
    music.generationBrief || "",
    music.endingFadeEnabled !== false,
    music.endingFadeDuration || 0,
    music.dynamicVolume !== false,
    Boolean(sfx.enabled),
    sfx.density || "",
  ]);
}

function buildImageSvg({ project, scene, variant }) {
  const { width, height } = inferDimensions(project.type);
  const [bgA, bgB] = getPaletteGradient(variant.palette);
  const sceneLabel = `${String(project.type || "").toLowerCase().includes("slideshow") ? "Slide" : "Scene"} ${scene.sceneId}`;
  const promptLines = wrapText(variant.prompt || scene.visualIntent || scene.narration, 40);
  const titleLines = wrapText(`${variant.previewTitle || "Visual"} · ${variant.shot || variant.motion || ""}`, 28);
  const subtitle = `${variant.mood || scene.emotion || "cinematic"} · ${variant.palette || "default"}`;

  const titleSvg = titleLines
    .map((line, index) => `<text x="96" y="${170 + index * 58}" font-size="44" font-weight="800" fill="white">${escapeXml(line)}</text>`)
    .join("");

  const promptSvg = promptLines
    .map((line, index) => `<text x="96" y="${height - 260 + index * 36}" font-size="28" font-weight="500" fill="rgba(255,255,255,0.82)">${escapeXml(line)}</text>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgA}" />
      <stop offset="100%" stop-color="${bgB}" />
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="30%" r="55%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.28)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect width="${width}" height="${height}" fill="rgba(5,8,12,0.22)" />
  <circle cx="${Math.round(width * 0.76)}" cy="${Math.round(height * 0.22)}" r="${Math.round(Math.min(width, height) * 0.22)}" fill="url(#glow)" />
  <rect x="${Math.round(width * 0.66)}" y="${Math.round(height * 0.56)}" width="${Math.round(width * 0.24)}" height="${Math.round(height * 0.18)}" rx="32" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.14)" />
  <rect x="72" y="72" width="170" height="42" rx="21" fill="rgba(0,0,0,0.22)" stroke="rgba(255,255,255,0.18)" />
  <text x="96" y="101" font-size="22" font-weight="700" fill="rgba(255,255,255,0.92)">${escapeXml(sceneLabel)}</text>
  ${titleSvg}
  <text x="96" y="${height - 320}" font-size="24" font-weight="700" fill="rgba(255,255,255,0.58)">${escapeXml(subtitle)}</text>
  ${promptSvg}
</svg>`;
}

async function ensureImageVariantAsset({ project, scene, variant }) {
  const { width, height } = inferDimensions(project.type);
  const outputDir = path.join(generatedMediaRoot, "images", sanitizeFileSegment(project.id));
  const baseName = sanitizeFileSegment(`${variant.id || `${project.id}-scene-${scene.sceneId}-image`}-${createImageVariantFingerprint(variant)}`);
  const svgPath = path.join(outputDir, `${baseName}.svg`);
  const pngPath = path.join(outputDir, `${baseName}.png`);

  await fs.mkdir(outputDir, { recursive: true });

  if (!await fileExists(svgPath)) {
    await fs.writeFile(svgPath, buildImageSvg({ project, scene, variant }), "utf8");
  }

  if (await fileExists(pngPath)) {
    return {
      absolutePath: pngPath,
      fileName: `${baseName}.png`,
      contentType: "image/png",
      storagePath: `generated-media/images/${sanitizeFileSegment(project.id)}/${baseName}.png`,
    };
  }

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      svgPath,
      "-frames:v",
      "1",
      "-vf",
      `scale=${width}:${height}`,
      pngPath,
    ]);

    return {
      absolutePath: pngPath,
      fileName: `${baseName}.png`,
      contentType: "image/png",
      storagePath: `generated-media/images/${sanitizeFileSegment(project.id)}/${baseName}.png`,
    };
  } catch {
    return {
      absolutePath: svgPath,
      fileName: `${baseName}.svg`,
      contentType: "image/svg+xml",
      storagePath: `generated-media/images/${sanitizeFileSegment(project.id)}/${baseName}.svg`,
    };
  }
}

function buildVideoFilter(variant = {}, width, height) {
  const motion = String(variant.motion || "").toLowerCase();
  const fps = 30;

  if (motion.includes("horizontal") || motion.includes("truck")) {
    return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)+on*1.8':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
  }

  if (motion.includes("vertical") || motion.includes("tilt") || motion.includes("pedestal")) {
    return `zoompan=z='1.08':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)+on*1.2':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
  }

  if (motion.includes("zoom") || motion.includes("dolly")) {
    return `zoompan=z='min(zoom+0.0016,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
  }

  return `zoompan=z='1.04':x='iw/2-(iw/zoom/2)+sin(on/12)*8':y='ih/2-(ih/zoom/2)':d=1:s=${width}x${height}:fps=${fps},fps=${fps},format=yuv420p`;
}

async function ensureVideoVariantAsset({ project, scene, variant, imageVariant }) {
  const { width, height } = inferDimensions(project.type);
  const outputDir = path.join(generatedMediaRoot, "videos", sanitizeFileSegment(project.id));
  const baseName = sanitizeFileSegment(`${variant.id || `${project.id}-scene-${scene.sceneId}-video`}-${createVideoVariantFingerprint(variant, imageVariant)}`);
  const mp4Path = path.join(outputDir, `${baseName}.mp4`);
  const durationSeconds = Math.max(4, Math.min(12, Math.round(scene.duration || 6)));

  await fs.mkdir(outputDir, { recursive: true });

  if (await fileExists(mp4Path)) {
    return {
      absolutePath: mp4Path,
      fileName: `${baseName}.mp4`,
      contentType: "video/mp4",
      storagePath: `generated-media/videos/${sanitizeFileSegment(project.id)}/${baseName}.mp4`,
    };
  }

  const sourceImage = await ensureImageVariantAsset({
    project,
    scene,
    variant: imageVariant || variant,
  });

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-loop",
      "1",
      "-i",
      sourceImage.absolutePath,
      "-t",
      String(durationSeconds),
      "-vf",
      buildVideoFilter(variant, width, height),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Path,
    ]);
  } catch {
    const fallbackColor = getPaletteGradient(variant.palette)[1];
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${fallbackColor}:s=${width}x${height}:d=${durationSeconds}`,
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Path,
    ]);
  }

  return {
    absolutePath: mp4Path,
    fileName: `${baseName}.mp4`,
    contentType: "video/mp4",
    storagePath: `generated-media/videos/${sanitizeFileSegment(project.id)}/${baseName}.mp4`,
  };
}

function mapVoiceIdToSayVoice(voiceId = "") {
  if (String(voiceId).startsWith("male")) {
    return "Alex";
  }

  return "Samantha";
}

async function ensureGeneratedNarrationAsset({ project, audio }) {
  const narration = audio?.narration || {};
  const outputDir = path.join(generatedMediaRoot, "audio", sanitizeFileSegment(project.id));
  const fingerprint = createNarrationFingerprint(project, audio);
  const baseName = `${sanitizeFileSegment(project.title || project.id)}-narration-${fingerprint}`;
  const aiffPath = path.join(outputDir, `${baseName}.aiff`);
  const m4aPath = path.join(outputDir, `${baseName}.m4a`);
  const scriptContent = String(project.script?.content || "").trim();

  if (!scriptContent) {
    throw new Error("A script is required before generating a downloadable narration track.");
  }

  await fs.mkdir(outputDir, { recursive: true });

  if (!await fileExists(m4aPath)) {
    await execFileAsync("say", [
      "-v",
      mapVoiceIdToSayVoice(narration.voiceId),
      "-o",
      aiffPath,
      scriptContent,
    ]);

    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      aiffPath,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      m4aPath,
    ]);
  }

  const stats = await fs.stat(m4aPath);
  return {
    id: `generated-narration-${sanitizeFileSegment(project.id)}-${fingerprint}`,
    name: `${baseName}.m4a`,
    sizeLabel: formatFileSize(stats.size),
    mimeType: "audio/mp4",
    storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
    uploadedAt: new Date(stats.mtimeMs).toISOString(),
  };
}

function resolveMusicBedConfig(mood = "cinematic") {
  const normalized = String(mood || "").toLowerCase();

  if (normalized.includes("uplifting")) {
    return { base: 220, accent: 440, texture: 660 };
  }

  if (normalized.includes("dark")) {
    return { base: 110, accent: 165, texture: 220 };
  }

  if (normalized.includes("ambient")) {
    return { base: 176, accent: 264, texture: 352 };
  }

  if (normalized.includes("editorial")) {
    return { base: 196, accent: 294, texture: 392 };
  }

  return { base: 147, accent: 294, texture: 440 };
}

async function ensureGeneratedMusicAsset({ project, audio }) {
  const music = audio?.music || {};
  const outputDir = path.join(generatedMediaRoot, "audio", sanitizeFileSegment(project.id));
  const fingerprint = createMusicFingerprint(project, audio);
  const baseName = `${sanitizeFileSegment(project.title || project.id)}-soundtrack-${fingerprint}`;
  const m4aPath = path.join(outputDir, `${baseName}.m4a`);
  const totalDuration = Math.max(
    8,
    Math.round(
      Array.isArray(project.scenes)
        ? project.scenes.reduce((sum, scene) => sum + (Number(scene?.duration) || 0), 0)
        : 0
    ) || 12
  );

  await fs.mkdir(outputDir, { recursive: true });

  if (!await fileExists(m4aPath)) {
    const { base, accent, texture } = resolveMusicBedConfig(music.mood);
    const fadeDuration = music.endingFadeEnabled === false
      ? 0
      : Math.max(0.5, Math.min(Number(music.endingFadeDuration) || 2.5, Math.max(1, totalDuration - 1)));
    const fadeStart = Math.max(0, totalDuration - fadeDuration);
    const filterParts = [
      "[0:a]volume=0.16[a0]",
      "[1:a]volume=0.08[a1]",
      "[2:a]volume=0.04[a2]",
      "[a0][a1][a2]amix=inputs=3:normalize=0",
    ];

    if (fadeDuration > 0) {
      filterParts.push(`afade=t=out:st=${fadeStart}:d=${fadeDuration}`);
    }

    filterParts.push(`volume=${music.dynamicVolume === false ? "0.8" : "0.9"}[outa]`);

    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${base}:duration=${totalDuration}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${accent}:duration=${totalDuration}`,
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${texture}:duration=${totalDuration}`,
      "-filter_complex",
      filterParts.join(";"),
      "-map",
      "[outa]",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      m4aPath,
    ]);
  }

  const stats = await fs.stat(m4aPath);
  return {
    absolutePath: m4aPath,
    fileName: `${baseName}.m4a`,
    contentType: "audio/mp4",
    storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
    source: {
      id: `generated-soundtrack-${sanitizeFileSegment(project.id)}-${fingerprint}`,
      name: `${baseName}.m4a`,
      sizeLabel: formatFileSize(stats.size),
      mimeType: "audio/mp4",
      storagePath: `generated-media/audio/${sanitizeFileSegment(project.id)}/${baseName}.m4a`,
      uploadedAt: new Date(stats.mtimeMs).toISOString(),
    },
  };
}

async function sendGeneratedMediaFile(asset, res, options = {}) {
  const shouldDownload = options.download === true;
  const buffer = await fs.readFile(asset.absolutePath);
  res.setHeader("Content-Type", asset.contentType);
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

  if (shouldDownload) {
    res.setHeader("Content-Disposition", `attachment; filename="${asset.fileName}"`);
  }

  res.send(buffer);
}

module.exports = {
  ensureGeneratedMusicAsset,
  ensureGeneratedNarrationAsset,
  ensureImageVariantAsset,
  ensureVideoVariantAsset,
  sendGeneratedMediaFile,
};

/**
 * Final video compositor.
 * Assembles approved scene visuals + the audio stack into a single MP4 using FFmpeg.
 *
 * Pipeline:
 *   1. Resolve each scene's visual (approved video → clip, approved image → Ken Burns,
 *      otherwise a colored placeholder).
 *   2. Normalize every scene into a silent segment of exactly `scene.duration` seconds
 *      at the project resolution / fps.
 *   3. Concatenate the segments into one silent video track.
 *   4. Mix the narration + music + SFX stems (with music ducked under narration).
 *   5. Mux the video track with the mixed audio → final MP4.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const {
  ensureImageVariantAsset,
  ensureVideoVariantAsset,
  ensureGeneratedNarrationAsset,
  ensureGeneratedMusicAsset,
  ensureGeneratedSfxAsset,
} = require("./assets");
const { sanitizeFileSegment } = require("../lib/files");
const { dataRoot } = require("../lib/paths");
const { sceneRequiresMotion } = require("@cosyl/shared");

const execFileAsync = promisify(execFile);

const renderOutputsRoot = path.join(dataRoot, "render-outputs");
const FPS = 30;

function inferDimensions(projectType = "") {
  return String(projectType || "").toLowerCase().includes("short")
    ? { width: 1080, height: 1920 }
    : { width: 1920, height: 1080 };
}

function getPaletteColor(palette = "") {
  const normalized = String(palette || "").toLowerCase();
  if (normalized.includes("cyan")) return "#0ea5e9";
  if (normalized.includes("amber") || normalized.includes("gold")) return "#f59e0b";
  if (normalized.includes("emerald") || normalized.includes("green")) return "#10b981";
  if (normalized.includes("rose") || normalized.includes("pink")) return "#fb7185";
  if (normalized.includes("violet") || normalized.includes("purple")) return "#8b5cf6";
  return "#475569";
}

function findApprovedImage(scene) {
  const variants = Array.isArray(scene.imageVariants) ? scene.imageVariants : [];
  return variants.find((v) => v.id === scene.approvedImageId)
    || variants.find((v) => v.id === scene.approvedVideoId)
    || variants[0]
    || null;
}

function findApprovedVideo(scene) {
  const variants = Array.isArray(scene.videoVariants) ? scene.videoVariants : [];
  return variants.find((v) => v.id === scene.approvedVideoId) || null;
}

/**
 * Build a silent, normalized segment of exactly `duration` seconds.
 * Returns the absolute path to the segment file.
 */
async function buildSceneSegment({ project, scene, width, height, segmentDir, durationOverride, segmentKey }) {
  const duration = Math.max(
    1,
    Math.round(Number(durationOverride ?? scene.duration) || 5),
  );
  const segmentPath = path.join(segmentDir, `scene-${segmentKey ?? scene.sceneId}.mp4`);
  // Render mode resolution (single source of truth, shared with the render gate):
  // only scenes that REQUIRE motion use their clip; static/hybrid-static scenes
  // render from the image (Ken Burns) even if a clip happens to exist. Using the
  // project-aware check keeps compose consistent with sceneRequiresMotion even
  // when a stale per-scene motionMode disagrees with the project clip mode.
  const approvedVideo = sceneRequiresMotion(project, scene) ? findApprovedVideo(scene) : null;
  const approvedImage = findApprovedImage(scene);

  // 1. Scene has an approved motion clip → refit it to scene.duration
  if (approvedVideo) {
    const videoAsset = await ensureVideoVariantAsset({
      project, scene, variant: approvedVideo, imageVariant: approvedImage,
    });
    // Scale + pad to canvas, loop-to-fill then hard-trim to the exact duration, strip audio.
    await execFileAsync("ffmpeg", [
      "-y", "-stream_loop", "-1", "-i", videoAsset.absolutePath,
      "-t", String(duration),
      "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${FPS},format=yuv420p`,
      "-an", "-r", String(FPS),
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      segmentPath,
    ]);
    return segmentPath;
  }

  // 2. Scene has an approved still → Ken Burns it for scene.duration.
  //    (Skip when the asset is an SVG placeholder — FFmpeg builds without librsvg
  //     can't decode it; fall through to the colored placeholder below.)
  if (approvedImage) {
    const imageAsset = await ensureImageVariantAsset({ project, scene, variant: approvedImage });

    if (imageAsset.contentType !== "image/svg+xml") {
      const zoom = `zoompan=z='min(zoom+0.0012,1.12)':d=${duration * FPS}:s=${width}x${height}:fps=${FPS}`;
      await execFileAsync("ffmpeg", [
        "-y", "-loop", "1", "-i", imageAsset.absolutePath,
        "-t", String(duration),
        "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},${zoom},format=yuv420p`,
        "-an", "-r", String(FPS),
        "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        segmentPath,
      ]);
      return segmentPath;
    }
  }

  // 3. No usable approved visual → solid colored placeholder
  const color = getPaletteColor(approvedImage?.palette);
  await execFileAsync("ffmpeg", [
    "-y", "-f", "lavfi",
    "-i", `color=c=${color}:s=${width}x${height}:d=${duration}:r=${FPS}`,
    "-vf", "format=yuv420p",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    segmentPath,
  ]);
  return segmentPath;
}

/**
 * Resolve and mix the audio stack into a single track of `totalDuration` seconds.
 * Returns the absolute path, or null if there is no audio at all.
 */
async function buildMixedAudio({ project, totalDuration, workDir }) {
  const audio = project.audio || {};
  const inputs = [];   // { path, role }

  // Narration (uploaded source or generated)
  const narration = audio.narration || {};
  if (narration.voiceId === "custom-audio-upload" && narration.uploadedSource?.storagePath) {
    const abs = path.resolve(dataRoot, narration.uploadedSource.storagePath);
    inputs.push({ path: abs, role: "narration" });
  } else if (narration.status === "generated") {
    try {
      const asset = await ensureGeneratedNarrationAsset({ project, audio });
      inputs.push({ path: path.resolve(dataRoot, asset.storagePath), role: "narration" });
    } catch { /* narration optional */ }
  }

  // Music (uploaded tracks or generated bed)
  const music = audio.music || {};
  if (music.mode === "uploaded" && Array.isArray(music.uploadedTracks) && music.uploadedTracks[0]?.storagePath) {
    inputs.push({ path: path.resolve(dataRoot, music.uploadedTracks[0].storagePath), role: "music" });
  } else if (music.mode !== "none" && music.status === "generated") {
    try {
      const asset = await ensureGeneratedMusicAsset({ project, audio });
      inputs.push({ path: asset.absolutePath, role: "music" });
    } catch { /* music optional */ }
  }

  // SFX
  const sfx = audio.sfx || {};
  if (sfx.enabled !== false && sfx.status === "generated") {
    try {
      const asset = await ensureGeneratedSfxAsset({ project, audio });
      if (asset) inputs.push({ path: asset.absolutePath, role: "sfx" });
    } catch { /* sfx optional */ }
  }

  if (inputs.length === 0) return null;

  const mixedPath = path.join(workDir, "mixed-audio.m4a");
  const ffmpegInputs = [];
  const filterChains = [];

  inputs.forEach((input, i) => {
    ffmpegInputs.push("-i", input.path);
    // Per-role gain: narration full, music ducked, sfx slightly under.
    const gain = input.role === "narration" ? 1.0 : input.role === "music" ? 0.18 : 0.6;
    filterChains.push(`[${i}:a]volume=${gain},aresample=44100[a${i}]`);
  });

  const mixLabels = inputs.map((_, i) => `[a${i}]`).join("");
  const filterComplex =
    `${filterChains.join(";")};${mixLabels}amix=inputs=${inputs.length}:duration=longest:normalize=0[outa]`;

  await execFileAsync("ffmpeg", [
    "-y", ...ffmpegInputs,
    "-filter_complex", filterComplex,
    "-map", "[outa]",
    "-t", String(totalDuration),
    "-c:a", "aac", "-b:a", "192k",
    mixedPath,
  ]);

  return mixedPath;
}

/**
 * Compose the final video. Returns metadata about the rendered file.
 */
async function composeFinalVideo({ project, assembly }) {
  const { width, height } = inferDimensions(project.type);
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];

  if (scenes.length === 0) {
    throw new Error("Cannot render: the project has no scenes.");
  }

  const projectSegment = sanitizeFileSegment(project.id);
  const outputDir = path.join(renderOutputsRoot, projectSegment);
  const workDir = path.join(outputDir, "_work");
  const segmentDir = path.join(workDir, "segments");
  await fs.mkdir(segmentDir, { recursive: true });

  // 1. Build the render plan.
  //    When the assembly carries a timeline (agent-generated OR hand-edited in
  //    the Timeline Editor), each timeline item becomes one segment — honoring
  //    its order, per-clip duration (trims) and splits (same sceneId twice).
  //    With no timeline, fall back to one segment per scene in sceneId order.
  const sceneById = new Map(scenes.map((scene) => [scene.sceneId, scene]));
  const timeline = Array.isArray(assembly?.timeline) ? assembly.timeline : [];

  const renderPlan = [];
  if (timeline.length > 0) {
    timeline.forEach((item, index) => {
      const scene = sceneById.get(item.sceneId);
      if (!scene) return; // skip timeline rows whose scene no longer exists
      renderPlan.push({
        scene,
        durationOverride: Number(item.duration) || scene.duration,
        segmentKey: `${index}-${item.sceneId}`,
      });
    });
  }
  // Fallback (or timeline referenced only stale scenes) → one segment per scene.
  if (renderPlan.length === 0) {
    [...scenes]
      .sort((a, b) => a.sceneId - b.sceneId)
      .forEach((scene) => {
        renderPlan.push({ scene, durationOverride: undefined, segmentKey: `${scene.sceneId}` });
      });
  }

  // 2. Build one normalized silent segment per render-plan entry.
  const segmentPaths = [];
  for (const entry of renderPlan) {
    const segmentPath = await buildSceneSegment({
      project,
      scene: entry.scene,
      width,
      height,
      segmentDir,
      durationOverride: entry.durationOverride,
      segmentKey: entry.segmentKey,
    });
    segmentPaths.push(segmentPath);
  }

  // 3. Concatenate the segments into a single silent video track.
  const concatListPath = path.join(workDir, "concat.txt");
  await fs.writeFile(concatListPath, segmentPaths.map((p) => `file '${p}'`).join("\n"), "utf8");
  const silentVideoPath = path.join(workDir, "video-track.mp4");
  await execFileAsync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", concatListPath,
    "-c", "copy", silentVideoPath,
  ]);

  const totalDuration = renderPlan.reduce(
    (sum, entry) => sum + Math.max(1, Math.round(Number(entry.durationOverride ?? entry.scene.duration) || 5)),
    0,
  );

  // 4. Mix the audio stack.
  const mixedAudioPath = await buildMixedAudio({ project, totalDuration, workDir });

  // 5. Mux video + audio (or keep silent if no audio is ready).
  const fileName = `${projectSegment}-final.mp4`;
  const finalPath = path.join(outputDir, fileName);

  if (mixedAudioPath) {
    await execFileAsync("ffmpeg", [
      "-y", "-i", silentVideoPath, "-i", mixedAudioPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart", "-shortest",
      finalPath,
    ]);
  } else {
    await execFileAsync("ffmpeg", [
      "-y", "-i", silentVideoPath,
      "-c:v", "copy", "-movflags", "+faststart",
      finalPath,
    ]);
  }

  // 6. Clean up intermediates (best-effort).
  await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});

  const stats = await fs.stat(finalPath);
  return {
    absolutePath: finalPath,
    fileName,
    storagePath: `render-outputs/${projectSegment}/${fileName}`,
    sizeBytes: stats.size,
    durationSeconds: totalDuration,
    hasAudio: Boolean(mixedAudioPath),
    sceneCount: renderPlan.length,
    resolution: `${width}x${height}`,
  };
}

module.exports = { composeFinalVideo };

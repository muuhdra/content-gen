/**
 * Reference → image data URLs.
 *
 * References can be still images, uploaded VIDEO clips / motion design, or
 * YouTube links. Vision analysis and image-conditioned generation both need
 * IMAGES, so this module normalizes any reference into one or more image data
 * URLs:
 *   - image            → the image itself (Base64 data URL)
 *   - video / motion    → a few representative frames extracted with FFmpeg
 *   - youtube           → the public thumbnail URL (best-effort)
 *
 * Everything is best-effort: failures return [] rather than throwing, so style
 * locking never breaks the pipeline.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { randomUUID } = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const { readReferenceAssetBuffer } = require("../projects/asset-storage");

const execFileAsync = promisify(execFile);

function bufferToDataUrl(buffer, mimeType = "image/png") {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function isVideoReference(reference, mimeType) {
  return (
    String(mimeType || reference?.mimeType || "").startsWith("video/")
    || reference?.kind === "reference-video"
    || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(reference?.storagePath || "")
  );
}

function isYoutubeReference(reference) {
  return (
    reference?.kind === "reference-youtube"
    || /youtube\.com|youtu\.be/i.test(reference?.preview || "")
  );
}

/**
 * Extract up to `count` evenly-spaced frames from a video buffer as JPEG data URLs.
 */
async function extractVideoFrames(buffer, count = 3) {
  const workDir = path.join(os.tmpdir(), `cosyl-refframes-${randomUUID().slice(0, 8)}`);
  await fs.mkdir(workDir, { recursive: true });
  const videoPath = path.join(workDir, "ref-source");
  const dataUrls = [];

  try {
    await fs.writeFile(videoPath, buffer);

    // Duration (best-effort) → pick evenly-spaced timestamps; fall back to 0s.
    let duration = 0;
    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", videoPath,
      ]);
      duration = Number.parseFloat(String(stdout).trim()) || 0;
    } catch { /* keep duration = 0 */ }

    const n = Math.max(1, count);
    const timestamps = duration > 0
      ? Array.from({ length: n }, (_, i) => Math.max(0, (duration * (i + 1)) / (n + 1)))
      : [0];

    for (let i = 0; i < timestamps.length; i += 1) {
      const framePath = path.join(workDir, `frame-${i}.jpg`);
      try {
        await execFileAsync("ffmpeg", [
          "-y", "-ss", String(timestamps[i].toFixed(2)), "-i", videoPath,
          "-frames:v", "1", "-vf", "scale=768:-1", "-q:v", "4", framePath,
        ]);
        const frameBuffer = await fs.readFile(framePath);
        if (frameBuffer.length) dataUrls.push(bufferToDataUrl(frameBuffer, "image/jpeg"));
      } catch { /* skip this frame */ }
    }
  } catch {
    /* return whatever we managed to extract */
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }

  return dataUrls;
}

/**
 * Normalize a single reference into image data URLs (or a public thumbnail URL).
 * @param {object} reference
 * @param {{ maxFrames?: number }} [options]
 * @returns {Promise<string[]>}
 */
async function referenceToImageUrls(reference, { maxFrames = 3 } = {}) {
  if (!reference) return [];

  if (isYoutubeReference(reference)) {
    return reference.preview ? [reference.preview] : [];
  }

  if (!reference.storagePath) return [];

  const asset = await readReferenceAssetBuffer(reference.storagePath);
  if (!asset?.buffer?.length) return [];

  if (isVideoReference(reference, asset.mimeType)) {
    return extractVideoFrames(asset.buffer, maxFrames);
  }

  return [bufferToDataUrl(asset.buffer, asset.mimeType || "image/png")];
}

module.exports = {
  referenceToImageUrls,
  extractVideoFrames,
  bufferToDataUrl,
};

/**
 * File-backed thumbnail store — mutex-protected mutations, same pattern as
 * projects/store.js. Holds the metadata for generated thumbnails (the PNG files
 * themselves live under data/generated-media/thumbnails/).
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const { Mutex } = require("../lib/mutex");
const { dataRoot } = require("../lib/paths");

const dataDirectory = dataRoot;
const thumbnailsFile = path.join(dataDirectory, "thumbnails.json");

const writeMutex = new Mutex();

async function ensureThumbnailsFile() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(thumbnailsFile);
  } catch {
    await fs.writeFile(thumbnailsFile, JSON.stringify([], null, 2), "utf8");
  }
}

async function readThumbnails() {
  await ensureThumbnailsFile();
  try {
    const parsed = JSON.parse(await fs.readFile(thumbnailsFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await fs.writeFile(thumbnailsFile, JSON.stringify([], null, 2), "utf8");
    return [];
  }
}

async function writeThumbnails(thumbnails) {
  await ensureThumbnailsFile();
  await fs.writeFile(thumbnailsFile, JSON.stringify(thumbnails, null, 2), "utf8");
}

async function _atomicWrite(mutateFn) {
  return writeMutex.lock(async () => {
    const thumbnails = await readThumbnails();
    return mutateFn(thumbnails);
  });
}

async function createThumbnail(thumbnail) {
  return _atomicWrite(async (thumbnails) => {
    thumbnails.unshift(thumbnail); // newest first
    await writeThumbnails(thumbnails);
    return thumbnail;
  });
}

async function deleteThumbnail(id) {
  return _atomicWrite(async (thumbnails) => {
    const next = thumbnails.filter((t) => t.id !== id);
    if (next.length === thumbnails.length) return false;
    await writeThumbnails(next);
    return true;
  });
}

module.exports = { readThumbnails, createThumbnail, deleteThumbnail };

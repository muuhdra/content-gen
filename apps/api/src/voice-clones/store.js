/**
 * File-backed store for built voice clones.
 *
 * Shape: Array of { id, name, sourceLabel, createdAt }
 * Voice clone *metadata* only — the actual audio model lives in the
 * ElevenLabs / MiniMax provider; we just keep the IDs so the user doesn't
 * need to re-create them on every device.
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const { Mutex } = require("../lib/mutex");
const { dataRoot } = require("../lib/paths");

const dataDirectory = dataRoot;
const clonesFile = path.join(dataDirectory, "voice-clones.json");

const writeMutex = new Mutex();

async function ensureClonesFile() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(clonesFile);
  } catch {
    await fs.writeFile(clonesFile, JSON.stringify([], null, 2), "utf8");
  }
}

async function readClones() {
  await ensureClonesFile();
  try {
    const parsed = JSON.parse(await fs.readFile(clonesFile, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await fs.writeFile(clonesFile, JSON.stringify([], null, 2), "utf8");
    return [];
  }
}

async function writeClones(clones) {
  await ensureClonesFile();
  await fs.writeFile(clonesFile, JSON.stringify(clones, null, 2), "utf8");
}

module.exports = {
  readClones,
  writeClones: (clones) =>
    writeMutex.lock(async () => {
      await writeClones(clones);
    }),
};

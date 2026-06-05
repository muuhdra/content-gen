/**
 * File-backed store for the Thumbnail Studio reference library
 * (categories + reference thumbnails). Mutex-protected writes, same pattern as
 * thumbnails/store.js. Seeded with a default starter library on first read so
 * the Studio is never empty.
 *
 * Shape: { categories: Category[], references: ReferenceThumbnail[] }
 */
const fs = require("node:fs/promises");
const path = require("node:path");

const { Mutex } = require("../lib/mutex");
const { dataRoot } = require("../lib/paths");

const dataDirectory = dataRoot;
const referencesFile = path.join(dataDirectory, "thumbnail-references.json");

const writeMutex = new Mutex();

// The library starts empty — the user builds a real reference/template library
// from the Thumbnail Studio (create categories, then register references).
const DEFAULT_LIBRARY = {
  categories: [],
  references: [],
};

async function ensureReferencesFile() {
  await fs.mkdir(dataDirectory, { recursive: true });
  try {
    await fs.access(referencesFile);
  } catch {
    await fs.writeFile(referencesFile, JSON.stringify(DEFAULT_LIBRARY, null, 2), "utf8");
  }
}

function normalizeLibrary(parsed) {
  const categories = Array.isArray(parsed?.categories) ? parsed.categories : [];
  const references = Array.isArray(parsed?.references) ? parsed.references : [];
  return { categories, references };
}

async function readLibrary() {
  await ensureReferencesFile();
  try {
    const parsed = JSON.parse(await fs.readFile(referencesFile, "utf8"));
    return normalizeLibrary(parsed);
  } catch {
    await fs.writeFile(referencesFile, JSON.stringify(DEFAULT_LIBRARY, null, 2), "utf8");
    return normalizeLibrary(DEFAULT_LIBRARY);
  }
}

const VALID_FORMATS = new Set(["16:9", "9:16", "1:1"]);

// Defensive sanitisation: keep only well-formed records and the fields we know.
function sanitizeLibrary(library) {
  const categories = (Array.isArray(library?.categories) ? library.categories : [])
    .filter((c) => c && typeof c.id === "string" && typeof c.name === "string")
    .map((c) => ({ id: c.id, name: c.name }));

  const knownCategoryIds = new Set(categories.map((c) => c.id));

  const references = (Array.isArray(library?.references) ? library.references : [])
    .filter((r) => r && typeof r.id === "string" && typeof r.prompt === "string")
    .map((r) => ({
      id: r.id,
      title: typeof r.title === "string" ? r.title : "Untitled",
      prompt: r.prompt,
      categoryId: knownCategoryIds.has(r.categoryId) ? r.categoryId : (categories[0]?.id ?? ""),
      format: VALID_FORMATS.has(r.format) ? r.format : "16:9",
      previewGradient:
        typeof r.previewGradient === "string" && r.previewGradient
          ? r.previewGradient
          : "from-slate-950 via-slate-900 to-slate-800 border-slate-700/40",
      tags: Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === "string") : [],
      ...(typeof r.customImage === "string" ? { customImage: r.customImage } : {}),
    }));

  return { categories, references };
}

async function writeLibrary(library) {
  return writeMutex.lock(async () => {
    await ensureReferencesFile();
    const clean = sanitizeLibrary(library);
    await fs.writeFile(referencesFile, JSON.stringify(clean, null, 2), "utf8");
    return clean;
  });
}

module.exports = { readLibrary, writeLibrary, sanitizeLibrary, DEFAULT_LIBRARY };

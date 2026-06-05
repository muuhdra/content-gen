/**
 * Thumbnail Studio reference library routes.
 *
 *   GET /thumbnails/references  → load the saved library { categories, references }
 *   PUT /thumbnails/references  → replace the whole library (categories + references)
 *
 * Storage follows the project policy: thumbnail references are TEMPLATES, so they
 * persist in Supabase when configured, else in the local JSON file store. The
 * frontend manages the library in local state and persists the full document on
 * every mutation.
 */
const express = require("express");

const { withErrorHandling } = require("../lib/http");
const { createReferencesRepository } = require("./references-repository");
const { DEFAULT_LIBRARY } = require("./references-store");

const router = express.Router();
const referencesRepository = createReferencesRepository();

router.get("/", withErrorHandling(async (_req, res) => {
  let library = await referencesRepository.readLibrary();

  // Seed the default starter library the first time (Supabase row absent).
  if (library === null || library === undefined) {
    library = await referencesRepository.writeLibrary(DEFAULT_LIBRARY);
  }

  res.json({ data: library });
}));

router.put("/", withErrorHandling(async (req, res) => {
  const body = req.body || {};

  if (!Array.isArray(body.categories) || !Array.isArray(body.references)) {
    res.status(400).json({ error: "Body must include `categories` and `references` arrays." });
    return;
  }

  const saved = await referencesRepository.writeLibrary(body);
  res.json({ data: saved });
}));

module.exports = { referencesRouter: router };

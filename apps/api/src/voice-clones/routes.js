/**
 * Voice clone metadata routes.
 *
 *   GET    /voice-clones          → list all saved clones
 *   POST   /voice-clones          → save / upsert a clone { id, name, sourceLabel }
 *   DELETE /voice-clones/:id      → remove a clone
 */
const express = require("express");
const { withErrorHandling } = require("../lib/http");
const { createVoiceClonesRepository } = require("./repository");

const router = express.Router();
const repo = createVoiceClonesRepository();

router.get("/", withErrorHandling(async (_req, res) => {
  const clones = await repo.readClones();
  res.json({ data: clones });
}));

router.post("/", withErrorHandling(async (req, res) => {
  const { id, name, sourceLabel } = req.body || {};
  if (!id || !name) {
    res.status(400).json({ error: "id and name are required." });
    return;
  }
  const saved = await repo.upsertClone({ id, name, sourceLabel: sourceLabel || "" });
  res.json({ data: saved });
}));

router.delete("/:id", withErrorHandling(async (req, res) => {
  await repo.deleteClone(req.params.id);
  res.status(204).send();
}));

module.exports = { voiceClonesRouter: router };

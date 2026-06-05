/**
 * Machine à états — locks in Incohérence #2 fix (Option A).
 *
 * resolveWorkingStatus promotes any authoring action's status to "Active",
 * EXCEPT while a render is in flight ("Rendering") which the worker owns.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { resolveWorkingStatus } = require("@cosyl/shared/types/production");

test("Draft → Active (premier acte d'authoring)", () => {
  assert.equal(resolveWorkingStatus("Draft"), "Active");
});

test("Completed → Active (ré-édition d'un projet rendu)", () => {
  assert.equal(resolveWorkingStatus("Completed"), "Active");
});

test("Active → Active (déjà en cours)", () => {
  assert.equal(resolveWorkingStatus("Active"), "Active");
});

test("Rendering → Rendering (préservé, le worker en a le contrôle)", () => {
  assert.equal(resolveWorkingStatus("Rendering"), "Rendering");
});

test("Statut inconnu → Active par défaut (jamais Rendering)", () => {
  // Defensive: garbage input must never accidentally claim a render is in flight.
  assert.equal(resolveWorkingStatus(undefined), "Active");
  assert.equal(resolveWorkingStatus(null), "Active");
  assert.equal(resolveWorkingStatus(""), "Active");
  assert.equal(resolveWorkingStatus("Garbage"), "Active");
});

/**
 * Reference mutation detection — drives the cascade in PATCH /projects/:id.
 *
 * structureChanged = change in id / kind / storagePath (file or count changed)
 * semanticChanged  = change in label / name (relabel or rename without re-upload)
 *
 * Both trigger scene/captions/assembly invalidation when foundation refs change.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  referencesStructureChanged,
  referencesSemanticChanged,
} = require("../src/projects/project-model");

const refA = { id: "r1", kind: "reference-image", label: "style", name: "Alpha",  storagePath: "p/a.png" };
const refB = { id: "r2", kind: "reference-image", label: "style", name: "Bravo",  storagePath: "p/b.png" };

test("structure: arrays identiques → false", () => {
  assert.equal(referencesStructureChanged([refA, refB], [refA, refB]), false);
});

test("structure: longueurs différentes → true", () => {
  assert.equal(referencesStructureChanged([refA], [refA, refB]), true);
});

test("structure: storagePath modifié → true", () => {
  const updated = { ...refA, storagePath: "p/a-v2.png" };
  assert.equal(referencesStructureChanged([refA], [updated]), true);
});

test("structure: id ou kind modifié → true", () => {
  assert.equal(referencesStructureChanged([refA], [{ ...refA, id: "r1-v2" }]), true);
  assert.equal(referencesStructureChanged([refA], [{ ...refA, kind: "reference-video" }]), true);
});

test("structure: rename seul (name change) → false (couvert par semantic)", () => {
  const renamed = { ...refA, name: "Alpha Prime" };
  assert.equal(referencesStructureChanged([refA], [renamed]), false);
});

test("semantic: name modifié → true", () => {
  const renamed = { ...refA, name: "Alpha Prime" };
  assert.equal(referencesSemanticChanged([refA], [renamed]), true);
});

test("semantic: label modifié → true", () => {
  const relabeled = { ...refA, label: "character" };
  assert.equal(referencesSemanticChanged([refA], [relabeled]), true);
});

test("semantic: name avec espaces multiples / casse différente → false (normalisé)", () => {
  const fuzzy = { ...refA, name: "  ALPHA  " };
  assert.equal(referencesSemanticChanged([refA], [fuzzy]), false);
});

test("semantic: storagePath seul (re-upload même nom) → false", () => {
  const reuploaded = { ...refA, storagePath: "p/a-v2.png" };
  assert.equal(referencesSemanticChanged([refA], [reuploaded]), false);
});

test("invariant: arrays vides → false sur les deux", () => {
  assert.equal(referencesStructureChanged([], []), false);
  assert.equal(referencesSemanticChanged([], []), false);
});

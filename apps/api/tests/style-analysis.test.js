/**
 * Style reverse-engineering agent — input guard.
 * analyzeStyleReferences must refuse to run without at least one reference image
 * (no malformed vision call), independent of API availability.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { analyzeStyleReferences } = require("@cosyl/agents");

test("analyzeStyleReferences is exported", () => {
  assert.equal(typeof analyzeStyleReferences, "function");
});

test("rejects when no reference images are provided", async () => {
  await assert.rejects(
    () => analyzeStyleReferences({ imageUrls: [], userStyleText: "cel-shaded anime" }),
    /at least one reference image/,
  );
});

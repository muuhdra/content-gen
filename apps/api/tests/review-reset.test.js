/**
 * Review reset — locks in Incohérence #3 fix.
 *
 * withReviewReset() must:
 *   - reset the listed stages to { status: "pending", approvedAt: null }
 *   - preserve any other stage on the incoming review (via normalize)
 *   - operate on the merged review (so an incoming approval is overridden by
 *     the reset when content changed, which preserves HITL).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { withReviewReset, normalizeReview } = require("../src/projects/project-model");

test("scenePlan listé: status → pending, approvedAt → null", () => {
  const review = {
    scenePlan: { status: "approved", approvedAt: "2026-01-01T00:00:00.000Z" },
    finalAssembly: { status: "pending", approvedAt: null },
  };

  const next = withReviewReset(review, ["scenePlan"]);

  assert.equal(next.scenePlan.status, "pending");
  assert.equal(next.scenePlan.approvedAt, null);
});

test("stages non listés: préservés tels quels", () => {
  const review = {
    scenePlan: { status: "approved", approvedAt: "2026-01-01T00:00:00.000Z" },
    finalAssembly: { status: "approved", approvedAt: "2026-01-02T00:00:00.000Z" },
  };

  const next = withReviewReset(review, ["scenePlan"]);

  assert.equal(next.finalAssembly.status, "approved");
  assert.equal(next.finalAssembly.approvedAt, "2026-01-02T00:00:00.000Z");
});

test("plusieurs stages: tous reset", () => {
  const review = {
    scenePlan: { status: "approved", approvedAt: "x" },
    finalAssembly: { status: "approved", approvedAt: "y" },
  };

  const next = withReviewReset(review, ["scenePlan", "finalAssembly"]);

  assert.equal(next.scenePlan.status, "pending");
  assert.equal(next.finalAssembly.status, "pending");
});

test("review undefined: normalise puis reset", () => {
  const next = withReviewReset(undefined, ["scenePlan"]);
  assert.equal(next.scenePlan.status, "pending");
  assert.equal(next.finalAssembly.status, "pending"); // default
});

test("normalizeReview: comble les stages manquants avec des défauts pending", () => {
  const next = normalizeReview({ scenePlan: { status: "approved" } });
  assert.equal(next.scenePlan.status, "approved");
  assert.equal(next.finalAssembly.status, "pending");
  assert.equal(next.finalAssembly.approvedAt, null);
});

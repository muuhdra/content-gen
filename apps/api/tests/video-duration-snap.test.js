/**
 * Per-model clip duration snapping.
 *
 * Each video engine only accepts specific durations. We snap the requested
 * scene length to the smallest supported value that still covers it (else the
 * largest). This prevents API rejections — e.g. Hailuo refuses 5s (only 6/10).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const aimlapi = require("@cosyl/agents/llm/aimlapi");
const { resolveSupportedDuration, resolveBudgetResolution } = aimlapi;

test("Hailuo: 5s scene → 6s (5 is not a valid Hailuo duration)", () => {
  assert.equal(resolveSupportedDuration("minimax/hailuo-2.3-fast", 5), 6);
});

test("Hailuo: 7s → 10s; 6s → 6s; 11s → 10s (clamped to largest)", () => {
  assert.equal(resolveSupportedDuration("minimax/hailuo-2.3-fast", 7), 10);
  assert.equal(resolveSupportedDuration("minimax/hailuo-2.3-fast", 6), 6);
  assert.equal(resolveSupportedDuration("minimax/hailuo-2.3-fast", 11), 10);
});

test("Wan: 5s → 5s; 6s → 10s; 12s → 15s", () => {
  assert.equal(resolveSupportedDuration("alibaba/wan-2-7-i2v", 5), 5);
  assert.equal(resolveSupportedDuration("alibaba/wan-2-7-i2v", 6), 10);
  assert.equal(resolveSupportedDuration("alibaba/wan-2-7-i2v", 12), 15);
});

test("Kling: 5s → 5s; 8s → 10s", () => {
  assert.equal(resolveSupportedDuration("klingai/v2.5-turbo/pro/image-to-video", 5), 5);
  assert.equal(resolveSupportedDuration("klingai/v2.5-turbo/pro/image-to-video", 8), 10);
});

test("Unknown model falls back to [5,10]", () => {
  assert.equal(resolveSupportedDuration("some/unknown-model", 5), 5);
  assert.equal(resolveSupportedDuration("some/unknown-model", 9), 10);
});

// ── Budget resolution (cost control) ─────────────────────────────────────────

test("Wan is pinned to 720p (its API default is 1080p — double the cost)", () => {
  assert.equal(resolveBudgetResolution("alibaba/wan-2-7-i2v"), "720p");
});

test("Hailuo is pinned to 768P (matches its budget default casing)", () => {
  assert.equal(resolveBudgetResolution("minimax/hailuo-2.3-fast"), "768P");
});

test("Kling / Seedance / unknown send no resolution param (left to defaults)", () => {
  assert.equal(resolveBudgetResolution("klingai/v2.5-turbo/pro/image-to-video"), null);
  assert.equal(resolveBudgetResolution("bytedance/seedance-2-0-fast"), null);
  assert.equal(resolveBudgetResolution("some/unknown"), null);
});

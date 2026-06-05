/**
 * Hybrid render mode → per-scene motionMode seeding.
 *
 * When scenes are generated, each gets a motionMode based on the project clip
 * mode set in Effects LAB:
 *   - "video"  → every scene "animate"
 *   - "static" → every scene "static"
 *   - "hybrid" → auto-pick ~40% (hook + payoff + ~every 3rd) as "animate"
 * (No API key in tests → deterministic scene path, which is what we assert.)
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { runSceneAgent } = require("@cosyl/agents");

function buildProject(clipMode) {
  const paragraphs = Array.from({ length: 9 }, (_, i) => `Paragraph ${i + 1} narration about the topic.`);
  return {
    id: "proj-hybrid",
    type: "Long-form",
    settings: { effects: { clipMode }, visualStyle: "cinematic" },
    script: { content: paragraphs.join("\n\n") },
  };
}

test("video mode → every scene is animate", async () => {
  const { output } = await runSceneAgent(buildProject("video"));
  assert.ok(output.scenes.length > 0);
  assert.ok(output.scenes.every((s) => s.motionMode === "animate"));
});

test("static mode → every scene is static", async () => {
  const { output } = await runSceneAgent(buildProject("static"));
  assert.ok(output.scenes.every((s) => s.motionMode === "static"));
});

test("hybrid mode → hook + payoff animate, and a partial (not all) middle is animated", async () => {
  const { output } = await runSceneAgent(buildProject("hybrid"));
  const scenes = output.scenes;
  assert.ok(scenes.length >= 4);
  // Hook (first) and payoff (last) always animate.
  assert.equal(scenes[0].motionMode, "animate");
  assert.equal(scenes[scenes.length - 1].motionMode, "animate");
  // It's a genuine mix: at least one static and not everything animated.
  const animated = scenes.filter((s) => s.motionMode === "animate").length;
  assert.ok(animated < scenes.length, "hybrid must leave some scenes static");
  assert.ok(animated >= 2, "hybrid must animate at least hook + payoff");
});

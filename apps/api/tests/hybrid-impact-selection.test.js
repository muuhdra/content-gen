/**
 * Hybrid impact-aware scene selection.
 * The system reads each scene's narration to animate the most captivating ones
 * (within a budget) instead of a blind "every 3rd".
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { scoreSceneImpact, selectHybridAnimatedIndices } = require("@cosyl/agents/sceneAgent");

test("a dramatic, question-laden scene scores higher than a flat one", () => {
  const flat = { narration: "The city was quiet that morning.", emotion: "calm" };
  const punchy = { narration: "But then everything changed — who really killed her?", emotion: "dramatic and intense" };
  const sFlat = scoreSceneImpact(flat, 3, 10);
  const sPunchy = scoreSceneImpact(punchy, 3, 10);
  assert.ok(sPunchy > sFlat, `expected punchy(${sPunchy}) > flat(${sFlat})`);
});

test("selection respects the budget ratio (count = round(total*ratio))", () => {
  const scenes = Array.from({ length: 10 }, (_, i) => ({ narration: `Scene ${i} narration.`, emotion: "steady" }));
  assert.equal(selectHybridAnimatedIndices(scenes, 0.4).size, 4);
  assert.equal(selectHybridAnimatedIndices(scenes, 0.2).size, 2);
  assert.equal(selectHybridAnimatedIndices(scenes, 1).size, 10);
});

test("hook and payoff are favored, and high-impact scenes are picked", () => {
  const scenes = [
    { narration: "A calm opening establishes the setting.", emotion: "bold and attention-grabbing" }, // hook (idx 0)
    { narration: "Some background details, fairly flat.", emotion: "grounded setup" },
    { narration: "Suddenly, the shocking truth was revealed!", emotion: "dramatic and intense" }, // high impact
    { narration: "More quiet exposition here.", emotion: "steady" },
    { narration: "A calm, reflective conclusion.", emotion: "calm and reflective" }, // payoff (last)
  ];
  const picked = selectHybridAnimatedIndices(scenes, 0.6); // 3 of 5
  assert.ok(picked.has(2), "high-impact reveal scene must be animated");
  assert.ok(picked.has(0), "hook should be animated");
});

test("empty scenes → empty selection", () => {
  assert.equal(selectHybridAnimatedIndices([], 0.4).size, 0);
});

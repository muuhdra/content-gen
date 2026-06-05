/**
 * Production handoff contracts — regression guard.
 *
 * Every `buildXHandoff()` runs its output through `createValidatedProductionPayload`,
 * which validates it against the matching factory JSON schema (Ajv) and THROWS on
 * mismatch. So "builds without throwing" == "the handoff matches its schema".
 *
 * This exercises the real builders on a realistic project so a drift between a
 * builder and its schema fails here instead of only at content-generation time.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runSceneAgent,
  runImagePromptAgent,
  runVideoPromptAgent,
  runAssemblyAgent,
} = require("@cosyl/agents");
const {
  buildScriptAnalysisHandoff,
  buildImageGenerationHandoff,
  buildVoiceDirectionHandoff,
  buildSoundtrackDirectionHandoff,
} = require("@cosyl/agents/productionHandoff");
const { defaultProjects } = require("../src/projects/defaults");

function sampleProject() {
  return JSON.parse(JSON.stringify(defaultProjects[0]));
}

test("01 script-analysis handoff matches its schema", () => {
  const project = sampleProject();
  const output = {
    mode: "ai",
    topic: project.title,
    content: project.script.content,
    model: "claude-sonnet-4-6",
    source: "generated",
    updatedAt: null,
  };
  assert.doesNotThrow(() => buildScriptAnalysisHandoff({ topic: project.title, project, output }));
});

test("02 scene-generation handoff matches its schema", async () => {
  const project = sampleProject();
  const result = await runSceneAgent(project); // validates scene handoff internally
  assert.ok(result.production, "scene agent should attach a production handoff");
  assert.ok(result.output.scenes.length > 0, "sample script should yield scenes");
});

test("03 + 04 image handoffs match their schemas", async () => {
  const project = sampleProject();
  const scenes = (await runSceneAgent(project)).output.scenes;
  const scene = scenes[0];

  const imageResult = runImagePromptAgent({ scene, project, count: 2 }); // validates 03 internally
  assert.ok(imageResult.output.variants.length === 2);

  const variant = imageResult.output.variants[0];
  assert.doesNotThrow(() => buildImageGenerationHandoff({ scene, project, variant }));
});

test("05 motion-video handoff matches its schema", async () => {
  const project = sampleProject();
  const scenes = (await runSceneAgent(project)).output.scenes;
  const scene = scenes[0];

  // Approve an image so the video agent has a base visual.
  const imageResult = runImagePromptAgent({ scene, project, count: 1 });
  scene.imageVariants = imageResult.output.variants;
  scene.approvedImageId = imageResult.output.variants[0].id;

  assert.doesNotThrow(() => runVideoPromptAgent({ scene, project, count: 2 })); // validates 05 internally
});

test("06 voice-direction handoff matches its schema", () => {
  const project = sampleProject();
  assert.doesNotThrow(() => buildVoiceDirectionHandoff({ project, audio: project.audio }));
});

test("07 soundtrack-direction handoff matches its schema", () => {
  const project = sampleProject();
  assert.doesNotThrow(() => buildSoundtrackDirectionHandoff({ project, audio: project.audio }));
});

test("08 assembly handoff matches its schema", async () => {
  const project = sampleProject();
  project.scenes = (await runSceneAgent(project)).output.scenes;
  assert.doesNotThrow(() => runAssemblyAgent({ project, previousHistory: [] })); // validates 08 internally
});

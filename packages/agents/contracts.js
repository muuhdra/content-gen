function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertString(value, label) {
  assert(typeof value === "string", `${label} must be a string`);
}

function assertNumber(value, label) {
  assert(typeof value === "number" && Number.isFinite(value), `${label} must be a finite number`);
}

function assertBoolean(value, label) {
  assert(typeof value === "boolean", `${label} must be a boolean`);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array`);
}

function assertObject(value, label) {
  assert(isPlainObject(value), `${label} must be an object`);
}

function createStructuredAgentResult({ agent, schema, model, output, validate, production = null }) {
  assertString(agent, "agent");
  assertString(schema, "schema");
  assertString(model, "model");
  assert(typeof validate === "function", "validate must be a function");

  validate(output);

  return {
    agent,
    schema,
    model,
    generatedAt: new Date().toISOString(),
    output,
    production,
  };
}

function validateScriptOutput(output) {
  assertObject(output, "script output");
  assert(output.mode === "ai" || output.mode === "manual", "script.mode must be ai or manual");
  assertString(output.topic, "script.topic");
  assertString(output.content, "script.content");
  assertString(output.model, "script.model");
  assert(["generated", "manual", "draft"].includes(output.source), "script.source must be generated, manual or draft");
  assert(output.updatedAt === null || typeof output.updatedAt === "string", "script.updatedAt must be null or a string");
}

function validateSceneOutput(output) {
  assertObject(output, "scene output");
  assertArray(output.scenes, "scene output.scenes");

  output.scenes.forEach((scene, index) => {
    assertObject(scene, `scene[${index}]`);
    assertString(scene.id, `scene[${index}].id`);
    assertNumber(scene.sceneId, `scene[${index}].sceneId`);
    assertString(scene.narration, `scene[${index}].narration`);
    assertString(scene.visualIntent, `scene[${index}].visualIntent`);
    assertString(scene.emotion, `scene[${index}].emotion`);
    assertNumber(scene.duration, `scene[${index}].duration`);
    assertNumber(scene.pauseDuration, `scene[${index}].pauseDuration`);
    assert(scene.approvedImageId === null || typeof scene.approvedImageId === "string", `scene[${index}].approvedImageId must be null or a string`);
    assertArray(scene.imageVariants, `scene[${index}].imageVariants`);
    assert(scene.approvedVideoId === null || typeof scene.approvedVideoId === "string", `scene[${index}].approvedVideoId must be null or a string`);
    assertArray(scene.videoVariants, `scene[${index}].videoVariants`);
  });
}

function validateImagePromptOutput(output) {
  assertObject(output, "image prompt output");
  assertArray(output.variants, "image prompt output.variants");

  output.variants.forEach((variant, index) => {
    assertObject(variant, `imageVariant[${index}]`);
    assertString(variant.id, `imageVariant[${index}].id`);
    assertNumber(variant.variantIndex, `imageVariant[${index}].variantIndex`);
    assert(["pending", "approved"].includes(variant.status), `imageVariant[${index}].status must be pending or approved`);
    assertString(variant.palette, `imageVariant[${index}].palette`);
    assertString(variant.shot, `imageVariant[${index}].shot`);
    assertString(variant.mood, `imageVariant[${index}].mood`);
    assertString(variant.previewTitle, `imageVariant[${index}].previewTitle`);
    assertString(variant.prompt, `imageVariant[${index}].prompt`);
  });
}

function validateVideoPromptOutput(output) {
  assertObject(output, "video prompt output");
  assertArray(output.variants, "video prompt output.variants");

  output.variants.forEach((variant, index) => {
    assertObject(variant, `videoVariant[${index}]`);
    assertString(variant.id, `videoVariant[${index}].id`);
    assertNumber(variant.variantIndex, `videoVariant[${index}].variantIndex`);
    assert(["pending", "approved"].includes(variant.status), `videoVariant[${index}].status must be pending or approved`);
    assertString(variant.engine, `videoVariant[${index}].engine`);
    assertString(variant.motion, `videoVariant[${index}].motion`);
    assertString(variant.energy, `videoVariant[${index}].energy`);
    assertString(variant.previewTitle, `videoVariant[${index}].previewTitle`);
    assertString(variant.prompt, `videoVariant[${index}].prompt`);
  });
}

function validateAssemblyOutput(output) {
  assertObject(output, "assembly output");
  assertString(output.status, "assembly.status");
  assert(output.generatedAt === null || typeof output.generatedAt === "string", "assembly.generatedAt must be null or a string");
  assertString(output.aspectRatio, "assembly.aspectRatio");
  assertString(output.resolution, "assembly.resolution");
  assertNumber(output.totalDurationSeconds, "assembly.totalDurationSeconds");
  assertString(output.totalDurationLabel, "assembly.totalDurationLabel");

  assertObject(output.readiness, "assembly.readiness");
  assertBoolean(output.readiness.hasScenes, "assembly.readiness.hasScenes");
  assertBoolean(output.readiness.hasAudio, "assembly.readiness.hasAudio");
  assertBoolean(output.readiness.hasCaptions, "assembly.readiness.hasCaptions");
  assertBoolean(output.readiness.hasVisualCoverage, "assembly.readiness.hasVisualCoverage");
  assertBoolean(output.readiness.readyToRender, "assembly.readiness.readyToRender");

  assertObject(output.summary, "assembly.summary");
  assertNumber(output.summary.sceneCount, "assembly.summary.sceneCount");
  assertNumber(output.summary.approvedImages, "assembly.summary.approvedImages");
  assertNumber(output.summary.approvedVideos, "assembly.summary.approvedVideos");
  assertNumber(output.summary.captionCueCount, "assembly.summary.captionCueCount");
  assertNumber(output.summary.fallbackImages, "assembly.summary.fallbackImages");
  assertNumber(output.summary.placeholders, "assembly.summary.placeholders");
  assertBoolean(output.summary.musicEnabled, "assembly.summary.musicEnabled");
  assertBoolean(output.summary.sfxEnabled, "assembly.summary.sfxEnabled");

  assertArray(output.timeline, "assembly.timeline");
  assertArray(output.warnings, "assembly.warnings");
  assertObject(output.output, "assembly.output");
  assertString(output.output.title, "assembly.output.title");
  assertString(output.output.fileName, "assembly.output.fileName");
  assertString(output.output.format, "assembly.output.format");
  assertString(output.output.previewLabel, "assembly.output.previewLabel");
  assertArray(output.history, "assembly.history");
}

function validateResearchOutput(output) {
  assertObject(output, "research output");
  assert(output.mode === "ai-research", "research.mode must be ai-research");
  assertString(output.topic, "research.topic");
  assert(["completed", "incomplete"].includes(output.status), "research.status must be completed or incomplete");
  assertString(output.model, "research.model");
  assertString(output.generatedAt, "research.generatedAt");
  assertString(output.brief, "research.brief");
  assertArray(output.sources, "research.sources");

  assertObject(output.webSearch, "research.webSearch");
  assertBoolean(output.webSearch.ok, "research.webSearch.ok");
  assertString(output.webSearch.summary, "research.webSearch.summary");
  assertArray(output.webSearch.citations, "research.webSearch.citations");
  assert(output.webSearch.error === null || typeof output.webSearch.error === "string", "research.webSearch.error must be null or a string");

  assert(output.error === null || typeof output.error === "string", "research.error must be null or a string");
}

function validateThumbnailPromptOutput(prompt) {
  assertString(prompt, "thumbnail prompt");
  assert(prompt.trim().length > 0, "thumbnail prompt must not be empty");
}

module.exports = {
  assert,
  assertArray,
  assertBoolean,
  assertNumber,
  assertObject,
  assertString,
  createStructuredAgentResult,
  validateAssemblyOutput,
  validateImagePromptOutput,
  validateSceneOutput,
  validateScriptOutput,
  validateVideoPromptOutput,
  validateResearchOutput,
  validateThumbnailPromptOutput,
};

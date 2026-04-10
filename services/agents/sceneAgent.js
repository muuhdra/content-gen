const {
  createStructuredAgentResult,
  validateSceneOutput,
} = require("./contracts");
const { buildSceneGenerationHandoff } = require("./productionHandoff");
const { buildReferenceDirective, selectSceneReferenceAnchors } = require("./referenceAnchors");

function splitScriptIntoBlocks(scriptContent) {
  return scriptContent
    .split(/\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !/^generated with\s+/i.test(block));
}

function isSlideshowProject(project) {
  return (project.type || "").toLowerCase().includes("slideshow");
}

function countWords(value) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function estimateSceneDurationFromWords(wordCount, { minimumSeconds, wordsPerSecond }) {
  return Math.max(minimumSeconds, Math.round(wordCount / wordsPerSecond));
}

function getSlideshowDuration(block) {
  const wordCount = countWords(block);

  return estimateSceneDurationFromWords(wordCount, {
    minimumSeconds: 7,
    wordsPerSecond: 2.4,
  });
}

function createSlideshowIntent(block, index, visualStyle) {
  const excerpt = block.slice(0, 140);
  const layout = [
    "headline with two supporting bullets",
    "hero statement with editorial side notes",
    "split layout with text stack and supporting visual",
    "problem-solution slide with strong hierarchy",
  ][index % 4];

  return `Slide ${index + 1} should present: ${excerpt} using a ${layout}, clean text-first pacing and ${visualStyle}.`;
}

function buildReferenceGuidance(project, block, visualStyle) {
  const visualIntent = `Visualize ${block.slice(0, 120)} with ${visualStyle}`;
  const anchors = selectSceneReferenceAnchors(project, {
    sceneText: block,
    visualIntent,
    maxItems: 4,
  });

  if (anchors.length === 0) {
    return "";
  }

  return `Reference anchors to preserve when relevant: ${buildReferenceDirective(anchors)}.`;
}

function createSceneFromBlock(block, index, project) {
  const slideshow = isSlideshowProject(project);
  const wordCount = countWords(block);
  const duration = project.type.toLowerCase().includes("short")
    ? estimateSceneDurationFromWords(wordCount, {
        minimumSeconds: 2,
        wordsPerSecond: 3,
      })
    : slideshow
      ? getSlideshowDuration(block)
      : estimateSceneDurationFromWords(wordCount, {
          minimumSeconds: 4,
          wordsPerSecond: 2.6,
        });
  const visualStyle = project.settings?.visualStyle || "consistent branded visuals";
  const referenceGuidance = buildReferenceGuidance(project, block, visualStyle);
  const tone = project.settings?.tone || "clear";

  return {
    id: `${project.id}-scene-${index + 1}`,
    sceneId: index + 1,
    narration: block,
    visualIntent: slideshow
      ? [createSlideshowIntent(block, index, visualStyle), referenceGuidance].filter(Boolean).join(" ")
      : [`Scene ${index + 1} should visualize: ${block.slice(0, 120)} with ${visualStyle}.`, referenceGuidance].filter(Boolean).join(" "),
    emotion: tone,
    duration,
    approvedImageId: null,
    imageVariants: [],
    approvedVideoId: null,
    videoVariants: [],
  };
}

function runSceneAgent(project) {
  const scriptContent = project.script?.content || "";
  const blocks = splitScriptIntoBlocks(scriptContent);
  const output = {
    scenes: blocks.map((block, index) => createSceneFromBlock(block, index, project)),
  };

  return createStructuredAgentResult({
    agent: "sceneAgent",
    schema: "cosyl.scenes.v1",
    model: project.settings?.scriptAgentModel || "structured-scene-agent",
    output,
    validate: validateSceneOutput,
    production: buildSceneGenerationHandoff({
      project,
      output,
    }),
  });
}

module.exports = {
  runSceneAgent,
};

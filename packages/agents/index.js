const { runScriptAgent } = require("./scriptAgent");
const { runSceneAgent } = require("./sceneAgent");
const { runImagePromptAgent } = require("./imagePromptAgent");
const { runVideoPromptAgent } = require("./videoPromptAgent");
const { runAssemblyAgent } = require("./assemblyAgent");
const { runResearchAgent } = require("./researchAgent");
const { generateThumbnailPrompt } = require("./thumbnailPromptAgent");
const { analyzeStyleReferences } = require("./styleAnalysisAgent");

module.exports = {
  runAssemblyAgent,
  runImagePromptAgent,
  runSceneAgent,
  runScriptAgent,
  runVideoPromptAgent,
  runResearchAgent,
  generateThumbnailPrompt,
  analyzeStyleReferences,
};

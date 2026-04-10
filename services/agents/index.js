const { runScriptAgent } = require("./scriptAgent");
const { runSceneAgent } = require("./sceneAgent");
const { runImagePromptAgent } = require("./imagePromptAgent");
const { runVideoPromptAgent } = require("./videoPromptAgent");
const { runAssemblyAgent } = require("./assemblyAgent");

module.exports = {
  runAssemblyAgent,
  runImagePromptAgent,
  runSceneAgent,
  runScriptAgent,
  runVideoPromptAgent,
};

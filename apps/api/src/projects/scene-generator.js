const { runSceneAgent } = require("../../../../services/agents");

function generateScenesFromScript(project) {
  const agentResult = runSceneAgent(project);
  return {
    scenes: agentResult.output.scenes,
    production: agentResult.production || null,
  };
}

module.exports = {
  generateScenesFromScript,
};

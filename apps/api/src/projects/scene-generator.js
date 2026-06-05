const { runSceneAgent } = require("@cosyl/agents");

async function generateScenesFromScript(project) {
  const agentResult = await runSceneAgent(project);
  return {
    scenes: agentResult.output.scenes,
    production: agentResult.production || null,
  };
}

module.exports = {
  generateScenesFromScript,
};

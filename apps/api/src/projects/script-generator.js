const { runScriptAgent } = require("../../../../services/agents");

function generateScriptFromTopic({ topic, project, model }) {
  const agentResult = runScriptAgent({
    topic,
    project,
    model,
  });

  return {
    ...agentResult.output,
    production: agentResult.production || null,
  };
}

module.exports = {
  generateScriptFromTopic,
};

const { runScriptAgent } = require("@cosyl/agents");

async function generateScriptFromTopic({ topic, project, model, duration }) {
  let finalProjectContext = project;

  // Advance Content: ground the script in the previously-generated research
  // brief (produced by the dedicated research engine). We do NOT re-run
  // research here — the user triggers it explicitly via /research/generate.
  if (project.isAdvanceContent && project.research?.brief) {
    finalProjectContext = {
      ...project,
      script: {
        ...project.script,
        researchHandoff: project.research.brief,
      },
    };
  }

  const agentResult = await runScriptAgent({
    topic,
    project: finalProjectContext,
    model,
    duration,
  });

  return {
    ...agentResult.output,
    production: agentResult.production || null,
  };
}

module.exports = { generateScriptFromTopic };

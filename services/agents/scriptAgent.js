const {
  createStructuredAgentResult,
  validateScriptOutput,
} = require("./contracts");
const { buildScriptAnalysisHandoff } = require("./productionHandoff");

function getProjectScriptBlueprint(projectType, { topic, tone, visualStyle }) {
  if ((projectType || "").toLowerCase().includes("short")) {
    return [
      `Hook: Open with a single high-retention line about ${topic} that immediately creates curiosity.`,
      `Setup: Explain the core context of ${topic} in a ${tone} tone, staying concise and easy to follow.`,
      `Beat: Deliver the most surprising or useful detail, phrased in a way that can become a strong visual moment.`,
      `Payoff: Land the conclusion fast with a memorable takeaway tied to ${visualStyle}.`,
    ];
  }

  if ((projectType || "").toLowerCase().includes("slideshow")) {
    return [
      `Hook: Open the VSL around ${topic} with a direct high-retention promise that immediately frames the opportunity.`,
      `Problem: Clarify the main pain point, bottleneck or misunderstanding the audience faces around ${topic}.`,
      `Agitation: Expand on the consequences of leaving this problem unsolved, while keeping the tone ${tone} and persuasive.`,
      `Context: Explain why most people misunderstand this issue and why the usual advice fails them.`,
      `Mechanism: Introduce the core idea, system or reframing that changes how the audience should think about ${topic}.`,
      `Breakdown: Expand that mechanism into a first clear step that can stand on its own as a focused slide.`,
      `Development: Continue with the next step or supporting principle, keeping the wording clean and presentation-friendly.`,
      `Proof: Add a concrete example, transformation or mini-case study that gives the promise credibility.`,
      `Objection handling: Address the most likely doubt, resistance or misconception the audience may still have.`,
      `Reframe: Show how the viewer should now reinterpret the problem after understanding the full explanation.`,
      `Implication: Describe what improves once the audience applies the insight correctly in the real world.`,
      `Takeaway: End with a concise, premium conclusion that feels persuasive, structured and visually compatible with ${visualStyle}.`,
    ];
  }

  return [
    `Hook: Open the story of ${topic} with a strong statement that establishes why the subject matters.`,
    `Setup: Introduce the wider context of ${topic} in a ${tone} tone, with enough clarity to orient the viewer.`,
    `Background: Add the first layer of factual or historical context that the audience needs before the main development.`,
    `Development: Explain the next important development in a paragraph that can stand on its own as a scene.`,
    `Escalation: Show how the stakes rise, using concrete language and clear cause-and-effect.`,
    `Perspective: Add a human, political, cultural or strategic angle that gives the story depth.`,
    `Turning point: Describe the decisive shift that changes the direction of the story.`,
    `Consequence: Explain the immediate fallout of that turning point in a way that can become a visual sequence.`,
    `Expansion: Continue the story with the next meaningful paragraph instead of compressing everything into one beat.`,
    `Interpretation: Clarify what this sequence of events reveals about ${topic} at a deeper level.`,
    `Resolution: Bring the narrative toward a clear conclusion without rushing the final explanation.`,
    `Takeaway: End with a documentary-style closing insight that feels conclusive and visually translatable within ${visualStyle}.`,
  ];
}

function generateScriptSections({ topic, project }) {
  const tone = project.settings?.tone || "clear and engaging";
  const visualStyle = project.settings?.visualStyle || "coherent visual storytelling";
  const projectType = project.type || "Long Form / YouTube";

  return getProjectScriptBlueprint(projectType, {
    topic,
    tone,
    visualStyle,
  });
}

function runScriptAgent({ topic, project, model }) {
  const cleanedTopic = topic.trim();
  const sections = generateScriptSections({
    topic: cleanedTopic,
    project,
  });
  const output = {
    mode: "ai",
    topic: cleanedTopic,
    content: sections.map((section, index) => `Part ${index + 1}: ${section}`).join("\n"),
    model,
    source: "generated",
    updatedAt: new Date().toISOString(),
  };

  return createStructuredAgentResult({
    agent: "scriptAgent",
    schema: "cosyl.script.v1",
    model,
    output,
    validate: validateScriptOutput,
    production: buildScriptAnalysisHandoff({
      topic: cleanedTopic,
      project,
      output,
    }),
  });
}

module.exports = {
  runScriptAgent,
};

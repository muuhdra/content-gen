const { createStructuredAgentResult, validateScriptOutput } = require("./contracts");
const { buildScriptAnalysisHandoff } = require("./productionHandoff");
const aimlapi = require("./llm/aimlapi");
const anthropicLLM = require("./llm/anthropic");
const openaiLLM = require("./llm/openai");

// ─── Model catalog ───────────────────────────────────────────────────────────
// Maps UI model keys → AIML API model IDs + fallback adapter

// Curated script LLMs (budget short-list): Claude Sonnet 4.6 (default) + GPT-4o.
const MODEL_MAP = {
  "claude-sonnet-4-6": { aimlModel: "claude-sonnet-4-6", fallback: "anthropic" },
  "gpt-4o":            { aimlModel: "gpt-4o",            fallback: "openai" },
};
const DEFAULT_SCRIPT_MODEL = MODEL_MAP["claude-sonnet-4-6"];

function resolveModel(modelKey = "") {
  return MODEL_MAP[modelKey] || DEFAULT_SCRIPT_MODEL;
}

// ─── LLM dispatcher ──────────────────────────────────────────────────────────

async function callLLM({ aimlModel, fallback, systemPrompt, userPrompt, maxTokens }) {
  // 1. AIML API (single key, all models)
  if (aimlapi.isAvailable()) {
    return aimlapi.generateText({ systemPrompt, userPrompt, model: aimlModel, maxTokens });
  }
  // 2. Direct Anthropic key
  if (fallback === "anthropic" && anthropicLLM.isAvailable()) {
    return anthropicLLM.generateText({ systemPrompt, userPrompt, model: aimlModel, maxTokens });
  }
  // 3. Direct OpenAI key
  if (openaiLLM.isAvailable()) {
    return openaiLLM.generateText({ systemPrompt, userPrompt, model: aimlModel, maxTokens });
  }

  throw new Error(
    "No LLM key configured. Set AIML_API_KEY (recommended), ANTHROPIC_API_KEY, or OPENAI_API_KEY in your .env file."
  );
}

// ─── Script blueprints ───────────────────────────────────────────────────────

function getScriptBlueprint(projectType, { topic, tone, visualStyle, duration }) {
  const isShort     = (projectType || "").toLowerCase().includes("short");
  const isSlideshow = (projectType || "").toLowerCase().includes("slideshow");

  if (isShort) {
    return [
      `Hook — One explosive opening line about "${topic}" that creates instant curiosity.`,
      `Setup — Core context of "${topic}" in a ${tone} tone, ultra-concise.`,
      `Beat — The most surprising or useful detail, phrased for maximum visual impact.`,
      `Payoff — Fast, memorable takeaway tied to ${visualStyle}.`,
    ];
  }

  if (isSlideshow) {
    return [
      `Hook — A direct, high-retention promise that immediately frames the opportunity around "${topic}".`,
      `Problem — The main pain point or bottleneck around "${topic}".`,
      `Agitation — Consequences of leaving this unsolved, ${tone} tone.`,
      `Context — Why most people misunderstand this and why usual advice fails.`,
      `Mechanism — The core idea that changes how the audience thinks about "${topic}".`,
      `Breakdown — First clear step or principle.`,
      `Development — Next step, clean and presentation-friendly.`,
      `Proof — Concrete example that gives the promise credibility.`,
      `Objection — The most likely doubt the audience still has.`,
      `Reframe — How the viewer should now reinterpret the problem.`,
      `Implication — What improves once they apply the insight.`,
      `Takeaway — Concise, persuasive conclusion compatible with ${visualStyle}.`,
    ];
  }

  // Long-form YouTube — by duration
  if (duration === "6-8 mins") {
    return [
      `Hook — Open "${topic}" with a strong statement that establishes why it matters.`,
      `Setup — Wider context in a ${tone} tone.`,
      `Development — The next important development as a standalone scene.`,
      `Escalation — Stakes rising, concrete cause-and-effect.`,
      `Turning point — Decisive shift changing the direction.`,
      `Takeaway — Concise, premium conclusion compatible with ${visualStyle}.`,
    ];
  }

  if (duration === "18-20 mins") {
    return [
      `Hook — Open "${topic}" with a strong statement.`,
      `Setup — Wider context in a ${tone} tone.`,
      `Background — Historical or factual context needed before the main development.`,
      `Development — The next important development.`,
      `Conflict — Core conflict or misunderstanding.`,
      `Analysis — Deeper analysis of driving factors.`,
      `Perspective — Human, political, cultural or strategic angle.`,
      `Technical Layer — Behind-the-scenes layer for credibility.`,
      `Escalation — Stakes rising with clear cause-and-effect.`,
      `Case Study — Concrete illustrative example.`,
      `Counter-Intuitive Angle — A perspective that reframes the topic.`,
      `Turning point — Decisive shift.`,
      `Consequence — Immediate fallout.`,
      `Systemic Implication — Widespread implications.`,
      `Expansion — Next meaningful paragraph (not a compression).`,
      `Outlook — Future prospects tied to "${topic}".`,
      `Resolution — Clear conclusion without rushing.`,
      `Takeaway — In-depth closing insight compatible with ${visualStyle}.`,
    ];
  }

  // Default 12-beat
  return [
    `Hook — Open "${topic}" with a statement that establishes why it matters.`,
    `Setup — Wider context in a ${tone} tone.`,
    `Background — First layer of context the audience needs.`,
    `Development — Next important development.`,
    `Escalation — Stakes rising with clear cause-and-effect.`,
    `Perspective — Human or strategic angle that gives depth.`,
    `Turning point — Decisive shift.`,
    `Consequence — Fallout of the turning point.`,
    `Expansion — Continuation instead of compression.`,
    `Interpretation — What the sequence reveals about "${topic}".`,
    `Resolution — Clear conclusion without rushing.`,
    `Takeaway — Documentary-style closing insight compatible with ${visualStyle}.`,
  ];
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildFormatLabel(projectType = "") {
  const t = projectType.toLowerCase();
  if (t.includes("short"))     return "short-form vertical video (TikTok / Reels / Shorts)";
  if (t.includes("slideshow")) return "slideshow / VSL presentation";
  return "long-form YouTube documentary";
}

function buildSystemPrompt({ project, sections, duration }) {
  const tone        = project.settings?.tone || "clear and engaging";
  const visualStyle = project.settings?.visualStyle || "coherent visual storytelling";
  const format      = buildFormatLabel(project.type);
  const language    = project.settings?.projectLanguage || "english";

  const sectionList = sections.map((s, i) => `  ${i + 1}. ${s}`).join("\n");

  return `You are an expert scriptwriter specializing in ${format} content.

Write a complete, production-ready script on the given topic.

FORMAT RULES — critical:
- Write ONLY the narration text, exactly as it will be spoken aloud
- Separate each section with a blank line (one paragraph per section)
- NO headers, NO labels, NO "Part 1:", NO "Hook:", NO stage directions
- NO intro sentence like "Here is your script" — start immediately with the content
- Language: ${language}

STYLE:
- Tone: ${tone}
- Visual style: ${visualStyle}
- Target duration: ${duration || "determined by content"}

STRUCTURE — write exactly ${sections.length} paragraphs in this order:
${sectionList}

Each paragraph should naturally flow into the next, be punchy, and be optimized for video pacing.

STORYTELLING CRAFT (write like a professional studio writer, not a list of facts):
- HOOK: open the very first sentence with a question, tension or stake that makes the viewer NEED to keep watching.
- EMOTIONAL ARC: build deliberately across the paragraphs — setup → rising stakes → turning point → resolution. Each paragraph should raise, shift or pay off the stakes, never just stack information.
- TRANSITIONS: connect each paragraph to the next with a real narrative link (cause-and-effect, contrast, or a question planted earlier and answered later) so it reads as one continuous story.
- SHOW, DON'T TELL: prefer concrete, vivid, sensory and specific detail over abstract or generic statements.
- PAYOFF: land the final paragraph on a resolution that closes the hook and leaves a lasting, memorable impression.

QUALITY BAR (this separates pro scripts from generic AI output):
- RETENTION: front-load value. No slow throat-clearing intro — the first seconds must earn the rest. ${format.includes("short") ? "Every sentence must justify its place; cut anything that doesn't add tension or payoff." : "Re-hook attention at each major turn so viewers don't drop off."}
- SPECIFICITY: use concrete names, numbers, places and examples instead of vague claims. Specific beats generic, always.
- BANNED FILLER: never use empty phrases like "in today's world", "buckle up", "let's dive in", "in conclusion", "the truth is", "little did they know", or rhetorical-question padding. Cut clichés.
- NATURAL VOICE: write for the ear, not the page — varied sentence length, clean rhythm, the way a great narrator actually speaks.

GROUNDING:
- If a RESEARCH BRIEF is provided in the user message, base the script on its verified facts, figures and angles. Prefer concrete, sourced details over generic claims. Do not invent statistics that contradict the brief.`;
}

// Cap the research brief so a long dossier never blows the prompt budget.
const MAX_RESEARCH_BRIEF_CHARS = 6000;

function buildUserPrompt({ topic, goal, researchBrief }) {
  const lines = [`Topic: ${topic}`];
  if (goal && goal.trim()) lines.push(`Goal: ${goal}`);

  if (researchBrief && researchBrief.trim()) {
    lines.push(
      "",
      "=== RESEARCH BRIEF (ground the script in these verified facts, angles and data) ===",
      researchBrief.trim().slice(0, MAX_RESEARCH_BRIEF_CHARS),
      "=== END RESEARCH BRIEF ==="
    );
  }

  return lines.join("\n");
}

// ─── Main agent ──────────────────────────────────────────────────────────────

async function runScriptAgent({ topic, project, model, duration }) {
  const cleanedTopic        = topic.trim();
  const { aimlModel, fallback } = resolveModel(model);

  const tone        = project.settings?.tone || "clear and engaging";
  const visualStyle = project.settings?.visualStyle || "coherent visual storytelling";
  const sections    = getScriptBlueprint(project.type, { topic: cleanedTopic, tone, visualStyle, duration });

  // Advance Content: ground the script in the research brief when present.
  const researchBrief = project.script?.researchHandoff || "";

  const systemPrompt = buildSystemPrompt({ project, sections, duration });
  const userPrompt   = buildUserPrompt({ topic: cleanedTopic, goal: project.goal, researchBrief });

  // Scale the output budget to the script length (≈900 tokens per beat),
  // so long-form (18-20 min, 18 beats) isn't truncated.
  const maxTokens = Math.min(16000, Math.max(2000, sections.length * 900));

  let content;
  try {
    content = await callLLM({ aimlModel, fallback, systemPrompt, userPrompt, maxTokens });
  } catch (err) {
    throw new Error(`Script generation failed (${aimlModel}): ${err.message}`);
  }

  const output = {
    mode: "ai",
    topic: cleanedTopic,
    content,
    model: aimlModel,
    source: "generated",
    updatedAt: new Date().toISOString(),
  };

  return createStructuredAgentResult({
    agent: "scriptAgent",
    schema: "cosyl.script.v1",
    model: aimlModel,
    output,
    validate: validateScriptOutput,
    production: buildScriptAnalysisHandoff({ topic: cleanedTopic, project, output }),
  });
}

module.exports = { runScriptAgent };

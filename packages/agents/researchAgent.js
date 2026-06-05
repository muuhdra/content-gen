/**
 * Research engine — the "Advance Content 2.0" pipeline.
 *
 * Given a topic, user instructions and a list of links (YouTube videos and/or
 * web articles), it:
 *   1. Reads each source     → YouTube transcripts + article text extraction
 *   2. Searches the web       → Perplexity Sonar (grounded, with citations)
 *   3. Synthesises a dossier  → a structured, factual research brief via LLM
 *
 * The brief is what grounds the script generation. The full structured result
 * (per-source status, web findings, citations) is surfaced in the UI so the
 * user can see what was read before generating the script.
 */
const aimlapi = require("./llm/aimlapi");
const { isYouTubeUrl, fetchYouTubeTranscript } = require("./research/youtube");
const { fetchArticle } = require("./research/article");
const { validateResearchOutput } = require("./contracts");

// ─── Source ingestion ─────────────────────────────────────────────────────────

async function ingestLink(url) {
  if (isYouTubeUrl(url)) {
    const result = await fetchYouTubeTranscript(url);
    return result.ok
      ? { type: "youtube", url, status: "read", text: result.text, chars: result.text.length }
      : { type: "youtube", url, status: "failed", error: result.error };
  }

  const result = await fetchArticle(url);
  return result.ok
    ? { type: "article", url, title: result.title, status: "read", text: result.text, chars: result.text.length }
    : { type: "article", url, status: "failed", error: result.error };
}

async function ingestAllLinks(links) {
  const valid = (Array.isArray(links) ? links : []).filter((l) => typeof l === "string" && l.trim());
  return Promise.all(valid.map((url) => ingestLink(url.trim())));
}

// ─── Web search ────────────────────────────────────────────────────────────────

// Multi-angle grounded web search: two focused passes that together cover the
// "verified" picture — established facts AND recent/contested developments. Run
// in parallel; merge summaries and dedupe citations across both.
async function runWebSearch({ topic, instructions }) {
  const angle = instructions ? ` (focus: ${instructions})` : "";

  const subQueries = [
    {
      label: "Core verified facts",
      query: `Provide the most important VERIFIED facts about "${topic}"${angle}: key figures, dates, statistics, named entities and the current state. Cite reliable, authoritative sources and ground every claim in them.`,
    },
    {
      label: "Recent & contested",
      query: `What are the most RECENT developments and any CONTESTED, debated or commonly-misunderstood points about "${topic}"${angle}? State dates, and note explicitly where credible sources disagree. Ground every claim in cited sources.`,
    },
  ];

  const results = await Promise.all(
    subQueries.map(async (sub) => {
      try {
        const { content, citations } = await aimlapi.searchWeb({ query: sub.query, model: "sonar" });
        return { ok: true, label: sub.label, content: content || "", citations: citations || [] };
      } catch (err) {
        return { ok: false, label: sub.label, content: "", citations: [], error: err instanceof Error ? err.message : "Web search failed." };
      }
    })
  );

  const usable = results.filter((r) => r.ok && r.content.trim());
  if (usable.length === 0) {
    return { ok: false, error: results.find((r) => r.error)?.error || "Web search failed.", summary: "", citations: [] };
  }

  const summary = usable.map((r) => `### ${r.label}\n${r.content}`).join("\n\n");

  // Dedupe citations across both passes by URL.
  const seen = new Set();
  const citations = [];
  for (const r of results) {
    for (const c of r.citations) {
      const url = typeof c === "string" ? c : c?.url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      citations.push(typeof c === "string" ? { title: url, url } : c);
    }
  }

  return { ok: true, summary, citations };
}

// ─── Synthesis ───────────────────────────────────────────────────────────────

// Per-source and total caps so a few long transcripts can't blow the LLM
// context window (or the bill). Long sources are truncated with a marker.
const MAX_CHARS_PER_SOURCE = 8000;
const MAX_TOTAL_SOURCE_CHARS = 28000;

function buildSynthesisPrompt({ topic, instructions, sources, webSummary }) {
  const readSources = sources.filter((s) => s.status === "read");

  let remaining = MAX_TOTAL_SOURCE_CHARS;
  const sourceBlocks = readSources
    .map((s, i) => {
      const label = s.type === "youtube" ? "Video transcript" : `Article${s.title ? ` — ${s.title}` : ""}`;
      const budget = Math.max(0, Math.min(MAX_CHARS_PER_SOURCE, remaining));
      const full = s.text || "";
      const clipped = full.length > budget ? `${full.slice(0, budget)}\n…[truncated]` : full;
      remaining -= clipped.length;
      return `### Source ${i + 1} (${label})\nURL: ${s.url}\n${clipped}`;
    })
    .join("\n\n");

  const userPrompt = [
    `TOPIC: ${topic}`,
    instructions ? `CREATOR INSTRUCTIONS: ${instructions}` : "",
    "",
    webSummary ? `=== LIVE WEB RESEARCH (with sources) ===\n${webSummary}` : "",
    "",
    readSources.length > 0 ? `=== PROVIDED SOURCES (transcripts / articles) ===\n${sourceBlocks}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are a senior research analyst preparing a factual brief for a professional scriptwriter.

From the web research and provided sources below, produce a clean, well-structured research brief.

OUTPUT STRUCTURE (use these exact section headers):
## Key Facts
- The most important, verifiable facts, figures, dates and findings (bullet points).
- Prefix EACH fact with a confidence tag based on source corroboration: [High] (supported by multiple independent sources), [Medium] (one solid source), or [Low] (single weak or unclear source).

## Narrative Angles
- 2-4 compelling angles or storylines the script could take, grounded in the material.

## Notable Quotes & Data
- Striking quotes, statistics or data points worth featuring — attribute each to its source.

## Caveats & Gaps
- Anything uncertain, contested, outdated or missing that the creator should be aware of.

VERIFICATION (critical — this brief must be trustworthy):
- CROSS-CHECK the live web research against the provided sources. Where they AGREE, treat the claim as High confidence. Where they CONFLICT, or a claim appears in only one source, do NOT present it as settled — flag the disagreement under Caveats with what each side says.
- Never invent facts, numbers or dates that are not supported by the material. If something is unknown, say so under Caveats rather than guessing.
- Prefer the most recent and most authoritative source when accounts differ; note the date.

RULES:
- Be factual and specific. Prefer concrete numbers and named entities over vague claims.
- Synthesise across sources; do not just list them.
- Do NOT write the script. This is a research brief only.`;

  return { systemPrompt, userPrompt };
}

async function synthesiseBrief({ topic, instructions, sources, webSummary, model }) {
  const { systemPrompt, userPrompt } = buildSynthesisPrompt({ topic, instructions, sources, webSummary });
  const apiModel = model || "claude-sonnet-4-6";
  return aimlapi.generateText({ systemPrompt, userPrompt, model: apiModel, maxTokens: 4000 });
}

// ─── Public agent ──────────────────────────────────────────────────────────────

/**
 * Run the full research engine.
 * @returns structured research result (async).
 */
async function runResearchAgent({ topic, project, model }) {
  const cleanedTopic = String(topic || "").trim();
  const instructions = project?.goal || "";
  const links = project?.advanceLinks || [];

  // 1. Read provided sources (transcripts + articles), in parallel.
  const sources = await ingestAllLinks(links);

  // 2. Live web search (grounded, with citations).
  const webSearch = await runWebSearch({ topic: cleanedTopic, instructions });

  // 3. Synthesise the factual brief from everything gathered.
  const hasMaterial = sources.some((s) => s.status === "read") || (webSearch.ok && webSearch.summary);
  let brief = "";
  let synthesisError = null;

  if (hasMaterial) {
    try {
      brief = await synthesiseBrief({
        topic: cleanedTopic,
        instructions,
        sources,
        webSummary: webSearch.ok ? webSearch.summary : "",
        model,
      });
    } catch (err) {
      synthesisError = err instanceof Error ? err.message : "Synthesis failed.";
    }
  }

  // Strip the heavy raw text out of the per-source records returned to the client.
  const sourceSummaries = sources.map((s) => {
    const { text, ...rest } = s; // eslint-disable-line no-unused-vars
    return rest;
  });

  const result = {
    mode: "ai-research",
    topic: cleanedTopic,
    status: brief ? "completed" : "incomplete",
    model: model || "claude-sonnet-4-6",
    generatedAt: new Date().toISOString(),
    sources: sourceSummaries,
    webSearch: {
      ok: webSearch.ok,
      summary: webSearch.ok ? webSearch.summary : "",
      citations: webSearch.citations || [],
      error: webSearch.ok ? null : (webSearch.error ?? null),
    },
    brief,
    error: synthesisError,
  };

  validateResearchOutput(result);
  return result;
}

module.exports = { runResearchAgent };

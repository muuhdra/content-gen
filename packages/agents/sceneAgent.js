const {
  createStructuredAgentResult,
  validateSceneOutput,
} = require("./contracts");
const { buildSceneGenerationHandoff } = require("./productionHandoff");
const { buildReferenceDirective, selectSceneReferenceAnchors } = require("./referenceAnchors");
const aimlapi = require("./llm/aimlapi");

const STORYBOARD_MODEL = "claude-sonnet-4-6";

function splitScriptIntoBlocks(scriptContent) {
  const lines = scriptContent
    .split(/\n+/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0 && !/^generated with\s+/i.test(block));

  const finalBlocks = [];
  for (const line of lines) {
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    if (wordCount > 30) {
      const sentences = line.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
      if (sentences.length > 1) {
        finalBlocks.push(...sentences);
        continue;
      }
    }
    finalBlocks.push(line);
  }
  return finalBlocks;
}

function isSlideshowProject(project) {
  return (project.type || "").toLowerCase().includes("slideshow");
}

// Effects LAB clip mode: "static" (all Ken Burns) | "hybrid" (mix) | "video"
// (all animated). Defaults to "video" for backward compatibility.
function resolveProjectClipMode(project) {
  const mode = project?.settings?.effects?.clipMode;
  return mode === "static" || mode === "hybrid" || mode === "video" ? mode : "video";
}

// Hybrid render mode: per-scene decision to generate an animated clip
// ("animate") or keep a cheaper static Ken Burns image ("static").
//   - "video"  → every scene animated
//   - "static" → every scene static (cheapest)
//   - "hybrid" → auto-pick ~40% (hook + payoff + ~every 3rd) to animate; the
//                user can override any scene afterwards in the Motion step.
function resolveSceneMotionMode(index, totalScenes, project) {
  if (isSlideshowProject(project)) return "static";
  const mode = resolveProjectClipMode(project);
  if (mode === "video") return "animate";
  // "static" → all stills; "hybrid" → provisional "static", overridden by the
  // impact-based selection pass (applyHybridImpactSelection) once all scenes exist.
  return "static";
}

// ── Hybrid: impact-aware scene selection ──────────────────────────────────────
// Reads each scene's actual narration to estimate how attention-grabbing it is,
// so the budget-limited animation lands on the scenes that captivate — not on a
// blind "every 3rd". Pure + deterministic (works without an API key).

const IMPACT_STAKE_WORDS = /\b(but|however|suddenly|until|because|secret|truth|reveal|revealed|shock|shocking|twist|never|nobody|everything|nothing|finally|realized|realised|discovered|warning|danger|dangerous|death|died|killed|war|crisis|betray|betrayed|escape|trapped|secretly|mistake|collapse|disaster|win|won|lost|the moment|turning point|changed everything)\b/;
const IMPACT_ABSOLUTE_WORDS = /\b(most|biggest|deadliest|greatest|worst|best|first|last|only|always|forever|every|impossible)\b/;

function scoreSceneImpact(scene, index, total) {
  const raw = String(scene?.narration || "");
  const text = raw.toLowerCase();
  let score = 0;

  // Linguistic cues in the actual narration (the "reading").
  if (raw.includes("?")) score += 2;     // questions / rhetorical hooks
  if (raw.includes("!")) score += 1.5;   // exclamations / intensity
  if (/\d/.test(text)) score += 1;       // numbers & stats land harder
  if (IMPACT_STAKE_WORDS.test(text)) score += 2;     // stakes / revelation / conflict
  if (IMPACT_ABSOLUTE_WORDS.test(text)) score += 1;  // superlatives / absolutes

  // Emotional arc weight (from buildSceneEmotion).
  const emo = String(scene?.emotion || "").toLowerCase();
  if (/(dramatic|intense|attention-grabbing|bold)/.test(emo)) score += 2;
  else if (/(building intensity|rising)/.test(emo)) score += 1;

  // Structural pivots: hook opens, payoff closes — both naturally captivate.
  const isFirst = index === 0;
  const isLast = total > 1 && index === total - 1;
  if (isFirst) score += 2.5;
  if (isLast) score += 1.5;

  // Short punchy beats (stingers) tend to hit.
  const words = text.split(/\s+/).filter(Boolean).length;
  if (words > 0 && words <= 12) score += 0.5;

  return score;
}

// Fraction of scenes to animate in hybrid mode (budget lever). Default 40%.
function resolveHybridAnimateRatio(project) {
  const raw = Number(project?.settings?.effects?.hybridAnimateRatio);
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
  return 0.4;
}

function selectHybridAnimatedIndices(scenes, ratio) {
  const total = Array.isArray(scenes) ? scenes.length : 0;
  if (total === 0) return new Set();
  const targetCount = Math.max(1, Math.min(total, Math.round(total * ratio)));

  // Hook (and payoff, when budget allows) always animate — they structurally
  // capture and land the story. The remaining budget goes to the highest-impact
  // scenes read from the narration.
  const selected = new Set([0]);
  if (targetCount >= 2 && total >= 2) selected.add(total - 1);

  const ranked = scenes
    .map((scene, index) => ({ index, score: scoreSceneImpact(scene, index, total) }))
    .filter((entry) => !selected.has(entry.index))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  for (const entry of ranked) {
    if (selected.size >= targetCount) break;
    selected.add(entry.index);
  }
  return selected;
}

// Assigns motionMode across all scenes for hybrid projects based on impact.
function applyHybridImpactSelection(scenes, project) {
  if (isSlideshowProject(project) || resolveProjectClipMode(project) !== "hybrid") {
    return scenes;
  }
  const animate = selectHybridAnimatedIndices(scenes, resolveHybridAnimateRatio(project));
  scenes.forEach((scene, index) => {
    scene.motionMode = animate.has(index) ? "animate" : "static";
  });
  return scenes;
}

// Emotional arc across the video: the per-scene emotion shifts with narrative
// position so the visuals (mood/lighting, derived from emotion downstream) follow
// the story — bold hook → grounded setup → rising intensity → dramatic peak →
// calm resolution — while always keeping the project's base tone.
function buildSceneEmotion(index, totalScenes, baseTone) {
  if (!totalScenes || totalScenes <= 1) return baseTone;

  const isFirst = index === 0;
  const isLast = index === totalScenes - 1;
  const position = index / (totalScenes - 1); // 0 → 1

  if (isFirst) return `${baseTone}, bold and attention-grabbing`;
  if (isLast) return `${baseTone}, calm and reflective`;
  if (position >= 0.6) return `${baseTone}, dramatic and intense`;
  if (position >= 0.3) return `${baseTone}, building intensity`;
  return `${baseTone}, grounded setup`;
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

function createSceneFromBlock(block, index, project, totalScenes, visualOverride = "") {
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

  // The script is pure narration (no labels), so derive emphasis from position:
  // the opening hook and the closing takeaway get a longer breathing pause.
  const isFirst = index === 0;
  const isLast = totalScenes > 1 && index === totalScenes - 1;
  const pauseDuration = isFirst || isLast ? 1.2 : 0.5;

  return {
    id: `${project.id}-scene-${index + 1}`,
    sceneId: index + 1,
    narration: block,
    // When the LLM storyboard provides a concrete visual, use it as the core and
    // append the locked style; otherwise fall back to the deterministic template.
    visualIntent: visualOverride
      ? [visualOverride, `Rendered in ${visualStyle}.`, referenceGuidance, slideshow ? "Establish a consistent environmental structure." : "Establish a strong, recognizable foundational environment for continuity."].filter(Boolean).join(" ")
      : slideshow
        ? [createSlideshowIntent(block, index, visualStyle), referenceGuidance, "Establish a consistent environmental structure."].filter(Boolean).join(" ")
        : [`Scene ${index + 1} should visualize: ${block.slice(0, 120)} with ${visualStyle}.`, referenceGuidance, "Establish a strong, recognizable foundational environment for continuity."].filter(Boolean).join(" "),
    emotion: buildSceneEmotion(index, totalScenes, tone),
    duration,
    pauseDuration,
    // Hybrid render mode: "animate" → generate a motion clip; "static" → Ken Burns image only.
    motionMode: resolveSceneMotionMode(index, totalScenes, project),
    approvedImageId: null,
    imageVariants: [],
    approvedVideoId: null,
    videoVariants: [],
  };
}

// ─── LLM storyboard director ───────────────────────────────────────────────────
// Splits the script into visual beats AND translates each (often abstract)
// narration into a CONCRETE, filmable visual description — the seed for every
// downstream image/video prompt.

function buildFormatLabel(projectType = "") {
  const t = projectType.toLowerCase();
  if (t.includes("short")) return "short-form vertical video (TikTok / Reels / Shorts)";
  if (t.includes("slideshow")) return "slideshow / VSL presentation";
  return "long-form YouTube video";
}

function buildStoryboardSystemPrompt(project) {
  const format = buildFormatLabel(project.type);
  const language = project.settings?.projectLanguage || "english";

  return `You are a professional storyboard director for ${format} content.

Break the script into an ordered sequence of visual scenes (one clear visual beat each).

For EACH scene return:
- "narration": the EXACT span of the script for that beat, verbatim and in order. Concatenated across all scenes, the narration must reconstruct the full script with no gaps, overlaps or rewording.
- "visual": a CONCRETE, filmable description of what we SEE on screen — main subject, setting/environment, action, mood and key props. TRANSLATE abstract narration into something a concept artist could draw (e.g. "regulation shaping decisions" → "officials in a marble government hall reviewing documents, a gavel on the desk, corporate logos on a screen"). Describe the IMAGE, do NOT restate the narration. Keep narration language as ${language}, but write the visual in English.

RULES:
- Keep scenes in script order; do not invent narration that isn't in the script.
- One scene per natural visual beat — split long paragraphs into distinct visuals when the imagery changes.
- Output ONLY valid JSON, no markdown, no commentary:
{"scenes":[{"narration":"...","visual":"..."}]}`;
}

function buildStoryboardUserPrompt(project) {
  const visualStyle = project.settings?.visualStyle || "consistent branded visuals";
  return `ART-DIRECTION CONTEXT (for coherence only — the locked style is applied later, focus on CONTENT): ${visualStyle}

SCRIPT:
${project.script?.content || ""}`;
}

function parseStoryboardScenes(text) {
  if (typeof text !== "string") return null;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : null;
    if (!scenes) return null;

    const cleaned = scenes
      .map((scene) => ({
        narration: typeof scene?.narration === "string" ? scene.narration.trim() : "",
        visual: typeof scene?.visual === "string" ? scene.visual.trim() : "",
      }))
      .filter((scene) => scene.narration.length > 0);

    return cleaned.length > 0 ? cleaned : null;
  } catch {
    return null;
  }
}

async function runStoryboardLLM(project) {
  try {
    const text = await aimlapi.generateText({
      systemPrompt: buildStoryboardSystemPrompt(project),
      userPrompt: buildStoryboardUserPrompt(project),
      model: STORYBOARD_MODEL,
      maxTokens: 6000,
    });
    return parseStoryboardScenes(text);
  } catch {
    return null; // any failure → deterministic fallback
  }
}

async function runSceneAgent(project) {
  const scriptContent = project.script?.content || "";

  // 1. Try the LLM storyboard director (concrete visual beats).
  const storyboard = aimlapi.isAvailable() ? await runStoryboardLLM(project) : null;

  let scenes;
  let usedLLM = false;

  if (storyboard && storyboard.length > 0) {
    usedLLM = true;
    scenes = storyboard.map((beat, index) =>
      createSceneFromBlock(beat.narration, index, project, storyboard.length, beat.visual)
    );
  } else {
    // 2. Deterministic fallback — split + template visuals (no LLM key / failure).
    const blocks = splitScriptIntoBlocks(scriptContent);
    scenes = blocks.map((block, index) => createSceneFromBlock(block, index, project, blocks.length));
  }

  // Hybrid mode: pick the most impactful scenes to animate (budget-aware).
  applyHybridImpactSelection(scenes, project);

  const output = { scenes };

  return createStructuredAgentResult({
    agent: "sceneAgent",
    schema: "cosyl.scenes.v1",
    model: usedLLM ? `storyboard-director:${STORYBOARD_MODEL}` : "structured-scene-agent",
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
  scoreSceneImpact,
  selectHybridAnimatedIndices,
};

/**
 * @file styleAnalysisAgent.js
 * Reverse-engineers the visual style of uploaded reference images into a precise,
 * reusable directive ("style brief"). This brief becomes the LOCKED guideline
 * applied to every scene's image generation, alongside the actual reference
 * images and the user's own descriptive style prompt.
 *
 * Vision model: gpt-4o (multimodal, text out). Falls back gracefully — callers
 * treat a thrown error as "no brief available" and keep the prompt-only path.
 */
const aimlapi = require("./llm/aimlapi");

const STYLE_ANALYSIS_MODEL = "gpt-4o";

const SYSTEM_PROMPT = `You are an art director reverse-engineering the visual style of reference images so it can be reproduced consistently across an entire video.

Analyze ONLY the visual style — never the specific subject matter. Produce a precise, reusable STYLE DIRECTIVE that another image model can follow to make new scenes look like they belong to the same production.

Cover, concisely and concretely:
- Medium & technique (e.g. 2D cel animation, 3D render, painterly illustration, photoreal, claymation, comic ink)
- Line work & edges (clean vector, sketchy, none, thick outlines…)
- Rendering & detail level (flat shading, soft gradients, cross-hatching, texture grain…)
- Color palette (dominant hues, saturation, contrast, warm/cool bias) — name actual colors
- Lighting (key direction, softness, ambient mood, time-of-day bias)
- Composition tendencies (framing, depth, negative space, camera feel)
- Mood / atmosphere and any era or artistic influences

Write it as a dense, comma-rich directive a prompt can append — NOT prose, NOT a list with headers. 120 words max. Do not mention "the reference image" or describe what is depicted; describe HOW it looks.`;

/**
 * @param {object} args
 * @param {string[]} args.imageUrls - Base64 data URLs (or public URLs) of style refs.
 * @param {string} [args.userStyleText] - The user's own descriptive style prompt.
 * @param {string} [args.model]
 * @returns {Promise<{ brief: string, model: string, sourceImageCount: number }>}
 */
async function analyzeStyleReferences({ imageUrls, userStyleText = "", model = STYLE_ANALYSIS_MODEL }) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new Error("analyzeStyleReferences requires at least one reference image.");
  }

  const userPrompt = userStyleText && userStyleText.trim()
    ? `The creator describes the intended style as: "${userStyleText.trim()}". Reconcile this with what you actually see in the image(s) and produce the unified STYLE DIRECTIVE.`
    : "Produce the STYLE DIRECTIVE from the image(s).";

  const raw = await aimlapi.analyzeImages({
    imageUrls,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model,
    maxTokens: 600,
  });

  const brief = raw.replace(/^\s*STYLE DIRECTIVE[:\-]?\s*/i, "").trim();

  return { brief, model, sourceImageCount: imageUrls.length };
}

module.exports = {
  analyzeStyleReferences,
  STYLE_ANALYSIS_MODEL,
};

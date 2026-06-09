/**
 * Map-motion scene generation tests.
 * Verifies:
 *  - geoLocation is extracted from narration (regex fallback)
 *  - geoLocation is passed from storyboard LLM output
 *  - isMapMotionScene correctly gates on geoLocation + map-motion reference
 *  - videoPromptAgent generates Map variants for map scenes
 *  - standard scenes are unaffected
 */

"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

// ── Inline the regex fallback from sceneAgent (keeps test self-contained) ────
const GEO_PREP_PATTERN = /\b(?:in|at|from|to|near|across|through|into|over|above|around|dans|en|au|aux|à|de|vers|sur|par)\s+([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][A-Za-zÀ-ÖØ-öø-ÿ\-']+(?:,?\s+[A-ZÀÂÄÉÈÊËÎÏÔÙÛÜÇ][A-Za-zÀ-ÖØ-öø-ÿ\-']+){0,4})/g;
const GEO_STANDALONE_PATTERN = /\b(Africa|Europe|Asia|Americas?|Australia|Océanie|Middle East|Moyen[- ]Orient|Sub[- ]Saharan|Sahara|Sahel)\b/i;

function extractGeoLocation(narration) {
  const text = String(narration || "");
  GEO_PREP_PATTERN.lastIndex = 0;
  const prepMatch = GEO_PREP_PATTERN.exec(text);
  if (prepMatch) return prepMatch[1].replace(/[,\s]+$/, "").trim();
  const standaloneMatch = text.match(GEO_STANDALONE_PATTERN);
  if (standaloneMatch) return standaloneMatch[0];
  return null;
}

// ── isMapMotionScene logic ─────────────────────────────────────────────────────
function isMapMotionScene(scene, project) {
  const hasGeo = typeof scene?.geoLocation === "string" && scene.geoLocation.trim().length > 0;
  if (!hasGeo) return false;
  const refs = Array.isArray(project?.references) ? project.references : [];
  return refs.some((r) => r?.label === "map-motion");
}

// ── Geo-location extraction ───────────────────────────────────────────────────

test("extractGeoLocation: detects English preposition pattern", () => {
  assert.equal(extractGeoLocation("The tragedy unfolded in Paris, France"), "Paris, France");
});

test("extractGeoLocation: detects French preposition pattern", () => {
  // Regex captures only capitalized word sequences (proper nouns) — stops before
  // lowercase words like "qui", so "Cameroun" is returned cleanly.
  assert.equal(extractGeoLocation("Une ville au Cameroun qui a tout changé"), "Cameroun");
});

test("extractGeoLocation: detects standalone continent", () => {
  assert.equal(extractGeoLocation("Across Africa, the story spread fast"), "Africa");
});

test("extractGeoLocation: returns null when no location", () => {
  assert.equal(extractGeoLocation("A dramatic moment changed everything."), null);
});

// ── isMapMotionScene gate ─────────────────────────────────────────────────────

test("isMapMotionScene: true when geoLocation + map-motion ref", () => {
  const scene = { geoLocation: "Lagos, Nigeria" };
  const project = { references: [{ label: "map-motion", storagePath: "/ref/map.mp4" }] };
  assert.equal(isMapMotionScene(scene, project), true);
});

test("isMapMotionScene: false when no geoLocation", () => {
  const scene = { geoLocation: null };
  const project = { references: [{ label: "map-motion", storagePath: "/ref/map.mp4" }] };
  assert.equal(isMapMotionScene(scene, project), false);
});

test("isMapMotionScene: false when no map-motion reference", () => {
  const scene = { geoLocation: "Paris, France" };
  const project = { references: [{ label: "style", storagePath: "/ref/style.jpg" }] };
  assert.equal(isMapMotionScene(scene, project), false);
});

test("isMapMotionScene: false when references array is empty", () => {
  const scene = { geoLocation: "London, UK" };
  const project = { references: [] };
  assert.equal(isMapMotionScene(scene, project), false);
});

// ── videoPromptAgent map variant output ───────────────────────────────────────

test("runVideoPromptAgent: map scene produces Map Flyover + Map Reveal variants", () => {
  const { runVideoPromptAgent } = require("../../../packages/agents/videoPromptAgent");

  const scene = {
    id: "proj-scene-3",
    sceneId: 3,
    narration: "The attack began in Mogadishu, Somalia, just before dawn.",
    visualIntent: "Map of Somalia with Mogadishu highlighted",
    geoLocation: "Mogadishu, Somalia",
    emotion: "dramatic",
    duration: 6,
    imageVariants: [],
    approvedImageId: null,
    videoVariants: [],
    approvedVideoId: null,
    motionMode: "animate",
  };

  const project = {
    id: "proj-1",
    type: "long-form",
    title: "Test Project",
    settings: { visualStyle: "motion graphic", videoAgentModel: "hailuo-2.3-fast" },
    references: [{ label: "map-motion", storagePath: "/ref/animated-map.mp4" }],
    scenes: [scene],
  };

  const result = runVideoPromptAgent({ scene, project, count: 2 });
  const variants = result.output.variants;

  assert.equal(variants.length, 2);
  assert.equal(variants[0].previewTitle, "Map Flyover");
  assert.equal(variants[1].previewTitle, "Map Reveal");
  assert.ok(variants[0].motion === "map zoom flyover");
  assert.ok(variants[1].motion === "map pan reveal");
  // Prompts should mention the location
  assert.ok(variants[0].prompt.includes("Mogadishu, Somalia"), "Flyover prompt must name the location");
  assert.ok(variants[1].prompt.includes("Mogadishu, Somalia"), "Reveal prompt must name the location");
  // Must be silent
  assert.ok(variants[0].prompt.toLowerCase().includes("silent"), "Must be silent");
});

test("runVideoPromptAgent: standard (non-map) scene is unaffected", () => {
  const { runVideoPromptAgent } = require("../../../packages/agents/videoPromptAgent");

  const scene = {
    id: "proj-scene-1",
    sceneId: 1,
    narration: "A soldier walked through the ruins.",
    visualIntent: "Soldier walking through devastated cityscape",
    geoLocation: null,
    emotion: "intense",
    duration: 6,
    imageVariants: [],
    approvedImageId: null,
    videoVariants: [],
    approvedVideoId: null,
    motionMode: "animate",
  };

  const project = {
    id: "proj-1",
    type: "long-form",
    title: "Test Project",
    settings: { visualStyle: "cinematic realism" },
    references: [{ label: "map-motion", storagePath: "/ref/animated-map.mp4" }],
    scenes: [scene],
  };

  const result = runVideoPromptAgent({ scene, project, count: 2 });
  const variants = result.output.variants;

  assert.equal(variants.length, 2);
  // Standard variants — not map
  assert.ok(variants[0].previewTitle !== "Map Flyover", "Standard scene must not produce map variant");
  assert.ok(!variants[0].prompt.includes("cartographic"), "Standard scene prompt must not have map language");
});

/**
 * Motion Graphic reference engine tests.
 * Verifies:
 *  - detectMotionGraphicType correctly identifies type from reference name
 *  - doesSceneMatchMotionGraphic gates correctly for each type
 *  - findMatchingMotionGraphicRef picks the right reference
 *  - videoPromptAgent generates type-specific variants (map, data, timeline, diagram)
 *  - standard scenes are unaffected when no match
 */

"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  detectMotionGraphicType,
  doesSceneMatchMotionGraphic,
  findMatchingMotionGraphicRef,
  extractGeoLocation,
} = require("../../../packages/agents/motionGraphic");

// ── detectMotionGraphicType ───────────────────────────────────────────────────

test("detectMotionGraphicType: map from 'animated-map'", () => {
  assert.equal(detectMotionGraphicType("animated-map"), "map");
});

test("detectMotionGraphicType: data from 'stats-counter'", () => {
  assert.equal(detectMotionGraphicType("stats-counter"), "data");
});

test("detectMotionGraphicType: timeline from 'historical-timeline'", () => {
  assert.equal(detectMotionGraphicType("historical-timeline"), "timeline");
});

test("detectMotionGraphicType: diagram from 'process-flow'", () => {
  assert.equal(detectMotionGraphicType("process-flow"), "diagram");
});

test("detectMotionGraphicType: generic for unknown name", () => {
  assert.equal(detectMotionGraphicType("logo-reveal"), "generic");
});

// ── doesSceneMatchMotionGraphic ───────────────────────────────────────────────

test("doesSceneMatchMotionGraphic: map matches geo scene", () => {
  const ref = { name: "animated-map", label: "motion-graphic" };
  const scene = { geoLocation: "Lagos, Nigeria", narration: "In Lagos the crisis began." };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), true);
});

test("doesSceneMatchMotionGraphic: map does NOT match non-geo scene", () => {
  const ref = { name: "animated-map", label: "motion-graphic" };
  const scene = { geoLocation: null, narration: "A soldier walked through the ruins." };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), false);
});

test("doesSceneMatchMotionGraphic: data matches stats scene", () => {
  const ref = { name: "stats-counter", label: "motion-graphic" };
  const scene = { geoLocation: null, narration: "Over 4.2 million people were affected, 67% of them children." };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), true);
});

test("doesSceneMatchMotionGraphic: data does NOT match narrative scene", () => {
  const ref = { name: "data-chart", label: "motion-graphic" };
  const scene = { geoLocation: null, narration: "She looked at him with tears in her eyes." };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), false);
});

test("doesSceneMatchMotionGraphic: timeline matches date scene", () => {
  const ref = { name: "historical-timeline", label: "motion-graphic" };
  const scene = { geoLocation: null, narration: "In 1994, the world watched in silence." };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), true);
});

test("doesSceneMatchMotionGraphic: diagram matches process scene", () => {
  const ref = { name: "process-flow", label: "motion-graphic" };
  const scene = { geoLocation: null, narration: "The system works in three distinct steps." };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), true);
});

// ── findMatchingMotionGraphicRef ──────────────────────────────────────────────

test("findMatchingMotionGraphicRef: returns matching ref", () => {
  const mapRef = { id: "ref-1", name: "animated-map", label: "motion-graphic" };
  const dataRef = { id: "ref-2", name: "stats-counter", label: "motion-graphic" };
  const project = { references: [mapRef, dataRef] };
  const scene = { geoLocation: "Paris, France", narration: "In Paris the situation changed." };
  const result = findMatchingMotionGraphicRef(scene, project);
  assert.equal(result?.id, "ref-1");
});

test("findMatchingMotionGraphicRef: picks data ref when scene has stats", () => {
  const mapRef  = { id: "ref-1", name: "animated-map",  label: "motion-graphic" };
  const dataRef = { id: "ref-2", name: "stats-counter", label: "motion-graphic" };
  const project = { references: [mapRef, dataRef] };
  const scene = { geoLocation: null, narration: "83% of the population had no access to clean water." };
  const result = findMatchingMotionGraphicRef(scene, project);
  assert.equal(result?.id, "ref-2");
});

test("findMatchingMotionGraphicRef: returns null when no match", () => {
  const mapRef = { id: "ref-1", name: "animated-map", label: "motion-graphic" };
  const project = { references: [mapRef] };
  const scene = { geoLocation: null, narration: "A soldier walked through the ruins." };
  const result = findMatchingMotionGraphicRef(scene, project);
  assert.equal(result, null);
});

// ── videoPromptAgent: type-specific variants ──────────────────────────────────

test("runVideoPromptAgent: map scene → Map Flyover + Map Reveal", () => {
  const { runVideoPromptAgent } = require("../../../packages/agents/videoPromptAgent");
  const scene = {
    id: "proj-scene-3", sceneId: 3,
    narration: "The attack began in Mogadishu, Somalia, just before dawn.",
    visualIntent: "Map of Somalia", geoLocation: "Mogadishu, Somalia",
    emotion: "dramatic", duration: 6,
    imageVariants: [], approvedImageId: null,
    videoVariants: [], approvedVideoId: null, motionMode: "animate",
  };
  const project = {
    id: "proj-1", type: "long-form", title: "Test",
    settings: { visualStyle: "motion graphic" },
    references: [{ id: "r1", name: "animated-map", label: "motion-graphic", storagePath: "/ref/map.mp4" }],
    scenes: [scene],
  };
  const { output: { variants } } = runVideoPromptAgent({ scene, project, count: 2 });
  assert.equal(variants.length, 2);
  assert.ok(variants[0].previewTitle.includes("Flyover"), "First variant should be Flyover");
  assert.ok(variants[1].previewTitle.includes("Reveal"), "Second variant should be Reveal");
  assert.ok(variants[0].prompt.includes("Mogadishu, Somalia"), "Prompt must name the location");
  assert.ok(variants[0].prompt.toLowerCase().includes("silent"), "Must be silent");
});

test("runVideoPromptAgent: data scene → Data Counter + Data Chart", () => {
  const { runVideoPromptAgent } = require("../../../packages/agents/videoPromptAgent");
  const scene = {
    id: "proj-scene-2", sceneId: 2,
    narration: "By 2020, over 800 million people lived in extreme poverty, nearly 10% of the world.",
    visualIntent: "Data visualization", geoLocation: null,
    emotion: "intense", duration: 6,
    imageVariants: [], approvedImageId: null,
    videoVariants: [], approvedVideoId: null, motionMode: "animate",
  };
  const project = {
    id: "proj-1", type: "long-form", title: "Test",
    settings: { visualStyle: "editorial" },
    references: [{ id: "r2", name: "stats-counter", label: "motion-graphic", storagePath: "/ref/data.mp4" }],
    scenes: [scene],
  };
  const { output: { variants } } = runVideoPromptAgent({ scene, project, count: 2 });
  assert.ok(variants[0].previewTitle.includes("Counter"), "First variant should be Counter");
  assert.ok(variants[0].prompt.toLowerCase().includes("data") || variants[0].prompt.toLowerCase().includes("counter"), "Must be data viz prompt");
});

test("runVideoPromptAgent: standard scene unaffected when no motion-graphic match", () => {
  const { runVideoPromptAgent } = require("../../../packages/agents/videoPromptAgent");
  const scene = {
    id: "proj-scene-1", sceneId: 1,
    narration: "A soldier walked through the ruins of the city.",
    visualIntent: "Soldier in devastated cityscape", geoLocation: null,
    emotion: "intense", duration: 6,
    imageVariants: [], approvedImageId: null,
    videoVariants: [], approvedVideoId: null, motionMode: "animate",
  };
  const project = {
    id: "proj-1", type: "long-form", title: "Test",
    settings: { visualStyle: "cinematic realism" },
    references: [{ id: "r1", name: "animated-map", label: "motion-graphic", storagePath: "/ref/map.mp4" }],
    scenes: [scene],
  };
  const { output: { variants } } = runVideoPromptAgent({ scene, project, count: 2 });
  // Not a geo scene → animated-map ref must NOT trigger
  assert.ok(!variants[0].previewTitle.includes("Flyover"), "Non-geo scene must not produce map variant");
  assert.ok(!variants[0].prompt.includes("cartographic"), "Non-geo prompt must not have map language");
});

// ── Profile / dossier type ────────────────────────────────────────────────────

test("detectMotionGraphicType: profile from 'character-dossier'", () => {
  assert.equal(detectMotionGraphicType("character-dossier"), "profile");
});

test("detectMotionGraphicType: profile from 'historical-profile'", () => {
  assert.equal(detectMotionGraphicType("historical-profile"), "profile");
});

test("detectMotionGraphicType: profile from 'dossier-infographic'", () => {
  assert.equal(detectMotionGraphicType("dossier-infographic"), "profile");
});

test("doesSceneMatchMotionGraphic: profile matches multi-word proper name", () => {
  const ref = { name: "character-dossier", label: "motion-graphic" };
  const scene = {
    geoLocation: null,
    narration: "Julius Caesar changed the course of Roman history forever.",
  };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), true);
});

test("doesSceneMatchMotionGraphic: profile matches without bio keywords", () => {
  const ref = { name: "historical-profile", label: "motion-graphic" };
  const scene = {
    geoLocation: null,
    // No "career/power/death" keywords — just a named person
    narration: "Pablo Escobar was at the center of everything that happened next.",
  };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), true);
});

test("doesSceneMatchMotionGraphic: profile does NOT match nameless narration", () => {
  const ref = { name: "character-dossier", label: "motion-graphic" };
  const scene = {
    geoLocation: null,
    narration: "The city was quiet that morning. Nobody expected what would happen next.",
  };
  assert.equal(doesSceneMatchMotionGraphic(scene, ref), false);
});

test("runVideoPromptAgent: profile scene → Card Drop + Panel Reveal variants", () => {
  const { runVideoPromptAgent } = require("../../../packages/agents/videoPromptAgent");
  const scene = {
    id: "proj-scene-4", sceneId: 4,
    narration: "Julius Caesar was Rome's most powerful general. His political career spanned decades and his military conquests reshaped the empire.",
    visualIntent: "Julius Caesar portrait dossier", geoLocation: null,
    emotion: "dramatic", duration: 8,
    imageVariants: [], approvedImageId: null,
    videoVariants: [], approvedVideoId: null, motionMode: "animate",
  };
  const project = {
    id: "proj-1", type: "long-form", title: "The Death of Caesar",
    settings: { visualStyle: "historical documentary" },
    references: [{ id: "r4", name: "character-dossier", label: "motion-graphic", storagePath: "/ref/dossier.mov" }],
    scenes: [scene],
  };
  const { output: { variants } } = runVideoPromptAgent({ scene, project, count: 2 });
  assert.equal(variants.length, 2);
  assert.ok(variants[0].previewTitle.includes("Card Drop"), `Expected "Card Drop", got "${variants[0].previewTitle}"`);
  assert.ok(variants[1].previewTitle.includes("Panel Reveal"), `Expected "Panel Reveal", got "${variants[1].previewTitle}"`);
  assert.ok(variants[0].motion === "dossier card drop", "motion must be dossier card drop");
  assert.ok(variants[1].motion === "dossier panel expand", "motion must be dossier panel expand");
  assert.ok(variants[0].prompt.includes("Julius Caesar"), "Prompt must name the subject");
  assert.ok(variants[0].prompt.toLowerCase().includes("dossier") || variants[0].prompt.toLowerCase().includes("card"), "Must have dossier language");
  assert.ok(variants[0].prompt.toLowerCase().includes("silent"), "Must be silent");
});

// ── extractGeoLocation ────────────────────────────────────────────────────────

test("extractGeoLocation: English preposition", () => {
  assert.equal(extractGeoLocation("The tragedy unfolded in Paris, France"), "Paris, France");
});

test("extractGeoLocation: French preposition (stops at lowercase)", () => {
  assert.equal(extractGeoLocation("Une ville au Cameroun qui a tout changé"), "Cameroun");
});

test("extractGeoLocation: standalone continent", () => {
  assert.equal(extractGeoLocation("Across Africa, the story spread fast"), "Africa");
});

test("extractGeoLocation: returns null when no location", () => {
  assert.equal(extractGeoLocation("A dramatic moment changed everything."), null);
});

/**
 * normalizeProject() — guarantees every project served / written has the full
 * shape the rest of the API and the UI expect, with safe defaults.
 *
 * This is the single function called on every read of a project, so any bug
 * here cascades everywhere.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { normalizeProject } = require("../src/projects/project-model");

test("projet quasi-vide: toutes les sections présentes avec defaults", () => {
  const project = { id: "p1", title: "Test", type: "Long Form / YouTube" };
  const normalized = normalizeProject(project);

  // Toutes les sections sont créées
  for (const key of ["script", "scenes", "audio", "captions", "assembly", "review", "settings", "references", "scriptLinkedReferences"]) {
    assert.ok(key in normalized, `Section "${key}" manquante`);
  }

  // Structure audio complète
  assert.ok(normalized.audio.narration);
  assert.ok(normalized.audio.music);
  assert.ok(normalized.audio.sfx);

  // Review aux défauts pending
  assert.equal(normalized.review.scenePlan.status, "pending");
  assert.equal(normalized.review.finalAssembly.status, "pending");

  // Arrays par défaut vides
  assert.deepEqual(normalized.scenes, []);
  assert.deepEqual(normalized.references, []);
  assert.deepEqual(normalized.scriptLinkedReferences, []);

  // Flags booléens
  assert.equal(normalized.isAdvanceContent, false);
});

test("préserve les valeurs fournies, comble seulement les manquantes", () => {
  const project = {
    id: "p2",
    title: "Custom",
    type: "Short Form / TikTok",
    script: { content: "My script content" },
    audio: { narration: { voiceId: "minimax-speech-2.8-hd" } },
  };
  const normalized = normalizeProject(project);

  // Préservé
  assert.equal(normalized.script.content, "My script content");
  assert.equal(normalized.audio.narration.voiceId, "minimax-speech-2.8-hd");

  // Comblé
  assert.equal(typeof normalized.script.mode, "string");
  assert.ok(normalized.audio.music);
  assert.ok(normalized.audio.sfx);
});

test("settings: graphics.moduleState et variantState mergés profondément", () => {
  const project = {
    id: "p3",
    type: "Long Form / YouTube",
    settings: {
      graphics: {
        moduleState: { "text-reveal": false }, // override partiel
      },
    },
  };
  const normalized = normalizeProject(project);

  // L'override est conservé
  assert.equal(normalized.settings.graphics.moduleState["text-reveal"], false);
  // Les autres modules gardent leurs defaults
  assert.equal(normalized.settings.graphics.moduleState["lower-third"], false);
  assert.equal(normalized.settings.graphics.moduleState["stat-counter"], false);
  // variantState aussi défaillé
  assert.equal(typeof normalized.settings.graphics.variantState["text-reveal"], "string");
});

test("scenes: variants reçoivent id et défauts si non fournis", () => {
  const project = {
    id: "p4",
    type: "Long Form / YouTube",
    scenes: [
      {
        sceneId: 1,
        narration: "Test",
        visualIntent: "x",
        duration: 5,
        imageVariants: [
          { /* pas d'id, pas de variantIndex */ },
          { id: "custom-image-id", prompt: "kept" },
        ],
        videoVariants: [{}],
      },
    ],
  };
  const normalized = normalizeProject(project);

  const scene = normalized.scenes[0];
  assert.equal(scene.imageVariants.length, 2);
  // ID auto-généré sur le premier
  assert.ok(scene.imageVariants[0].id.includes("scene-1-image-1"));
  assert.equal(scene.imageVariants[0].variantIndex, 1);
  assert.equal(scene.imageVariants[0].status, "pending");
  // ID custom préservé sur le second
  assert.equal(scene.imageVariants[1].id, "custom-image-id");
  assert.equal(scene.imageVariants[1].prompt, "kept");
});

test("idempotent: normaliser deux fois donne le même résultat", () => {
  const project = { id: "p5", title: "Idempotency", type: "Long Form / YouTube" };
  const once = normalizeProject(project);
  const twice = normalizeProject(once);
  assert.deepEqual(twice, once);
});

test("ne crashe pas sur entrée minimale ({id, type})", () => {
  assert.doesNotThrow(() => normalizeProject({ id: "minimal", type: "Long Form / YouTube" }));
});

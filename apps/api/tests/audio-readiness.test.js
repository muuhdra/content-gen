/**
 * Audio readiness predicates — used by every "audio stack ready" check
 * (generatedAt timestamp, render gate, assembly computation).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  isMusicReady,
  isNarrationReady,
  isSfxReady,
} = require("../src/projects/project-model");

// ─── Narration ─────────────────────────────────────────────────────────────────

test("narration generated → ready", () => {
  assert.equal(isNarrationReady({ narration: { voiceId: "elevenlabs-v3", status: "generated" } }), true);
});

test("narration draft → not ready", () => {
  assert.equal(isNarrationReady({ narration: { voiceId: "elevenlabs-v3", status: "draft" } }), false);
});

test("narration upload custom: ready uniquement si fichier présent", () => {
  assert.equal(
    isNarrationReady({
      narration: {
        voiceId: "custom-audio-upload",
        status: "uploaded",
        uploadedSource: { storagePath: "uploads/narration/x.mp3" },
      },
    }),
    true,
  );
  assert.equal(
    isNarrationReady({
      narration: { voiceId: "custom-audio-upload", status: "uploaded" }, // pas de fichier
    }),
    false,
  );
});

// ─── Music ─────────────────────────────────────────────────────────────────────

test('music mode "none" → toujours ready (utilisateur a explicitement désactivé)', () => {
  assert.equal(isMusicReady({ music: { mode: "none", status: "disabled" } }), true);
});

test('music mode "auto" generated → ready', () => {
  assert.equal(isMusicReady({ music: { mode: "auto", status: "generated" } }), true);
});

test('music mode "auto" draft → not ready', () => {
  assert.equal(isMusicReady({ music: { mode: "auto", status: "draft" } }), false);
});

test('music mode "uploaded": ready uniquement si au moins une piste a storagePath', () => {
  assert.equal(
    isMusicReady({
      music: {
        mode: "uploaded",
        uploadedTracks: [{ id: "t1", storagePath: "uploads/music/t1.mp3" }],
      },
    }),
    true,
  );
  assert.equal(
    isMusicReady({
      music: { mode: "uploaded", uploadedTracks: [] },
    }),
    false,
  );
  assert.equal(
    isMusicReady({
      music: { mode: "uploaded", uploadedTracks: [{ id: "t1" /* pas de storagePath */ }] },
    }),
    false,
  );
});

// ─── SFX ───────────────────────────────────────────────────────────────────────

test("sfx désactivé (enabled:false) → toujours ready", () => {
  assert.equal(isSfxReady({ sfx: { enabled: false } }), true);
});

test("sfx activé generated → ready", () => {
  assert.equal(isSfxReady({ sfx: { enabled: true, status: "generated" } }), true);
});

test("sfx activé draft → not ready", () => {
  assert.equal(isSfxReady({ sfx: { enabled: true, status: "draft" } }), false);
});

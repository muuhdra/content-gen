/**
 * Audio cascade on script change — locks in Incohérence #1 fix.
 *
 * Auto-generated stems (TTS voice, auto music, enabled SFX) must reset to
 * "draft" so the render gate blocks until they're refreshed. User-provided
 * choices (uploads, explicit "none"/disabled) must be preserved intact.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { invalidateAudioForScriptChange } = require("../src/projects/audio-generator");

test("audio auto-généré: narration/music/sfx → draft, generatedAt → null", () => {
  const audio = {
    narration: {
      voiceId: "elevenlabs-v3",
      status: "generated",
      estimatedDuration: "02:30",
      generatedSource: { id: "narration-x", storagePath: "p/x.m4a" },
    },
    music: {
      mode: "auto",
      status: "generated",
      generatedSource: { id: "m", storagePath: "p/m.m4a" },
    },
    sfx: {
      enabled: true,
      status: "generated",
      generatedSource: { id: "s", storagePath: "p/s.m4a" },
    },
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  const next = invalidateAudioForScriptChange(audio);

  assert.equal(next.narration.status, "draft");
  assert.equal(next.narration.generatedSource, null);
  assert.equal(next.music.status, "draft");
  assert.equal(next.music.generatedSource, null);
  assert.equal(next.sfx.status, "draft");
  assert.equal(next.sfx.generatedSource, null);
  assert.equal(next.generatedAt, null);
});

test("narration uploadée: préservée (uploadedSource, status, voiceId)", () => {
  const audio = {
    narration: {
      voiceId: "custom-audio-upload",
      status: "uploaded",
      uploadedSource: { id: "u", storagePath: "uploads/narration/u.mp3", name: "voice.mp3" },
    },
    music: { mode: "uploaded", status: "uploaded", uploadedTracks: [{ storagePath: "uploads/music/t.mp3" }] },
    sfx: { enabled: false, status: "draft" },
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  const next = invalidateAudioForScriptChange(audio);

  assert.equal(next.narration.status, "uploaded");
  assert.equal(next.narration.voiceId, "custom-audio-upload");
  assert.deepEqual(next.narration.uploadedSource, audio.narration.uploadedSource);
});

test("musique uploaded: mode et uploadedTracks préservés", () => {
  const audio = {
    narration: { voiceId: "elevenlabs-v3", status: "generated" },
    music: {
      mode: "uploaded",
      status: "uploaded",
      uploadedTracks: [{ id: "t1", storagePath: "uploads/music/t1.mp3" }],
      trackName: "t1.mp3",
    },
    sfx: { enabled: true, status: "generated" },
  };

  const next = invalidateAudioForScriptChange(audio);

  assert.equal(next.music.mode, "uploaded");
  assert.equal(next.music.status, "uploaded");
  assert.deepEqual(next.music.uploadedTracks, audio.music.uploadedTracks);
});

test('musique mode "none": disabled préservé (pas remis en draft)', () => {
  const audio = {
    narration: { voiceId: "elevenlabs-v3", status: "generated" },
    music: { mode: "none", status: "disabled" },
    sfx: { enabled: true, status: "generated" },
  };

  const next = invalidateAudioForScriptChange(audio);

  assert.equal(next.music.mode, "none");
  assert.equal(next.music.status, "disabled");
});

test("sfx désactivé: enabled:false et status non-écrasés", () => {
  const audio = {
    narration: { voiceId: "elevenlabs-v3", status: "generated" },
    music: { mode: "auto", status: "generated" },
    sfx: { enabled: false, status: "draft" },
  };

  const next = invalidateAudioForScriptChange(audio);

  assert.equal(next.sfx.enabled, false);
  // Le status n'est pas changé quand sfx est désactivé
  assert.equal(next.sfx.status, "draft");
});

test("entrée vide / undefined: ne crashe pas, generatedAt:null", () => {
  const next = invalidateAudioForScriptChange({});
  assert.equal(next.generatedAt, null);
  assert.ok(next.narration);
  assert.ok(next.music);
  assert.ok(next.sfx);
});

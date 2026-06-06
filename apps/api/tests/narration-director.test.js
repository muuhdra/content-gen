/**
 * Narration Director — expressive delivery gating + safe fallback.
 *
 * Only ElevenLabs v3 understands inline [tags]; other engines must keep plain
 * text. Without an API key, directNarration returns the original script
 * unchanged (never breaks TTS).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { directNarration, voiceSupportsAudioTags } = require("@cosyl/agents");

test("audio tags only for ElevenLabs voices", () => {
  assert.equal(voiceSupportsAudioTags("elevenlabs/v3_alpha"), true);
  assert.equal(voiceSupportsAudioTags("minimax/speech-2.8-hd"), false);
  assert.equal(voiceSupportsAudioTags(""), false);
});

test("directNarration returns the original text when no API key (fallback)", async () => {
  const prev = process.env.AIML_API_KEY;
  delete process.env.AIML_API_KEY;
  try {
    const script = "Behind the golden mosaics, the empress was never safe. Who could she trust?";
    const out = await directNarration({ scriptContent: script, deliveryDirection: "calm professional true-crime" });
    assert.equal(out, script);
  } finally {
    if (prev !== undefined) process.env.AIML_API_KEY = prev;
  }
});

test("directNarration handles empty input gracefully", async () => {
  assert.equal(await directNarration({ scriptContent: "" }), "");
});

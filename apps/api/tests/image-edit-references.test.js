/**
 * Reference-conditioned image generation (style lock + continuity).
 *
 * generateImageEdit feeds reference images to Gemini's edit model. It must guard
 * its inputs: no API key → clear error; key present but no reference images →
 * clear error (we never fire a malformed edit request).
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const aimlapi = require("@cosyl/agents/llm/aimlapi");

test("generateImageEdit is exported", () => {
  assert.equal(typeof aimlapi.generateImageEdit, "function");
});

test("generateImageEdit without an API key throws a clear error", async () => {
  const prev = process.env.AIML_API_KEY;
  delete process.env.AIML_API_KEY;
  try {
    await assert.rejects(
      () => aimlapi.generateImageEdit({ prompt: "x", imageUrls: ["data:image/png;base64,AAAA"] }),
      /AIML_API_KEY is not configured/,
    );
  } finally {
    if (prev !== undefined) process.env.AIML_API_KEY = prev;
  }
});

test("generateImageEdit with a key but no reference images is rejected", async () => {
  const prev = process.env.AIML_API_KEY;
  process.env.AIML_API_KEY = "test-key";
  try {
    await assert.rejects(
      () => aimlapi.generateImageEdit({ prompt: "x", imageUrls: [] }),
      /at least one reference image/,
    );
  } finally {
    if (prev === undefined) delete process.env.AIML_API_KEY;
    else process.env.AIML_API_KEY = prev;
  }
});

/**
 * Reference → image normalization (supports image / video / YouTube refs).
 * Pure-path coverage (no ffmpeg needed): YouTube thumbnail, empty inputs, dataUrl.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { referenceToImageUrls, bufferToDataUrl } = require("../src/media/reference-frames");

test("null / empty reference yields no images", async () => {
  assert.deepEqual(await referenceToImageUrls(null), []);
  assert.deepEqual(await referenceToImageUrls({ label: "style" }), []); // no storagePath, not youtube
});

test("YouTube reference returns its thumbnail URL (no file read)", async () => {
  const url = "https://img.youtube.com/vi/abc/hqdefault.jpg";
  const out = await referenceToImageUrls({ kind: "reference-youtube", preview: url });
  assert.deepEqual(out, [url]);
});

test("YouTube reference without a preview yields nothing", async () => {
  assert.deepEqual(await referenceToImageUrls({ kind: "reference-youtube", preview: null }), []);
});

test("bufferToDataUrl builds a base64 data URL", () => {
  const url = bufferToDataUrl(Buffer.from("hi"), "image/jpeg");
  assert.match(url, /^data:image\/jpeg;base64,/);
});

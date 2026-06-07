/**
 * Ken Burns filter builder — motion style + intensity.
 * Static/hybrid scenes animate their stills; this must produce a valid, distinct
 * FFmpeg zoompan chain per style and intensity.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { buildKenBurnsFilter } = require("../src/media/compose");

const base = { width: 1920, height: 1080, durationFrames: 180, fps: 30 };

test("zoom-in-out uses a growing zoom; intensity changes the rate/max", () => {
  const subtle = buildKenBurnsFilter({ motionStyle: "zoom-in-out", intensity: "subtle", ...base });
  const strong = buildKenBurnsFilter({ motionStyle: "zoom-in-out", intensity: "strong", ...base });
  assert.match(subtle, /zoompan=z='min\(zoom\+0\.0007,1\.06\)'/);
  assert.match(strong, /zoompan=z='min\(zoom\+0\.002,1\.2\)'/);
  assert.match(subtle, /format=yuv420p$/);
});

test("horizontal-pan moves x, vertical-pan moves y", () => {
  const h = buildKenBurnsFilter({ motionStyle: "horizontal-pan", intensity: "medium", ...base });
  const v = buildKenBurnsFilter({ motionStyle: "vertical-pan", intensity: "medium", ...base });
  assert.match(h, /x='\(iw-iw\/zoom\)\*on\/\(180-1\)'/);
  assert.match(v, /y='\(ih-ih\/zoom\)\*on\/\(180-1\)'/);
});

test("unknown style falls back to zoom-in-out; unknown intensity → medium", () => {
  const out = buildKenBurnsFilter({ motionStyle: "nope", intensity: "nope", ...base });
  assert.match(out, /min\(zoom\+0\.0012,1\.12\)/); // medium zoom
});

test("always scales/crops to the canvas first", () => {
  const out = buildKenBurnsFilter({ motionStyle: "zoom-in-out", intensity: "medium", ...base });
  assert.match(out, /^scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,/);
});

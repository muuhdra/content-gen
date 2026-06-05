/**
 * Effects LAB "static" clip mode → render fidelity.
 *
 * When a project is set to "static" clips, approved images alone are enough to
 * render (Ken Burns motion). The render gate must NOT demand an approved video
 * per scene — otherwise a static project can never be queued. "video" mode (the
 * default) keeps requiring motion clips.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const { getRenderQueueError, resolveClipMode, motionIsOptional, sceneRequiresMotion } = require("@cosyl/shared");

function buildProject(clipMode, { withVideos = false } = {}) {
  return {
    id: "proj-clipmode",
    type: "Short", // non-slideshow on purpose
    settings: { effects: { clipMode } },
    review: {
      scenePlan: { status: "approved" },
      finalAssembly: { status: "approved" },
    },
    assembly: { readiness: { readyToRender: true } },
    scenes: [
      { id: "scene-1", sceneId: 1, approvedImageId: "img-1", approvedVideoId: withVideos ? "vid-1" : null },
      { id: "scene-2", sceneId: 2, approvedImageId: "img-2", approvedVideoId: withVideos ? "vid-2" : null },
    ],
  };
}

test("resolveClipMode defaults to video when unset", () => {
  assert.equal(resolveClipMode({}), "video");
  assert.equal(resolveClipMode({ settings: { effects: { clipMode: "static" } } }), "static");
  assert.equal(resolveClipMode({ settings: { effects: { clipMode: "video" } } }), "video");
});

test("motionIsOptional true for static clip mode and for slideshow", () => {
  assert.equal(motionIsOptional(buildProject("static")), true);
  assert.equal(motionIsOptional(buildProject("video")), false);
  assert.equal(motionIsOptional({ type: "Slideshow / VSL", settings: {} }), true);
});

test("static mode: images-only project is render-ready (no video required)", () => {
  const error = getRenderQueueError(buildProject("static", { withVideos: false }));
  assert.equal(error, null);
});

test("video mode: images-only project is blocked until clips are approved", () => {
  const error = getRenderQueueError(buildProject("video", { withVideos: false }));
  assert.equal(error, "Approve one clip for every scene before queueing the render.");
});

test("video mode: passes once every scene has an approved clip", () => {
  const error = getRenderQueueError(buildProject("video", { withVideos: true }));
  assert.equal(error, null);
});

test("static mode still enforces an approved image per scene", () => {
  const project = buildProject("static");
  project.scenes[1].approvedImageId = null;
  const error = getRenderQueueError(project);
  assert.equal(error, "Approve one image for every scene before queueing the render.");
});

// ── Hybrid mode ──────────────────────────────────────────────────────────────

test("resolveClipMode recognizes hybrid", () => {
  assert.equal(resolveClipMode({ settings: { effects: { clipMode: "hybrid" } } }), "hybrid");
});

test("hybrid: only scenes flagged animate require a clip", () => {
  const project = {
    type: "Long-form",
    settings: { effects: { clipMode: "hybrid" } },
    scenes: [
      { id: "scene-1", sceneId: 1, motionMode: "animate", approvedImageId: "img-1", approvedVideoId: null },
      { id: "scene-2", sceneId: 2, motionMode: "static", approvedImageId: "img-2", approvedVideoId: null },
    ],
  };
  assert.equal(sceneRequiresMotion(project, project.scenes[0]), true);
  assert.equal(sceneRequiresMotion(project, project.scenes[1]), false);
});

test("hybrid: blocked until the animate scene has a clip; static scene needs none", () => {
  const project = {
    type: "Long-form",
    settings: { effects: { clipMode: "hybrid" } },
    review: { scenePlan: { status: "approved" }, finalAssembly: { status: "approved" } },
    assembly: { readiness: { readyToRender: true } },
    scenes: [
      { id: "scene-1", sceneId: 1, motionMode: "animate", approvedImageId: "img-1", approvedVideoId: null },
      { id: "scene-2", sceneId: 2, motionMode: "static", approvedImageId: "img-2", approvedVideoId: null },
    ],
  };
  // animate scene lacks a clip → blocked
  assert.equal(getRenderQueueError(project), "Approve one clip for every scene before queueing the render.");
  // give the animate scene its clip → ready (static scene needs no clip)
  project.scenes[0].approvedVideoId = "vid-1";
  assert.equal(getRenderQueueError(project), null);
});

test("hybrid: motionIsOptional is false at project level (some scenes animate)", () => {
  assert.equal(motionIsOptional({ type: "Long-form", settings: { effects: { clipMode: "hybrid" } } }), false);
});

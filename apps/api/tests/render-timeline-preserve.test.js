/**
 * Timeline Editor → render fidelity.
 *
 * The render worker refreshes summary/readiness from the latest project state,
 * but it must NOT clobber a timeline the user shaped in the Timeline Editor
 * (clip order, trims, splits). resolveRenderAssembly overlays the saved edited
 * timeline onto a freshly generated assembly so hand edits actually render.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  resolveRenderAssembly,
  hasUserEditedTimeline,
  normalizeAssembly,
} = require("@cosyl/shared");

function buildProject(overrides = {}) {
  return {
    id: "proj-timeline",
    type: "Short",
    title: "Timeline fidelity",
    scenes: [
      { id: "scene-1", sceneId: 1, duration: 5, narration: "Intro", approvedImageId: "img-1", imageVariants: [{ id: "img-1", status: "approved" }] },
      { id: "scene-2", sceneId: 2, duration: 5, narration: "Body", approvedImageId: "img-2", imageVariants: [{ id: "img-2", status: "approved" }] },
    ],
    audio: {},
    ...overrides,
  };
}

test("no editor state → fresh assembly is used as-is (no overlay)", () => {
  const project = buildProject({ assembly: normalizeAssembly({ timeline: [] }) });
  assert.equal(hasUserEditedTimeline(project.assembly), false);
  const resolved = resolveRenderAssembly(project);
  // Fresh assembly comes from the agent; it must be a normalized object.
  assert.ok(Array.isArray(resolved.timeline));
});

test("hand-edited timeline (reorder + trim + split) is preserved through render resolution", () => {
  // User reordered scene 2 first, trimmed scene 1, and split scene 2 into two clips.
  const editedTimeline = [
    { id: "clip-2a", sceneId: 2, duration: 2.5, startTime: 0, sourceType: "image" },
    { id: "clip-1", sceneId: 1, duration: 3, startTime: 2.5, sourceType: "image" },
    { id: "clip-2b", sceneId: 2, duration: 2.5, startTime: 5.5, sourceType: "image" },
  ];
  const editor = {
    zoom: 1,
    playhead: 0,
    totalDuration: 8,
    tracks: [
      {
        id: "track-visual",
        kind: "visual",
        items: editedTimeline.map((t) => ({
          id: t.id,
          trackId: "track-visual",
          kind: "visual",
          startTime: t.startTime,
          duration: t.duration,
          sceneId: t.sceneId,
        })),
      },
    ],
  };

  const project = buildProject({
    assembly: normalizeAssembly({
      timeline: editedTimeline,
      totalDurationSeconds: 8,
      totalDurationLabel: "00:08",
      editor,
    }),
  });

  assert.equal(hasUserEditedTimeline(project.assembly), true);

  const resolved = resolveRenderAssembly(project);

  // Order preserved exactly as edited.
  assert.deepEqual(resolved.timeline.map((t) => t.id), ["clip-2a", "clip-1", "clip-2b"]);
  // Trim preserved.
  assert.equal(resolved.timeline.find((t) => t.id === "clip-1").duration, 3);
  // Split preserved (scene 2 appears twice).
  assert.equal(resolved.timeline.filter((t) => t.sceneId === 2).length, 2);
  // Edited total duration preserved.
  assert.equal(resolved.totalDurationSeconds, 8);
  // Editor state carried through.
  assert.ok(resolved.editor);
});

test("editor with an empty visual track is not treated as a hand edit", () => {
  const project = buildProject({
    assembly: normalizeAssembly({
      timeline: [],
      editor: { zoom: 1, playhead: 0, totalDuration: 0, tracks: [{ id: "track-visual", kind: "visual", items: [] }] },
    }),
  });
  assert.equal(hasUserEditedTimeline(project.assembly), false);
});

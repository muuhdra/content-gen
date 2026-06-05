/**
 * @file assemblyHelper.js
 * Assembly normalization and generation helpers. Shared between the API routes
 * and the orchestrator render worker, so neither has to cross workspace boundaries.
 *
 * generateProjectAssembly was previously in apps/api/src/projects/assembly-generator.js
 * and was imported by the render worker via a fragile relative path.
 *
 * Rule: packages/* must never import from apps/*
 */

const { runAssemblyAgent } = require("@cosyl/agents");

const defaultAssembly = {
  status: "draft",
  generatedAt: null,
  aspectRatio: "16:9",
  resolution: "1920x1080",
  totalDurationSeconds: 0,
  totalDurationLabel: "00:00",
  readiness: {
    hasScenes: false,
    hasAudio: false,
    hasCaptions: false,
    hasVisualCoverage: false,
    readyToRender: false,
  },
  summary: {
    sceneCount: 0,
    approvedImages: 0,
    approvedVideos: 0,
    captionCueCount: 0,
    fallbackImages: 0,
    placeholders: 0,
    musicEnabled: false,
    sfxEnabled: false,
  },
  timeline: [],
  warnings: [],
  output: {
    title: "",
    fileName: "",
    format: "mp4",
    previewLabel: "Final Cut",
  },
  history: [],
};

/**
 * Normalizes an assembly object by merging with safe defaults.
 * @param {object} assembly
 * @returns {object}
 */
function normalizeAssembly(assembly = {}) {
  return {
    ...defaultAssembly,
    ...assembly,
    readiness: {
      ...defaultAssembly.readiness,
      ...(assembly.readiness || {}),
    },
    summary: {
      ...defaultAssembly.summary,
      ...(assembly.summary || {}),
    },
    timeline: Array.isArray(assembly.timeline) ? assembly.timeline : [],
    warnings: Array.isArray(assembly.warnings) ? assembly.warnings : [],
    output: {
      ...defaultAssembly.output,
      ...(assembly.output || {}),
    },
    history: Array.isArray(assembly.history) ? assembly.history : [],
  };
}

/**
 * Prepends a warning to the list while keeping a max of 4 and deduplicating.
 * @param {string[]} existingWarnings
 * @param {string} reason
 * @returns {string[]}
 */
function prependWarning(existingWarnings, reason) {
  if (!reason) {
    return existingWarnings;
  }

  return [reason, ...existingWarnings.filter((item) => item !== reason)].slice(0, 4);
}

/**
 * Resets the assembly to draft status with an invalidation reason prepended.
 * @param {object} project
 * @param {string} reason
 * @returns {object}
 */
function invalidateAssembly(project, reason) {
  const currentAssembly = normalizeAssembly(project.assembly);

  return normalizeAssembly({
    ...currentAssembly,
    status: "draft",
    warnings: prependWarning(currentAssembly.warnings, reason),
    readiness: {
      ...currentAssembly.readiness,
      readyToRender: false,
    },
  });
}

/**
 * Runs the assembly agent and returns a normalized assembly object.
 * @param {object} project - Full project record.
 * @returns {object}
 */
function generateProjectAssembly(project) {
  const normalizedAssembly = normalizeAssembly(project.assembly);
  const agentResult = runAssemblyAgent({
    project,
    previousHistory: normalizedAssembly.history,
  });

  return normalizeAssembly({
    ...agentResult.output,
    production: agentResult.production || null,
  });
}

/**
 * Determines whether the user has manually customized the timeline in the
 * Timeline Editor. The editor stamps `assembly.editor` (with an updatedAt) on
 * every commit, so its presence is the signal that hand edits exist.
 * @param {object} assembly
 * @returns {boolean}
 */
function hasUserEditedTimeline(assembly) {
  const editor = assembly?.editor;
  if (!editor || !Array.isArray(editor.tracks) || editor.tracks.length === 0) {
    return false;
  }
  const hasVisualClips = editor.tracks.some(
    (track) => track.kind === "visual" && Array.isArray(track.items) && track.items.length > 0,
  );
  return hasVisualClips && Array.isArray(assembly.timeline) && assembly.timeline.length > 0;
}

/**
 * Resolves the assembly to feed the compositor at render time.
 *
 * The render worker must always refresh summary/readiness/warnings from the
 * latest project state, but it must NOT clobber a timeline the user shaped in
 * the Timeline Editor (clip order, trims, splits). This overlays the saved
 * edited timeline onto a freshly generated assembly so both stay true.
 *
 * @param {object} project - Full project record.
 * @returns {object} normalized assembly safe to render.
 */
function resolveRenderAssembly(project) {
  const freshAssembly = generateProjectAssembly(project);
  const savedAssembly = normalizeAssembly(project.assembly);

  if (!hasUserEditedTimeline(savedAssembly)) {
    return freshAssembly;
  }

  // Preserve the hand-edited timeline + its derived duration + editor state,
  // while keeping the freshly computed summary/readiness/output/warnings.
  return normalizeAssembly({
    ...freshAssembly,
    timeline: savedAssembly.timeline,
    totalDurationSeconds: savedAssembly.totalDurationSeconds || freshAssembly.totalDurationSeconds,
    totalDurationLabel: savedAssembly.totalDurationLabel || freshAssembly.totalDurationLabel,
    editor: savedAssembly.editor,
  });
}

module.exports = {
  defaultAssembly,
  normalizeAssembly,
  invalidateAssembly,
  generateProjectAssembly,
  resolveRenderAssembly,
  hasUserEditedTimeline,
};

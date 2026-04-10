const { runAssemblyAgent } = require("../../../../services/agents");

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

function prependWarning(existingWarnings, reason) {
  if (!reason) {
    return existingWarnings;
  }

  return [reason, ...existingWarnings.filter((item) => item !== reason)].slice(0, 4);
}

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

module.exports = {
  defaultAssembly,
  normalizeAssembly,
  invalidateAssembly,
  generateProjectAssembly,
};

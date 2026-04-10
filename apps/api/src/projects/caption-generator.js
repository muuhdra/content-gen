const defaultCaptionStyle = {
  captionPosition: "center",
  animationStyle: "pop",
  animationIntensity: 62,
  wordByWord: true,
  wordHighlight: true,
  typography: "bold",
  textSize: 52,
  letterSpacing: 1.5,
  colorStyle: "purple",
  strokeEnabled: false,
  strokeWidth: 0,
  strokeOpacity: 0,
  strokeColor: "black",
  watermarkEnabled: false,
  watermarkText: "",
  watermarkOpacity: 0,
  watermarkPosition: "top-right",
};

const defaultCaptions = {
  status: "draft",
  generatedAt: null,
  style: defaultCaptionStyle,
  cues: [],
};

function normalizeCaptionStyle(style = {}) {
  return {
    ...defaultCaptionStyle,
    ...style,
  };
}

function normalizeCaptions(captions = {}) {
  return {
    ...defaultCaptions,
    ...captions,
    style: normalizeCaptionStyle(captions.style || {}),
    cues: Array.isArray(captions.cues) ? captions.cues : [],
  };
}

function splitNarrationIntoChunks(narration) {
  const words = narration.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const chunkSize = words.length <= 6 ? 3 : words.length <= 12 ? 4 : 5;
  const chunks = [];

  for (let index = 0; index < words.length; index += chunkSize) {
    chunks.push(words.slice(index, index + chunkSize));
  }

  return chunks;
}

function generateCaptionsTrack(project, styleOverrides = {}) {
  const normalizedStyle = normalizeCaptionStyle(styleOverrides);
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const fallbackNarration = project.script?.content
    ? project.script.content
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line, index) => ({
          sceneId: index + 1,
          narration: line,
          duration: Math.max(4, Math.round(line.split(/\s+/).filter(Boolean).length / 2.6)),
        }))
    : [];

  const sourceScenes = scenes.length > 0 ? scenes : fallbackNarration;
  let currentOffsetMs = 0;

  const cues = sourceScenes.flatMap((scene) => {
    const chunks = splitNarrationIntoChunks(scene.narration || "");

    if (chunks.length === 0) {
      return [];
    }

    const sceneDurationMs = Math.max(1000, Math.round((scene.duration || 4) * 1000));
    const cueDurationMs = Math.max(500, Math.floor(sceneDurationMs / chunks.length));

    const sceneCues = chunks.map((chunk, chunkIndex) => {
      const startMs = currentOffsetMs + chunkIndex * cueDurationMs;
      const isLastChunk = chunkIndex === chunks.length - 1;
      const endMs = isLastChunk ? currentOffsetMs + sceneDurationMs : startMs + cueDurationMs;
      const highlightedWord = normalizedStyle.wordHighlight ? chunk[Math.floor(chunk.length / 2)] || chunk[0] : null;

      return {
        id: `${project.id}-caption-${scene.sceneId}-${chunkIndex + 1}`,
        sceneId: scene.sceneId,
        startMs,
        endMs,
        text: chunk.join(" "),
        highlightedWord,
      };
    });

    currentOffsetMs += sceneDurationMs;
    return sceneCues;
  });

  return normalizeCaptions({
    status: cues.length > 0 ? "generated" : "draft",
    generatedAt: cues.length > 0 ? new Date().toISOString() : null,
    style: normalizedStyle,
    cues,
  });
}

function invalidateCaptions(captions = {}) {
  const normalizedCaptions = normalizeCaptions(captions);

  return normalizeCaptions({
    ...normalizedCaptions,
    status: "draft",
    generatedAt: null,
    cues: [],
  });
}

module.exports = {
  defaultCaptionStyle,
  defaultCaptions,
  normalizeCaptions,
  generateCaptionsTrack,
  invalidateCaptions,
};

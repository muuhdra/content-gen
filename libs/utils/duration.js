function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const secondsPart = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${secondsPart}`;
}

function estimateSpeechDurationSeconds(scriptContent) {
  const words = scriptContent.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.round(words / 2.6));
}

function estimateSpeechDurationLabel(scriptContent) {
  return formatDuration(estimateSpeechDurationSeconds(scriptContent));
}

module.exports = {
  estimateSpeechDurationLabel,
  estimateSpeechDurationSeconds,
  formatDuration,
};

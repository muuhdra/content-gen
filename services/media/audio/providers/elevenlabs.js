function createElevenLabsVoiceRender({ voiceId, language, scriptContent, estimatedDuration }) {
  return {
    provider: "elevenlabs",
    voiceId,
    language,
    status: "generated",
    textPreview: scriptContent.split(/\n+/).join(" ").slice(0, 220) || "No script available yet.",
    estimatedDuration,
  };
}

module.exports = {
  createElevenLabsVoiceRender,
};

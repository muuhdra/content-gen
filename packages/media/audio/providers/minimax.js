const { MODEL_CONFIG } = require("@cosyl/config/models");

function createMinimaxVoiceRender({ voiceId, language, scriptContent, estimatedDuration }) {
  const config = MODEL_CONFIG.voice.providers[voiceId] || MODEL_CONFIG.voice.providers["minimax-speech-2.8-hd"];
  return {
    provider: "minimax",
    adapter: "aimlapi",
    aimlModel: config?.aimlModel || "minimax/speech-2.8-hd",
    voiceApiId: config?.voiceId || "male-qn-qingse",
    voiceId,
    language,
    status: "generated",
    textPreview: scriptContent.split(/\n+/).join(" ").slice(0, 220) || "No script available yet.",
    estimatedDuration,
  };
}

module.exports = { createMinimaxVoiceRender };

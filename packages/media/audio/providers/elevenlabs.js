const { MODEL_CONFIG } = require("@cosyl/config/models");

function createElevenLabsVoiceRender({ voiceId, language, scriptContent, estimatedDuration }) {
  const config = MODEL_CONFIG.voice.providers[voiceId] || MODEL_CONFIG.voice.providers["elevenlabs-v3"];
  return {
    provider: "elevenlabs",
    adapter: "aimlapi",
    aimlModel: config?.aimlModel || "elevenlabs/v3_alpha",
    voiceApiId: config?.voiceId || "21m00Tcm4TlvDq8ikWAM",
    voiceId,
    language,
    status: "generated",
    textPreview: scriptContent.split(/\n+/).join(" ").slice(0, 220) || "No script available yet.",
    estimatedDuration,
  };
}

module.exports = { createElevenLabsVoiceRender };

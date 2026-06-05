const { MODEL_CONFIG } = require("@cosyl/config/models");
const { estimateSpeechDurationLabel } = require("@cosyl/shared/utils/duration");
const { createElevenLabsVoiceRender } = require("./providers/elevenlabs");
const { createMinimaxVoiceRender } = require("./providers/minimax");

function resolveVoiceModel(voiceId) {
  if (typeof voiceId === "string" && voiceId.startsWith("clone-")) {
    return {
      model: "elevenlabs-custom-cloned",
      label: "Custom Cloned Voice",
    };
  }

  const provider = MODEL_CONFIG.voice.providers[voiceId] || MODEL_CONFIG.voice.providers[MODEL_CONFIG.voice.default];
  return {
    model: voiceId || MODEL_CONFIG.voice.default,
    label: provider?.label || "ElevenLabs Voice",
  };
}

function generateVoice({ scriptContent, voiceId, language, deliveryStyle = "" }) {
  const voiceModel = resolveVoiceModel(voiceId);
  const estimatedDuration = estimateSpeechDurationLabel(scriptContent);

  // Determine provider adapter
  const provider = MODEL_CONFIG.voice.providers[voiceId] || MODEL_CONFIG.voice.providers[MODEL_CONFIG.voice.default];
  const adapter = provider?.adapter || "elevenlabs";

  let render;
  if (adapter === "minimax") {
    render = createMinimaxVoiceRender({
      voiceId,
      language,
      scriptContent,
      estimatedDuration,
    });
  } else {
    render = createElevenLabsVoiceRender({
      voiceId,
      language,
      scriptContent,
      estimatedDuration,
    });
  }

  return {
    ...render,
    model: voiceModel.model,
    modelLabel: voiceModel.label,
    direction: typeof deliveryStyle === "string" ? deliveryStyle : "",
  };
}

module.exports = {
  generateVoice,
};

const MODEL_CONFIG = {
  script: {
    default: "gpt",
    providers: {
      claude: { label: "Claude" },
      gpt: { label: "GPT" },
      gemini: { label: "Gemini" },
    },
  },
  image: {
    default: "nano-banana",
    providers: {
      "nano-banana": { label: "Nano Banana", adapter: "nano-banana" },
      "kling-3.0": { label: "Kling 3.0", adapter: "kling" },
    },
  },
  video: {
    default: "kling-3.0",
    providers: {
      "kling-3.0": { label: "Kling 3.0", adapter: "kling" },
      "seedance-2.0": { label: "Seedance 2.0", adapter: "seedance" },
    },
  },
  voice: {
    default: "elevenlabs-default",
    providers: {
      "elevenlabs-default": { label: "ElevenLabs Standard Voice", adapter: "elevenlabs" },
      "elevenlabs-custom-cloned": { label: "Custom Cloned Voice", adapter: "elevenlabs" },
      "male-1": { label: "Male 1", adapter: "elevenlabs" },
      "male-2": { label: "Male 2", adapter: "elevenlabs" },
      "male-3": { label: "Male 3", adapter: "elevenlabs" },
      "male-4": { label: "Male 4", adapter: "elevenlabs" },
      "male-5": { label: "Male 5", adapter: "elevenlabs" },
      "male-6": { label: "Male 6", adapter: "elevenlabs" },
      "male-7": { label: "Male 7", adapter: "elevenlabs" },
    },
  },
};

module.exports = {
  MODEL_CONFIG,
};

/**
 * Model catalog — curated short-list (budget decision). All accessed via AIML
 * API (api.aimlapi.com); the `aimlModel` fields are the exact API IDs.
 *
 * Kept models:
 *   - Script:  Claude Sonnet 4.6, GPT-4o
 *   - Image:   Nano Banana (Gemini 3 Pro Image)
 *   - Video:   Kling 2.5 Turbo Pro, Seedance 2.0 Fast
 *   - Voice:   ElevenLabs v3, MiniMax Speech 2.8 HD
 *   - Music:   ElevenLabs Music
 *   - Research: Perplexity Sonar (handled in the research engine, not here)
 */
const MODEL_CONFIG = {

  // ── Script / LLM ─────────────────────────────────────────────────────────
  script: {
    default: "claude-sonnet-4-6",
    providers: {
      "claude-sonnet-4-6": { label: "Claude Sonnet 4.6", adapter: "aimlapi", aimlModel: "claude-sonnet-4-6" },
      "gpt-4o":            { label: "GPT-4o",            adapter: "aimlapi", aimlModel: "gpt-4o" },
    },
  },

  // ── Image generation ──────────────────────────────────────────────────────
  // Default = Gemini 2.5 Flash (best quality/cost balance). Flux Schnell = ultra
  // budget. Nano Banana Pro = premium.
  image: {
    default: "gemini-2.5-flash-image",
    providers: {
      "gemini-2.5-flash-image": { label: "Nano Banana (Gemini 2.5 Flash)", adapter: "aimlapi", aimlModel: "google/gemini-2.5-flash-image" },
      "flux-schnell":            { label: "Flux Schnell (budget)",          adapter: "aimlapi", aimlModel: "flux/schnell" },
      "nano-banana-pro":         { label: "Nano Banana Pro (Gemini 3 Pro)", adapter: "aimlapi", aimlModel: "google/nano-banana-pro" },
    },
  },

  // ── Video generation (image-to-video) ─────────────────────────────────────
  // Budget tiers (price per ~5s clip, 720/768p, via AIML):
  //   - Hailuo 2.3 Fast ≈ $0.25  → default budget engine (native 768p)
  //   - Wan 2.7         ≈ $0.40  (720p) / cheaper in some AIML credit tiers
  //   - Kling 2.5 Turbo ≈ $0.46  → premium motion, kept for hero shots
  //   - Seedance 2.0    → premium/expensive on AIML
  video: {
    default: "hailuo-2.3-fast",
    providers: {
      "hailuo-2.3-fast":     { label: "Hailuo 2.3 Fast (budget 768p)", adapter: "aimlapi", aimlModel: "minimax/hailuo-2.3-fast" },
      "wan-2.7":             { label: "Wan 2.7 (budget 720p)",         adapter: "aimlapi", aimlModel: "alibaba/wan-2-7-i2v" },
      "kling-2.5-turbo-pro": { label: "Kling 2.5 Turbo Pro (premium)", adapter: "aimlapi", aimlModel: "klingai/v2.5-turbo/pro/image-to-video" },
      "seedance-2.0-fast":   { label: "Seedance 2.0 Fast",             adapter: "aimlapi", aimlModel: "bytedance/seedance-2-0-fast" },
      // Not a model — disables motion (static slides). Kept as a valid choice.
      none: { label: "Pas de motion (statique)", adapter: "none" },
    },
  },

  // ── Voice / TTS ────────────────────────────────────────────────────────────
  voice: {
    default: "elevenlabs-v3",
    providers: {
      "elevenlabs-v3":         { label: "ElevenLabs v3",       adapter: "aimlapi", aimlModel: "elevenlabs/v3_alpha",     voiceId: "21m00Tcm4TlvDq8ikWAM" },
      "minimax-speech-2.8-hd": { label: "MiniMax Speech 2.8 HD", adapter: "aimlapi", aimlModel: "minimax/speech-2.8-hd",  voiceId: "male-qn-qingse" },
    },
  },

  // ── Music generation ───────────────────────────────────────────────────────
  music: {
    default: "elevenlabs-music",
    providers: {
      "elevenlabs-music": { label: "ElevenLabs Music", adapter: "aimlapi", aimlModel: "elevenlabs/eleven_music" },
    },
  },

};

module.exports = { MODEL_CONFIG };

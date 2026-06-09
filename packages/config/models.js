/**
 * Model catalog — curated short-list (budget decision). All accessed via AIML
 * API (api.aimlapi.com); the `aimlModel` fields are the exact API IDs.
 *
 * Kept models:
 *   - Script:  Claude Sonnet 4.6, GPT-4o
 *   - Image:   Qwen-image-plus, Nano Banana (Gemini 2.5 Flash), Seedream 4.5, Nano Banana Pro
 *   - Video:   Kling 2.5 Turbo Pro, Seedance 2.0 Fast
 *   - Voice:   ElevenLabs v3, MiniMax Speech 2.8 HD
 *   - Music:   ElevenLabs Music
 *   - SFX:    ElevenLabs Sound Effects (eleven_text_to_sound_v2)
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
  // Price tiers (via AIML API):
  //   - Qwen-image-plus   ~$0.03 / image  → budget alt — best benchmark score (AI Arena #1)
  //   - Nano Banana       ~$0.04 / image  → default — best overall quality/cost balance
  //   - Seedream 4.5      ~$0.04 / image  → photo premium — superior photorealism & identity consistency
  //   - Nano Banana Pro   ~$0.12 / image  → premium max — highest detail for complex scenes
  //
  // Removed: Flux Schnell — open-weight, non-commercial licence only (not suitable for production).
  image: {
    default: "gemini-2.5-flash-image",
    providers: {
      "qwen-image-plus":        { label: "Qwen-image-plus (Alibaba)",       adapter: "aimlapi", aimlModel: "qwen/qwen-image-plus" },
      "gemini-2.5-flash-image": { label: "Nano Banana (Gemini 2.5 Flash)",  adapter: "aimlapi", aimlModel: "google/gemini-2.5-flash-image" },
      "seedream-4.5":           { label: "Seedream 4.5 (ByteDance)",        adapter: "aimlapi", aimlModel: "bytedance/seedream-4.5" },
      "nano-banana-pro":        { label: "Nano Banana Pro (Gemini 3 Pro)",  adapter: "aimlapi", aimlModel: "google/nano-banana-pro" },
    },
  },

  // ── Video generation (image-to-video) ─────────────────────────────────────
  // Budget tiers (price per short clip, via AIML API):
  //   - Hailuo 2.3 Fast  $0.19 / 6s  768p  → default — best price/quality ratio
  //   - Wan 2.7         ~$0.40 / 5s  720p  → fallback budget option
  //   - Kling 2.5 Turbo ~$0.46 / 5s  1080p → premium motion (hero shots / key scenes)
  //   - Seedance 2.0    ~$0.50+/ 5s  720p  → premium/expensive on AIML
  video: {
    default: "hailuo-2.3-fast",
    providers: {
      // shortClipSeconds = shortest valid duration the model accepts.
      // Used by budget mode (budgetClips: true) — compose.js loops the short clip
      // to the full scene duration with `-stream_loop -1 -t <sceneDuration>`.
      "hailuo-2.3-fast":     { label: "Hailuo 2.3 Fast (budget 768p)", adapter: "aimlapi", aimlModel: "minimax/hailuo-2.3-fast",              shortClipSeconds: 6 },
      "wan-2.7":             { label: "Wan 2.7 (budget 720p)",         adapter: "aimlapi", aimlModel: "alibaba/wan-2-7-i2v",                   shortClipSeconds: 5 },
      "kling-2.5-turbo-pro": { label: "Kling 2.5 Turbo Pro (premium)", adapter: "aimlapi", aimlModel: "klingai/v2.5-turbo/pro/image-to-video", shortClipSeconds: 5 },
      "seedance-2.0-fast":   { label: "Seedance 2.0 Fast",             adapter: "aimlapi", aimlModel: "bytedance/seedance-2-0-fast",            shortClipSeconds: 5 },
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

  // ── SFX generation ────────────────────────────────────────────────────────
  // Per-scene AI cues via ElevenLabs Sound Effects API.
  // When aiSfx is disabled (or AIML API unavailable) the engine falls back to
  // a procedural FFmpeg sine generator (zero cost, always available).
  sfx: {
    default: "elevenlabs-sfx",
    providers: {
      "elevenlabs-sfx": { label: "ElevenLabs Sound Effects", adapter: "aimlapi", aimlModel: "eleven_text_to_sound_v2" },
    },
  },

};

module.exports = { MODEL_CONFIG };

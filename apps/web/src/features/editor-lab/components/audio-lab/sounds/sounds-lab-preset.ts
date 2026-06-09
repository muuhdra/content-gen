export type SfxDensity = "none" | "light" | "medium" | "dense";

export type SoundsLabPreset = {
  enabled: boolean;
  /** Use ElevenLabs AI Sound Effects for per-scene genre-aware cues.
   * When false (or AIML API unavailable), falls back to the procedural FFmpeg sine generator. */
  aiSfx: boolean;
  density: SfxDensity;
  cueFocus: string[];
};

export const defaultSoundsLabPreset: SoundsLabPreset = {
  enabled: true,
  aiSfx: true,
  density: "medium",
  cueFocus: ["impact", "transition", "notification"],
};

export type EffectModuleId = "reactive-fx" | "hook-effect" | "video-ending";
export type ClipMode = "static" | "hybrid" | "video";
export type MotionStyle = "vertical-pan" | "horizontal-pan" | "zoom-in-out";
export type KenBurnsIntensity = "subtle" | "medium" | "strong";

export type EffectsLabPreset = {
  clipMode: ClipMode;
  motionStyle: MotionStyle;
  kenBurnsIntensity: KenBurnsIntensity;
  /** Hybrid budget: fraction of scenes to animate (0–1). The system picks the most impactful. */
  hybridAnimateRatio: number;
  moduleState: Record<EffectModuleId, boolean>;
  videoEndingDuration: number;
};

export const defaultEffectsLabPreset: EffectsLabPreset = {
  clipMode: "static",
  motionStyle: "vertical-pan",
  kenBurnsIntensity: "medium",
  hybridAnimateRatio: 0.4,
  moduleState: {
    "reactive-fx": true,
    "hook-effect": false,
    "video-ending": true,
  },
  videoEndingDuration: 2,
};

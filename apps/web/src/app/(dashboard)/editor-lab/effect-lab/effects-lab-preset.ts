export type EffectModuleId = "reactive-fx" | "hook-effect" | "video-ending";
export type ClipMode = "static" | "video";
export type MotionStyle = "vertical-pan" | "horizontal-pan" | "zoom-in-out";

export type EffectsLabPreset = {
  clipMode: ClipMode;
  motionStyle: MotionStyle;
  moduleState: Record<EffectModuleId, boolean>;
  videoEndingDuration: number;
};

export const defaultEffectsLabPreset: EffectsLabPreset = {
  clipMode: "static",
  motionStyle: "vertical-pan",
  moduleState: {
    "reactive-fx": true,
    "hook-effect": false,
    "video-ending": true,
  },
  videoEndingDuration: 2,
};

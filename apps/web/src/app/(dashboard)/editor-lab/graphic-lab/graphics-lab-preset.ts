export type GraphicModuleId = "text-reveal" | "lower-third" | "stat-counter";

export type GraphicsLabPreset = {
  focusedModuleId: GraphicModuleId;
  moduleState: Record<GraphicModuleId, boolean>;
  variantState: Record<GraphicModuleId, string>;
};

export const defaultGraphicsLabPreset: GraphicsLabPreset = {
  focusedModuleId: "text-reveal",
  moduleState: {
    "text-reveal": true,
    "lower-third": false,
    "stat-counter": false,
  },
  variantState: {
    "text-reveal": "Viral",
    "lower-third": "Minimal",
    "stat-counter": "Burst",
  },
};

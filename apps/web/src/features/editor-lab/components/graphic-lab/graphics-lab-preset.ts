export type GraphicModuleId = "text-reveal" | "lower-third" | "stat-counter";

export type GraphicsLabPreset = {
  enabled: boolean;
  focusedModuleId: GraphicModuleId;
  moduleState: Record<GraphicModuleId, boolean>;
  variantState: Record<GraphicModuleId, string>;
};

export const defaultGraphicsLabPreset: GraphicsLabPreset = {
  enabled: true,
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

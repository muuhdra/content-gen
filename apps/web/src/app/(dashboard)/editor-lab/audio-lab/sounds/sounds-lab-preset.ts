export type SfxDensity = "none" | "light" | "medium" | "dense";

export type SoundsLabPreset = {
  enabled: boolean;
  density: SfxDensity;
  cueFocus: string[];
};

export const defaultSoundsLabPreset: SoundsLabPreset = {
  enabled: true,
  density: "medium",
  cueFocus: ["impact", "transition", "notification"],
};

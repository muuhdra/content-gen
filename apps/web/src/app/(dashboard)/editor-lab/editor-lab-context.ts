import React, { createContext, useContext, type Dispatch, type SetStateAction } from "react";

import type { CaptionLabPreset } from "./caption-lab/caption-lab-preset";
import type { MusicLabPreset } from "./audio-lab/music/music-lab-preset";
import type { SoundsLabPreset } from "./audio-lab/sounds/sounds-lab-preset";
import type { EffectsLabPreset } from "./effect-lab/effects-lab-preset";
import type { GraphicsLabPreset } from "./graphic-lab/graphics-lab-preset";
import type { ProjectDraft } from "../projects/project-draft";
import type { ProjectRecord } from "@/lib/projects-api";

export interface EditorLabContextType {
  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;
  captionPreset: CaptionLabPreset;
  captionPresetVersion: number;
  setCaptionPreset: Dispatch<SetStateAction<CaptionLabPreset>>;
  musicPreset: MusicLabPreset;
  setMusicPreset: Dispatch<SetStateAction<MusicLabPreset>>;
  soundsPreset: SoundsLabPreset;
  setSoundsPreset: Dispatch<SetStateAction<SoundsLabPreset>>;
  graphicsPreset: GraphicsLabPreset;
  setGraphicsPreset: Dispatch<SetStateAction<GraphicsLabPreset>>;
  effectsPreset: EffectsLabPreset;
  setEffectsPreset: Dispatch<SetStateAction<EffectsLabPreset>>;
  projectDraft: ProjectDraft | null;
  setProjectDraft: Dispatch<SetStateAction<ProjectDraft | null>>;
  projectRecord: ProjectRecord | null;
  setProjectRecord: Dispatch<SetStateAction<ProjectRecord | null>>;
  // Global Parameters
  visualStyle: string;
  setVisualStyle: Dispatch<SetStateAction<string>>;
  references: any[];
  setReferences: Dispatch<SetStateAction<any[]>>;
  narrationLanguage: string;
  setNarrationLanguage: Dispatch<SetStateAction<string>>;
  selectedVoice: string;
  setSelectedVoice: Dispatch<SetStateAction<string>>;
  narrationStyle: string;
  setNarrationStyle: Dispatch<SetStateAction<string>>;
}

export const EditorLabContext = createContext<EditorLabContextType | undefined>(undefined);

export const useEditorLab = () => {
  const context = useContext(EditorLabContext);

  if (!context) {
    throw new Error("useEditorLab must be used within an EditorLabProvider");
  }

  return context;
};

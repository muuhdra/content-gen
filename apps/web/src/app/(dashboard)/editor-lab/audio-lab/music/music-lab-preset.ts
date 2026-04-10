export type UploadedMusicTrack = {
  id: string;
  name: string;
  sizeLabel: string;
  mimeType?: string;
  storagePath?: string;
  uploadedAt?: string;
};

export type MusicMode = "ai" | "uploaded";
export type MusicMood = "cinematic" | "uplifting" | "dark" | "editorial" | "ambient";

export type MusicLabPreset = {
  mode: MusicMode;
  mood: MusicMood;
  generationBrief: string;
  uploadedTracks: UploadedMusicTrack[];
  endingFadeEnabled: boolean;
  endingFadeDuration: number;
  dynamicVolume: boolean;
};

export const defaultMusicLabPreset: MusicLabPreset = {
  mode: "ai",
  mood: "cinematic",
  generationBrief: "",
  uploadedTracks: [],
  endingFadeEnabled: true,
  endingFadeDuration: 2.5,
  dynamicVolume: true,
};

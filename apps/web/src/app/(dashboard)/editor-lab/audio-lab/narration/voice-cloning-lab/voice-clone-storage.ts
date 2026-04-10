"use client";

export type BuiltClone = {
  id: string;
  name: string;
  sourceLabel: string;
};

export const CUSTOM_AUDIO_UPLOAD_ID = "custom-audio-upload";
export const CLONE_VOICE_STORAGE_KEY = "cosyl-clone-voices";

export function isBuiltCloneVoiceId(voiceId?: string | null) {
  return typeof voiceId === "string" && voiceId.startsWith("clone-");
}

export function isCustomVoiceId(voiceId?: string | null) {
  return voiceId === CUSTOM_AUDIO_UPLOAD_ID || isBuiltCloneVoiceId(voiceId);
}

export function readBuiltClones(): BuiltClone[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CLONE_VOICE_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeBuiltClones(clones: BuiltClone[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CLONE_VOICE_STORAGE_KEY, JSON.stringify(clones));
}

export function findBuiltClone(voiceId?: string | null) {
  if (!isBuiltCloneVoiceId(voiceId)) {
    return null;
  }

  return readBuiltClones().find((clone) => clone.id === voiceId) ?? null;
}

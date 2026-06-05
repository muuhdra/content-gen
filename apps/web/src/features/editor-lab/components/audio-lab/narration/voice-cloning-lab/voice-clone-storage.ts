"use client";

import { fetchVoiceClones, saveVoiceClone, deleteVoiceClone } from "@/lib/projects-api";

export type BuiltClone = {
  id: string;
  name: string;
  sourceLabel: string;
};

export const CUSTOM_AUDIO_UPLOAD_ID = "custom-audio-upload";
// Keep localStorage as fast in-memory cache; server is source of truth.
export const CLONE_VOICE_STORAGE_KEY = "cosyl-clone-voices";

export function isBuiltCloneVoiceId(voiceId?: string | null) {
  return typeof voiceId === "string" && voiceId.startsWith("clone-");
}

export function isCustomVoiceId(voiceId?: string | null) {
  return voiceId === CUSTOM_AUDIO_UPLOAD_ID || isBuiltCloneVoiceId(voiceId);
}

// ── Local cache (fast reads) ──────────────────────────────────────────────────

function readLocalCache(): BuiltClone[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLONE_VOICE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(clones: BuiltClone[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLONE_VOICE_STORAGE_KEY, JSON.stringify(clones));
}

// ── Public API (sync for reads, async for writes) ─────────────────────────────

export function readBuiltClones(): BuiltClone[] {
  return readLocalCache();
}

/** Fetch from server and refresh local cache. Call once on component mount. */
export async function syncBuiltClonesFromServer(): Promise<BuiltClone[]> {
  try {
    const clones = await fetchVoiceClones();
    const normalized: BuiltClone[] = clones.map((c) => ({
      id: c.id,
      name: c.name,
      sourceLabel: c.sourceLabel || "",
    }));
    writeLocalCache(normalized);
    return normalized;
  } catch {
    // Fall back to local cache on network error.
    return readLocalCache();
  }
}

/** Save a clone to server + update local cache. */
export async function writeBuiltClones(clones: BuiltClone[]): Promise<void> {
  writeLocalCache(clones);
  // Sync every clone to the server (upsert is idempotent).
  await Promise.all(
    clones.map((c) => saveVoiceClone({ id: c.id, name: c.name, sourceLabel: c.sourceLabel || "" }).catch(() => {}))
  );
}

/** Remove one clone from server + update local cache. */
export async function removeBuiltClone(id: string): Promise<BuiltClone[]> {
  const next = readLocalCache().filter((c) => c.id !== id);
  writeLocalCache(next);
  await deleteVoiceClone(id).catch(() => {});
  return next;
}

export function findBuiltClone(voiceId?: string | null) {
  if (!isBuiltCloneVoiceId(voiceId)) return null;
  return readLocalCache().find((clone) => clone.id === voiceId) ?? null;
}

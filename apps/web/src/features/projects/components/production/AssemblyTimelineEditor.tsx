"use client";

import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Copy,
  GripVertical,
  Minus,
  MoveHorizontal,
  Pause,
  Play,
  Plus,
  Scissors,
  RotateCcw,
  RotateCw,
  Save,
  SkipBack,
  SkipForward,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getImageVariantUrl,
  type ProjectAssembly,
  type ProjectAssemblyEditorClip,
  type ProjectAssemblyEditorState,
  type ProjectAssemblyEditorTrack,
  type ProjectAssemblyTimelineItem,
  type ProjectRecord,
  type ProjectScene,
} from "@/lib/projects-api";

const TRACK_HEADER_WIDTH = 128;
const BASE_PIXELS_PER_SECOND = 124;
const MIN_CLIP_DURATION = 0.5;
const MIN_TIMELINE_DURATION = 12;
const HEADER_HEIGHT = 44;
const SNAP_THRESHOLD_SECONDS = 0.18;
const EDGE_AUTO_SCROLL_ZONE = 72;
const EDGE_AUTO_SCROLL_STEP = 28;

type SaveStatus = "idle" | "saving" | "saved" | "error";

export type TimelinePreviewSnapshot = {
  playhead: number;
  totalDuration: number;
  selectedClipId: string | null;
  selectedClip: ProjectAssemblyEditorClip | null;
  activeClips: ProjectAssemblyEditorClip[];
};

type InteractionState =
  | {
      type: "move";
      clipId: string;
      trackId: string;
      kind: ProjectAssemblyEditorClip["kind"];
      pointerOffsetSeconds: number;
    }
  | {
      type: "resize";
      clipId: string;
      trackId: string;
    }
  | {
      type: "playhead";
    };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function snapSeconds(value: number) {
  return Math.round(value * 4) / 4;
}

function roundDuration(value: number) {
  return Math.round(value * 100) / 100;
}

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds * 1000));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const millis = Math.floor((safe % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(millis).padStart(2, "0")}`;
}

function formatRulerTime(seconds: number) {
  const wholeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  const secs = wholeSeconds % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function trimLabel(value: string, fallback: string, maxLength = 28) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function buildSceneMap(scenes: ProjectScene[]) {
  return new Map(scenes.map((scene) => [scene.sceneId, scene]));
}

function getVisualPreviewId(scene?: ProjectScene | null) {
  if (!scene) {
    return null;
  }

  return scene.approvedImageId || null;
}

function getTrackAccent(trackId: string, kind: ProjectAssemblyEditorClip["kind"]) {
  if (trackId === "visual-a") return "sky";
  if (trackId === "visual-b") return "emerald";
  if (trackId === "captions") return "amber";
  if (trackId === "narration") return "violet";
  if (trackId === "music") return "orange";
  if (trackId === "sfx") return "rose";
  if (kind === "visual") return "sky";
  if (kind === "caption") return "amber";
  if (kind === "narration") return "violet";
  if (kind === "sfx") return "rose";
  return "orange";
}

function getTrackTheme(trackId: string, kind: ProjectAssemblyEditorClip["kind"]) {
  const accent = getTrackAccent(trackId, kind);

  if (accent === "sky") {
    return {
      headerText: "text-sky-200",
      headerBorder: "border-sky-400/20",
      headerBg: "bg-sky-500/10",
      clip: "border-sky-400/30 bg-sky-500/25 text-sky-50 shadow-[0_16px_34px_-22px_rgba(56,189,248,0.85)]",
      clipInner: "bg-sky-300/12",
      handle: "bg-sky-100/18",
      waveform: "from-sky-200/0 via-sky-200/35 to-sky-200/0",
      line: "bg-sky-300/70",
      marker: "bg-sky-300",
    };
  }

  if (accent === "emerald") {
    return {
      headerText: "text-emerald-200",
      headerBorder: "border-emerald-400/20",
      headerBg: "bg-emerald-500/10",
      clip: "border-emerald-400/30 bg-emerald-500/22 text-emerald-50 shadow-[0_16px_34px_-22px_rgba(16,185,129,0.85)]",
      clipInner: "bg-emerald-300/12",
      handle: "bg-emerald-100/18",
      waveform: "from-emerald-200/0 via-emerald-200/35 to-emerald-200/0",
      line: "bg-emerald-300/70",
      marker: "bg-emerald-300",
    };
  }

  if (accent === "amber") {
    return {
      headerText: "text-amber-200",
      headerBorder: "border-amber-400/20",
      headerBg: "bg-amber-500/10",
      clip: "border-amber-300/35 bg-amber-600/60 text-amber-50 shadow-[0_16px_34px_-22px_rgba(245,158,11,0.85)]",
      clipInner: "bg-amber-100/12",
      handle: "bg-amber-100/18",
      waveform: "from-amber-100/0 via-amber-100/45 to-amber-100/0",
      line: "bg-amber-100/85",
      marker: "bg-amber-300",
    };
  }

  if (accent === "violet") {
    return {
      headerText: "text-violet-200",
      headerBorder: "border-violet-400/20",
      headerBg: "bg-violet-500/10",
      clip: "border-violet-300/30 bg-violet-500/40 text-violet-50 shadow-[0_16px_34px_-22px_rgba(139,92,246,0.85)]",
      clipInner: "bg-violet-100/12",
      handle: "bg-violet-100/18",
      waveform: "from-violet-100/0 via-violet-100/35 to-violet-100/0",
      line: "bg-violet-100/75",
      marker: "bg-violet-300",
    };
  }

  if (accent === "rose") {
    return {
      headerText: "text-rose-200",
      headerBorder: "border-rose-400/20",
      headerBg: "bg-rose-500/10",
      clip: "border-rose-300/30 bg-rose-500/32 text-rose-50 shadow-[0_16px_34px_-22px_rgba(244,63,94,0.85)]",
      clipInner: "bg-rose-100/12",
      handle: "bg-rose-100/18",
      waveform: "from-rose-100/0 via-rose-100/35 to-rose-100/0",
      line: "bg-rose-100/75",
      marker: "bg-rose-300",
    };
  }

  return {
    headerText: "text-orange-200",
    headerBorder: "border-orange-400/20",
    headerBg: "bg-orange-500/10",
    clip: "border-orange-300/30 bg-orange-500/35 text-orange-50 shadow-[0_16px_34px_-22px_rgba(249,115,22,0.85)]",
    clipInner: "bg-orange-100/12",
    handle: "bg-orange-100/18",
    waveform: "from-orange-100/0 via-orange-100/40 to-orange-100/0",
    line: "bg-orange-100/75",
    marker: "bg-orange-300",
  };
}

function getTrackLabel(trackId: string, kind: ProjectAssemblyEditorClip["kind"]) {
  if (trackId === "visual-a") return "Primary Visuals";
  if (trackId === "visual-b") return "Cutaways";
  if (trackId === "captions") return "Captions";
  if (trackId === "narration") return "Narration";
  if (trackId === "music") return "Music Bed";
  if (trackId === "sfx") return "SFX";
  return kind;
}

function computeTimelineSpan(tracks: ProjectAssemblyEditorTrack[], floorValue: number) {
  const maxEnd = tracks.reduce((trackMax, track) => {
    const clipMax = track.items.reduce((itemMax, clip) => Math.max(itemMax, clip.startTime + clip.duration), 0);
    return Math.max(trackMax, clipMax);
  }, 0);

  return Math.max(floorValue, maxEnd, MIN_TIMELINE_DURATION);
}

function sortTrackItems(track: ProjectAssemblyEditorTrack) {
  return {
    ...track,
    items: [...track.items].sort((left, right) => left.startTime - right.startTime),
  };
}

function sanitizeEditorState(editor: ProjectAssemblyEditorState, floorValue: number) {
  const tracks = Array.isArray(editor.tracks) ? editor.tracks.map(sortTrackItems) : [];
  const totalDuration = computeTimelineSpan(tracks, floorValue);

  return {
    zoom: clamp(editor.zoom || 1, 0.65, 2.4),
    playhead: clamp(editor.playhead || 0, 0, totalDuration),
    totalDuration,
    updatedAt: editor.updatedAt,
    tracks,
  };
}

function buildVisualTracks(project: ProjectRecord, scenes: ProjectScene[]) {
  const sceneMap = buildSceneMap(scenes);
  const sourceItems = project.assembly.timeline.length > 0
    ? project.assembly.timeline
    : scenes.map((scene) => ({
        id: scene.id,
        sceneId: scene.sceneId,
        duration: scene.duration,
        startTime: undefined,
        trackId: null,
        sourceType: scene.approvedVideoId ? "video" : scene.approvedImageId ? "image" : "placeholder",
        sourceLabel: `Scene ${String(scene.sceneId).padStart(2, "0")}`,
        visualDirective: scene.visualIntent,
        narrationPreview: scene.narration,
        motion: scene.emotion,
        audioLayer: "scene",
        slideHeadline: null,
        slideBullets: [],
        slideLayout: null,
        textDensity: null,
        pacingStrategy: null,
        transition: null,
      } satisfies ProjectAssemblyTimelineItem));

  let cursor = 0;

  return sourceItems.map((item, index) => {
    const scene = sceneMap.get(item.sceneId);
    const duration = roundDuration(Math.max(MIN_CLIP_DURATION, item.duration || scene?.duration || 5));
    const startTime = typeof item.startTime === "number" ? item.startTime : cursor;
    cursor = Math.max(cursor, startTime + duration);
    const trackId = item.trackId || (index % 2 === 0 ? "visual-a" : "visual-b");

    return {
      id: item.id,
      trackId,
      kind: "visual" as const,
      label: trimLabel(item.sourceLabel || scene?.visualIntent || scene?.narration || "", `Scene ${String(item.sceneId).padStart(2, "0")}`),
      startTime,
      duration,
      sceneId: item.sceneId,
      sourceType: item.sourceType,
      sourceLabel: item.sourceLabel,
      previewText: item.visualDirective || scene?.visualIntent || null,
      previewImageId: getVisualPreviewId(scene),
      accent: getTrackAccent(trackId, "visual"),
    };
  });
}

function buildCaptionTrack(project: ProjectRecord, scenes: ProjectScene[], visualItems: ProjectAssemblyEditorClip[]) {
  const groupedByScene = new Map<number, { startMs: number; endMs: number; texts: string[] }>();

  for (const cue of project.captions.cues || []) {
    const existing = groupedByScene.get(cue.sceneId);
    if (existing) {
      existing.startMs = Math.min(existing.startMs, cue.startMs);
      existing.endMs = Math.max(existing.endMs, cue.endMs);
      existing.texts.push(cue.text);
    } else {
      groupedByScene.set(cue.sceneId, {
        startMs: cue.startMs,
        endMs: cue.endMs,
        texts: [cue.text],
      });
    }
  }

  if (visualItems.length > 0) {
    const sceneMap = buildSceneMap(scenes);
    return visualItems.map((visualClip) => {
      const sceneId = visualClip.sceneId ?? null;
      const group = sceneId ? groupedByScene.get(sceneId) : null;
      const scene = sceneId ? sceneMap.get(sceneId) : null;
      const previewText = group?.texts[0] || scene?.narration || visualClip.previewText || null;

      return {
        id: `caption-${visualClip.id}`,
        trackId: "captions",
        kind: "caption" as const,
        label: trimLabel(previewText || "", sceneId ? `Caption ${sceneId}` : "Caption"),
        startTime: roundDuration(visualClip.startTime),
        duration: roundDuration(Math.max(MIN_CLIP_DURATION, visualClip.duration)),
        sceneId,
        previewText,
        accent: "amber",
      };
    });
  }

  if (groupedByScene.size > 0) {
    return Array.from(groupedByScene.entries())
      .sort((left, right) => left[1].startMs - right[1].startMs)
      .map(([sceneId, group]) => ({
        id: `caption-${sceneId}`,
        trackId: "captions",
        kind: "caption" as const,
        label: trimLabel(group.texts[0] || "", `Scene ${sceneId}`),
        startTime: roundDuration(group.startMs / 1000),
        duration: roundDuration(Math.max(MIN_CLIP_DURATION, (group.endMs - group.startMs) / 1000)),
        sceneId,
        previewText: group.texts[0] || null,
        accent: "amber",
      }));
  }

  const visualByScene = new Map(visualItems.map((item) => [item.sceneId, item]));
  return scenes.map((scene) => {
    const linkedVisual = visualByScene.get(scene.sceneId);
    return {
      id: `caption-${scene.sceneId}`,
      trackId: "captions",
      kind: "caption" as const,
      label: trimLabel(scene.narration, `Caption ${scene.sceneId}`),
      startTime: linkedVisual?.startTime ?? 0,
      duration: linkedVisual?.duration ?? scene.duration ?? 5,
      sceneId: scene.sceneId,
      previewText: scene.narration,
      accent: "amber",
    };
  });
}

function buildNarrationTrack(scenes: ProjectScene[], visualItems: ProjectAssemblyEditorClip[]) {
  if (visualItems.length > 0) {
    const sceneMap = buildSceneMap(scenes);

    return visualItems.map((visualClip) => {
      const sceneId = visualClip.sceneId ?? null;
      const scene = sceneId ? sceneMap.get(sceneId) : null;
      const previewText = scene?.narration || visualClip.previewText || null;

      return {
        id: `narration-${visualClip.id}`,
        trackId: "narration",
        kind: "narration" as const,
        label: trimLabel(previewText || "", sceneId ? `Narration ${sceneId}` : "Narration"),
        startTime: roundDuration(visualClip.startTime),
        duration: roundDuration(Math.max(MIN_CLIP_DURATION, visualClip.duration)),
        sceneId,
        previewText,
        accent: "violet",
      };
    });
  }

  const visualByScene = new Map(visualItems.map((item) => [item.sceneId, item]));

  return scenes.map((scene) => {
    const linkedVisual = visualByScene.get(scene.sceneId);
    return {
      id: `narration-${scene.sceneId}`,
      trackId: "narration",
      kind: "narration" as const,
      label: trimLabel(scene.narration, `Narration ${scene.sceneId}`),
      startTime: linkedVisual?.startTime ?? 0,
      duration: linkedVisual?.duration ?? scene.duration ?? 5,
      sceneId: scene.sceneId,
      previewText: scene.narration,
      accent: "violet",
    };
  });
}

function buildSfxTrack(project: ProjectRecord, scenes: ProjectScene[], visualItems: ProjectAssemblyEditorClip[]) {
  if (project.audio?.sfx?.enabled === false) {
    return [] as ProjectAssemblyEditorClip[];
  }

  const visualByScene = new Map(visualItems.map((item) => [item.sceneId, item]));
  const cueGroups = new Map<number, string[]>();

  for (const cue of project.audio?.sfx?.cues || []) {
    const match = String(cue).match(/(?:scene|slide)\s+(\d+)/i);
    const sceneId = match ? Number(match[1]) : null;

    if (!sceneId) {
      continue;
    }

    const existing = cueGroups.get(sceneId) || [];
    existing.push(String(cue));
    cueGroups.set(sceneId, existing);
  }

  if (visualItems.length > 0) {
    return visualItems.map((visualClip) => {
      const sceneId = visualClip.sceneId ?? null;
      const scene = sceneId ? scenes.find((entry) => entry.sceneId === sceneId) : null;
      const cueSummary = (sceneId ? cueGroups.get(sceneId)?.[0] : null)
        || scene?.visualIntent
        || `Scene ${sceneId ?? "X"} SFX`;

      return {
        id: `sfx-${visualClip.id}`,
        trackId: "sfx",
        kind: "sfx" as const,
        label: trimLabel(cueSummary, sceneId ? `SFX ${sceneId}` : "SFX"),
        startTime: roundDuration(visualClip.startTime),
        duration: roundDuration(Math.max(MIN_CLIP_DURATION, visualClip.duration)),
        sceneId,
        previewText: cueSummary,
        accent: "rose",
      };
    });
  }

  return scenes.map((scene) => {
    const linkedVisual = visualByScene.get(scene.sceneId);
    const cueSummary = cueGroups.get(scene.sceneId)?.[0]
      || `Scene ${scene.sceneId} SFX`
      || scene.visualIntent;

    return {
      id: `sfx-${scene.sceneId}`,
      trackId: "sfx",
      kind: "sfx" as const,
      label: trimLabel(cueSummary, `SFX ${scene.sceneId}`),
      startTime: linkedVisual?.startTime ?? 0,
      duration: linkedVisual?.duration ?? scene.duration ?? 5,
      sceneId: scene.sceneId,
      previewText: cueSummary,
      accent: "rose",
    };
  });
}

function buildMusicTrack(project: ProjectRecord, totalDuration: number): ProjectAssemblyEditorClip[] {
  if ((project.audio?.music?.mode || "auto") === "none") {
    return [] as ProjectAssemblyEditorClip[];
  }

  const uploadedTracks = Array.isArray(project.audio?.music?.uploadedTracks)
    ? project.audio.music.uploadedTracks.filter((track) => Boolean(track?.storagePath))
    : [];
  const baseLabel = uploadedTracks.length > 0
    ? uploadedTracks.map((track) => track.name).join(" / ")
    : project.audio?.music?.trackName || project.audio?.music?.mood || "Music bed";

  return [
    {
      id: "music-bed",
      trackId: "music",
      kind: "music" as const,
      label: trimLabel(baseLabel, "Music bed"),
      startTime: 0,
      duration: roundDuration(Math.max(totalDuration, MIN_TIMELINE_DURATION)),
      previewText: project.audio?.music?.generationBrief || baseLabel,
      accent: "orange",
    },
  ];
}

function buildDerivedAudioTracks(project: ProjectRecord, scenes: ProjectScene[], visualItems: ProjectAssemblyEditorClip[]) {
  const captionItems = buildCaptionTrack(project, scenes, visualItems);
  const narrationItems = buildNarrationTrack(scenes, visualItems);
  const coreTracks: ProjectAssemblyEditorTrack[] = [
    { id: "captions", label: "Captions", kind: "caption", accent: "amber", items: captionItems },
    { id: "narration", label: "Narration", kind: "narration", accent: "violet", items: narrationItems },
  ];
  const audioFloorDuration = computeTimelineSpan(coreTracks, Math.max(
    MIN_TIMELINE_DURATION,
    project.assembly.totalDurationSeconds || 0,
    scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0),
  ));
  const musicItems = buildMusicTrack(project, audioFloorDuration);
  const sfxItems = buildSfxTrack(project, scenes, visualItems);

  return [
    ...coreTracks,
    { id: "music", label: "Music Bed", kind: "music", accent: "orange", items: musicItems },
    { id: "sfx", label: "SFX", kind: "sfx", accent: "rose", items: sfxItems },
  ] as ProjectAssemblyEditorTrack[];
}

function buildInitialEditorState(project: ProjectRecord, scenes: ProjectScene[]): ProjectAssemblyEditorState {
  const floorDuration = Math.max(
    MIN_TIMELINE_DURATION,
    project.assembly.totalDurationSeconds || 0,
    scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0),
  );

  const generatedState = (() => {
    const visualItems = buildVisualTracks(project, scenes);
    const baseTracks: ProjectAssemblyEditorTrack[] = [
      { id: "visual-a", label: "Primary Visuals", kind: "visual", accent: "sky", items: visualItems.filter((item) => item.trackId === "visual-a") },
      { id: "visual-b", label: "Cutaways", kind: "visual", accent: "emerald", items: visualItems.filter((item) => item.trackId === "visual-b") },
    ];
    const derivedTracks = buildDerivedAudioTracks(project, scenes, visualItems);

    return {
      zoom: 1,
      playhead: 0,
      totalDuration: computeTimelineSpan([...baseTracks, ...derivedTracks], floorDuration),
      tracks: ([
        ...baseTracks,
        ...derivedTracks,
      ] as ProjectAssemblyEditorTrack[]).map(sortTrackItems),
    } satisfies ProjectAssemblyEditorState;
  })();

  if (project.assembly.editor?.tracks?.length) {
    const existingEditor = sanitizeEditorState(project.assembly.editor, floorDuration);
    const trackMap = new Map(existingEditor.tracks.map((track) => [track.id, track]));
    const mergedTracks = generatedState.tracks.map((fallbackTrack) => trackMap.get(fallbackTrack.id) || fallbackTrack);

    return sanitizeEditorState({
      ...existingEditor,
      tracks: mergedTracks,
    }, floorDuration);
  }

  return generatedState;
}

function serializeEditorState(editor: ProjectAssemblyEditorState) {
  return JSON.stringify({
    zoom: roundDuration(editor.zoom),
    playhead: roundDuration(editor.playhead),
    totalDuration: roundDuration(editor.totalDuration),
    tracks: editor.tracks.map((track) => ({
      id: track.id,
      items: track.items.map((item) => ({
        id: item.id,
        trackId: item.trackId,
        startTime: roundDuration(item.startTime),
        duration: roundDuration(item.duration),
      })),
    })),
  });
}

function buildAssemblyFromEditor(
  project: ProjectRecord,
  scenes: ProjectScene[],
  editor: ProjectAssemblyEditorState,
): ProjectAssembly {
  const sceneMap = buildSceneMap(scenes);
  const baseTimelineById = new Map(project.assembly.timeline.map((item) => [item.id, item]));
  const baseTimelineByScene = new Map(project.assembly.timeline.map((item) => [item.sceneId, item]));
  const visualItems = editor.tracks
    .filter((track) => track.kind === "visual")
    .flatMap((track) => track.items)
    .sort((left, right) => left.startTime - right.startTime);

  const nextTimeline = visualItems.map((clip) => {
    const base = baseTimelineById.get(clip.id) || (clip.sceneId ? baseTimelineByScene.get(clip.sceneId) : undefined);
    const scene = clip.sceneId ? sceneMap.get(clip.sceneId) : undefined;
    return {
      id: clip.id,
      sceneId: clip.sceneId ?? base?.sceneId ?? 0,
      duration: roundDuration(Math.max(MIN_CLIP_DURATION, clip.duration)),
      startTime: roundDuration(Math.max(0, clip.startTime)),
      trackId: clip.trackId,
      sourceType: clip.sourceType || base?.sourceType || (scene?.approvedVideoId ? "video" : scene?.approvedImageId ? "image" : "placeholder"),
      sourceLabel: clip.sourceLabel || base?.sourceLabel || clip.label,
      visualDirective: base?.visualDirective || scene?.visualIntent || clip.previewText || "",
      narrationPreview: base?.narrationPreview || scene?.narration || clip.previewText || "",
      motion: base?.motion || scene?.emotion || "steady",
      audioLayer: base?.audioLayer || "timeline-customized",
      slideHeadline: base?.slideHeadline || null,
      slideBullets: base?.slideBullets || [],
      slideLayout: base?.slideLayout || null,
      textDensity: base?.textDensity || null,
      pacingStrategy: base?.pacingStrategy || null,
      transition: base?.transition || null,
    } satisfies ProjectAssemblyTimelineItem;
  });

  const nextTotalDuration = computeTimelineSpan(editor.tracks, Math.max(project.assembly.totalDurationSeconds || 0, MIN_TIMELINE_DURATION));

  return {
    ...project.assembly,
    totalDurationSeconds: roundDuration(nextTotalDuration),
    totalDurationLabel: formatRulerTime(nextTotalDuration),
    timeline: nextTimeline,
    editor: {
      ...editor,
      totalDuration: nextTotalDuration,
      updatedAt: new Date().toISOString(),
    },
  };
}

function cloneEditorState(editor: ProjectAssemblyEditorState): ProjectAssemblyEditorState {
  return {
    ...editor,
    tracks: editor.tracks.map((track) => ({
      ...track,
      items: track.items.map((item) => ({ ...item })),
    })),
  };
}

function replaceClipAcrossTracks(
  tracks: ProjectAssemblyEditorTrack[],
  trackId: string,
  clipId: string,
  updater: (clip: ProjectAssemblyEditorClip) => ProjectAssemblyEditorClip,
) {
  return tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }

    return sortTrackItems({
      ...track,
      items: track.items.map((clip) => (clip.id === clipId ? updater(clip) : clip)),
    });
  });
}

function removeClipAcrossTracks(tracks: ProjectAssemblyEditorTrack[], trackId: string, clipId: string) {
  return tracks.map((track) => {
    if (track.id !== trackId) {
      return track;
    }

    return sortTrackItems({
      ...track,
      items: track.items.filter((clip) => clip.id !== clipId),
    });
  });
}

function findClipInTracks(tracks: ProjectAssemblyEditorTrack[], clipId: string) {
  for (const track of tracks) {
    const clip = track.items.find((item) => item.id === clipId);
    if (clip) {
      return clip;
    }
  }

  return null;
}

function buildVisualSignature(tracks: ProjectAssemblyEditorTrack[]) {
  return JSON.stringify(
    tracks
      .filter((track) => track.kind === "visual")
      .map((track) => ({
        id: track.id,
        items: track.items.map((item) => ({
          id: item.id,
          startTime: roundDuration(item.startTime),
          duration: roundDuration(item.duration),
          sceneId: item.sceneId ?? null,
        })),
      })),
  );
}

function buildSupportTracksFromVisuals(
  project: ProjectRecord,
  scenes: ProjectScene[],
  editor: ProjectAssemblyEditorState,
) {
  const visualTracks = editor.tracks.filter((track) => track.kind === "visual").map(sortTrackItems);
  const visualItems = visualTracks.flatMap((track) => track.items).sort((left, right) => left.startTime - right.startTime);
  const derivedTracks = buildDerivedAudioTracks(project, scenes, visualItems);

  return sanitizeEditorState({
    ...editor,
    tracks: ([
      ...visualTracks,
      ...derivedTracks,
    ] as ProjectAssemblyEditorTrack[]),
  }, Math.max(project.assembly.totalDurationSeconds || 0, MIN_TIMELINE_DURATION));
}

function buildSnapPoints(
  tracks: ProjectAssemblyEditorTrack[],
  targetTrackId: string,
  clipId: string,
  playhead: number,
) {
  const targetTrack = tracks.find((track) => track.id === targetTrackId);
  const points = new Set<number>([0, snapSeconds(playhead)]);

  for (const clip of targetTrack?.items || []) {
    if (clip.id === clipId) {
      continue;
    }

    points.add(snapSeconds(clip.startTime));
    points.add(snapSeconds(clip.startTime + clip.duration));
  }

  return Array.from(points).sort((left, right) => left - right);
}

function snapToNearestPoint(value: number, candidates: number[]) {
  let closest = value;
  let smallestDistance = Number.POSITIVE_INFINITY;

  for (const point of candidates) {
    const distance = Math.abs(point - value);
    if (distance < smallestDistance) {
      smallestDistance = distance;
      closest = point;
    }
  }

  return smallestDistance <= SNAP_THRESHOLD_SECONDS ? closest : value;
}

function moveClipBetweenTracks(
  tracks: ProjectAssemblyEditorTrack[],
  sourceTrackId: string,
  targetTrackId: string,
  clipId: string,
  nextStartTime: number,
) {
  let movingClip: ProjectAssemblyEditorClip | null = null;

  const withoutSource = tracks.map((track) => {
    if (track.id !== sourceTrackId) {
      return track;
    }

    const nextItems = track.items.filter((clip) => {
      if (clip.id === clipId) {
        movingClip = clip;
        return false;
      }
      return true;
    });

    return sortTrackItems({
      ...track,
      items: nextItems,
    });
  });

  if (!movingClip) {
    return tracks;
  }

  const clipToMove: ProjectAssemblyEditorClip = movingClip;

  return withoutSource.map((track) => {
    if (track.id !== targetTrackId) {
      return track;
    }

    const movedClip: ProjectAssemblyEditorClip = {
      ...clipToMove,
      trackId: targetTrackId,
      startTime: nextStartTime,
    };

    return sortTrackItems({
      ...track,
      items: [
        ...track.items,
        movedClip,
      ],
    });
  });
}

function buildWaveformPattern(themeLineClass: string) {
  return (
    <div className="absolute inset-0 flex items-center gap-2 overflow-hidden px-3 opacity-80">
      {Array.from({ length: 22 }).map((_, index) => (
        <span
          key={index}
          className={cn("w-1 rounded-full", themeLineClass)}
          style={{ height: `${24 + ((index * 17) % 38)}%` }}
        />
      ))}
    </div>
  );
}

function renderTrackTitle(trackId: string, kind: ProjectAssemblyEditorClip["kind"], stacked = false) {
  const label = getTrackLabel(trackId, kind);

  if (!stacked || label !== "Primary Visuals") {
    return label;
  }

  return (
    <>
      <span className="block">Primary</span>
      <span className="block">Visuals</span>
    </>
  );
}

export function AssemblyTimelineEditor({
  project,
  scenes,
  onCommit,
  onPreviewChange,
  mode = "embedded",
}: {
  project: ProjectRecord;
  scenes: ProjectScene[];
  onCommit: (nextAssembly: ProjectAssembly) => Promise<void> | void;
  onPreviewChange?: (snapshot: TimelinePreviewSnapshot) => void;
  mode?: "embedded" | "studio";
}) {
  const isStudioMode = mode === "studio";
  const sourceState = useMemo(() => buildInitialEditorState(project, scenes), [project, scenes]);
  const [editorState, setEditorState] = useState<ProjectAssemblyEditorState>(() => cloneEditorState(sourceState));
  const [history, setHistory] = useState<ProjectAssemblyEditorState[]>(() => [cloneEditorState(sourceState)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeInteraction, setActiveInteraction] = useState<InteractionState | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const editorStateRef = useRef(editorState);
  const sourceSignature = useMemo(() => serializeEditorState(sourceState), [sourceState]);
  const lastSourceSignatureRef = useRef(sourceSignature);
  const trackHeaderWidth = isStudioMode ? 118 : TRACK_HEADER_WIDTH;
  const laneHeight = isStudioMode ? 52 : 64;
  const clipInset = isStudioMode ? 3 : 6;
  const pixelsPerSecond = BASE_PIXELS_PER_SECOND * editorState.zoom;

  useEffect(() => {
    editorStateRef.current = editorState;
  }, [editorState]);

  useEffect(() => {
    if (activeInteraction) {
      return;
    }

    if (lastSourceSignatureRef.current === sourceSignature) {
      return;
    }

    lastSourceSignatureRef.current = sourceSignature;
    const nextState = cloneEditorState(sourceState);
    startTransition(() => {
      setEditorState(nextState);
      setHistory([cloneEditorState(nextState)]);
      setHistoryIndex(0);
      setSaveStatus("idle");
      setSelectedClipId(null);
    });
  }, [activeInteraction, sourceSignature, sourceState]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let frameId = 0;
    let lastFrameTime = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = (now - lastFrameTime) / 1000;
      lastFrameTime = now;

      setEditorState((current) => {
        const nextPlayhead = current.playhead + deltaSeconds;
        if (nextPlayhead >= current.totalDuration) {
          setIsPlaying(false);
          return { ...current, playhead: current.totalDuration };
        }

        return { ...current, playhead: nextPlayhead };
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying]);

  const totalDuration = editorState.totalDuration;
  const sortedTracks = editorState.tracks.map(sortTrackItems);
  const visualClipCount = sortedTracks.filter((track) => track.kind === "visual").reduce((count, track) => count + track.items.length, 0);
  const selectedClip = sortedTracks.flatMap((track) => track.items).find((clip) => clip.id === selectedClipId) || null;
  const activeClips = useMemo(
    () => sortedTracks
      .flatMap((track) => track.items)
      .filter((clip) => editorState.playhead >= clip.startTime && editorState.playhead < clip.startTime + clip.duration),
    [editorState.playhead, sortedTracks],
  );

  useEffect(() => {
    if (!onPreviewChange) {
      return;
    }

    onPreviewChange({
      playhead: editorState.playhead,
      totalDuration,
      selectedClipId,
      selectedClip,
      activeClips,
    });
  }, [activeClips, editorState.playhead, onPreviewChange, selectedClip, selectedClipId, totalDuration]);

  const commitEditorState = useCallback((nextState: ProjectAssemblyEditorState) => {
    const previousSnapshot = history[historyIndex];
    const nextVisualSignature = buildVisualSignature(nextState.tracks);
    const previousVisualSignature = buildVisualSignature(previousSnapshot.tracks);
    const nextSnapshot = cloneEditorState(
      nextVisualSignature !== previousVisualSignature
        ? buildSupportTracksFromVisuals(project, scenes, nextState)
        : nextState,
    );

    if (serializeEditorState(previousSnapshot) === serializeEditorState(nextSnapshot)) {
      setEditorState(nextSnapshot);
      return;
    }

    setEditorState(nextSnapshot);
    setHistory((current) => [...current.slice(0, historyIndex + 1), cloneEditorState(nextSnapshot)]);
    setHistoryIndex((current) => current + 1);
    setSaveStatus("saving");
    lastSourceSignatureRef.current = serializeEditorState(nextSnapshot);

    const nextAssembly = buildAssemblyFromEditor(project, scenes, nextSnapshot);
    Promise.resolve(onCommit(nextAssembly))
      .then(() => {
        setSaveStatus("saved");
      })
      .catch(() => {
        setSaveStatus("error");
      });
  }, [history, historyIndex, onCommit, project, scenes]);

  const clientXToSeconds = useCallback((clientX: number) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return 0;
    }

    const rect = viewport.getBoundingClientRect();
    const offsetX = clientX - rect.left + viewport.scrollLeft - trackHeaderWidth;
    return clamp(offsetX / pixelsPerSecond, 0, editorStateRef.current.totalDuration);
  }, [pixelsPerSecond, trackHeaderWidth]);

  const resolveTargetTrack = (kind: ProjectAssemblyEditorClip["kind"], clientY: number, fallbackTrackId: string) => {
    if (kind !== "visual") {
      return fallbackTrackId;
    }

    for (const track of editorStateRef.current.tracks) {
      if (track.kind !== "visual") {
        continue;
      }

      const row = trackRefs.current[track.id];
      if (!row) {
        continue;
      }

      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        return track.id;
      }
    }

    return fallbackTrackId;
  };

  useEffect(() => {
    if (!activeInteraction) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const current = editorStateRef.current;
      const viewport = viewportRef.current;

      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        if (event.clientX >= rect.right - EDGE_AUTO_SCROLL_ZONE) {
          viewport.scrollLeft += EDGE_AUTO_SCROLL_STEP;
        } else if (event.clientX <= rect.left + EDGE_AUTO_SCROLL_ZONE) {
          viewport.scrollLeft -= EDGE_AUTO_SCROLL_STEP;
        }
      }

      if (activeInteraction.type === "playhead") {
        startTransition(() => {
          setEditorState({
            ...current,
            playhead: clientXToSeconds(event.clientX),
          });
        });
        return;
      }

      const nextSeconds = clientXToSeconds(event.clientX);
      const targetTrackId = activeInteraction.type === "move"
        ? resolveTargetTrack(activeInteraction.kind, event.clientY, activeInteraction.trackId)
        : activeInteraction.trackId;

      startTransition(() => {
        setEditorState((state) => {
          const baseTotalDuration = Math.max(project.assembly.totalDurationSeconds || 0, MIN_TIMELINE_DURATION);

          if (activeInteraction.type === "move") {
            const movingClip = findClipInTracks(state.tracks, activeInteraction.clipId);
            if (!movingClip) {
              return state;
            }

            const rawStart = clamp(
              nextSeconds - activeInteraction.pointerOffsetSeconds,
              0,
              Math.max(0, state.totalDuration - movingClip.duration),
            );
            const snapPoints = buildSnapPoints(state.tracks, targetTrackId, activeInteraction.clipId, state.playhead);
            const snappedStart = snapSeconds(
              snapToNearestPoint(
                snapToNearestPoint(rawStart, snapPoints),
                snapPoints.map((point) => point - movingClip.duration),
              ),
            );
            const nextTracks = targetTrackId === activeInteraction.trackId
              ? replaceClipAcrossTracks(state.tracks, activeInteraction.trackId, activeInteraction.clipId, (clip) => ({
                  ...clip,
                  startTime: snappedStart,
                }))
              : moveClipBetweenTracks(state.tracks, activeInteraction.trackId, targetTrackId, activeInteraction.clipId, snappedStart);
            const nextDuration = computeTimelineSpan(nextTracks, baseTotalDuration);

            return {
              ...state,
              totalDuration: nextDuration,
              playhead: clamp(state.playhead, 0, nextDuration),
              tracks: nextTracks,
            };
          }

          const resizingClip = findClipInTracks(state.tracks, activeInteraction.clipId);
          if (!resizingClip) {
            return state;
          }

          const resizeSnapPoints = buildSnapPoints(state.tracks, activeInteraction.trackId, activeInteraction.clipId, state.playhead);
          const nextEnd = snapToNearestPoint(nextSeconds, resizeSnapPoints);
          const nextTracks = replaceClipAcrossTracks(state.tracks, activeInteraction.trackId, activeInteraction.clipId, (clip) => ({
            ...clip,
            duration: snapSeconds(
              clamp(nextEnd - clip.startTime, MIN_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, state.totalDuration - clip.startTime)),
            ),
          }));
          const nextDuration = computeTimelineSpan(nextTracks, baseTotalDuration);

          return {
            ...state,
            totalDuration: nextDuration,
            playhead: clamp(state.playhead, 0, nextDuration),
            tracks: nextTracks,
          };
        });
      });
    };

    const handlePointerUp = () => {
      const shouldCommit = activeInteraction.type !== "playhead";
      setActiveInteraction(null);

      if (!shouldCommit) {
        return;
      }

      commitEditorState(editorStateRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [activeInteraction, clientXToSeconds, commitEditorState, project]);

  const handleUndo = () => {
    if (historyIndex === 0) {
      return;
    }

    const nextIndex = historyIndex - 1;
    const nextState = cloneEditorState(history[nextIndex]);
    setHistoryIndex(nextIndex);
    setEditorState(nextState);
    setSaveStatus("saving");
    lastSourceSignatureRef.current = serializeEditorState(nextState);
    Promise.resolve(onCommit(buildAssemblyFromEditor(project, scenes, nextState)))
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("error"));
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) {
      return;
    }

    const nextIndex = historyIndex + 1;
    const nextState = cloneEditorState(history[nextIndex]);
    setHistoryIndex(nextIndex);
    setEditorState(nextState);
    setSaveStatus("saving");
    lastSourceSignatureRef.current = serializeEditorState(nextState);
    Promise.resolve(onCommit(buildAssemblyFromEditor(project, scenes, nextState)))
      .then(() => setSaveStatus("saved"))
      .catch(() => setSaveStatus("error"));
  };

  const setPlayheadFromClientX = (clientX: number) => {
    setEditorState((current) => ({
      ...current,
      playhead: clientXToSeconds(clientX),
    }));
  };

  const handleZoomChange = (direction: "in" | "out") => {
    setEditorState((current) => ({
      ...current,
      zoom: direction === "in"
        ? clamp(current.zoom + 0.15, 0.65, 2.4)
        : clamp(current.zoom - 0.15, 0.65, 2.4),
    }));
  };

  const handleFitTimeline = () => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const availableWidth = Math.max(640, viewport.clientWidth - trackHeaderWidth - 32);
    const targetZoom = clamp(availableWidth / Math.max(totalDuration, MIN_TIMELINE_DURATION) / BASE_PIXELS_PER_SECOND, 0.65, 2.4);

    setEditorState((current) => ({
      ...current,
      zoom: targetZoom,
    }));
  };

  const commitSelectionUpdate = useCallback((updater: (state: ProjectAssemblyEditorState) => ProjectAssemblyEditorState | null) => {
    const nextState = updater(cloneEditorState(editorStateRef.current));
    if (!nextState) {
      return;
    }

    commitEditorState(nextState);
  }, [commitEditorState]);

  const selectRelativeClip = (direction: "previous" | "next") => {
    const clips = sortedTracks.flatMap((track) => track.items).sort((left, right) => left.startTime - right.startTime);
    if (clips.length === 0) {
      return;
    }

    const activeIndex = selectedClipId
      ? clips.findIndex((clip) => clip.id === selectedClipId)
      : clips.findIndex((clip) => clip.startTime >= editorState.playhead);
    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    const nextIndex = direction === "previous"
      ? Math.max(0, currentIndex - 1)
      : Math.min(clips.length - 1, currentIndex + (selectedClipId ? 1 : 0));
    const nextClip = clips[nextIndex];

    setSelectedClipId(nextClip.id);
    setEditorState((current) => ({
      ...current,
      playhead: clamp(nextClip.startTime, 0, current.totalDuration),
    }));
  };

  const duplicateSelectedClip = useCallback(() => {
    if (!selectedClipId) {
      return;
    }

    commitSelectionUpdate((state) => {
      const targetClip = findClipInTracks(state.tracks, selectedClipId);
      if (!targetClip) {
        return null;
      }

      const targetTrackId = targetClip.kind === "visual"
        ? (targetClip.trackId === "visual-a" ? "visual-b" : "visual-a")
        : targetClip.trackId;
      const duplicateId = `${targetClip.id}-dup-${Date.now()}`;
      const nextStart = snapSeconds(Math.min(state.totalDuration, targetClip.startTime + targetClip.duration));
      const duplicateClip: ProjectAssemblyEditorClip = {
        ...targetClip,
        id: duplicateId,
        trackId: targetTrackId,
        startTime: nextStart,
      };
      const nextTracks = state.tracks.map((track) => track.id === targetTrackId
        ? sortTrackItems({ ...track, items: [...track.items, duplicateClip] })
        : track);

      return {
        ...state,
        totalDuration: computeTimelineSpan(nextTracks, Math.max(project.assembly.totalDurationSeconds || 0, MIN_TIMELINE_DURATION)),
        tracks: nextTracks,
      };
    });
  }, [commitSelectionUpdate, project.assembly.totalDurationSeconds, selectedClipId]);

  const splitSelectedClip = useCallback(() => {
    if (!selectedClipId) {
      return;
    }

    commitSelectionUpdate((state) => {
      const targetClip = findClipInTracks(state.tracks, selectedClipId);
      if (!targetClip) {
        return null;
      }

      const splitPoint = snapSeconds(clamp(state.playhead, targetClip.startTime + MIN_CLIP_DURATION, targetClip.startTime + targetClip.duration - MIN_CLIP_DURATION));
      if (splitPoint <= targetClip.startTime || splitPoint >= targetClip.startTime + targetClip.duration) {
        return null;
      }

      const firstDuration = snapSeconds(splitPoint - targetClip.startTime);
      const secondDuration = snapSeconds(targetClip.duration - firstDuration);
      const secondClip: ProjectAssemblyEditorClip = {
        ...targetClip,
        id: `${targetClip.id}-split-${Date.now()}`,
        startTime: splitPoint,
        duration: secondDuration,
      };

      const nextTracks = state.tracks.map((track) => {
        if (track.id !== targetClip.trackId) {
          return track;
        }

        return sortTrackItems({
          ...track,
          items: track.items.flatMap((clip) => {
            if (clip.id !== targetClip.id) {
              return [clip];
            }

            return [
              { ...clip, duration: firstDuration },
              secondClip,
            ];
          }),
        });
      });

      setSelectedClipId(secondClip.id);

      return {
        ...state,
        totalDuration: computeTimelineSpan(nextTracks, Math.max(project.assembly.totalDurationSeconds || 0, MIN_TIMELINE_DURATION)),
        tracks: nextTracks,
      };
    });
  }, [commitSelectionUpdate, project.assembly.totalDurationSeconds, selectedClipId]);

  const deleteSelectedClip = useCallback(() => {
    if (!selectedClipId) {
      return;
    }

    commitSelectionUpdate((state) => {
      const targetClip = findClipInTracks(state.tracks, selectedClipId);
      if (!targetClip) {
        return null;
      }

      const nextTracks = removeClipAcrossTracks(state.tracks, targetClip.trackId, targetClip.id);
      const nextDuration = computeTimelineSpan(nextTracks, Math.max(project.assembly.totalDurationSeconds || 0, MIN_TIMELINE_DURATION));
      setSelectedClipId(null);

      return {
        ...state,
        totalDuration: nextDuration,
        playhead: clamp(state.playhead, 0, nextDuration),
        tracks: nextTracks,
      };
    });
  }, [commitSelectionUpdate, project.assembly.totalDurationSeconds, selectedClipId]);

  const resyncSupportTracks = useCallback(() => {
    commitSelectionUpdate((state) => buildSupportTracksFromVisuals(project, scenes, state));
  }, [commitSelectionUpdate, project, scenes]);

  const nudgeSelectedClip = useCallback((delta: number) => {
    if (!selectedClipId) {
      return;
    }

    commitSelectionUpdate((state) => {
      const targetClip = findClipInTracks(state.tracks, selectedClipId);
      if (!targetClip) {
        return null;
      }

      const nextTracks = replaceClipAcrossTracks(state.tracks, targetClip.trackId, targetClip.id, (clip) => {
        const nextStart = snapSeconds(clamp(clip.startTime + delta, 0, Math.max(0, state.totalDuration - clip.duration)));
        return {
          ...clip,
          startTime: nextStart,
        };
      });

      return {
        ...state,
        tracks: nextTracks,
      };
    });
  }, [commitSelectionUpdate, selectedClipId]);

  const resizeSelectedClip = useCallback((delta: number) => {
    if (!selectedClipId) {
      return;
    }

    commitSelectionUpdate((state) => {
      const targetClip = findClipInTracks(state.tracks, selectedClipId);
      if (!targetClip) {
        return null;
      }

      const nextTracks = replaceClipAcrossTracks(state.tracks, targetClip.trackId, targetClip.id, (clip) => ({
        ...clip,
        duration: snapSeconds(clamp(clip.duration + delta, MIN_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, state.totalDuration - clip.startTime))),
      }));
      const nextDuration = computeTimelineSpan(nextTracks, Math.max(project.assembly.totalDurationSeconds || 0, MIN_TIMELINE_DURATION));

      return {
        ...state,
        totalDuration: nextDuration,
        playhead: clamp(state.playhead, 0, nextDuration),
        tracks: nextTracks,
      };
    });
  }, [commitSelectionUpdate, project.assembly.totalDurationSeconds, selectedClipId]);

  useEffect(() => {
    if (!selectedClipId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }

      if (event.key === "ArrowLeft" && event.shiftKey) {
        event.preventDefault();
        resizeSelectedClip(-0.25);
        return;
      }

      if (event.key === "ArrowRight" && event.shiftKey) {
        event.preventDefault();
        resizeSelectedClip(0.25);
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeSelectedClip(-0.25);
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeSelectedClip(0.25);
        return;
      }

      if (event.key.toLowerCase() === "d" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        duplicateSelectedClip();
        return;
      }

      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        splitSelectedClip();
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deleteSelectedClip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelectedClip, duplicateSelectedClip, nudgeSelectedClip, resizeSelectedClip, selectedClipId, splitSelectedClip]);

  const tickCount = Math.max(8, Math.ceil(totalDuration));
  const majorTickEvery = totalDuration > 24 ? 4 : totalDuration > 14 ? 2 : 1;
  const timelineCanvasWidth = Math.max(isStudioMode ? 960 : 900, Math.ceil(totalDuration * pixelsPerSecond));

  return (
    <div className={cn(
      "rounded-none border shadow-[0_40px_100px_-65px_rgba(0,0,0,0.95)]",
      isStudioMode
        ? "flex h-full min-h-155 flex-col border-white/10 bg-[#040406]"
        : "border-white/8 bg-black/30",
    )}>
      <div className={cn(
        "border-b border-white/8 px-4 py-3",
        isStudioMode ? "flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-start lg:gap-6 lg:px-5 lg:py-4" : "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
      )}>
        <div className={cn("space-y-1", isStudioMode && "max-w-190")}>
          <div className="flex items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80 font-mono">Assembly Timeline</p>
            {saveStatus !== "idle" && (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-none text-[8px] font-black uppercase tracking-[0.18em] font-mono",
                  saveStatus === "saved" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                  saveStatus === "saving" && "border-amber-500/30 bg-amber-500/10 text-amber-300",
                  saveStatus === "error" && "border-destructive/30 bg-destructive/10 text-destructive",
                )}
              >
                <Save className="mr-1 h-3 w-3" />
                {saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Syncing..." : "Error"}
              </Badge>
            )}
          </div>
          <p className="text-[9px] leading-relaxed text-white/40 font-mono">
            Every layer is aligned with the narration. Reorganize visuals, clips and sound design before final export.
          </p>
        </div>

        <div className={cn("flex gap-2", isStudioMode ? "flex-col items-start" : "flex-wrap items-center")}>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => selectRelativeClip("previous")} className={cn(
              "rounded-none border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
              isStudioMode ? "h-7 px-2 text-[8px] font-black uppercase tracking-[0.16em]" : "h-8 px-3",
            )}>
              <SkipBack className="mr-1.5 h-3.5 w-3.5" /> Prev
            </Button>
            <Button type="button" variant="outline" onClick={() => selectRelativeClip("next")} className={cn(
              "rounded-none border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
              isStudioMode ? "h-7 px-2 text-[8px] font-black uppercase tracking-[0.16em]" : "h-8 px-3",
            )}>
              <SkipForward className="mr-1.5 h-3.5 w-3.5" /> Next
            </Button>
            <Button type="button" variant="outline" onClick={handleUndo} disabled={historyIndex === 0} className={cn(
              "rounded-none border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
              isStudioMode ? "h-7 px-2.5 text-[8px] font-black uppercase tracking-[0.16em]" : "h-8 px-3",
            )}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Undo
            </Button>
            <Button type="button" variant="outline" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={cn(
              "rounded-none border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
              isStudioMode ? "h-7 px-2.5 text-[8px] font-black uppercase tracking-[0.16em]" : "h-8 px-3",
            )}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Redo
            </Button>
            <Button
              type="button"
              onClick={() => setIsPlaying((current) => !current)}
              className={cn(
                "rounded-none bg-primary text-primary-foreground hover:bg-primary/90",
                isStudioMode ? "h-7 px-3.5 text-[8px] font-black uppercase tracking-[0.16em]" : "h-8 px-3",
              )}
            >
              {isPlaying ? <Pause className="mr-1.5 h-3.5 w-3.5" /> : <Play className="mr-1.5 h-3.5 w-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
            <div className={cn(
              "inline-flex items-center gap-1 rounded-none border border-white/10 bg-white/5",
              isStudioMode ? "h-7 px-1" : "h-8 px-2.5",
            )}>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleZoomChange("out")} className="rounded-none text-white/70 hover:bg-white/10 hover:text-white">
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className={cn(
                "text-center font-black uppercase tracking-[0.18em] text-white/70 font-mono",
                isStudioMode ? "min-w-11 text-[8px]" : "min-w-12 text-[9px]",
              )}>
                {Math.round(editorState.zoom * 100)}%
              </span>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => handleZoomChange("in")} className="rounded-none text-white/70 hover:bg-white/10 hover:text-white">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button type="button" variant="outline" onClick={handleFitTimeline} className={cn(
              "rounded-none border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
              isStudioMode ? "h-7 px-2 text-[8px] font-black uppercase tracking-[0.16em]" : "h-8 px-3",
            )}>
              Fit
            </Button>
          </div>

          <div className={cn(
            "inline-flex items-center rounded-none border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-[0.18em] text-white/75 font-mono",
            isStudioMode ? "h-7 px-2.5 text-[8px]" : "h-8 px-3",
          )}>
            {formatClock(editorState.playhead)} / {formatClock(totalDuration)}
          </div>
        </div>
      </div>

      <div className={cn("border-b border-white/8 bg-black/20 px-4 py-2.5", isStudioMode && "px-8 py-4")}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[8px] font-mono uppercase tracking-[0.18em] text-white/45">
          <span>Visuals: <span className="text-white/80">{visualClipCount}</span></span>
          <span>Timeline: <span className="text-white/80">{formatRulerTime(totalDuration)}</span></span>
          <span>Active: <span className="text-white/80">{selectedClip ? selectedClip.label : "None"}</span></span>
          <span>Sync: <span className="text-white/80 leading-none">Narration lead</span></span>
        </div>
      </div>

      <div
        ref={viewportRef}
        className={cn(
          "overflow-x-auto overflow-y-hidden",
          isStudioMode && "min-h-0 flex-1 overflow-y-auto",
        )}
      >
        <div className="relative min-w-fit bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_15%),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)]" style={{ backgroundSize: `${pixelsPerSecond}px 100%` }}>
          <div className="sticky left-0 top-0 z-30 flex border-b border-white/8 bg-[#07080b]/95 backdrop-blur-sm">
            <div className="flex h-11 shrink-0 items-center border-r border-white/8 px-3" style={{ width: trackHeaderWidth }}>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/60 font-mono">Assembly</p>
                <p className="mt-0.5 text-[8px] text-white/20 font-mono">Interactive</p>
              </div>
            </div>
            <div
              className="relative h-11"
              style={{ width: timelineCanvasWidth }}
              onPointerDown={(event) => {
                setPlayheadFromClientX(event.clientX);
                setActiveInteraction({ type: "playhead" });
              }}
            >
              {Array.from({ length: tickCount + 1 }).map((_, index) => {
                const left = index * pixelsPerSecond;
                const isMajor = index % majorTickEvery === 0;
                return (
                  <div key={index} className="absolute inset-y-0" style={{ left }}>
                    <div className={cn("absolute top-0 h-4 w-px", isMajor ? "bg-white/18" : "bg-white/8")} />
                    {isMajor && (
                      <span className="absolute top-5 -translate-x-1/2 text-[8px] font-mono text-white/35">
                        {formatRulerTime(index)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="pointer-events-none absolute z-20"
            style={{ left: trackHeaderWidth + editorState.playhead * pixelsPerSecond, top: HEADER_HEIGHT, bottom: 0 }}
          >
            <div className="relative h-full w-px bg-primary/80 shadow-[0_0_18px_rgba(255,51,0,0.55)]">
              <div className="absolute -top-3 -translate-x-1/2 rounded-none border border-primary/40 bg-primary px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.16em] text-black font-mono">
                {formatRulerTime(editorState.playhead)}
              </div>
            </div>
          </div>

          <div className={cn("space-y-2", isStudioMode ? "p-0" : "p-3")}>
            {sortedTracks.map((track) => {
              const theme = getTrackTheme(track.id, track.kind);
              return (
                <div key={track.id} className="flex min-w-fit">
                  <div
                    className="sticky left-0 z-10 flex shrink-0 items-stretch border border-white/8 bg-[#090a0f]/95 backdrop-blur-sm"
                    style={{ height: laneHeight, width: trackHeaderWidth }}
                  >
                    <div className={cn("w-1", theme.marker)} />
                    <div className="flex flex-1 flex-col justify-center px-3">
                      <p className={cn(
                        "font-black uppercase tracking-[0.18em] font-mono",
                        theme.headerText,
                        isStudioMode ? "max-w-16.5 text-[8px] leading-[1.1]" : "text-[9px]",
                      )}>
                        {renderTrackTitle(track.id, track.kind, isStudioMode)}
                      </p>
                      <p className={cn(
                        "mt-0.5 uppercase tracking-[0.16em] text-white/25 font-mono",
                        isStudioMode ? "text-[7px]" : "text-[7px]",
                      )}>
                        {track.items.length} item{track.items.length > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div
                    ref={(node) => {
                      trackRefs.current[track.id] = node;
                    }}
                    className={cn("relative border border-l-0 border-white/8 bg-white/2")}
                    style={{ width: timelineCanvasWidth, height: laneHeight }}
                    onPointerDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }

                      setPlayheadFromClientX(event.clientX);
                      setActiveInteraction({ type: "playhead" });
                    }}
                  >
                    {track.items.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-[0.18em] text-white/18 font-black font-mono">
                        Drop-ready lane
                      </div>
                    )}

                    {track.items.map((clip) => {
                      const left = clip.startTime * pixelsPerSecond;
                      const width = Math.max(isStudioMode ? 48 : 82, clip.duration * pixelsPerSecond);
                      const clipTheme = getTrackTheme(clip.trackId, clip.kind);
                      const isSelected = clip.id === selectedClipId;

                      return (
                        <div
                          key={clip.id}
                          className={cn(
                            "absolute overflow-hidden rounded-none border backdrop-blur-sm transition-shadow cursor-grab active:cursor-grabbing",
                            clipTheme.clip,
                            isSelected && "ring-2 ring-white/35",
                          )}
                          style={{ left, width, top: clipInset, bottom: clipInset }}
                          onPointerDown={(event) => {
                            event.stopPropagation();
                            setSelectedClipId(clip.id);
                            const pointerSeconds = clientXToSeconds(event.clientX);
                            setActiveInteraction({
                              type: "move",
                              clipId: clip.id,
                              trackId: clip.trackId,
                              kind: clip.kind,
                              pointerOffsetSeconds: pointerSeconds - clip.startTime,
                            });
                          }}
                        >
                          <div className={cn("absolute inset-0", clipTheme.clipInner)} />
                          {(clip.kind === "caption" || clip.kind === "narration" || clip.kind === "music") && buildWaveformPattern(clipTheme.line)}
                          <div className="relative flex h-full items-stretch">
                            {clip.previewImageId && (
                              <div className="relative hidden w-10 shrink-0 border-r border-white/10 md:block">
                                <Image
                                  src={getImageVariantUrl(clip.previewImageId)}
                                  alt=""
                                  fill
                                  className="object-cover opacity-90"
                                  sizes="40px"
                                  unoptimized
                                />
                                <div className="absolute inset-0 bg-linear-to-r from-black/20 to-transparent" />
                              </div>
                            )}

                            <div className={cn(
                              "flex min-w-0 flex-1 items-center",
                              isStudioMode ? "gap-1 px-1.5" : "gap-2 px-2.5",
                            )}>
                              <div className={cn(
                                "shrink-0 items-center justify-center rounded-none border border-white/12 bg-black/15 text-white/65",
                                isStudioMode ? "flex h-3.5 w-3.5" : "flex h-6 w-6",
                              )}>
                                <GripVertical className={cn(isStudioMode ? "h-2 w-2" : "h-3.5 w-3.5")} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={cn(
                                  "truncate font-black uppercase tracking-[0.14em] text-white font-mono",
                                  isStudioMode ? "text-[6px]" : "text-[9px]",
                                )}>
                                  {clip.label}
                                </p>
                                <div className={cn(
                                  "mt-0.5 flex items-center gap-1.5 uppercase tracking-[0.16em] text-white/50 font-mono",
                                  isStudioMode ? "text-[4px]" : "text-[7px]",
                                )}>
                                  <span>{formatRulerTime(clip.startTime)}</span>
                                  <span>·</span>
                                  <span>{roundDuration(clip.duration)}s</span>
                                  {clip.sceneId ? (
                                    <>
                                      <span>·</span>
                                      <span>Scene {clip.sceneId}</span>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={cn("relative h-full shrink-0 border-l border-white/10", clipTheme.handle, isStudioMode ? "w-1.5" : "w-3")}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                setSelectedClipId(clip.id);
                                setActiveInteraction({
                                  type: "resize",
                                  clipId: clip.id,
                                  trackId: clip.trackId,
                                });
                              }}
                              aria-label={`Resize ${clip.label}`}
                            >
                              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
                              <MoveHorizontal className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 text-white/60" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={cn(
        "flex flex-col gap-2 border-t border-white/8 bg-black/20 px-4 py-3 lg:flex-row lg:items-center lg:justify-between",
        isStudioMode && "px-5 py-3 lg:flex-wrap lg:justify-start lg:gap-4",
      )}>
        <div className={cn("flex flex-wrap gap-2", isStudioMode && "max-w-full")}>
          <Badge variant="outline" className={cn(
            "rounded-none border-white/10 bg-white/5 font-black uppercase tracking-[0.16em] text-white/55 font-mono",
            isStudioMode ? "px-1.5 py-0.5 text-[6px]" : "text-[8px]",
          )}>
            <Sparkles className="mr-1 h-3 w-3" /> Auto-saves clip layout
          </Badge>
          <Badge variant="outline" className={cn(
            "rounded-none border-white/10 bg-white/5 font-black uppercase tracking-[0.16em] text-white/55 font-mono",
            isStudioMode ? "px-1.5 py-0.5 text-[6px]" : "text-[8px]",
          )}>
            Visual clips can switch lanes
          </Badge>
          <Badge variant="outline" className={cn(
            "rounded-none border-white/10 bg-white/5 font-black uppercase tracking-[0.16em] text-white/55 font-mono",
            isStudioMode ? "px-1.5 py-0.5 text-[6px]" : "text-[8px]",
          )}>
            Captions, narration and music are resizable
          </Badge>
        </div>
        <div className={cn(
          "flex flex-wrap items-center gap-2",
          isStudioMode && "justify-start",
        )}>
          <Button
            type="button"
            variant="outline"
            onClick={resyncSupportTracks}
            className={cn(
              "rounded-none border-primary/20 bg-primary/10 font-black uppercase tracking-[0.16em] text-primary hover:bg-primary/15",
              isStudioMode ? "h-6 px-2 text-[7px]" : "h-8 px-3 text-[9px]",
            )}
          >
            <Sparkles className="mr-1.5 h-3 w-3" /> Resync Layers
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={duplicateSelectedClip}
            disabled={!selectedClip}
            className={cn(
              "rounded-none border-white/10 bg-white/5 font-black uppercase tracking-[0.16em] text-white/75 hover:bg-white/10",
              isStudioMode ? "h-6 px-2 text-[7px]" : "h-8 px-3 text-[9px]",
            )}
          >
            <Copy className="mr-1.5 h-3 w-3" /> Duplicate
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={splitSelectedClip}
            disabled={!selectedClip}
            className={cn(
              "rounded-none border-white/10 bg-white/5 font-black uppercase tracking-[0.16em] text-white/75 hover:bg-white/10",
              isStudioMode ? "h-6 px-2 text-[7px]" : "h-8 px-3 text-[9px]",
            )}
          >
            <Scissors className="mr-1.5 h-3 w-3" /> Split
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={deleteSelectedClip}
            disabled={!selectedClip}
            className={cn(
              "rounded-none border-destructive/20 bg-destructive/10 font-black uppercase tracking-[0.16em] text-destructive hover:bg-destructive/15",
              isStudioMode ? "h-6 px-2 text-[7px]" : "h-8 px-3 text-[9px]",
            )}
          >
            <Trash2 className="mr-1.5 h-3 w-3" /> Delete
          </Button>
          {selectedClip && (
            <div className="text-[9px] leading-relaxed text-white/45 font-mono">
              Selected: <span className="text-white/75">{selectedClip.label}</span> · Start {formatRulerTime(selectedClip.startTime)} · Duration {roundDuration(selectedClip.duration)}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

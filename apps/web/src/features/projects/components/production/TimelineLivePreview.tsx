"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getImageVariantUrl, type ProjectRecord, type ProjectAssemblyEditorClip } from "@/lib/projects-api";
import type { TimelinePreviewSnapshot } from "@/features/projects/components/production/AssemblyTimelineEditor";

function formatClock(seconds: number) {
  const safe = Math.max(0, Math.round(seconds * 1000));
  const totalSeconds = Math.floor(safe / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const millis = Math.floor((safe % 1000) / 10);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(millis).padStart(2, "0")}`;
}

function getPrimaryClip(activeClips: ProjectAssemblyEditorClip[], kind: ProjectAssemblyEditorClip["kind"]) {
  return activeClips.find((clip) => clip.kind === kind) || null;
}

function getNarrationReferenceSceneId(activeClips: ProjectAssemblyEditorClip[], selectedClip: ProjectAssemblyEditorClip | null) {
  return getPrimaryClip(activeClips, "narration")?.sceneId
    || selectedClip?.sceneId
    || getPrimaryClip(activeClips, "visual")?.sceneId
    || null;
}

function getLayerState(clip: ProjectAssemblyEditorClip | null, narrationSceneId: number | null) {
  if (!clip) {
    return {
      label: "Inactive",
      tone: "border-white/10 bg-white/5 text-white/45",
      detail: "No active layer at the current playhead.",
    };
  }

  if (clip.sceneId && narrationSceneId && clip.sceneId === narrationSceneId) {
    return {
      label: "Synced",
      tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      detail: "Aligned with the active narration beat.",
    };
  }

  if (clip.kind === "music") {
    return {
      label: "Supporting",
      tone: "border-orange-500/30 bg-orange-500/10 text-orange-200",
      detail: "Bed spans the sequence under the narration.",
    };
  }

  return {
    label: "Review",
    tone: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    detail: "Check this layer against the active narration timing.",
  };
}

function PreviewLayerCard({
  title,
  clip,
  narrationSceneId,
}: {
  title: string;
  clip: ProjectAssemblyEditorClip | null;
  narrationSceneId: number | null;
}) {
  const state = getLayerState(clip, narrationSceneId);

  return (
    <div className="rounded-none border border-white/8 bg-black/20 p-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/75 font-mono">{title}</p>
        <Badge variant="outline" className={cn("rounded-none px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.14em] font-mono", state.tone)}>
          {state.label}
        </Badge>
      </div>
      <p className="mt-1.5 text-[8px] text-white/70 font-mono">
        {clip?.label || "No active element"}
      </p>
      <p className="mt-1 text-[7px] leading-relaxed text-white/40 font-mono">
        {clip?.previewText || state.detail}
      </p>
    </div>
  );
}

export function TimelineLivePreview({
  project,
  snapshot,
}: {
  project: ProjectRecord;
  snapshot: TimelinePreviewSnapshot | null;
}) {
  const activeClips = snapshot?.activeClips || [];
  const selectedClip = snapshot?.selectedClip || null;
  const activeVisual = getPrimaryClip(activeClips, "visual");
  const activeNarration = getPrimaryClip(activeClips, "narration");
  const activeCaption = getPrimaryClip(activeClips, "caption");
  const activeMusic = getPrimaryClip(activeClips, "music");
  const activeSfx = getPrimaryClip(activeClips, "sfx");
  const narrationSceneId = getNarrationReferenceSceneId(activeClips, selectedClip);
  const previewImageId = activeVisual?.previewImageId
    || selectedClip?.previewImageId
    || project.scenes.find((scene) => scene.sceneId === narrationSceneId)?.approvedImageId
    || null;
  const currentScene = narrationSceneId
    ? project.scenes.find((scene) => scene.sceneId === narrationSceneId) || null
    : null;

  return (
    <div className="flex h-full min-h-[420px] flex-col rounded-none border border-white/8 bg-black/30 shadow-[0_40px_100px_-65px_rgba(0,0,0,0.95)]">
      <div className="border-b border-white/8 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80 font-mono">Live Preview</p>
            <p className="mt-1 text-[9px] leading-relaxed text-white/40 font-mono">
              Every layer is evaluated against the narration so you can spot what needs changes before export.
            </p>
          </div>
          <Badge variant="outline" className="rounded-none border-primary/20 bg-primary/10 text-[8px] font-black uppercase tracking-[0.16em] text-primary font-mono">
            {snapshot ? `${formatClock(snapshot.playhead)} / ${formatClock(snapshot.totalDuration)}` : "Waiting"}
          </Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="relative aspect-video overflow-hidden rounded-none border border-white/8 bg-black">
          {previewImageId ? (
            <Image
              src={getImageVariantUrl(previewImageId)}
              alt=""
              fill
              sizes="(min-width: 1280px) 40vw, 100vw"
              className="object-cover opacity-90"
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.18em] text-white/25 font-black font-mono">
              No visual preview available
            </div>
          )}

          <div className="absolute inset-0 bg-linear-to-t from-black via-black/25 to-transparent" />

          <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
            <Badge variant="outline" className="rounded-none border-white/10 bg-black/50 text-[8px] font-black uppercase tracking-[0.16em] text-white/75 font-mono">
              {currentScene ? `Scene ${String(currentScene.sceneId).padStart(2, "0")}` : "No active scene"}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "rounded-none text-[8px] font-black uppercase tracking-[0.16em] font-mono",
                activeVisual && activeNarration && activeVisual.sceneId === activeNarration.sceneId
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300",
              )}
            >
              {activeVisual && activeNarration && activeVisual.sceneId === activeNarration.sceneId ? "Visual synced to narration" : "Review sync"}
            </Badge>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
            <div className="rounded-none border border-violet-400/20 bg-black/40 p-3 backdrop-blur-sm">
              <p className="text-[8px] font-black uppercase tracking-[0.16em] text-violet-200 font-mono">Narration reference</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-white/90 font-mono">
                {activeNarration?.previewText || currentScene?.narration || "Move the playhead or select a clip to preview the active narration beat."}
              </p>
            </div>

            {activeCaption?.previewText ? (
              <div className="inline-flex max-w-full rounded-none border border-amber-400/20 bg-black/55 px-3 py-2 backdrop-blur-sm">
                <p className="text-[10px] leading-relaxed text-amber-100 font-mono">
                  {activeCaption.previewText}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          <PreviewLayerCard title="Visual Layer" clip={activeVisual} narrationSceneId={narrationSceneId} />
          <PreviewLayerCard title="Narration Layer" clip={activeNarration} narrationSceneId={narrationSceneId} />
          <PreviewLayerCard title="Captions Layer" clip={activeCaption} narrationSceneId={narrationSceneId} />
          <PreviewLayerCard title="SFX Layer" clip={activeSfx} narrationSceneId={narrationSceneId} />
        </div>

        <div className="rounded-none border border-white/8 bg-black/20 p-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/75 font-mono">Soundtrack Layer</p>
            <Badge variant="outline" className="rounded-none border-orange-500/30 bg-orange-500/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[0.14em] text-orange-200 font-mono">
              {activeMusic ? "Supporting bed" : "Idle"}
            </Badge>
          </div>
          <p className="mt-1.5 text-[8px] text-white/70 font-mono">
            {activeMusic?.label || project.audio?.music?.trackName || project.audio?.music?.mood || "No active soundtrack layer"}
          </p>
          <p className="mt-1 text-[7px] leading-relaxed text-white/40 font-mono">
            {project.audio?.music?.generationBrief || activeMusic?.previewText || "The soundtrack should support the narration arc and project tone."}
          </p>
        </div>
      </div>
    </div>
  );
}

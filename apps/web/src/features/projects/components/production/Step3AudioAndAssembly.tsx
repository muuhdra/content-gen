import Link from "next/link";
import React, { useId, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Download,
  FileText,
  Layers,
  Mic,
  Music,
  Settings2,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getProjectMusicDownloadUrl,
  getProjectNarrationDownloadUrl,
  getProjectSfxDownloadUrl,
  getProjectUploadedMusicTrackDownloadUrl,
  type ProjectRecord,
  type ProjectScene,
} from "@/lib/projects-api";

interface Step3AudioAndAssemblyProps {
  project: ProjectRecord | null;
  scenes: ProjectScene[];
  onExport: () => void;
  isExporting: boolean;
  onGenerateVoice: () => void;
  onGenerateMusic: () => void;
  onToggleMusic: (enabled: boolean) => void;
  onToggleSfx: (enabled: boolean) => void;
  isLoadingAudio: boolean;
  onGenerateCaptions: () => void;
  isLoadingCaptions: boolean;
  onUploadNarrationSource: (file: File) => void;
  isUploadingNarrationSource: boolean;
  onOpenAudioLab: () => void;
  onOpenCaptionsLab: () => void;
  isSlideshowProject: boolean;
  // True when approved images alone are enough (slideshow OR "static" clip mode):
  // motion clips are not required to reach a render-ready assembly.
  motionOptional: boolean;
  // Per-scene aware (handles hybrid): every scene needing a clip has one.
  motionSatisfied: boolean;
  isRenderQueued: boolean;
  timelineStudioHref?: string;
}

interface ReadinessItem {
  label: string;
  ready: boolean;
  detail: string;
}

function SummaryMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <div className="rounded-none border border-white/8 bg-white/[0.03] px-2.5 py-2">
      <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/50 font-mono">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[9px] font-black uppercase tracking-[0.1em] font-display md:text-[10px]",
          tone === "success" && "text-emerald-300",
          tone === "warning" && "text-amber-300",
          tone === "neutral" && "text-white",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ReadinessRow({ item }: { item: ReadinessItem }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-none border border-white/6 bg-black/20 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/80 font-mono">{item.label}</p>
        <p className="mt-0.5 text-[9px] leading-relaxed text-white/40 font-mono">{item.detail}</p>
      </div>
      <Badge
        variant="outline"
        className={cn(
          "shrink-0 rounded-none text-[8px] font-black uppercase tracking-[0.18em] font-mono",
          item.ready
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-amber-500/30 bg-amber-500/10 text-amber-300",
        )}
      >
        {item.ready ? "Ready" : "Pending"}
      </Badge>
    </div>
  );
}

export function Step3AudioAndAssembly({
  project,
  scenes,
  onExport,
  isExporting,
  onGenerateVoice,
  onGenerateMusic,
  onToggleMusic,
  onToggleSfx,
  isLoadingAudio,
  onGenerateCaptions,
  isLoadingCaptions,
  onUploadNarrationSource,
  isUploadingNarrationSource,
  onOpenAudioLab,
  onOpenCaptionsLab,
  isSlideshowProject,
  motionOptional,
  motionSatisfied,
  isRenderQueued,
  timelineStudioHref,
}: Step3AudioAndAssemblyProps) {
  const narrationSourceInputId = useId();
  const [isFinalGateExpanded, setIsFinalGateExpanded] = useState(true);

  if (!project) return null;

  const actualDuration = scenes.reduce((acc, scene) => acc + (scene.duration || 5), 0);
  const narrationRequiresUpload = project.audio?.narration?.voiceId === "custom-audio-upload";
  const uploadedNarrationSource = project.audio?.narration?.uploadedSource;
  const generatedNarrationSource = project.audio?.narration?.generatedSource;
  const generatedSoundtrackSource = project.audio?.music?.generatedSource;
  const generatedSfxSource = project.audio?.sfx?.generatedSource;
  const musicMode = project.audio?.music?.mode || "auto";
  const uploadedNarrationReady = Boolean(uploadedNarrationSource?.storagePath);
  const uploadedTracks = Array.isArray(project.audio?.music?.uploadedTracks)
    ? project.audio.music.uploadedTracks
    : [];
  const downloadableUploadedTracks = uploadedTracks.filter((track) => Boolean(track?.storagePath));
  const uploadedTrackCount = downloadableUploadedTracks.length;
  const musicGenerationDisabled = musicMode === "uploaded" || musicMode === "none";
  const narrationUploadPending = narrationRequiresUpload && !uploadedNarrationReady;
  const musicUploadPending = musicMode === "uploaded" && uploadedTrackCount === 0;
  const narrationDownloadReady = narrationRequiresUpload
    ? uploadedNarrationReady
    : Boolean(generatedNarrationSource?.storagePath || project.audio?.narration?.status === "generated");
  const soundtrackDownloadReady = musicMode !== "uploaded"
    && musicMode !== "none"
    && Boolean(generatedSoundtrackSource?.storagePath || project.audio?.music?.status === "generated");
  const sfxDownloadReady = project.audio?.sfx?.enabled !== false
    && Boolean(generatedSfxSource?.storagePath || project.audio?.sfx?.status === "generated");
  const hasScenes = scenes.length > 0;
  const approvedImages = scenes.filter((scene) => Boolean(scene.approvedImageId)).length;
  const approvedVideos = scenes.filter((scene) => Boolean(scene.approvedVideoId)).length;
  const hasApprovedImages = hasScenes && approvedImages === scenes.length;
  const hasApprovedVideos = motionSatisfied;
  const captionsDisabled = project.captions?.status === "disabled";
  const captionsReady = captionsDisabled
    || (Boolean(project.captions?.generatedAt) && Array.isArray(project.captions?.cues) && project.captions.cues.length > 0);
  const narrationReady = narrationRequiresUpload
    ? uploadedNarrationReady
    : project.audio?.narration?.status === "generated";
  const musicReady = musicMode === "none"
    ? true
    : musicMode === "uploaded"
      ? uploadedTrackCount > 0
      : project.audio?.music?.status === "generated";
  const sfxReady = project.audio?.sfx?.enabled === false || project.audio?.sfx?.status === "generated";
  const exportReady = hasScenes && hasApprovedImages && hasApprovedVideos && captionsReady && narrationReady && musicReady && sfxReady;

  const readinessItems: ReadinessItem[] = [
    {
      label: "Scene Coverage",
      ready: hasScenes,
      detail: hasScenes
        ? `${scenes.length} scene${scenes.length > 1 ? "s" : ""} available in the assembly timeline.`
        : "Generate a script and a scene breakdown before final assembly.",
    },
    {
      label: "Visual Validation",
      ready: hasApprovedImages && hasApprovedVideos,
      detail: motionOptional
        ? `${approvedImages}/${scenes.length} visuals selected${isSlideshowProject ? " for slideshow assembly" : " (static clips — no motion required)"}.`
        : `${approvedImages}/${scenes.length} visuals and ${approvedVideos}/${scenes.length} animations selected.`,
    },
    {
      label: "Narration + Music",
      ready: narrationReady && musicReady && sfxReady,
      detail: narrationRequiresUpload
        ? uploadedNarrationReady
          ? `Narration source uploaded. ${musicReady ? "Music is configured." : "Music still needs to be rendered."}`
          : "Upload the custom narration source, then render music and SFX if needed."
        : `${narrationReady ? "Narration ready." : "Narration still needs generation."} ${musicReady ? "Music ready." : "Music still needs generation."}`,
    },
    {
      label: "Captions + Export",
      ready: captionsReady && exportReady,
      detail: captionsDisabled
        ? "Captions are disabled for this project, so export can proceed without a captions layer."
        : captionsReady
        ? "Captions are present. Export will unlock as soon as the remaining steps are validated."
        : "Captions are still missing, so final export stays blocked.",
    },
  ];

  const exportBlockers = readinessItems.filter((item) => !item.ready);
  const pageTitle = hasScenes ? "Assembly Room" : "Studio Prep Mode";
  const pageDescription = hasScenes
    ? "Review audio tracks and verify your checklist before launching the final production export."
    : "Prepare narration and soundtrack settings while the visual pipeline is being processed.";

  return (
    <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(92,45,145,0.18),transparent_40%),linear-gradient(180deg,#040406_0%,#07070a_45%,#050506_100%)] text-white">
      <div className="mx-auto max-w-6xl space-y-5 px-6 py-5 md:px-8">
          <div className="rounded-none border border-white/8 bg-black/30 px-3 py-2.5 shadow-[0_30px_80px_-50px_rgba(0,0,0,0.8)]">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-[32rem] space-y-1">
                <Badge variant="outline" className="rounded-none border-primary/30 bg-primary/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-[0.2em] text-primary font-mono">
                  Step 3 · Audio & Assembly
                </Badge>
                <div className="space-y-0.5">
                  <h2 className="text-[15px] font-black uppercase tracking-[0.16em] text-white font-display md:text-base">{pageTitle}</h2>
                  <p className="max-w-[31rem] text-[8px] leading-relaxed text-white/55 font-mono md:text-[9px]">{pageDescription}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:w-[300px]">
                <SummaryMetric
                  label="Scenes"
                  value={hasScenes ? `${scenes.length} ready` : "Awaiting scenes"}
                  tone={hasScenes ? "success" : "warning"}
                />
                <SummaryMetric
                  label="Visuals"
                  value={hasApprovedImages && hasApprovedVideos ? "Validated" : motionOptional ? `${approvedImages}/${scenes.length} visuals` : `${approvedImages}/${scenes.length} frames · ${approvedVideos}/${scenes.length} clips`}
                  tone={hasApprovedImages && hasApprovedVideos ? "success" : "warning"}
                />
                <SummaryMetric
                  label="Audio"
                  value={narrationReady && musicReady && sfxReady ? "Configured" : "In progress"}
                  tone={narrationReady && musicReady && sfxReady ? "success" : "warning"}
                />
                <SummaryMetric
                  label="Export"
                  value={isRenderQueued ? "Queued" : exportReady ? "Unlocked" : `${exportBlockers.length} blocker${exportBlockers.length > 1 ? "s" : ""}`}
                  tone={isRenderQueued || exportReady ? "success" : "warning"}
                />
              </div>
            </div>
          </div>

          <div className="rounded-none border border-white/8 bg-black/25 p-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 pb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80 font-mono">Assembly Checklist</p>
                <p className="mt-0.5 text-[9px] text-white/40 font-mono">Everything that still needs to be ready before export.</p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-none text-[8px] font-black uppercase tracking-[0.18em] font-mono",
                  exportReady
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-300",
                )}
              >
                {exportReady ? "All systems ready" : "Export not ready"}
              </Badge>
            </div>
            <div className="mt-3 space-y-2.5">
              {readinessItems.map((item) => (
                <ReadinessRow key={item.label} item={item} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-3">
            <div className="rounded-none border border-white/8 bg-black/25 overflow-hidden flex flex-col hover:border-primary/30 transition-all duration-300">
              <div className="border-b border-white/8 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-none border border-primary/20 bg-primary/10 text-primary">
                      <Mic className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.18em] text-primary font-mono">Voiceover</h3>
                      <p className="mt-0.5 text-[8px] text-white/35 font-mono">Narration and source selection.</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-none text-[8px] font-black uppercase tracking-[0.16em] font-mono",
                      narrationReady
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : narrationUploadPending
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : "border-primary/30 bg-primary/10 text-primary",
                    )}
                  >
                    {narrationReady ? "Ready" : narrationUploadPending ? "Upload needed" : "Configurable"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2.5 p-3">
                <div className="rounded-none border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35 font-mono">Configured source</p>
                  <p className="mt-1.5 truncate text-[9px] text-white/70 font-mono">
                    {narrationRequiresUpload
                      ? uploadedNarrationReady
                        ? uploadedNarrationSource?.name || "Uploaded narration source"
                        : "Awaiting custom narration source"
                      : project.audio?.narration?.voiceId || project.settings?.voiceId || "Default Voice"}
                  </p>
                </div>
                {narrationRequiresUpload && uploadedNarrationSource?.sizeLabel ? (
                  <p className="text-[8px] text-white/35 font-mono">{uploadedNarrationSource.sizeLabel}</p>
                ) : null}
                {!narrationRequiresUpload && generatedNarrationSource?.sizeLabel ? (
                  <p className="text-[8px] text-white/35 font-mono">{generatedNarrationSource.sizeLabel}</p>
                ) : null}
                {!narrationRequiresUpload && narrationDownloadReady ? (
                  <p className="text-[8px] text-white/35 font-mono">Voice stem stays separate from soundtrack and SFX.</p>
                ) : null}
                {project.audio?.narration?.status === 'generating' && (
                  <p className="text-[8px] text-primary animate-pulse font-mono">Generating voice track...</p>
                )}
              </div>

              <div className="border-t border-white/8 bg-black/20 p-3 space-y-2">
                {narrationRequiresUpload ? (
                  <>
                    <input
                      id={narrationSourceInputId}
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aiff"
                      className="hidden"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0];

                        if (nextFile) {
                          onUploadNarrationSource(nextFile);
                        }

                        event.currentTarget.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => window.document.getElementById(narrationSourceInputId)?.click()}
                      disabled={isUploadingNarrationSource}
                      className="h-9 w-full rounded-none bg-white/10 text-[9px] font-black uppercase tracking-[0.16em] text-white hover:bg-sky-400/20 hover:text-sky-300"
                    >
                      {isUploadingNarrationSource ? <Sparkles className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                      {uploadedNarrationSource ? "Replace Narration Source" : "Upload Narration Source"}
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={onGenerateVoice}
                    disabled={isLoadingAudio}
                    className="h-9 w-full rounded-none bg-white/10 text-[9px] font-black uppercase tracking-[0.16em] text-white hover:bg-primary/20 hover:text-primary"
                  >
                    {isLoadingAudio ? <Sparkles className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                    Generate Voice
                  </Button>
                )}
                {narrationDownloadReady ? (
                  <a
                    href={getProjectNarrationDownloadUrl(project.id, true)}
                    download
                    className="inline-flex h-9 w-full items-center justify-center rounded-none border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-[0.16em] text-white/80 transition-all hover:bg-white/10"
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download Voice Track
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-none border border-white/8 bg-black/25 overflow-hidden flex flex-col hover:border-emerald-500/30 transition-all duration-300">
              <div className="border-b border-white/8 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-none border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                      <Music className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h3 className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300 font-mono">Soundtrack</h3>
                      <p className="mt-0.5 text-[8px] text-white/35 font-mono">Music and sound design configuration.</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "rounded-none text-[8px] font-black uppercase tracking-[0.16em] font-mono",
                      musicReady
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : musicUploadPending
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                          : musicMode === "none"
                            ? "border-white/15 bg-white/5 text-white/35"
                            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
                    )}
                  >
                    {musicReady ? "Ready" : musicUploadPending ? "Upload needed" : musicMode === "none" ? "Disabled" : "Configurable"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2.5 p-3">
                {/* On/off switches — choose whether music / SFX are part of this render. */}
                <div className="space-y-1.5 rounded-none border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/55 font-mono">Musique dans la vidéo</span>
                    <div className="flex items-center gap-1 rounded-none border border-white/10 bg-black/30 p-0.5">
                      <button
                        type="button"
                        disabled={musicMode === "uploaded"}
                        onClick={() => onToggleMusic(true)}
                        className={cn("rounded-none px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] font-mono transition-all disabled:opacity-40",
                          musicMode !== "none" ? "bg-emerald-500/20 text-emerald-300" : "text-white/40 hover:text-white")}
                      >On</button>
                      <button
                        type="button"
                        onClick={() => onToggleMusic(false)}
                        className={cn("rounded-none px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] font-mono transition-all",
                          musicMode === "none" ? "bg-white/15 text-white" : "text-white/40 hover:text-white")}
                      >Off</button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/55 font-mono">SFX (effets sonores)</span>
                    <div className="flex items-center gap-1 rounded-none border border-white/10 bg-black/30 p-0.5">
                      <button
                        type="button"
                        onClick={() => onToggleSfx(true)}
                        className={cn("rounded-none px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] font-mono transition-all",
                          project.audio?.sfx?.enabled !== false ? "bg-emerald-500/20 text-emerald-300" : "text-white/40 hover:text-white")}
                      >On</button>
                      <button
                        type="button"
                        onClick={() => onToggleSfx(false)}
                        className={cn("rounded-none px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] font-mono transition-all",
                          project.audio?.sfx?.enabled === false ? "bg-white/15 text-white" : "text-white/40 hover:text-white")}
                      >Off</button>
                    </div>
                  </div>
                  <p className="text-[7.5px] leading-relaxed text-white/30 font-mono">
                    {musicMode === "uploaded" ? "Mode musique sur pistes uploadées — gère-le dans l'Audio Lab." : "Off = non généré et exclu du rendu (budget réduit)."}
                  </p>
                </div>
                <div className="rounded-none border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35 font-mono">Current mode</p>
                  <p className="mt-1.5 truncate text-[9px] text-white/70 font-mono">
                    {musicMode === "uploaded"
                      ? uploadedTrackCount > 0
                        ? `${uploadedTrackCount} uploaded track${uploadedTrackCount > 1 ? "s" : ""}`
                        : "Awaiting uploaded tracks"
                      : musicMode === "none"
                        ? "Music disabled"
                        : project.audio?.music?.mood || "Cinematic"}
                  </p>
                </div>
                {generatedSoundtrackSource?.sizeLabel ? (
                  <p className="text-[8px] text-white/35 font-mono">{generatedSoundtrackSource.sizeLabel}</p>
                ) : null}
                {project.audio?.music?.generationBrief ? (
                  <div className="rounded-none border border-white/8 bg-white/[0.03] px-3 py-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35 font-mono">Direction brief</p>
                    <p className="mt-1.5 text-[8px] leading-relaxed text-white/55 font-mono">
                      {project.audio.music.generationBrief}
                    </p>
                  </div>
                ) : null}
                {project.audio?.sfx?.designBrief ? (
                  <div className="rounded-none border border-white/8 bg-white/[0.03] px-3 py-2">
                    <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35 font-mono">SFX direction</p>
                    <p className="mt-1.5 text-[8px] leading-relaxed text-white/55 font-mono">
                      {project.audio.sfx.designBrief}
                    </p>
                  </div>
                ) : null}
                {generatedSfxSource?.sizeLabel ? (
                  <p className="text-[8px] text-white/35 font-mono">SFX stem · {generatedSfxSource.sizeLabel}</p>
                ) : null}
                {musicMode === "uploaded" && uploadedTrackCount > 0 ? (
                  <div className="space-y-2">
                    {downloadableUploadedTracks.map((track) => (
                      <div key={track.id} className="flex items-center justify-between gap-2 rounded-none border border-white/8 bg-white/[0.03] px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[9px] text-white/70 font-mono">{track.name}</p>
                          <p className="text-[8px] uppercase tracking-[0.16em] text-white/25 font-mono">{track.sizeLabel}</p>
                        </div>
                        {track.storagePath ? (
                          <a
                            href={getProjectUploadedMusicTrackDownloadUrl(project.id, track.id, true)}
                            download
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-none border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {project.audio?.music?.status === 'generating' && (
                  <p className="text-[8px] text-emerald-300 animate-pulse font-mono">Generating soundtrack...</p>
                )}
              </div>

              <div className="border-t border-white/8 bg-black/20 p-3 space-y-2">
                <Button
                  onClick={onGenerateMusic}
                  disabled={isLoadingAudio || musicGenerationDisabled}
                  className="h-9 w-full rounded-none bg-white/10 text-[9px] font-black uppercase tracking-[0.16em] text-white hover:bg-emerald-500/20 hover:text-emerald-300"
                >
                  {isLoadingAudio ? <Sparkles className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                  {musicMode === "uploaded"
                    ? "Using Uploaded Tracks"
                    : musicMode === "none"
                      ? "Music Disabled"
                      : project.audio?.sfx?.enabled === false
                        ? "Generate Soundtrack"
                        : "Generate Soundtrack + SFX Stems"}
                </Button>
                {(musicMode === "uploaded" && uploadedTrackCount === 0) || musicMode === "none" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenAudioLab}
                    className="h-9 w-full rounded-none border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-[0.16em] text-white/80 hover:bg-white/10"
                  >
                    <Settings2 className="mr-2 h-3.5 w-3.5" /> Open Audio Lab
                  </Button>
                ) : null}
                {soundtrackDownloadReady ? (
                  <a
                    href={getProjectMusicDownloadUrl(project.id, true)}
                    download
                    className="inline-flex h-9 w-full items-center justify-center rounded-none border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-[0.16em] text-white/80 transition-all hover:bg-white/10"
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download Soundtrack
                  </a>
                ) : null}
                {sfxDownloadReady ? (
                  <a
                    href={getProjectSfxDownloadUrl(project.id, true)}
                    download
                    className="inline-flex h-9 w-full items-center justify-center rounded-none border border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-[0.16em] text-white/80 transition-all hover:bg-white/10"
                  >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Download SFX Stem
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-none border border-primary/20 bg-gradient-to-b from-primary/12 to-transparent overflow-hidden flex flex-col">
              <div className="border-b border-primary/15 bg-primary/8 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-none border border-primary/20 bg-primary/10 text-primary">
                    <Layers className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-[9px] font-black uppercase tracking-[0.18em] text-primary font-mono">Assembly</h3>
                    <p className="mt-0.5 text-[8px] text-white/40 font-mono">Final timeline and export handoff.</p>
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-none border border-white/8 bg-black/20 px-3 py-2.5">
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35 font-mono">Captions</p>
                    <p className={cn("mt-1.5 text-[9px] font-black uppercase tracking-[0.16em] font-mono", captionsReady ? "text-emerald-300" : "text-amber-300")}>
                      {captionsDisabled ? "Disabled" : captionsReady ? "Ready" : "Missing"}
                    </p>
                  </div>
                  <div className="rounded-none border border-white/8 bg-black/20 px-3 py-2.5">
                    <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35 font-mono">Timeline</p>
                    <p className={cn("mt-1.5 text-[9px] font-black uppercase tracking-[0.16em] font-mono", hasScenes ? "text-emerald-300" : "text-amber-300")}>
                      {hasScenes ? `${actualDuration.toFixed(1)}s ready` : "Empty"}
                    </p>
                  </div>
                </div>

                <div className="rounded-none border border-white/8 bg-black/20 p-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-white/35 font-mono">Assembly preview</p>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-white/50 font-mono">
                    {hasScenes
                      ? "Images, motion, narration, music and captions will be aligned into the final render timeline."
                      : "Once your scenes exist, they will appear here and feed the export pipeline automatically."}
                  </p>
                </div>

                <div className="rounded-none border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center gap-2 text-white/70">
                    <FileText className="h-3.5 w-3.5 text-primary/80" />
                    <p className="text-[9px] font-black uppercase tracking-[0.16em] font-mono">Export status</p>
                  </div>
                  <p className="mt-1.5 text-[9px] leading-relaxed text-white/45 font-mono">
                    {exportReady
                      ? "The production package is complete and can be queued right away."
                      : exportBlockers[0]?.detail || "Complete the pending items to unlock export."}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-3 border-t border-white/6 pt-4">
            {/* Assembly Timeline lives on its own dedicated page — clear gateway, no embedded duplicate. */}
            <div className="flex flex-col gap-3 rounded-none border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-none border border-primary/30 bg-primary/10 text-primary">
                  <Layers className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/80 font-mono">Assembly Timeline</p>
                  <p className="max-w-md text-[10px] leading-relaxed text-white/45 font-mono">
                    Arrange clips, captions and audio tracks, then render the final video — in the dedicated Timeline Editor.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="outline" className="rounded-none border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-[0.18em] text-white/55 font-mono">
                      {scenes.length} scene{scenes.length > 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="rounded-none border-white/10 bg-white/5 text-[8px] font-black uppercase tracking-[0.18em] text-white/55 font-mono">
                      {actualDuration.toFixed(1)}s total
                    </Badge>
                  </div>
                </div>
              </div>

              {timelineStudioHref ? (
                <Link href={timelineStudioHref} className="shrink-0">
                  <Button
                    type="button"
                    className="h-10 rounded-none bg-primary px-5 text-[10px] font-black uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90"
                  >
                    <Layers className="mr-2 h-4 w-4" /> Open Timeline Editor <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              ) : null}
            </div>

            <div className="rounded-none border border-primary/20 bg-gradient-to-b from-primary/12 via-primary/6 to-transparent p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-none border border-primary/30 bg-primary/10 text-primary">
                    {isRenderQueued || exportReady ? <CheckCircle2 className="h-4.5 w-4.5" /> : <AlertTriangle className="h-4.5 w-4.5" />}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary font-mono">Final Export Gate</p>
                    <h3 className="text-base font-black uppercase tracking-[0.14em] text-white font-display md:text-lg">
                      {isRenderQueued ? "Render queued" : exportReady ? "Ready to render" : "Blocked until the pipeline is complete"}
                    </h3>
                    <p className="text-[9px] leading-relaxed text-white/50 font-mono md:text-[10px]">
                      {isRenderQueued
                        ? "The render job has already been queued from Production Studio. You can monitor the project while processing continues."
                        : exportReady
                        ? "Assembly, audio, captions and visual approvals are all in place. You can queue the final export now."
                        : "This page stays useful for prep work, but the final render only unlocks when every prerequisite below is validated."}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsFinalGateExpanded((current) => !current)}
                  className="h-10 rounded-none border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-[10px] font-black uppercase tracking-[0.18em]"
                >
                  {isFinalGateExpanded ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                  {isFinalGateExpanded ? "Hide Gate Details" : "Show Gate Details"}
                </Button>
              </div>

              {isFinalGateExpanded && (
                <>
                  {exportBlockers.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {exportBlockers.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-none border border-white/8 bg-black/20 px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/75 font-mono">{item.label}</p>
                            <p className="mt-0.5 text-[9px] text-white/35 font-mono">{item.detail}</p>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 text-primary/70" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-none border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300 font-mono">Render queue unlocked</p>
                      <p className="mt-0.5 text-[9px] leading-relaxed text-emerald-100/70 font-mono md:text-[10px]">
                        Launch the export to generate the final production render from the validated assembly.
                      </p>
                    </div>
                  )}

                  {!captionsReady && !captionsDisabled && (
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        type="button"
                        onClick={onGenerateCaptions}
                        disabled={isLoadingCaptions || !hasScenes || isRenderQueued}
                        className="h-10 rounded-none bg-amber-500/10 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300 hover:bg-amber-500/20"
                      >
                        {isLoadingCaptions ? <Sparkles className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                        Generate Captions
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onOpenCaptionsLab}
                        className="h-10 rounded-none border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-[0.18em] text-white/80 hover:bg-white/10"
                      >
                        <Settings2 className="mr-2 h-4 w-4" /> Open Captions Lab
                      </Button>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      onClick={onExport}
                      disabled={isExporting || isRenderQueued || !exportReady}
                      className="h-10 flex-1 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-black uppercase tracking-[0.22em] shadow-[0_0_20px_-5px_rgba(255,51,0,0.45)]"
                    >
                      {isExporting ? (
                        <><Sparkles className="mr-2 h-4 w-4 animate-spin" /> Assembling...</>
                      ) : isRenderQueued ? (
                        <><CheckCircle2 className="mr-2 h-4 w-4" /> Render Queued</>
                      ) : (
                        <><Download className="mr-2 h-4 w-4" /> Launch Final Export</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={onOpenAudioLab}
                      className="h-10 rounded-none border-white/10 bg-white/5 text-white/80 hover:bg-white/10 text-[10px] font-black uppercase tracking-[0.18em]"
                    >
                      <Settings2 className="mr-2 h-4 w-4" /> Open Audio Lab
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
      </div>
    </div>
  );
}

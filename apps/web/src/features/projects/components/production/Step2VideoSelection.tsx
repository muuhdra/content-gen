import React, { useState, useRef } from 'react';
import Image from 'next/image';
import { Sparkles, RefreshCw, ChevronRight, ArrowLeft, ArrowRight, Check, Play, Pause, Film, AlertCircle, CheckCircle2, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getImageVariantUrl, getVideoVariantUrl, type ProjectScene, type ProjectVideoVariant } from "@/lib/projects-api";

function VideoVariantCard({
  variant,
  isApproved,
  isAnyApproved,
  onApprove,
  onRegenerate,
  isLoading,
}: {
  variant: ProjectVideoVariant;
  isApproved: boolean;
  isAnyApproved: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
  isLoading: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const downloadUrl = getVideoVariantUrl(variant.id, true);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={`group relative rounded-none border overflow-hidden transition-all duration-500 ${
      isApproved
        ? "border-emerald-500/40 bg-emerald-500/5"
        : isAnyApproved
          ? "border-border opacity-50 hover:opacity-100 hover:border-primary/20"
          : "border-border hover:border-primary/30"
    }`}>
      <div className="aspect-video relative overflow-hidden bg-black">
        <video
          ref={videoRef}
          src={getVideoVariantUrl(variant.id)}
          className="h-full w-full object-cover"
          preload="metadata"
          loop
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
          onEnded={() => setIsPlaying(false)}
          onError={() => {}}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="h-10 w-10 rounded-none bg-background/10 border border-border flex items-center justify-center text-muted-foreground/20">
            <Film className="h-5 w-5" />
          </div>
        </div>
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center group/play">
          <div className={`h-16 w-16 rounded-none backdrop-blur-sm border flex items-center justify-center transition-all duration-300 ${
            isPlaying ? "bg-background/10 border-border opacity-0 group-hover/play:opacity-100" : "bg-background/10 border-border group-hover/play:bg-background/20"
          }`}>
            {isPlaying ? <Pause className="h-7 w-7 text-foreground fill-current" /> : <Play className="h-7 w-7 text-foreground fill-current ml-1" />}
          </div>
        </button>
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <Badge variant="outline" className="border-border bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase tracking-tight text-foreground/70 rounded-none font-mono">
            {variant.motion}
          </Badge>
          <Badge variant="outline" className="border-border bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase tracking-tight text-muted-foreground/50 rounded-none font-mono">
            {variant.engine}
          </Badge>
        </div>
        {isApproved && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-16 w-16 rounded-none bg-emerald-500/20 backdrop-blur-sm border border-emerald-500/40 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-400" />
            </div>
          </div>
        )}
        {isLoading && !isApproved && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Sparkles className="h-8 w-8 text-primary animate-pulse" />
          </div>
        )}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-border">
            <div className="h-full bg-primary transition-all" style={{ width: `${(currentTime / duration) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[11px] font-black text-foreground/70 font-mono">{variant.motion} · {variant.energy}</p>
          <p className="text-[9px] text-muted-foreground/30 mt-1 font-mono">{variant.engine}</p>
        </div>
        <div className="flex items-center gap-2">
          {isApproved ? (
            <Button disabled className="flex-1 h-9 rounded-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 opacity-70 text-[10px] font-black uppercase tracking-widest cursor-default font-mono">
              <Check className="h-3 w-3 mr-1.5" /> Selected
            </Button>
          ) : (
            <Button onClick={onApprove} disabled={isLoading} className="flex-1 h-9 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-black uppercase tracking-widest transition-all font-mono">
              Approve
            </Button>
          )}
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            title="Regenerate this clip"
            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-border text-muted-foreground transition-all hover:bg-card hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <a
            href={downloadUrl}
            download
            title="Download video"
            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-border text-muted-foreground transition-all hover:bg-card hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

interface Step2VideoSelectionProps {
  selectedScene: ProjectScene | null;
  scenes: ProjectScene[];
  sceneIndex: number;
  loadingSceneId: string | null;
  loadingVariantId: string | null;
  onGenerateVideos: (sceneId: string) => void;
  onApproveVideo: (videoId: string) => void;
  onRegenerateVideo: (videoId: string) => void;
  isSlideshowProject: boolean;
  // True when approved images alone are enough (slideshow OR "static" clip mode):
  // motion is optional, so step 2 never blocks the path to assembly.
  motionOptional: boolean;
  // Per-scene aware (handles hybrid): every scene needing a clip has one.
  motionSatisfied: boolean;
  clipMode?: string;
  requiresMotion: (scene: ProjectScene) => boolean;
  onToggleSceneMotion: (sceneId: string, motionMode: "animate" | "static") => void;
  onSelectScene: (sceneId: string) => void;
  onGoBackToStep1: () => void;
  onGoToStep3: () => void;
}

export function Step2VideoSelection({
  selectedScene,
  scenes,
  sceneIndex,
  loadingSceneId,
  loadingVariantId,
  onGenerateVideos,
  onApproveVideo,
  onRegenerateVideo,
  isSlideshowProject,
  motionOptional,
  motionSatisfied,
  clipMode,
  requiresMotion,
  onToggleSceneMotion,
  onSelectScene,
  onGoBackToStep1,
  onGoToStep3,
}: Step2VideoSelectionProps) {
  const sceneNeedsMotion = selectedScene ? requiresMotion(selectedScene) : false;
  const isHybrid = clipMode === "hybrid";
  const sceneIsReadyForStep2Progress = Boolean(selectedScene?.approvedImageId) && (!sceneNeedsMotion || Boolean(selectedScene?.approvedVideoId));

  const canContinueToStep3 = scenes.length > 0 && scenes.every((s) => !!s.approvedImageId) && motionSatisfied;

  if (!selectedScene) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex items-center justify-center h-full text-muted-foreground/10">
          <p className="text-sm font-black uppercase tracking-widest font-mono">Select a scene</p>
        </div>
      </ScrollArea>
    );
  }

  if (!selectedScene.approvedImageId) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <AlertCircle className="h-12 w-12 text-destructive/40" />
          <div className="text-center space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 font-mono">Frame not approved</p>
            <p className="text-[10px] text-muted-foreground/15 max-w-sm leading-relaxed font-mono">
              You must approve an image in Step 1 before generating videos for this scene.
            </p>
          </div>
          <Button onClick={onGoBackToStep1} variant="ghost" className="h-8 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:bg-card rounded-none font-mono">
            <ArrowLeft className="h-4 w-4" /> Back to Visuals
          </Button>
        </div>
      </ScrollArea>
    );
  }

  if (selectedScene.videoVariants.length === 0) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <div className="w-48 aspect-video rounded-none overflow-hidden border-2 border-emerald-500/30">
            <Image
              src={getImageVariantUrl(selectedScene.approvedImageId)}
              fill
              sizes="192px"
              className="object-cover"
              alt="Approved image"
              unoptimized
            />
          </div>
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-emerald-400/60 font-mono">
              <CheckCircle2 className="h-3.5 w-3.5" /> Image approved
            </div>

            {isHybrid && (
              <HybridMotionToggle
                scene={selectedScene}
                sceneNeedsMotion={sceneNeedsMotion}
                onToggle={onToggleSceneMotion}
              />
            )}

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 font-mono">
              {!sceneNeedsMotion ? "Static scene (Ken Burns)" : motionOptional ? "Optional motion" : "Generate motion"}
            </p>
            <p className="text-[9px] text-muted-foreground/20 max-w-sm leading-relaxed font-mono">
              {!sceneNeedsMotion
                ? isHybrid
                  ? "This scene stays static (Ken Burns) — no clip needed, no extra cost. Flip it to “Animate” above if you want motion."
                  : isSlideshowProject
                    ? "Generate slide motion variants if you want hybrid motion. You can also continue directly to Audio & Assembly."
                    : "Static clip mode — motion is optional. Generate motion variants only if you want them, or continue straight to Audio & Assembly."
                : "Animate this scene to create a motion clip between 5 and 10 seconds."}
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            {sceneNeedsMotion && (
              <Button
                onClick={() => onGenerateVideos(selectedScene.id)}
                disabled={loadingSceneId === selectedScene.id}
                className="h-12 px-8 rounded-none bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-[0.3em] hover:bg-primary/90 transition-all shadow-[0_0_25px_-5px_rgba(255,51,0,0.25)] font-mono"
              >
                {loadingSceneId === selectedScene.id ? (
                  <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Animating...</>
                ) : (
                  <><Film className="h-4 w-4 mr-2" /> {isSlideshowProject ? "Generate Slide Motion" : "Generate Motion"}</>
                )}
              </Button>
            )}
            {canContinueToStep3 && (
              <Button onClick={onGoToStep3} className="h-10 gap-2 rounded-none bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-[10px] font-black uppercase tracking-widest transition-all font-mono">
                {isSlideshowProject ? "Continue to Audio & Assembly" : "Audio & Assembly"} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1 p-8">
      <div className="space-y-8">
        <div className="flex gap-5 rounded-none border border-emerald-500/10 bg-emerald-500/[0.02] p-5">
          <div className="w-28 aspect-video flex-shrink-0 rounded-none overflow-hidden border border-emerald-500/20">
            <Image
              src={getImageVariantUrl(selectedScene.approvedImageId)}
              fill
              sizes="112px"
              className="object-cover"
              alt="Reference"
              unoptimized
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[8px] font-black uppercase tracking-widest text-emerald-400/60 mb-2 flex items-center gap-2 font-mono">
              <CheckCircle2 className="h-3 w-3" /> Approved Frame
            </p>
            <p className="text-[12px] text-muted-foreground/50 leading-relaxed font-mono italic">
              {selectedScene.videoVariants[0]?.prompt || selectedScene.narration}
            </p>
            {isHybrid && (
              <div className="mt-3 flex items-center gap-2">
                <HybridMotionToggle
                  scene={selectedScene}
                  sceneNeedsMotion={sceneNeedsMotion}
                  onToggle={onToggleSceneMotion}
                />
                {!sceneNeedsMotion && (
                  <span className="text-[8px] uppercase tracking-[0.16em] text-amber-300/70 font-mono">Static — clip ignoré au rendu</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {selectedScene.videoVariants.map((variant) => (
            <VideoVariantCard
              key={variant.id}
              variant={variant}
              isApproved={variant.id === selectedScene.approvedVideoId}
              isAnyApproved={!!selectedScene.approvedVideoId}
              onApprove={() => onApproveVideo(variant.id)}
              onRegenerate={() => onRegenerateVideo(variant.id)}
              isLoading={loadingVariantId === variant.id}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-4">
          <Button
            onClick={() => onGenerateVideos(selectedScene.id)}
            disabled={loadingSceneId === selectedScene.id}
            variant="ghost"
            className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:bg-card rounded-none font-mono"
          >
            {loadingSceneId === selectedScene.id ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate clips
          </Button>

          <div className="flex items-center gap-2">
            {sceneIsReadyForStep2Progress && sceneIndex < scenes.length - 1 && (
              <Button
                onClick={() => onSelectScene(scenes[sceneIndex + 1].id)}
                className="h-9 gap-2 rounded-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-black uppercase tracking-widest transition-all font-mono"
              >
                Next scene <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {canContinueToStep3 && (
              <Button
                onClick={onGoToStep3}
                className="h-9 gap-2 rounded-none bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-[10px] font-black uppercase tracking-widest transition-all font-mono"
              >
                {isSlideshowProject ? "Continue to Audio & Assembly" : "Audio & Assembly"} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// Hybrid render mode: per-scene switch between an animated clip and a static
// Ken Burns image. Lets the user override the auto-selection plan scene by scene.
function HybridMotionToggle({
  scene,
  sceneNeedsMotion,
  onToggle,
}: {
  scene: ProjectScene;
  sceneNeedsMotion: boolean;
  onToggle: (sceneId: string, motionMode: "animate" | "static") => void;
}) {
  return (
    <div className="mx-auto flex w-fit items-center gap-1 rounded-none border border-border bg-background p-1">
      <button
        type="button"
        onClick={() => onToggle(scene.id, "animate")}
        className={`rounded-none px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] transition-all font-mono ${sceneNeedsMotion ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        <Film className="mr-1 inline h-3 w-3" /> Animer
      </button>
      <button
        type="button"
        onClick={() => onToggle(scene.id, "static")}
        className={`rounded-none px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] transition-all font-mono ${!sceneNeedsMotion ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        Statique
      </button>
    </div>
  );
}

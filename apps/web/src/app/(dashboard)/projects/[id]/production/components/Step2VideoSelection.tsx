import React, { useState, useRef } from 'react';
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
  isLoading,
}: {
  variant: ProjectVideoVariant;
  isApproved: boolean;
  isAnyApproved: boolean;
  onApprove: () => void;
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
    <div className={`group relative rounded-[28px] border overflow-hidden transition-all duration-500 ${
      isApproved
        ? "border-[#22c55e]/40 bg-[#22c55e]/5 shadow-[0_0_30px_-5px_rgba(34,197,94,0.2)]"
        : isAnyApproved
          ? "border-white/3 bg-white/1 opacity-50 hover:opacity-100 hover:border-white/7"
          : "border-white/4 bg-white/2 hover:border-white/10"
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
          <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/20">
            <Film className="h-5 w-5" />
          </div>
        </div>
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center group/play">
          <div className={`h-16 w-16 rounded-full backdrop-blur-sm border flex items-center justify-center transition-all duration-300 ${
            isPlaying ? "bg-white/10 border-white/20 opacity-0 group-hover/play:opacity-100" : "bg-white/10 border-white/20 group-hover/play:bg-white/20"
          }`}>
            {isPlaying ? <Pause className="h-7 w-7 text-white fill-current" /> : <Play className="h-7 w-7 text-white fill-current ml-1" />}
          </div>
        </button>
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <Badge variant="outline" className="border-white/10 bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase tracking-tight text-white/70">
            {variant.motion}
          </Badge>
          <Badge variant="outline" className="border-white/10 bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase tracking-tight text-white/50">
            {variant.engine}
          </Badge>
        </div>
        {isApproved && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-16 w-16 rounded-full bg-[#22c55e]/20 backdrop-blur-sm border border-[#22c55e]/40 flex items-center justify-center">
              <Check className="h-8 w-8 text-[#22c55e]" />
            </div>
          </div>
        )}
        {isLoading && !isApproved && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Sparkles className="h-8 w-8 text-[#9b6dff] animate-pulse" />
          </div>
        )}
        {duration > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
            <div className="h-full bg-[#9b6dff] transition-all" style={{ width: `${(currentTime / duration) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="text-[11px] font-black text-white/70">{variant.motion} · {variant.energy}</p>
          <p className="text-[9px] text-white/20 mt-1">{variant.engine}</p>
        </div>
        <div className="flex items-center gap-2">
          {isApproved ? (
            <Button disabled className="flex-1 h-9 rounded-xl bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 opacity-70 text-[10px] font-black uppercase tracking-widest cursor-default">
              <Check className="h-3 w-3 mr-1.5" /> Selected
            </Button>
          ) : (
            <Button onClick={onApprove} disabled={isLoading} className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-[#9b6dff] hover:text-white text-[10px] font-black uppercase tracking-widest transition-all duration-300">
              Approve
            </Button>
          )}
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl border border-white/5 hover:bg-white/5 text-white/30 hover:text-white transition-all"
            title="Download video"
          >
            <a href={downloadUrl} download>
              <Download className="h-3.5 w-3.5" />
            </a>
          </Button>
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
  onSelectScene,
  onGoBackToStep1,
  onGoToStep3,
}: Step2VideoSelectionProps) {

  // FIX #2: Show "Go to Step 3" whenever ALL scenes have approved videos
  const allVideosApproved = scenes.length > 0 && scenes.every((s) => !!s.approvedVideoId);

  if (!selectedScene) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex items-center justify-center h-full text-white/10">
          <p className="text-sm font-black uppercase tracking-widest">Select a scene</p>
        </div>
      </ScrollArea>
    );
  }

  if (!selectedScene.approvedImageId) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <AlertCircle className="h-12 w-12 text-red-400/40" />
          <div className="text-center space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20">Image not approved</p>
            <p className="text-[10px] text-white/10 max-w-sm leading-relaxed">
              You must approve an image in Step 1 before generating videos for this scene.
            </p>
          </div>
          <Button onClick={onGoBackToStep1} variant="ghost" className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white border border-white/5 hover:bg-white/5 rounded-xl">
            <ArrowLeft className="h-4 w-4" /> Back to Step 1
          </Button>
        </div>
      </ScrollArea>
    );
  }

  if (selectedScene.videoVariants.length === 0) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <div className="w-48 aspect-video rounded-2xl overflow-hidden border-2 border-[#22c55e]/30 shadow-[0_0_30px_-5px_rgba(34,197,94,0.2)]">
            <img src={getImageVariantUrl(selectedScene.approvedImageId)} className="h-full w-full object-cover" alt="Approved image" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-[#22c55e]/60">
              <CheckCircle2 className="h-3.5 w-3.5" /> Image approved
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20">Generate animations</p>
            <p className="text-[10px] text-white/10 max-w-sm leading-relaxed">
              Agent 5 will animate this scene, creating video variants of 5 to 15 seconds.
            </p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <Button
              onClick={() => onGenerateVideos(selectedScene.id)}
              disabled={loadingSceneId === selectedScene.id}
              className="h-14 px-10 rounded-3xl bg-white text-black text-[12px] font-black uppercase tracking-[0.3em] hover:bg-[#9b6dff] hover:text-white transition-all duration-500"
            >
              {loadingSceneId === selectedScene.id ? (
                <><Sparkles className="h-5 w-5 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Film className="h-5 w-5 mr-2" /> Generate Videos (Agent 5)</>
              )}
            </Button>
            {/* FIX #2: Allow going to Step 3 if all other scenes are already done */}
            {allVideosApproved && (
              <Button onClick={onGoToStep3} className="h-10 gap-2 rounded-xl bg-[#9b6dff]/10 text-[#9b6dff] border border-[#9b6dff]/20 hover:bg-[#9b6dff]/20 text-[10px] font-black uppercase tracking-widest transition-all">
                Audio & Assembly <ArrowRight className="h-4 w-4" />
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
        <div className="flex gap-5 rounded-2xl border border-[#22c55e]/10 bg-[#22c55e]/[0.02] p-5">
          <div className="w-28 aspect-video flex-shrink-0 rounded-xl overflow-hidden border border-[#22c55e]/20">
            <img src={getImageVariantUrl(selectedScene.approvedImageId)} className="h-full w-full object-cover" alt="Reference" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-widest text-[#22c55e]/60 mb-2 flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3" /> Approved Reference Image
            </p>
            <p className="text-[12px] text-white/40 leading-relaxed">
              {selectedScene.videoVariants[0]?.prompt || selectedScene.narration}
            </p>
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
              isLoading={loadingVariantId === variant.id}
            />
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/3">
          <Button
            onClick={() => onGenerateVideos(selectedScene.id)}
            disabled={loadingSceneId === selectedScene.id}
            variant="ghost"
            className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white border border-white/5 hover:bg-white/5 rounded-xl"
          >
            {loadingSceneId === selectedScene.id ? <Sparkles className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate variants
          </Button>

          <div className="flex items-center gap-2">
            {selectedScene.approvedVideoId && sceneIndex < scenes.length - 1 && (
              <Button
                onClick={() => onSelectScene(scenes[sceneIndex + 1].id)}
                className="h-9 gap-2 rounded-xl bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 hover:bg-[#22c55e]/20 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Next scene <ChevronRight className="h-4 w-4" />
              </Button>
            )}

            {/* FIX #2: Show whenever ALL videos are approved */}
            {allVideosApproved && (
              <Button
                onClick={onGoToStep3}
                className="h-9 gap-2 rounded-xl bg-[#9b6dff]/10 text-[#9b6dff] border border-[#9b6dff]/20 hover:bg-[#9b6dff]/20 text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Audio & Assembly <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

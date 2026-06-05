import React from 'react';
import Image from 'next/image';
import { Camera, Sparkles, Wand2, RefreshCw, ChevronRight, ArrowRight, Check, Download } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getImageVariantUrl, type ProjectScene, type ProjectImageVariant } from "@/lib/projects-api";

function getPaletteColor(palette: string): string {
  const map: Record<string, string> = {
    "neon-dark": "#9b6dff",
    "golden-hour": "#f59e0b",
    "monochrome": "#6b7280",
    "cinematic": "#3b82f6",
    "pastel": "#f9a8d4",
    "nature": "#22c55e",
    "desert": "#f97316",
  };
  return map[palette?.toLowerCase()] ?? "#6366f1";
}

function getMoodEmoji(mood: string): string {
  const map: Record<string, string> = {
    "dramatic": "🎭",
    "calm": "🌊",
    "tense": "⚡",
    "hopeful": "🌅",
    "dark": "🌑",
    "energetic": "🔥",
    "mysterious": "🌫️",
  };
  return map[mood?.toLowerCase()] ?? "✨";
}

function ImageVariantCard({
  variant,
  isApproved,
  isAnyApproved,
  onApprove,
  onRegenerate,
  isLoading,
}: {
  variant: ProjectImageVariant;
  isApproved: boolean;
  isAnyApproved: boolean;
  onApprove: () => void;
  onRegenerate: () => void;
  isLoading: boolean;
}) {
  const paletteColor = getPaletteColor(variant.palette);
  const moodEmoji = getMoodEmoji(variant.mood);
  const variantUrl = getImageVariantUrl(variant.id);
  const downloadUrl = getImageVariantUrl(variant.id, true);

  return (
    <div className={`group relative rounded-none border overflow-hidden transition-all duration-500 ${
      isApproved
        ? "border-emerald-500/40 bg-emerald-500/5"
        : isAnyApproved
          ? "border-border opacity-50 hover:opacity-100 hover:border-primary/20"
          : "border-border hover:border-primary/30"
    }`}>
      <div className="aspect-video relative overflow-hidden bg-black">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: `radial-gradient(ellipse at 30% 40%, ${paletteColor}33, transparent 60%)` }}
        />
        <Image
          src={variantUrl}
          fill
          sizes="(min-width: 1280px) 33vw, 100vw"
          className="object-cover transition-all duration-500 group-hover:scale-105"
          alt={variant.previewTitle}
          unoptimized
        />
        <div className="absolute inset-0 bg-linear-to-t from-black via-transparent to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <Badge
            variant="outline"
            className="border-border bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase tracking-tight text-foreground/70 rounded-none font-mono"
          >
            {moodEmoji} {variant.shot}
          </Badge>
          <div
            className="h-3 w-3 rounded-none border border-border"
            style={{ backgroundColor: paletteColor }}
            title={variant.palette}
          />
        </div>

        {isApproved && (
          <div className="absolute inset-0 flex items-center justify-center">
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
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-foreground/70 font-mono">{variant.previewTitle}</p>
            <span className="text-[9px] font-mono text-muted-foreground/20">#{variant.variantIndex}</span>
          </div>
          <p className="text-[9px] text-muted-foreground/30 mt-1 line-clamp-2 leading-relaxed font-mono">{variant.mood} · {variant.palette}</p>
        </div>

        <div className="flex items-center gap-2">
          {isApproved ? (
            <Button
              disabled
              className="flex-1 h-9 rounded-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 opacity-70 text-[10px] font-black uppercase tracking-widest cursor-default font-mono"
            >
              <Check className="h-3 w-3 mr-1.5" /> Selected
            </Button>
          ) : (
            <Button
              onClick={onApprove}
              disabled={isLoading}
              className="flex-1 h-9 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-[10px] font-black uppercase tracking-widest transition-all font-mono"
            >
              Approve
            </Button>
          )}
          <Button
            onClick={onRegenerate}
            disabled={isLoading}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-none border border-border hover:bg-card text-muted-foreground hover:text-foreground transition-all"
            title="Regenerate"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <a
            href={downloadUrl}
            download
            title="Download image"
            className="inline-flex h-9 w-9 items-center justify-center rounded-none border border-border text-muted-foreground transition-all hover:bg-card hover:text-foreground"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

interface Step1VisualSelectionProps {
  selectedScene: ProjectScene | null;
  scenes: ProjectScene[];
  sceneIndex: number;
  loadingSceneId: string | null;
  loadingVariantId: string | null;
  onGenerateVisuals: (sceneId: string) => void;
  onApproveFrame: (imageId: string) => void;
  onRegenerateFrame: (imageId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onGoToStep2: () => void;
}

export function Step1VisualSelection({
  selectedScene,
  scenes,
  sceneIndex,
  loadingSceneId,
  loadingVariantId,
  onGenerateVisuals,
  onApproveFrame,
  onRegenerateFrame,
  onSelectScene,
  onGoToStep2,
}: Step1VisualSelectionProps) {
  if (!selectedScene) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex items-center justify-center h-full text-muted-foreground/10">
          <p className="text-sm font-black uppercase tracking-widest font-mono">Select a scene</p>
        </div>
      </ScrollArea>
    );
  }

  if (selectedScene.imageVariants.length === 0) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <div className="text-center space-y-3">
            <div className="h-16 w-16 rounded-none border border-dashed border-border flex items-center justify-center mx-auto">
              <Camera className="h-7 w-7 text-muted-foreground/10" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 font-mono">No visuals generated</p>
            <p className="text-[9px] text-muted-foreground/20 max-w-xs leading-relaxed font-mono">
              Generate the visual foundation for this scene based on the scene directive.
            </p>
          </div>
          <Button
            onClick={() => onGenerateVisuals(selectedScene.id)}
            disabled={loadingSceneId === selectedScene.id}
            className="h-12 px-8 rounded-none bg-primary text-primary-foreground text-[11px] font-black uppercase tracking-[0.3em] hover:bg-primary/90 transition-all shadow-[0_0_25px_-5px_rgba(255,51,0,0.25)] font-mono"
          >
            {loadingSceneId === selectedScene.id ? (
              <><Sparkles className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="h-4 w-4 mr-2" /> Generate Visuals</>
            )}
          </Button>
        </div>
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="flex-1 p-8">
      <div className="space-y-8">
        {/* Prompt info */}
        <div className="rounded-none border border-primary/10 bg-primary/3 p-4">
          <p className="text-[8px] font-black uppercase tracking-widest text-primary/60 mb-2 flex items-center gap-2 font-mono">
            <Wand2 className="h-3 w-3" /> Visual Directive
          </p>
          <p className="text-[11px] text-muted-foreground/50 leading-relaxed font-mono italic">
            {selectedScene.imageVariants[0]?.prompt || selectedScene.visualIntent}
          </p>
        </div>

        {/* Image grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
          {selectedScene.imageVariants.map((variant) => (
            <ImageVariantCard
              key={variant.id}
              variant={variant}
              isApproved={variant.id === selectedScene.approvedImageId}
              isAnyApproved={!!selectedScene.approvedImageId}
              onApprove={() => onApproveFrame(variant.id)}
              onRegenerate={() => onRegenerateFrame(variant.id)}
              isLoading={loadingVariantId === variant.id}
            />
          ))}
        </div>

        {/* Action bar bottom */}
        <div className="flex items-center justify-between pt-4">
          <Button
            onClick={() => onGenerateVisuals(selectedScene.id)}
            disabled={loadingSceneId === selectedScene.id}
            variant="ghost"
            className="h-8 gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:bg-card rounded-none font-mono"
          >
            {loadingSceneId === selectedScene.id ? (
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate Visuals
          </Button>

          {selectedScene.approvedImageId && (
            <Button
              onClick={() => {
                if (sceneIndex < scenes.length - 1) {
                  onSelectScene(scenes[sceneIndex + 1].id);
                } else {
                  onGoToStep2();
                }
              }}
              className="h-9 gap-2 rounded-none bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[10px] font-black uppercase tracking-widest transition-all font-mono"
            >
              {sceneIndex < scenes.length - 1 ? (
                <><ChevronRight className="h-4 w-4" /> Next Scene</>
              ) : (
                <><ArrowRight className="h-4 w-4" /> Go to Step 2</>
              )}
            </Button>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

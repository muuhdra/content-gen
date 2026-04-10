import React from 'react';
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
    <div className={`group relative rounded-[28px] border overflow-hidden transition-all duration-500 ${
      isApproved
        ? "border-[#22c55e]/40 bg-[#22c55e]/5 shadow-[0_0_30px_-5px_rgba(34,197,94,0.2)]"
        : isAnyApproved
          ? "border-white/3 bg-white/1 opacity-50 hover:opacity-100 hover:border-white/7"
          : "border-white/4 bg-white/2 hover:border-white/10"
    }`}>
      <div className="aspect-video relative overflow-hidden bg-black">
        <div
          className="absolute inset-0 opacity-30"
          style={{ background: `radial-gradient(ellipse at 30% 40%, ${paletteColor}33, transparent 60%)` }}
        />
        <img
          src={variantUrl}
          className="h-full w-full object-cover transition-all duration-500 group-hover:scale-105"
          alt={variant.previewTitle}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <Badge
            variant="outline"
            className="border-white/10 bg-black/50 backdrop-blur-sm text-[8px] font-black uppercase tracking-tight text-white/70"
          >
            {moodEmoji} {variant.shot}
          </Badge>
          <div
            className="h-3 w-3 rounded-full border border-white/20"
            style={{ backgroundColor: paletteColor }}
            title={variant.palette}
          />
        </div>

        {isApproved && (
          <div className="absolute inset-0 flex items-center justify-center">
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
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black text-white/70">{variant.previewTitle}</p>
            <span className="text-[9px] font-mono text-white/20">#{variant.variantIndex}</span>
          </div>
          <p className="text-[9px] text-white/20 mt-1 line-clamp-2 leading-relaxed">{variant.mood} · {variant.palette}</p>
        </div>

        <div className="flex items-center gap-2">
          {isApproved ? (
            <Button
              disabled
              className="flex-1 h-9 rounded-xl bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 opacity-70 text-[10px] font-black uppercase tracking-widest cursor-default"
            >
              <Check className="h-3 w-3 mr-1.5" /> Sélectionnée
            </Button>
          ) : (
            <Button
              onClick={onApprove}
              disabled={isLoading}
              className="flex-1 h-9 rounded-xl bg-white text-black hover:bg-[#9b6dff] hover:text-white text-[10px] font-black uppercase tracking-widest transition-all duration-300"
            >
              Valider
            </Button>
          )}
          <Button
            onClick={onRegenerate}
            disabled={isLoading}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl border border-white/5 hover:bg-white/5 text-white/30 hover:text-white transition-all"
            title="Régénérer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-xl border border-white/5 hover:bg-white/5 text-white/30 hover:text-white transition-all"
            title="Download image"
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

interface Step1ImageSelectionProps {
  selectedScene: ProjectScene | null;
  scenes: ProjectScene[];
  sceneIndex: number;
  loadingSceneId: string | null;
  loadingVariantId: string | null;
  onGenerateImages: (sceneId: string) => void;
  onApproveImage: (imageId: string) => void;
  onRegenerateImage: (imageId: string) => void;
  onSelectScene: (sceneId: string) => void;
  onGoToStep2: () => void;
}

export function Step1ImageSelection({
  selectedScene,
  scenes,
  sceneIndex,
  loadingSceneId,
  loadingVariantId,
  onGenerateImages,
  onApproveImage,
  onRegenerateImage,
  onSelectScene,
  onGoToStep2,
}: Step1ImageSelectionProps) {
  if (!selectedScene) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex items-center justify-center h-full text-white/10">
          <p className="text-sm font-black uppercase tracking-widest">Select a scene</p>
        </div>
      </ScrollArea>
    );
  }

  if (selectedScene.imageVariants.length === 0) {
    return (
      <ScrollArea className="flex-1 p-8">
        <div className="flex flex-col items-center justify-center h-full gap-8">
          <div className="text-center space-y-4">
            <div className="h-20 w-20 rounded-full border border-dashed border-white/10 flex items-center justify-center mx-auto">
              <Camera className="h-8 w-8 text-white/10" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-white/20">No images generated</p>
            <p className="text-[10px] text-white/10 max-w-sm leading-relaxed">
              Agent 3 will analyze the context of this scene and generate image variants based on the prompt provided by Agent 2.
            </p>
          </div>
          <Button
            onClick={() => onGenerateImages(selectedScene.id)}
            disabled={loadingSceneId === selectedScene.id}
            className="h-14 px-10 rounded-3xl bg-white text-black text-[12px] font-black uppercase tracking-[0.3em] hover:bg-[#9b6dff] hover:text-white transition-all duration-500 shadow-[0_15px_40px_rgba(255,255,255,0.1)] hover:shadow-[0_15px_40px_rgba(155,109,255,0.3)]"
          >
            {loadingSceneId === selectedScene.id ? (
              <><Sparkles className="h-5 w-5 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Wand2 className="h-5 w-5 mr-2" /> Generate Images (Agent 3)</>
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
        <div className="rounded-2xl border border-[#9b6dff]/10 bg-[#9b6dff]/[0.03] p-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-[#9b6dff]/60 mb-2 flex items-center gap-2">
            <Wand2 className="h-3 w-3" /> Visual Directive (Agent 2)
          </p>
          <p className="text-[12px] text-white/40 leading-relaxed">
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
              onApprove={() => onApproveImage(variant.id)}
              onRegenerate={() => onRegenerateImage(variant.id)}
              isLoading={loadingVariantId === variant.id}
            />
          ))}
        </div>

        {/* Action bar bottom */}
        <div className="flex items-center justify-between pt-4 border-t border-white/3">
          <Button
            onClick={() => onGenerateImages(selectedScene.id)}
            disabled={loadingSceneId === selectedScene.id}
            variant="ghost"
            className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-white border border-white/5 hover:bg-white/5 rounded-xl"
          >
            {loadingSceneId === selectedScene.id ? (
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Regenerate all variants
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
              className="h-9 gap-2 rounded-xl bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20 hover:bg-[#22c55e]/20 text-[10px] font-black uppercase tracking-widest transition-all"
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

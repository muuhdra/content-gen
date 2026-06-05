import React from 'react';
import Image from 'next/image';
import { CheckCircle2, Circle, AlertCircle, ImageIcon } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ProjectScene } from "@/lib/projects-api";

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const imageUrl = (variantId: string) => `${apiBase}/media/images/${variantId}`;

interface SceneSidebarProps {
  scenes: ProjectScene[];
  selectedSceneId: string | null;
  step: 1 | 2 | 3;
  // True when approved images alone are enough (slideshow OR "static" clip mode).
  motionOptional: boolean;
  // Per-scene (handles hybrid): does this scene need an animated clip?
  requiresMotion: (scene: ProjectScene) => boolean;
  onSelect: (id: string) => void;
}

export function SceneSidebar({ scenes, selectedSceneId, step, motionOptional, requiresMotion, onSelect }: SceneSidebarProps) {
  return (
    <aside className="w-[300px] flex-shrink-0 border-r border-border bg-card flex flex-col">
      <div className="p-4 bg-card/80">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 font-mono">
            {step === 1 ? "Visual Setup" : step === 2 ? motionOptional ? "Optional Motion" : "Motion Setup" : "Timeline Assembly"}
          </h3>
          <Badge variant="outline" className="border-border bg-background text-[8px] font-bold text-primary/60 uppercase rounded-none font-mono">
            {scenes.length} scenes
          </Badge>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {scenes.map((scene, i) => {
            const isSelected = selectedSceneId === scene.id;
            const hasApprovedImage = !!scene.approvedImageId;
            const hasApprovedVideo = !!scene.approvedVideoId;
            const hasImageVariants = scene.imageVariants.length > 0;
            const hasVideoVariants = scene.videoVariants.length > 0;

            let statusIcon;
            let statusColor;
            
            if (step === 1) {
              if (hasApprovedImage) { statusIcon = <CheckCircle2 className="h-3.5 w-3.5" />; statusColor = "text-emerald-400"; }
              else if (hasImageVariants) { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-amber-400"; }
              else { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-muted-foreground/20"; }
            } else if (step === 2) {
              if (hasApprovedVideo || (!requiresMotion(scene) && hasApprovedImage)) { statusIcon = <CheckCircle2 className="h-3.5 w-3.5" />; statusColor = "text-emerald-400"; }
              else if (hasVideoVariants) { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-amber-400"; }
              else if (!hasApprovedImage) { statusIcon = <AlertCircle className="h-3.5 w-3.5" />; statusColor = "text-destructive"; }
              else { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-muted-foreground/20"; }
            } else {
              const visualReady = hasApprovedImage && (!requiresMotion(scene) || hasApprovedVideo);

              if (visualReady) { statusIcon = <CheckCircle2 className="h-3.5 w-3.5" />; statusColor = "text-emerald-400"; }
              else if (!hasApprovedImage) { statusIcon = <AlertCircle className="h-3.5 w-3.5" />; statusColor = "text-destructive"; }
              else { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-amber-400"; }
            }

            return (
              <button
                key={scene.id}
                onClick={() => onSelect(scene.id)}
                className={`w-full text-left rounded-none border transition-all duration-300 p-3.5 ${
                  isSelected
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-transparent hover:bg-background hover:border-primary/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-16 flex-shrink-0 rounded-none overflow-hidden border border-border relative ${
                    (step === 2 || step === 3) && hasApprovedImage ? "bg-black" : "bg-background"
                  }`}>
                    {(step === 2 || step === 3) && hasApprovedImage ? (
                      <Image
                        src={imageUrl(scene.approvedImageId!)}
                        fill
                        sizes="64px"
                        className="object-cover opacity-80"
                        alt=""
                        unoptimized
                      />
                    ) : hasApprovedImage ? (
                       <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-emerald-400/40" />
                      </div>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground/10">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 ring-1 ring-primary/40 rounded-none" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-tight text-foreground/60 font-mono">
                        Scene {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={statusColor}>{statusIcon}</span>
                    </div>
                    <p className="text-[10px] line-clamp-2 text-muted-foreground/30 leading-relaxed mt-1.5 font-mono">
                      {scene.narration}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[8px] font-mono text-muted-foreground/15">{scene.duration}s</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

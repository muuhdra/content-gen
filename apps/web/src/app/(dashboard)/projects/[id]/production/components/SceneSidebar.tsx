import React from 'react';
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
  onSelect: (id: string) => void;
}

export function SceneSidebar({ scenes, selectedSceneId, step, onSelect }: SceneSidebarProps) {
  return (
    <aside className="w-[300px] flex-shrink-0 border-r border-white/4 bg-[#08080c] flex flex-col">
      <div className="p-4 border-b border-white/4 bg-black/20">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">
            {step === 1 ? "Scènes du Script" : step === 2 ? "Scènes Validées" : "Timeline Montage"}
          </h3>
          <Badge variant="outline" className="border-white/5 bg-white/2 text-[8px] font-bold text-[#9b6dff]/60 uppercase">
            {scenes.length} scènes
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
              if (hasApprovedImage) { statusIcon = <CheckCircle2 className="h-3.5 w-3.5" />; statusColor = "text-[#22c55e]"; }
              else if (hasImageVariants) { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-[#f59e0b]"; }
              else { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-white/20"; }
            } else if (step === 2) {
              if (hasApprovedVideo) { statusIcon = <CheckCircle2 className="h-3.5 w-3.5" />; statusColor = "text-[#22c55e]"; }
              else if (hasVideoVariants) { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-[#f59e0b]"; }
              else if (!hasApprovedImage) { statusIcon = <AlertCircle className="h-3.5 w-3.5" />; statusColor = "text-red-400"; }
              else { statusIcon = <Circle className="h-3.5 w-3.5" />; statusColor = "text-white/20"; }
            } else {
              // Step 3
              statusIcon = <CheckCircle2 className="h-3.5 w-3.5" />; statusColor = "text-[#22c55e]";
            }

            return (
              <button
                key={scene.id}
                onClick={() => onSelect(scene.id)}
                className={`w-full text-left rounded-2xl border transition-all duration-300 p-3.5 ${
                  isSelected
                    ? "border-[#9b6dff]/30 bg-[#9b6dff]/5 shadow-[0_0_20px_-5px_rgba(155,109,255,0.25)]"
                    : "border-white/3 bg-transparent hover:bg-white/2 hover:border-white/6"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`h-12 w-16 flex-shrink-0 rounded-lg overflow-hidden border border-white/5 relative ${
                    (step === 2 || step === 3) && hasApprovedImage ? "bg-black" : "bg-black/60"
                  }`}>
                    {(step === 2 || step === 3) && hasApprovedImage ? (
                      <img
                        src={imageUrl(scene.approvedImageId!)}
                        className="h-full w-full object-cover opacity-80"
                        alt=""
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : hasApprovedImage ? (
                       <div className="h-full w-full flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-[#22c55e]/40" />
                      </div>
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-white/10">
                        <ImageIcon className="h-4 w-4" />
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute inset-0 ring-2 ring-[#9b6dff]/40 rounded-lg" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black uppercase tracking-tight text-white/60">
                        Scène {i + 1}
                      </span>
                      <span className={statusColor}>{statusIcon}</span>
                    </div>
                    <p className="text-[10px] line-clamp-2 text-white/25 leading-relaxed mt-1.5 font-medium">
                      {scene.narration}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[8px] font-mono text-white/15">{scene.duration}s</span>
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

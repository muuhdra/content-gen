import React from 'react';
import { Check, ChevronRight, LayoutTemplate } from 'lucide-react';
import type { ProjectScene } from "@/lib/projects-api";

interface StepIndicatorProps {
  step: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  scenes: ProjectScene[];
  isExportDone: boolean;
  // True when approved images alone are enough (slideshow OR "static" clip mode):
  // motion clips are optional, so step 2 never blocks progression.
  motionOptional: boolean;
  // Per-scene aware (handles hybrid): whether every scene that needs a clip has one.
  motionSatisfied: boolean;
  motionRequiredCount: number;
  motionApprovedCount: number;
}

export function StepIndicator({ step, onStepChange, scenes, isExportDone, motionOptional, motionSatisfied, motionRequiredCount, motionApprovedCount }: StepIndicatorProps) {
  const imagesApproved = scenes.filter((s) => s.approvedImageId).length;
  const hasScenes = scenes.length > 0;
  const allImagesApproved = scenes.length > 0 && imagesApproved === scenes.length;
  const allVideosApproved = motionSatisfied;
  const imageProgressLabel = hasScenes ? `${imagesApproved}/${scenes.length} frames` : "Awaiting scenes";
  const videoProgressLabel = !hasScenes
    ? "Awaiting scenes"
    : motionRequiredCount === 0
      ? "Optional motion"
      : `${motionApprovedCount}/${motionRequiredCount} clips`;
  const assemblyLabel = isExportDone
    ? "Render queued ✓"
    : hasScenes
      ? "Finalization"
      : "Setup mode";

  return (
    <div className="flex items-center justify-between gap-4 bg-card/95 px-6 py-2.5">
      <div className="flex items-center gap-2">
        <div className="h-3.5 w-3.5 bg-primary rounded-none" />
        <span className="text-[12px] font-black uppercase tracking-[0.18em] text-foreground font-display">
          Production<span className="text-primary">Studio</span>
        </span>
        <span className="mx-2 text-border">|</span>
        <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/30 font-mono">Pipeline Control</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        {/* Step 1: Images */}
        <button
          onClick={() => onStepChange(1)}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-none border transition-all duration-300 ${
            step === 1
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/20"
          }`}
        >
          <div className={`flex h-5.5 w-5.5 items-center justify-center rounded-none text-[9px] font-black font-mono ${
            step === 1 ? "bg-primary text-primary-foreground" : allImagesApproved ? "bg-emerald-500/20 text-emerald-400" : "bg-background border border-border text-muted-foreground/30"
          }`}>
            {allImagesApproved ? <Check className="h-3 w-3" /> : "1"}
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] leading-none font-mono">Visual Selection</p>
            <p className="mt-0.5 text-[7px] font-medium leading-none text-muted-foreground/40 font-mono">{imageProgressLabel}</p>
          </div>
        </button>

        <ChevronRight className="h-3.5 w-3.5 text-border" />

        {/* Step 2: Videos */}
        <button
          onClick={() => onStepChange(2)}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-none border transition-all duration-300 ${
            step === 2
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/20"
          }`}
        >
          <div className={`flex h-5.5 w-5.5 items-center justify-center rounded-none text-[9px] font-black font-mono ${
            step === 2 ? "bg-primary text-primary-foreground" : allVideosApproved ? "bg-emerald-500/20 text-emerald-400" : "bg-background border border-border text-muted-foreground/30"
          }`}>
            {allVideosApproved ? <Check className="h-3 w-3" /> : "2"}
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] leading-none font-mono">
              {motionOptional ? "Optional Motion" : "Motion Selection"}
            </p>
            <p className="mt-0.5 text-[7px] font-medium leading-none text-muted-foreground/40 font-mono">{videoProgressLabel}</p>
          </div>
        </button>

        <ChevronRight className="h-3.5 w-3.5 text-border" />

        {/* Step 3: Audio & Assembly */}
        <button
          onClick={() => onStepChange(3)}
          className={`flex items-center gap-2.5 px-4 py-2 rounded-none border transition-all duration-300 ${
            step === 3
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-primary/20"
          }`}
        >
          <div className={`flex h-5.5 w-5.5 items-center justify-center rounded-none text-[9px] font-black font-mono ${
            step === 3
              ? "bg-primary text-primary-foreground"
              : isExportDone
                ? "bg-emerald-500/20 text-emerald-400"
                : "bg-background border border-border text-muted-foreground/30"
          }`}>
            {isExportDone ? <Check className="h-3 w-3" /> : <LayoutTemplate className="h-3 w-3" />}
          </div>
          <div className="text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.14em] leading-none font-mono">Audio & Assembly</p>
            <p className="mt-0.5 text-[7px] font-medium leading-none text-muted-foreground/40 font-mono">{assemblyLabel}</p>
          </div>
        </button>
      </div>

      <div className="w-[72px]" />
    </div>
  );
}

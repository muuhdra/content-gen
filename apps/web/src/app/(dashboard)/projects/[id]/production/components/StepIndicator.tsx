import React from 'react';
import { Check, ChevronRight, Music } from 'lucide-react';
import type { ProjectScene } from "@/lib/projects-api";

interface StepIndicatorProps {
  step: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  scenes: ProjectScene[];
  isExportDone: boolean;
}

export function StepIndicator({ step, onStepChange, scenes, isExportDone }: StepIndicatorProps) {
  const imagesApproved = scenes.filter((s) => s.approvedImageId).length;
  const videosApproved = scenes.filter((s) => s.approvedVideoId).length;
  
  const allImagesApproved = scenes.length > 0 && imagesApproved === scenes.length;
  const allVideosApproved = scenes.length > 0 && videosApproved === scenes.length;

  return (
    <div className="flex items-center justify-between px-8 py-4 border-b border-white/4 bg-black/40">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 bg-[#9b6dff] rounded-sm" />
        <span className="text-sm font-black uppercase tracking-[0.2em] text-white/90">
          Video<span className="text-[#9b6dff]">SOS</span>
        </span>
        <span className="text-white/10 mx-3">|</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Production Studio</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4">
        {/* Step 1: Images */}
        <button
          onClick={() => onStepChange(1)}
          className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all duration-300 ${
            step === 1
              ? "border-[#9b6dff]/40 bg-[#9b6dff]/10 text-white shadow-lg"
              : "border-white/5 bg-white/2 text-white/40 hover:text-white/80 hover:bg-white/4"
          }`}
        >
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${
            step === 1 ? "bg-[#9b6dff] text-white" : allImagesApproved ? "bg-[#22c55e]/20 text-[#22c55e]" : "bg-white/5 text-white/30"
          }`}>
            {allImagesApproved ? <Check className="h-3 w-3" /> : "1"}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Image Selection</p>
            <p className="text-[8px] font-medium text-white/30 mt-1 leading-none">{imagesApproved}/{scenes.length} approved</p>
          </div>
        </button>

        <ChevronRight className="h-4 w-4 text-white/10" />

        {/* Step 2: Videos */}
        <button
          onClick={() => onStepChange(2)}
          className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all duration-300 ${
            step === 2
              ? "border-[#9b6dff]/40 bg-[#9b6dff]/10 text-white shadow-lg"
              : "border-white/5 bg-white/2 text-white/40 hover:text-white/80"
          }`}
        >
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${
            step === 2 ? "bg-[#9b6dff] text-white" : allVideosApproved ? "bg-[#22c55e]/20 text-[#22c55e]" : "bg-white/5 text-white/20"
          }`}>
            {allVideosApproved ? <Check className="h-3 w-3" /> : "2"}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Video Selection</p>
            <p className="text-[8px] font-medium text-white/30 mt-1 leading-none">{videosApproved}/{scenes.length} approved</p>
          </div>
        </button>

        <ChevronRight className="h-4 w-4 text-white/10" />

        {/* Step 3: Audio & Assembly */}
        <button
          onClick={() => onStepChange(3)}
          className={`flex items-center gap-3 px-5 py-2.5 rounded-xl border transition-all duration-300 ${
            step === 3
              ? "border-[#9b6dff]/40 bg-[#9b6dff]/10 text-white shadow-lg"
              : "border-white/5 bg-white/2 text-white/40 hover:text-white/80"
          }`}
        >
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black ${
            step === 3
              ? "bg-[#9b6dff] text-white"
              : isExportDone
                ? "bg-[#22c55e]/20 text-[#22c55e]"
                : "bg-white/5 text-white/20"
          }`}>
            {isExportDone ? <Check className="h-3 w-3" /> : <Music className="h-3 w-3" />}
          </div>
          <div className="text-left">
            <p className="text-[10px] font-black uppercase tracking-widest leading-none">Audio & Assembly</p>
            <p className="text-[8px] font-medium text-white/30 mt-1 leading-none">
              {isExportDone ? "Export queued ✓" : "Finalization"}
            </p>
          </div>
        </button>
      </div>

      <div className="w-[100px]" />
    </div>
  );
}

"use client";

import React, { useState, startTransition } from 'react';
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Music as MusicIcon, Mic, Volume1, Sparkles } from "lucide-react"

// Specialized Audio Components
import { MusicLab } from "./music/MusicLab"
import { NarrationLab } from "./narration/NarrationLab"
import { SoundsLab } from "./sounds/SoundsLab"

type AudioTabId = "music" | "narration" | "sounds";

export function AudioLab() {
  const [activeSubTab, setActiveSubTab] = useState<AudioTabId>("music");

  const audioTabs: Array<{
    id: AudioTabId;
    label: string;
    icon: typeof MusicIcon;
    hint: string;
  }> = [
    { id: "music", label: "Music", icon: MusicIcon, hint: "Playlist flow" },
    { id: "narration", label: "Narration", icon: Mic, hint: "Voice direction" },
    { id: "sounds", label: "Sounds", icon: Volume1, hint: "SFX pool" },
  ];

  const activeTabMeta = audioTabs.find((tab) => tab.id === activeSubTab) ?? audioTabs[0];

  return (
    <div className="space-y-5 animate-in fade-in duration-700">

      {/* Sub-navigation for Audio (Horizontal) */}
      <Tabs
        value={activeSubTab}
        onValueChange={(value) => startTransition(() => setActiveSubTab(value as AudioTabId))}
        className="w-full space-y-4"
      >
        <div className="space-y-4">
          <div className="flex justify-center">
            <TabsList className="bg-black/5 border border-border/10 p-1 h-auto rounded-[18px] overflow-hidden inline-flex shadow-sm">
              {audioTabs.map((subTab) => (
                <TabsTrigger
                  key={subTab.id}
                  value={subTab.id}
                  className="px-6 py-2 gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:text-foreground data-[state=active]:shadow-md text-foreground/30 transition-all uppercase text-[9px] font-black tracking-[0.2em] outline-none"
                >
                  <subTab.icon className="w-3 h-3" />
                  {subTab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mx-auto flex w-full max-w-[920px] items-center justify-between gap-3 rounded-3xl border border-white/4 bg-[#08080c] px-5 py-4 shadow-xl">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-white/75">
                <Sparkles className="h-3.5 w-3.5 text-[#5c2d91]" />
                <span className="text-[10px] font-black uppercase tracking-[0.22em]">Audio Workflow</span>
              </div>
              <p className="text-[10px] font-medium leading-relaxed text-white/25">
                Work one audio layer at a time, then balance music, narration and SFX before production.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]">
              {activeTabMeta.hint}
            </Badge>
          </div>
        </div>

        {/* Sub-tab Contents */}
        <div className="pt-1">
          <TabsContent value="music" className="outline-none mt-0">
            {activeSubTab === "music" ? <MusicLab /> : null}
          </TabsContent>

          <TabsContent value="narration" className="outline-none mt-0">
            {activeSubTab === "narration" ? <NarrationLab /> : null}
          </TabsContent>

          <TabsContent value="sounds" className="outline-none mt-0">
            {activeSubTab === "sounds" ? <SoundsLab /> : null}
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer Info or Global Audio Settings */}
      <div className="rounded-3xl border border-white/4 bg-[#08080c] px-5 py-4 shadow-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-foreground/15">
            Audio Mastering Engine v2.0
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]">
              48kHz
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]">
              High Fidelity
            </Badge>
            <Badge variant="outline" className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]">
              {activeTabMeta.label}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

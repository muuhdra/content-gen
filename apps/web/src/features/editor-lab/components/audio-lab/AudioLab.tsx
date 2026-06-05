"use client";

import React, { useState, startTransition } from 'react';
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Music as MusicIcon, Mic, Volume1, Sparkles } from "lucide-react"
import { useSearchParams } from "next/navigation"

// Specialized Audio Components
import { MusicLab } from "./music/MusicLab"
import { NarrationLab } from "./narration/NarrationLab"
import { SoundsLab } from "./sounds/SoundsLab"

type AudioTabId = "music" | "narration" | "sounds";

function isAudioTabId(value: string | null): value is AudioTabId {
  return value === "music" || value === "narration" || value === "sounds";
}

export function AudioLab() {
  const searchParams = useSearchParams();
  const [activeSubTab, setActiveSubTab] = useState<AudioTabId>(() => {
    const requestedAudioTab = searchParams.get("audioTab");
    return isAudioTabId(requestedAudioTab) ? requestedAudioTab : "music";
  });

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
            <TabsList className="bg-background border border-border p-1 h-auto rounded-none inline-flex shadow-none">
              {audioTabs.map((subTab) => (
                <TabsTrigger
                  key={subTab.id}
                  value={subTab.id}
                  className="px-6 py-2 gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none text-muted-foreground transition-all uppercase text-[9px] font-black tracking-[0.2em] outline-none font-mono"
                >
                  <subTab.icon className="w-3 h-3" />
                  {subTab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="mx-auto flex w-full max-w-230 items-center justify-between gap-3 rounded-none border border-border bg-card px-5 py-3 shadow-none">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Audio Suite</span>
              <span className="text-[9px] font-medium text-muted-foreground font-mono ml-2 border-l border-border pl-3">
                {activeTabMeta.hint}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono">
                {activeSubTab} lab
              </Badge>
            </div>
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
      <div className="rounded-none bg-transparent mt-4 pt-4 px-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-muted-foreground/40 font-mono">
            Mastering Engine v2.0 // 48kHz Hi-Fi
          </p>
          <div className="hidden sm:flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-border bg-background/50 text-muted-foreground/50 text-[7px] uppercase tracking-[0.18em] rounded-none font-mono">
              Ready
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Sparkles, Volume2, Zap } from "lucide-react";

import { useEditorLab } from "../../editor-lab-context";
import type { SfxDensity } from "./sounds-lab-preset";

const densityOptions: Array<{
  id: SfxDensity;
  label: string;
  hint: string;
}> = [
  { id: "none", label: "None", hint: "No SFX layer in the final mix." },
  { id: "light", label: "Light", hint: "Only a few accent cues across the edit." },
  { id: "medium", label: "Balanced", hint: "A natural amount of support around key moments." },
  { id: "dense", label: "Heavy", hint: "Frequent accents for a more designed edit." },
];

const cueFocusOptions = [
  { id: "impact", label: "Impact Hits", hint: "For reveals, strong beats and key emphasis." },
  { id: "transition", label: "Transitions", hint: "For scene changes, swipes and motion bridges." },
  { id: "notification", label: "Notifications", hint: "For UI beats, alerts and tech moments." },
  { id: "ambient", label: "Ambient Texture", hint: "For subtle movement underneath the edit." },
  { id: "whoosh", label: "Whooshes", hint: "For motion accents and faster camera energy." },
  { id: "ui", label: "UI Clicks", hint: "For interface demos and product interactions." },
] as const;

export function SoundsLab() {
  const { soundsPreset, setSoundsPreset, setActiveTab } = useEditorLab();
  const selectedDensity = densityOptions.find((option) => option.id === soundsPreset.density) ?? densityOptions[2];

  const toggleCueFocus = (cueId: string) => {
    setSoundsPreset((current) => ({
      ...current,
      cueFocus: current.cueFocus.includes(cueId)
        ? current.cueFocus.filter((item) => item !== cueId)
        : [...current.cueFocus, cueId],
    }));
  };

  const selectRecommended = () => {
    setSoundsPreset((current) => ({
      ...current,
      cueFocus: ["impact", "transition", "notification"],
    }));
  };

  const clearCueFocus = () => {
    setSoundsPreset((current) => ({
      ...current,
      cueFocus: [],
    }));
  };

  return (
    <div className="mx-auto grid max-w-[92%] grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] animate-in fade-in duration-700">
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              SFX Setup
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
              This step defines how much sound design the project should use. The actual cues are generated later.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    Enable SFX
                  </h4>
                  <p className="text-[11px] leading-relaxed text-white/25">
                    Turn the sound design layer on or off for this project.
                  </p>
                </div>
                <Switch
                  checked={soundsPreset.enabled}
                  onCheckedChange={(checked) =>
                    setSoundsPreset((current) => ({
                      ...current,
                      enabled: checked,
                    }))
                  }
                  className="data-[state=checked]:bg-[#5c2d91]"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-[#5c2d91]/12 bg-[#0d0a14] p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#5c2d91]/20 bg-[#5c2d91]/10">
                    <Zap className="h-4 w-4 text-[#9b6dff]" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-white/82">Effects Sync</p>
                    <p className="text-[10px] leading-relaxed text-white/24">
                      Reactive motion feels better when SFX and effects are aligned.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="h-9 rounded-xl border-white/10 bg-white/2 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white/40 hover:border-[#5c2d91]/20 hover:bg-[#5c2d91]/15 hover:text-white"
                  onClick={() => setActiveTab("effects")}
                >
                  Effects Lab
                  <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="overflow-hidden rounded-[30px] border-white/5 bg-[#050508] shadow-xl">
          <div className="border-b border-white/5 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white/72">
                  <Volume2 className="h-3.5 w-3.5 text-[#9b6dff]" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">Sound Density</h3>
                </div>
                <p className="text-[10px] font-medium text-white/22">
                  Choose how often the system should place SFX around the edit.
                </p>
              </div>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
              >
                {selectedDensity.label}
              </Badge>
            </div>
          </div>
          <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2">
            {densityOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                disabled={!soundsPreset.enabled}
                onClick={() =>
                  setSoundsPreset((current) => ({
                    ...current,
                    density: option.id,
                  }))
                }
                className={`rounded-[22px] border px-4 py-4 text-left transition-all ${
                  !soundsPreset.enabled
                    ? "cursor-not-allowed border-white/5 bg-white/2 opacity-45"
                    : soundsPreset.density === option.id
                      ? "border-[#5c2d91]/25 bg-[#5c2d91]/8"
                      : "border-white/5 bg-white/2 hover:border-white/10"
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/72">
                  {option.label}
                </span>
                <span className="mt-1 block text-[11px] leading-relaxed text-white/26">
                  {option.hint}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white/72">
                  <Sparkles className="h-3.5 w-3.5 text-[#9b6dff]" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">Cue Focus</h3>
                </div>
                <p className="text-[10px] font-medium text-white/22">
                  Tell the generator what kinds of SFX it should prioritize.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!soundsPreset.enabled}
                  onClick={selectRecommended}
                  className="h-8 rounded-full border border-white/10 bg-white/2 px-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 hover:bg-white/5 hover:text-white/60 disabled:opacity-40"
                >
                  Recommended
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!soundsPreset.enabled}
                  onClick={clearCueFocus}
                  className="h-8 rounded-full border border-white/10 bg-white/2 px-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 hover:bg-white/5 hover:text-white/60 disabled:opacity-40"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>
          <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {cueFocusOptions.map((option) => {
              const isActive = soundsPreset.cueFocus.includes(option.id);

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!soundsPreset.enabled}
                  onClick={() => toggleCueFocus(option.id)}
                  className={`rounded-[22px] border px-4 py-4 text-left transition-all ${
                    !soundsPreset.enabled
                      ? "cursor-not-allowed border-white/5 bg-white/2 opacity-45"
                      : isActive
                        ? "border-[#5c2d91]/25 bg-[#5c2d91]/8"
                        : "border-white/5 bg-white/2 hover:border-white/10"
                  }`}
                >
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/72">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-white/26">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Current Plan
            </h3>
          </div>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]"
              >
                {soundsPreset.enabled ? "SFX Enabled" : "SFX Disabled"}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]"
              >
                {selectedDensity.label}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]"
              >
                {soundsPreset.cueFocus.length} focus tags
              </Badge>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <p className="text-[11px] leading-relaxed text-white/30">
                {soundsPreset.enabled
                  ? soundsPreset.cueFocus.length > 0
                    ? `SFX will be generated later with a ${selectedDensity.label.toLowerCase()} density, prioritizing ${soundsPreset.cueFocus.join(", ")} cues.`
                    : `SFX will be generated later with a ${selectedDensity.label.toLowerCase()} density across the edit.`
                  : "SFX are turned off for this project, so the final audio workflow will rely on music and narration only."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

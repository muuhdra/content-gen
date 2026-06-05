"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Sparkles, Volume2, Zap } from "lucide-react";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
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
        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              SFX Setup
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
              Configure sound design density and cue focus for the final mix.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="rounded-none border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                    Enable SFX
                  </h4>
                  <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
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
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className="rounded-none border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-none border border-border bg-background">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-foreground font-display">Effects Sync</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">
                      Reactive motion feels better when SFX and effects are aligned.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="h-9 rounded-none border-border bg-background px-4 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-foreground font-mono"
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
        <Card className="overflow-hidden rounded-none border border-border bg-black shadow-none">
          <div className=" px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-foreground">
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Sound Density</h3>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground font-mono">
                Frequency of sound design cues across the edit.
              </p>
              </div>
              <Badge
                variant="outline"
                className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
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
                className={`rounded-none border px-4 py-4 text-left transition-all ${
                  !soundsPreset.enabled
                    ? "cursor-not-allowed border-border bg-card opacity-45"
                    : soundsPreset.density === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <span className={`block text-[10px] font-black uppercase tracking-[0.18em] font-mono ${soundsPreset.density === option.id ? "text-primary" : "text-muted-foreground"}`}>
                  {option.label}
                </span>
                <span className={`mt-1 block text-[11px] leading-relaxed font-mono ${soundsPreset.density === option.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                  {option.hint}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Cue Focus</h3>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground font-mono">
                Prioritized SFX categories for the generator.
              </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!soundsPreset.enabled}
                  onClick={selectRecommended}
                  className="h-8 rounded-none border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-primary/10 hover:text-foreground disabled:opacity-40 font-mono"
                >
                  Recommended
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!soundsPreset.enabled}
                  onClick={clearCueFocus}
                  className="h-8 rounded-none border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-primary/10 hover:text-foreground disabled:opacity-40 font-mono"
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
                  className={`rounded-none border px-4 py-4 text-left transition-all ${
                    !soundsPreset.enabled
                      ? "cursor-not-allowed border-border bg-card opacity-45"
                      : isActive
                        ? "border-primary bg-primary/10"
                        : "border-border bg-background hover:border-primary/50"
                  }`}
                >
                  <span className={`block text-[10px] font-black uppercase tracking-[0.18em] font-mono ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {option.label}
                  </span>
                  <span className={`mt-1 block text-[11px] leading-relaxed font-mono ${isActive ? "text-primary/70" : "text-muted-foreground/50"}`}>
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              Current Plan
            </h3>
          </div>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {soundsPreset.enabled ? "SFX Enabled" : "SFX Disabled"}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {selectedDensity.label}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {soundsPreset.cueFocus.length} focus tags
              </Badge>
            </div>

            <div className="rounded-none border border-border bg-background p-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                {soundsPreset.enabled
                  ? `SFX generation configured at ${selectedDensity.label.toLowerCase()} density.`
                  : "SFX layer disabled for this project."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

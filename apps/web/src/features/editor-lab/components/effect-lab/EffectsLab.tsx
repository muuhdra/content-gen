"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Sparkles } from "lucide-react";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
import type { ClipMode, EffectModuleId, MotionStyle } from "./effects-lab-preset";

type EffectModuleConfig = {
  id: EffectModuleId;
  title: string;
  description: string;
  hint: string;
};

const effectModules: EffectModuleConfig[] = [
  {
    id: "reactive-fx",
    title: "Effects + SoundFXs",
    description: "Add stronger motion accents when sound moments hit.",
    hint: "Reactive",
  },
  {
    id: "hook-effect",
    title: "Hook Effect",
    description: "Create a stronger first beat for the opening seconds.",
    hint: "Opening",
  },
  {
    id: "video-ending",
    title: "Video Ending",
    description: "Fade out the final seconds to close more cleanly.",
    hint: "Outro",
  },
];

const motionOptions: Array<{ id: MotionStyle; label: string; hint: string }> = [
  { id: "vertical-pan", label: "Vertical Pan", hint: "Slow vertical movement" },
  { id: "horizontal-pan", label: "Horizontal Pan", hint: "Slow horizontal movement" },
  { id: "zoom-in-out", label: "Zoom In-Out", hint: "Soft alternating zoom" },
];

function getSliderValue(value: number | readonly number[], fallback: number) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return typeof value === "number" ? value : fallback;
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function easeInOut(value: number) {
  return 0.5 - Math.cos(clamp(value) * Math.PI) / 2;
}

function mapRange(value: number, inMin: number, inMax: number) {
  if (inMax <= inMin) {
    return 0;
  }

  return clamp((value - inMin) / (inMax - inMin));
}

type ModuleCardProps = {
  module: EffectModuleConfig;
  active: boolean;
  onToggle: (checked: boolean) => void;
  children?: ReactNode;
};

function ModuleCard({ module, active, onToggle, children }: ModuleCardProps) {
  return (
    <div
      className={`rounded-none border p-4 transition-all ${active
          ? "border-primary bg-primary/10"
          : "border-border bg-card hover:border-primary/50"
        }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground font-display">
              {module.title}
            </h3>
            <Badge
              variant="outline"
              className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
            >
              {module.hint}
            </Badge>
          </div>
          <p className="max-w-70 text-[11px] leading-relaxed text-muted-foreground font-mono">
            {module.description}
          </p>
        </div>
        <Switch
          className="data-[state=checked]:bg-primary"
          checked={active}
          onCheckedChange={onToggle}
        />
      </div>

      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

export function EffectsLab() {
  const { effectsPreset, setEffectsPreset } = useEditorLab();
  const { clipMode, motionStyle, moduleState, videoEndingDuration } = effectsPreset;
  const [previewProgress, setPreviewProgress] = useState(0);

  const activeModules = useMemo(() => {
    return effectModules.filter((module) => moduleState[module.id]);
  }, [moduleState]);

  const selectedMotion = motionOptions.find((option) => option.id === motionStyle) ?? motionOptions[0];

  const toggleModule = (id: EffectModuleId, checked: boolean) => {
    setEffectsPreset((current) => ({
      ...current,
      moduleState: {
        ...current.moduleState,
        [id]: checked,
      },
    }));
  };

  const previewHeadline =
    clipMode === "video"
      ? "Shape motion with cleaner pacing"
      : clipMode === "hybrid"
        ? "Animate key beats, Ken Burns the rest"
        : "Give stills more depth and movement";

  const previewSubline =
    motionStyle === "horizontal-pan"
      ? "Horizontal motion keeps landscapes feeling wider and smoother."
      : motionStyle === "zoom-in-out"
        ? "Soft zooming adds energy without making the frame feel busy."
        : "Vertical movement adds lift while keeping the subject centered.";

  const previewCycleMs = useMemo(() => {
    const base = clipMode === "video" ? 5600 : clipMode === "hybrid" ? 5200 : 4800;
    return base + videoEndingDuration * 220;
  }, [clipMode, videoEndingDuration]);

  useEffect(() => {
    let frameId = 0;
    let startedAt = 0;

    const loop = (timestamp: number) => {
      if (startedAt === 0) {
        startedAt = timestamp;
      }

      const elapsed = (timestamp - startedAt) % previewCycleMs;
      setPreviewProgress(elapsed / previewCycleMs);
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [previewCycleMs]);

  const introEnd = moduleState["hook-effect"] ? 0.18 : 0.08;
  const outroSize = moduleState["video-ending"] ? clamp(videoEndingDuration / 20, 0.1, 0.42) : 0;
  const outroStart = 1 - outroSize;
  const motionStart = introEnd;
  const motionEnd = moduleState["video-ending"] ? outroStart : 1;
  const motionWindowProgress = easeInOut(mapRange(previewProgress, motionStart, motionEnd));
  const introProgress = easeInOut(mapRange(previewProgress, 0, introEnd));
  const outroProgress = easeInOut(mapRange(previewProgress, outroStart, 1));

  const motionTransform =
    motionStyle === "horizontal-pan"
      ? `translate3d(${Math.round(-22 + motionWindowProgress * 44)}px, 0px, 0px)`
      : motionStyle === "zoom-in-out"
        ? `translate3d(0px, ${Math.round(12 - motionWindowProgress * 10)}px, 0px) scale(${1 + motionWindowProgress * 0.12})`
        : `translate3d(0px, ${Math.round(18 - motionWindowProgress * 36)}px, 0px)`;

  const hookTransform = moduleState["hook-effect"]
    ? `scale(${1.1 - introProgress * 0.1}) rotate(${(1 - introProgress) * -1.4}deg)`
    : "scale(1)";
  const stageOpacity = moduleState["video-ending"] ? 1 - outroProgress * 0.88 : 1;
  const reactiveGlowOpacity = moduleState["reactive-fx"]
    ? 0.18 + Math.sin(motionWindowProgress * Math.PI * 4) * 0.08
    : 0.08;
  const timelineFill = `${Math.round(previewProgress * 100)}%`;
  const outroFill = moduleState["video-ending"] ? `${Math.round((1 - outroStart) * 100)}%` : "0%";

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] animate-in fade-in duration-500">
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              Effect Modules
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
              Turn on only the timing cues that improve pacing.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <ModuleCard
              module={effectModules[0]}
              active={moduleState["reactive-fx"]}
              onToggle={(checked) => toggleModule("reactive-fx", checked)}
            />

            <ModuleCard
              module={effectModules[1]}
              active={moduleState["hook-effect"]}
              onToggle={(checked) => toggleModule("hook-effect", checked)}
            />

            <ModuleCard
              module={effectModules[2]}
              active={moduleState["video-ending"]}
              onToggle={(checked) => toggleModule("video-ending", checked)}
            >
              <div className="rounded-none border border-border bg-background p-3">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                  <span>Fade duration</span>
                  <span className="font-mono text-foreground">{videoEndingDuration}s</span>
                </div>
                <div className="mt-2">
                  <Slider
                    value={[videoEndingDuration]}
                    onValueChange={(value) =>
                      setEffectsPreset((current) => ({
                        ...current,
                        videoEndingDuration: getSliderValue(value, 2),
                      }))
                    }
                    min={1}
                    max={10}
                    step={1}
                    disabled={!moduleState["video-ending"]}
                    className="**:[[role=slider]]:bg-primary **:[[role=slider]]:border-primary **:[[role=slider]]:w-5 **:[[role=slider]]:h-5 **:[[role=slider]]:rounded-none"
                  />
                </div>
              </div>
            </ModuleCard>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              Motion Profile
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
              Choose the base movement style for this project.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="flex items-center justify-between gap-1 rounded-none border border-border bg-background p-1">
              {([
                { id: "static", label: "Static", hint: "Ken Burns · le moins cher" },
                { id: "hybrid", label: "Hybride", hint: "Mix auto ~40% animé" },
                { id: "video", label: "Full Vidéo", hint: "Tout animé · premium" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.hint}
                  onClick={() => setEffectsPreset((current) => ({ ...current, clipMode: opt.id as ClipMode }))}
                  className={`flex-1 rounded-none px-2 py-2 text-[9px] font-black uppercase tracking-[0.14em] transition-all font-mono ${clipMode === opt.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[9px] leading-relaxed text-muted-foreground/50 font-mono">
              {clipMode === "static"
                ? "Chaque scène = image animée par Ken Burns. Coût mini, aucune génération vidéo."
                : clipMode === "hybrid"
                  ? "~40% des scènes animées (hook + plans clés), le reste en Ken Burns. Tu ajustes chaque scène à l'étape Motion."
                  : "Toutes les scènes en clips animés. Rendu premium, coût le plus élevé."}
            </p>

            <div className="space-y-2">
              {motionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setEffectsPreset((current) => ({ ...current, motionStyle: option.id as MotionStyle }))}
                  className={`w-full rounded-none border px-4 py-3 text-left transition-all ${motionStyle === option.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:border-primary/50"
                    }`}
                >
                  <span className={`block text-[10px] font-black uppercase tracking-[0.18em] font-mono ${motionStyle === option.id ? "text-primary" : "text-muted-foreground"}`}>
                    {option.label}
                  </span>
                  <span className={`mt-1 block text-[10px] leading-relaxed font-mono ${motionStyle === option.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden rounded-none border border-border bg-black shadow-none">
          <div className=" px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em] font-display">
                Effects Preview
              </span>
            </div>
            <Badge
              variant="outline"
              className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
            >
              {selectedMotion.label}
            </Badge>
          </div>

          <div className="aspect-16/8 min-h-105 relative overflow-hidden bg-background">
            <div className="absolute inset-0 bg-primary/5" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--primary)_0.04,transparent_28%),radial-gradient(circle_at_bottom_right,var(--primary)_0.12,transparent_22%)] opacity-20" />
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary),transparent_32%)] transition-opacity"
              style={{
                opacity: clamp(reactiveGlowOpacity, 0.05, 0.28),
              }}
            />

            <div className="absolute top-5 left-5 flex items-center gap-2 rounded-none border border-border bg-black/30 px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-none bg-primary" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground font-mono">
                Motion stage
              </span>
            </div>

            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <div
                className="max-w-3xl space-y-4 transition-[opacity,transform] duration-150 will-change-transform"
                style={{
                  opacity: stageOpacity,
                  transform: `${motionTransform} ${hookTransform}`,
                }}
              >
                {moduleState["reactive-fx"] ? (
                  <div className="mx-auto flex w-fit items-center gap-2 rounded-none border border-border bg-black/30 px-3 py-1.5">
                    <AlertTriangle className="h-3 w-3 text-primary" />
                    <span className="text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground font-mono">
                      Reactive FX enabled
                    </span>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h2 className="text-[1.2rem] font-black uppercase tracking-tight text-muted-foreground/30 font-display">
                    Clip 02
                  </h2>
                  <p className="text-[1.15rem] font-black uppercase leading-none text-foreground font-display">
                    {previewHeadline}
                  </p>
                  <p className="text-[1.8rem] font-black uppercase leading-none text-foreground font-display">
                    with
                    <span className="ml-3 inline-block bg-primary px-3 py-1 text-primary-foreground font-mono">
                      {selectedMotion.label}
                    </span>
                  </p>
                  <p className="mx-auto max-w-2xl text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                    {previewSubline}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="border-border bg-card text-muted-foreground text-[7px] uppercase tracking-[0.18em] rounded-none font-mono"
                  >
                    {clipMode === "video" ? "Video clips" : "Static clips"}
                  </Badge>
                  {moduleState["hook-effect"] ? (
                    <Badge
                      variant="outline"
                      className="border-border bg-card text-muted-foreground text-[7px] uppercase tracking-[0.18em] rounded-none font-mono"
                    >
                      Hook Effect
                    </Badge>
                  ) : null}
                  {moduleState["video-ending"] ? (
                    <Badge
                      variant="outline"
                      className="border-border bg-card text-muted-foreground text-[7px] uppercase tracking-[0.18em] rounded-none font-mono"
                    >
                      Ending {videoEndingDuration}s
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="absolute inset-x-8 bottom-6 space-y-2">
              <div className="h-1.5 overflow-hidden rounded-none bg-border">
                <div
                  className="h-full rounded-none bg-primary"
                  style={{ width: timelineFill }}
                />
              </div>
              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground font-mono">
                <span>{moduleState["hook-effect"] ? "Hook intro active" : "Standard intro"}</span>
                <span>{moduleState["video-ending"] ? `Fade tail ${outroFill}` : "No fade tail"}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              Active Stack
            </h3>
            <Badge
              variant="outline"
              className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
            >
              {activeModules.length} active
            </Badge>
          </div>
          <CardContent className="space-y-3 p-3.5">
            {activeModules.length > 0 ? (
              activeModules.map((module) => (
                <div
                  key={module.id}
                  className="rounded-none border border-border bg-background px-4 py-3"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground font-mono">
                    {module.title}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground font-mono">
                    {module.id === "video-ending"
                      ? `Fade out for ${videoEndingDuration}s`
                      : module.id === "hook-effect"
                        ? "Opening impact is enabled"
                        : "Reactive accents follow sound moments"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-none border border-dashed border-border bg-background px-4 py-4 text-center">
                <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                  No effect modules are active yet. Turn on a module on the left to shape pacing.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

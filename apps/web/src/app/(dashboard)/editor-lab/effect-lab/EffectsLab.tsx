"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Sparkles } from "lucide-react";

import { useEditorLab } from "../editor-lab-context";
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
      className={`rounded-3xl border p-4 transition-all ${
        active
          ? "border-[#5c2d91]/25 bg-[#0b0a11]"
          : "border-white/4 bg-[#08080c] hover:border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              {module.title}
            </h3>
            <Badge
              variant="outline"
              className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]"
            >
              {module.hint}
            </Badge>
          </div>
          <p className="max-w-[280px] text-[11px] leading-relaxed text-white/24">
            {module.description}
          </p>
        </div>
        <Switch
          className="data-[state=checked]:bg-[#5c2d91]"
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
      : "Give stills more depth and movement";

  const previewSubline =
    motionStyle === "horizontal-pan"
      ? "Horizontal motion keeps landscapes feeling wider and smoother."
      : motionStyle === "zoom-in-out"
        ? "Soft zooming adds energy without making the frame feel busy."
        : "Vertical movement adds lift while keeping the subject centered.";

  const previewCycleMs = useMemo(() => {
    const base = clipMode === "video" ? 5600 : 4800;
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
        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Effect Modules
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
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
              <div className="rounded-2xl border border-white/5 bg-white/2 p-3">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                  <span>Fade duration</span>
                  <span className="font-mono text-white/75">{videoEndingDuration}s</span>
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
                    className="**:[[role=slider]]:bg-white **:[[role=slider]]:border-[#5c2d91] **:[[role=slider]]:w-5 **:[[role=slider]]:h-5"
                  />
                </div>
              </div>
            </ModuleCard>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Motion Profile
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
              Choose the base movement style for this project.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="flex items-center justify-between gap-2 rounded-full border border-white/5 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => setEffectsPreset((current) => ({ ...current, clipMode: "static" as ClipMode }))}
                className={`flex-1 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
                  clipMode === "static" ? "bg-white text-black" : "text-white/30 hover:text-white/55"
                }`}
              >
                Static Clips
              </button>
              <button
                type="button"
                onClick={() => setEffectsPreset((current) => ({ ...current, clipMode: "video" as ClipMode }))}
                className={`flex-1 rounded-full px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
                  clipMode === "video" ? "bg-white text-black" : "text-white/30 hover:text-white/55"
                }`}
              >
                Video Clips
              </button>
            </div>

            <div className="space-y-2">
              {motionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setEffectsPreset((current) => ({ ...current, motionStyle: option.id as MotionStyle }))}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                    motionStyle === option.id
                      ? "border-white/20 bg-white/6"
                      : "border-white/5 bg-white/2 hover:border-white/12"
                  }`}
                >
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/65">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[10px] leading-relaxed text-white/24">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[30px] border-white/5 bg-[#050508] shadow-xl">
          <div className="border-b border-white/5 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/80">
              <Sparkles className="h-4 w-4 text-primary/80" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                Effects Preview
              </span>
            </div>
            <Badge
              variant="outline"
              className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
            >
              {selectedMotion.label}
            </Badge>
          </div>

          <div className="aspect-[16/8] min-h-[420px] relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(92,45,145,0.08),transparent_28%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(92,45,145,0.12),transparent_22%)]" />
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at center, rgba(155,109,255,${clamp(reactiveGlowOpacity, 0.05, 0.28)}), transparent 32%)`,
              }}
            />

            <div className="absolute top-5 left-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-[#9b6dff]" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/45">
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
                  <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
                    <AlertTriangle className="h-3 w-3 text-[#9b6dff]" />
                    <span className="text-[8px] font-black uppercase tracking-[0.22em] text-white/65">
                      Reactive FX enabled
                    </span>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <h2 className="text-[1.2rem] font-black uppercase tracking-tight text-white/18">
                    Clip 02
                  </h2>
                  <p className="text-[1.15rem] font-black uppercase leading-none text-white">
                    {previewHeadline}
                  </p>
                  <p className="text-[1.8rem] font-black uppercase leading-none text-white/95">
                    with
                    <span className="ml-3 inline-block bg-[#9b6dff] px-3 py-1 text-black">
                      {selectedMotion.label}
                    </span>
                  </p>
                  <p className="mx-auto max-w-2xl text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
                    {previewSubline}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className="border-white/10 bg-white/2 text-white/35 text-[7px] uppercase tracking-[0.18em]"
                  >
                    {clipMode === "video" ? "Video clips" : "Static clips"}
                  </Badge>
                  {moduleState["hook-effect"] ? (
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/2 text-white/35 text-[7px] uppercase tracking-[0.18em]"
                    >
                      Hook Effect
                    </Badge>
                  ) : null}
                  {moduleState["video-ending"] ? (
                    <Badge
                      variant="outline"
                      className="border-white/10 bg-white/2 text-white/35 text-[7px] uppercase tracking-[0.18em]"
                    >
                      Ending {videoEndingDuration}s
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="absolute inset-x-8 bottom-6 space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#9b6dff,rgba(255,255,255,0.92))]"
                  style={{ width: timelineFill }}
                />
              </div>
              <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-[0.18em] text-white/28">
                <span>{moduleState["hook-effect"] ? "Hook intro active" : "Standard intro"}</span>
                <span>{moduleState["video-ending"] ? `Fade tail ${outroFill}` : "No fade tail"}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Active Stack
            </h3>
            <Badge
              variant="outline"
              className="border-white/10 bg-white/2 text-white/30 text-[8px] uppercase tracking-[0.18em]"
            >
              {activeModules.length} active
            </Badge>
          </div>
          <CardContent className="space-y-3 p-3.5">
            {activeModules.length > 0 ? (
              activeModules.map((module) => (
                <div
                  key={module.id}
                  className="rounded-2xl border border-white/5 bg-white/2 px-4 py-3"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/28">
                    {module.title}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-white/55">
                    {module.id === "video-ending"
                      ? `Fade out for ${videoEndingDuration}s`
                      : module.id === "hook-effect"
                        ? "Opening impact is enabled"
                        : "Reactive accents follow sound moments"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/2 px-4 py-4">
                <p className="text-[11px] leading-relaxed text-white/40">
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

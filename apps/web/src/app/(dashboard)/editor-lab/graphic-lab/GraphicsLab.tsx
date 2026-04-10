"use client";

import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Activity, Layers3, Sparkles } from "lucide-react";

import { useEditorLab } from "../editor-lab-context";
import type { GraphicModuleId } from "./graphics-lab-preset";

type GraphicModuleConfig = {
  id: GraphicModuleId;
  title: string;
  description: string;
  hint: string;
  variants: string[];
};

const graphicModules: GraphicModuleConfig[] = [
  {
    id: "text-reveal",
    title: "Text Reveal",
    description: "Emphasize the strongest words with bold on-screen motion.",
    hint: "Hook moments",
    variants: ["Viral", "Editorial", "Punch"],
  },
  {
    id: "lower-third",
    title: "Lower Third",
    description: "Introduce a speaker, source or scene with clean context.",
    hint: "Context tag",
    variants: ["Minimal", "Anchor", "Ticker"],
  },
  {
    id: "stat-counter",
    title: "Stat Counter",
    description: "Highlight a number, growth signal or proof point.",
    hint: "Metric burst",
    variants: ["Burst", "Board", "Pulse"],
  },
];

const captionColorThemes = {
  red: {
    accent: "#ef4444",
    accentSurface: "rgba(239,68,68,0.16)",
    accentSoft: "#fff2f2",
  },
  yellow: {
    accent: "#facc15",
    accentSurface: "rgba(250,204,21,0.18)",
    accentSoft: "#fffde8",
  },
  green: {
    accent: "#22c55e",
    accentSurface: "rgba(34,197,94,0.16)",
    accentSoft: "#effff4",
  },
  blue: {
    accent: "#3b82f6",
    accentSurface: "rgba(59,130,246,0.16)",
    accentSoft: "#eef6ff",
  },
  purple: {
    accent: "#9b6dff",
    accentSurface: "rgba(155,109,255,0.18)",
    accentSoft: "#f8f5ff",
  },
} as const;

const captionTypographyStyles = {
  bold: {
    fontFamily: '"Arial Black", Impact, sans-serif',
    transformClass: "italic skew-x-[-8deg]",
  },
  inter: {
    fontFamily: 'Inter, "Helvetica Neue", sans-serif',
    transformClass: "",
  },
  serif: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    transformClass: "",
  },
  mono: {
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace',
    transformClass: "",
  },
  condensed: {
    fontFamily: '"Arial Narrow", "Roboto Condensed", sans-serif',
    transformClass: "",
  },
  typewriter: {
    fontFamily: '"American Typewriter", Georgia, serif',
    transformClass: "",
  },
} as const;

type ModuleCardProps = {
  module: GraphicModuleConfig;
  active: boolean;
  currentVariant: string;
  focused: boolean;
  accentColor: string;
  accentSurface: string;
  onFocus: () => void;
  onToggle: (checked: boolean) => void;
  onVariantSelect: (variant: string) => void;
};

function ModuleCard({
  module,
  active,
  currentVariant,
  focused,
  onFocus,
  onToggle,
  onVariantSelect,
  accentColor,
  accentSurface,
}: ModuleCardProps) {
  return (
    <div
      className={`rounded-3xl border p-4 transition-all ${
        focused
          ? "bg-[#0b0a11]"
          : "border-white/4 bg-[#08080c] hover:border-white/10"
      }`}
      style={
        focused
          ? {
              borderColor: accentColor,
              boxShadow: `0 0 0 1px ${accentSurface} inset`,
            }
          : undefined
      }
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
          <p className="max-w-[260px] text-[11px] leading-relaxed text-white/24">
            {module.description}
          </p>
        </div>
        <Switch
          className="data-[state=checked]:bg-[#5c2d91]"
          checked={active}
          onCheckedChange={onToggle}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onFocus}
          className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all ${
            focused
              ? "border-white bg-white text-black"
              : "border-white/10 bg-white/2 text-white/40 hover:border-white/20 hover:text-white/70"
          }`}
        >
          {focused ? "Previewing" : "Preview"}
        </button>

        {module.variants.map((variant) => (
          <button
            key={variant}
            type="button"
            onClick={() => onVariantSelect(variant)}
            className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all ${
              currentVariant === variant
                ? ""
                : "border-white/10 bg-white/2 text-white/30 hover:border-white/20 hover:text-white/65"
            }`}
            style={
              currentVariant === variant
                ? {
                    borderColor: accentColor,
                    backgroundColor: accentSurface,
                    color: accentColor,
                  }
                : undefined
            }
          >
            {variant}
          </button>
        ))}
      </div>
    </div>
  );
}

function renderTextReveal(variant: string, options: { accent: string; accentSoft: string; fontFamily: string; transformClass: string; cadence: string }) {
  const label =
    variant === "Editorial"
      ? "Context turns into clarity"
      : variant === "Punch"
        ? "Make each keyword hit"
        : "Stop the scroll faster";
  const accent = variant === "Editorial" ? "precision" : variant === "Punch" ? "impact" : "attention";

  return (
    <div className="space-y-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/28">
        Text Reveal
      </p>
      <div className="space-y-2">
        <p
          className={`text-[1.1rem] font-black uppercase leading-none text-white ${options.transformClass}`}
          style={{ fontFamily: options.fontFamily }}
        >
          {label}
        </p>
        <p
          className={`text-[1.7rem] font-black uppercase leading-none text-white/95 ${options.transformClass}`}
          style={{ fontFamily: options.fontFamily }}
        >
          with
          <span
            className="ml-3 inline-block rounded-full px-3 py-1 text-black"
            style={{ backgroundColor: options.accent }}
          >
            {accent}
          </span>
        </p>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: options.accentSoft }}>
        {variant} preset synced with {options.cadence}
      </p>
    </div>
  );
}

function renderLowerThird(
  variant: string,
  options: { accent: string; fontFamily: string; positionClass: string; positionLabel: string }
) {
  const tone =
    variant === "Anchor"
      ? "Studio anchor"
      : variant === "Ticker"
        ? "Live update"
        : "Minimal ID";

  return (
    <div className={`absolute inset-x-10 ${options.positionClass}`}>
      <div className="rounded-3xl border border-white/10 bg-black/45 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: options.accent }}>
              {tone}
            </p>
            <p className="text-lg font-black uppercase tracking-tight text-white" style={{ fontFamily: options.fontFamily }}>
              Maya Chen
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/45">
              AI Product Analyst · {options.positionLabel}
            </p>
          </div>
          <Layers3 className="mt-1 h-4 w-4" style={{ color: options.accent }} />
        </div>
      </div>
    </div>
  );
}

function renderStatCounter(
  variant: string,
  options: { accent: string; accentSoft: string; fontFamily: string }
) {
  const value = variant === "Board" ? "24.7K" : variant === "Pulse" ? "+68%" : "+247%";
  const label =
    variant === "Board" ? "Qualified views" : variant === "Pulse" ? "Retention lift" : "CTR growth";

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/35 px-5 py-4 text-left backdrop-blur-sm">
      <div className="flex items-center gap-2 text-white/35">
        <Activity className="h-4 w-4" style={{ color: options.accent }} />
        <span className="text-[8px] font-black uppercase tracking-[0.2em]">
          Stat Counter
        </span>
      </div>
      <p className="mt-3 text-[2rem] font-black leading-none text-white" style={{ fontFamily: options.fontFamily }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: options.accentSoft }}>
        {label}
      </p>
    </div>
  );
}

export function GraphicsLab() {
  const { captionPreset, graphicsPreset, setGraphicsPreset } = useEditorLab();
  const { focusedModuleId, moduleState, variantState } = graphicsPreset;

  const focusedModule = graphicModules.find((module) => module.id === focusedModuleId) ?? graphicModules[0];
  const activeModules = useMemo(
    () => graphicModules.filter((module) => moduleState[module.id]),
    [moduleState]
  );

  const toggleModule = (id: GraphicModuleId, checked: boolean) => {
    setGraphicsPreset((current) => {
      const nextModuleState = { ...current.moduleState, [id]: checked };
      let nextFocusedModuleId = current.focusedModuleId;

      if (!checked && current.focusedModuleId === id) {
        nextFocusedModuleId =
          graphicModules.find((module) => nextModuleState[module.id])?.id ??
          graphicModules.find((module) => module.id !== id)?.id ??
          id;
      }

      if (checked) {
        nextFocusedModuleId = id;
      }

      return {
        ...current,
        focusedModuleId: nextFocusedModuleId,
        moduleState: nextModuleState,
      };
    });
  };

  const selectVariant = (id: GraphicModuleId, variant: string) => {
    setGraphicsPreset((current) => ({
      ...current,
      focusedModuleId: id,
      moduleState: {
        ...current.moduleState,
        [id]: true,
      },
      variantState: {
        ...current.variantState,
        [id]: variant,
      },
    }));
  };

  const previewTitle = moduleState[focusedModuleId]
    ? `${focusedModule.title} / ${variantState[focusedModuleId]}`
    : `${focusedModule.title} is off`;
  const captionTheme = captionColorThemes[captionPreset.colorStyle];
  const captionTypography = captionTypographyStyles[captionPreset.typography];
  const lowerThirdPlacement =
    captionPreset.captionPosition === "bottom" || captionPreset.captionPosition === "custom"
      ? { positionClass: "top-10", positionLabel: "shifted above captions" }
      : { positionClass: "bottom-10", positionLabel: "clear of caption zone" };
  const captionSyncLabel = `${
    captionPreset.typography === "typewriter"
      ? "American Typewriter"
      : captionPreset.typography.charAt(0).toUpperCase() + captionPreset.typography.slice(1)
  } / ${captionPreset.colorStyle} / ${captionPreset.wordByWord ? "word-by-word" : "full-line"}`;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] animate-in fade-in duration-500">
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Graphic Modules
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
              Turn on only the overlays that help readability and emphasis.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            {graphicModules.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                active={moduleState[module.id]}
                currentVariant={variantState[module.id]}
                focused={focusedModuleId === module.id}
                onFocus={() => setGraphicsPreset((current) => ({ ...current, focusedModuleId: module.id }))}
                onToggle={(checked) => toggleModule(module.id, checked)}
                onVariantSelect={(variant) => selectVariant(module.id, variant)}
                accentColor={captionTheme.accent}
                accentSurface={captionTheme.accentSurface}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[30px] border-white/5 bg-[#050508] shadow-xl">
          <div className="border-b border-white/5 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/80">
              <Sparkles className="h-4 w-4 text-primary/80" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                Graphics Preview
              </span>
            </div>
            <Badge
              variant="outline"
              className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
            >
              {previewTitle}
            </Badge>
          </div>

          <div className="border-b border-white/5 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
              >
                Synced from captions
              </Badge>
              <span className="text-[10px] font-medium text-white/35">
                {captionSyncLabel}
              </span>
            </div>
          </div>

          <div className="aspect-[16/8] min-h-[420px] relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(92,45,145,0.08),transparent_28%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(92,45,145,0.12),transparent_22%)]" />

            <div className="absolute top-5 left-5 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: captionTheme.accent }} />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/45">
                Overlay stage
              </span>
            </div>

            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              {moduleState[focusedModuleId] ? (
                <>
                  {focusedModuleId === "text-reveal"
                    ? renderTextReveal(variantState["text-reveal"], {
                        accent: captionTheme.accent,
                        accentSoft: captionTheme.accentSoft,
                        fontFamily: captionTypography.fontFamily,
                        transformClass: captionTypography.transformClass,
                        cadence: captionPreset.wordByWord ? "word-by-word pacing" : "full-line pacing",
                      })
                    : null}
                  {focusedModuleId === "stat-counter"
                    ? renderStatCounter(variantState["stat-counter"], {
                        accent: captionTheme.accent,
                        accentSoft: captionTheme.accentSoft,
                        fontFamily: captionTypography.fontFamily,
                      })
                    : null}
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/25">
                    Preview paused
                  </p>
                  <p className="text-lg font-bold text-white/55">
                    Enable a module to see how the overlay will look.
                  </p>
                </div>
              )}
            </div>

            {moduleState["lower-third"]
              ? renderLowerThird(variantState["lower-third"], {
                  accent: captionTheme.accent,
                  fontFamily: captionTypography.fontFamily,
                  positionClass: lowerThirdPlacement.positionClass,
                  positionLabel: lowerThirdPlacement.positionLabel,
                })
              : null}
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
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/28">
                        {module.title}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-white/55">
                        {variantState[module.id]} preset active
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGraphicsPreset((current) => ({ ...current, focusedModuleId: module.id }))}
                      className="rounded-full border border-white/10 bg-white/2 px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
                    >
                      Focus
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/2 px-4 py-4">
                <p className="text-[11px] leading-relaxed text-white/40">
                  No graphics are active yet. Turn on a module on the left to build the overlay stack.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

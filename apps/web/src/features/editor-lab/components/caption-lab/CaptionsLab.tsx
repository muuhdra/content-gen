"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { CaptionsOff, Type, Activity, Layers3, Sparkles } from "lucide-react";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
import {
  type AnimationStyle,
  type CaptionLabPreset,
  type CaptionPosition,
  type ColorStyle,
  type TypographyStyle,
} from "./caption-lab-preset";

import type { GraphicModuleId } from "../graphic-lab/graphics-lab-preset";

// ==========================================
// SUBTITLES / CAPTIONS CONFIGS
// ==========================================
const captionPositions = [
  { label: "Top", value: "top" as const, hint: "Upper framing" },
  { label: "Center", value: "center" as const, hint: "Story focus" },
  { label: "Bottom", value: "bottom" as const, hint: "Classic subtitle" },
  { label: "Social", value: "custom" as const, hint: "Raised lower third" },
];

const animationOptions: Array<{ id: AnimationStyle; label: string; hint: string }> = [
  { id: "none", label: "None", hint: "Static captions" },
  { id: "pop", label: "Pop", hint: "Punchy emphasis" },
  { id: "slide", label: "Slide", hint: "Smooth motion" },
  { id: "reveal", label: "Reveal", hint: "Progressive entry" },
  { id: "bounce", label: "Bounce", hint: "Playful rhythm" },
];

const typographyOptions: Array<{ id: TypographyStyle; label: string; sample: string }> = [
  { id: "bold", label: "Bold", sample: "Impact" },
  { id: "inter", label: "Clean", sample: "Modern" },
  { id: "serif", label: "Serif", sample: "Story" },
  { id: "mono", label: "Mono", sample: "Tech" },
  { id: "condensed", label: "Condensed", sample: "Headline" },
  { id: "typewriter", label: "American Typewriter", sample: "Classic" },
];

const colorThemes = {
  red: {
    chip: "Red",
    caption: "#fff2f2",
    accent: "#ef4444",
    titleBg: "bg-[#ef4444] text-white",
  },
  yellow: {
    chip: "Yellow",
    caption: "#fffde8",
    accent: "#facc15",
    titleBg: "bg-[#facc15] text-black",
  },
  green: {
    chip: "Green",
    caption: "#effff4",
    accent: "#22c55e",
    titleBg: "bg-[#22c55e] text-white",
  },
  blue: {
    chip: "Blue",
    caption: "#eef6ff",
    accent: "#3b82f6",
    titleBg: "bg-[#3b82f6] text-white",
  },
  purple: {
    chip: "Purple",
    caption: "#f8f5ff",
    accent: "#9b6dff",
    titleBg: "bg-[#9b6dff] text-white",
  },
} as const satisfies Record<ColorStyle, { chip: string; caption: string; accent: string; titleBg: string }>;

const typographyStyles: Record<TypographyStyle, { fontFamily: string; transformClass: string; labelClass: string }> = {
  bold: {
    fontFamily: '"Arial Black", Impact, sans-serif',
    transformClass: "italic skew-x-[-10deg]",
    labelClass: "tracking-[0.02em]",
  },
  inter: {
    fontFamily: 'Inter, "Helvetica Neue", sans-serif',
    transformClass: "",
    labelClass: "tracking-tight",
  },
  serif: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    transformClass: "",
    labelClass: "tracking-[0.01em]",
  },
  mono: {
    fontFamily: '"IBM Plex Mono", "SFMono-Regular", monospace',
    transformClass: "",
    labelClass: "tracking-[0.08em]",
  },
  condensed: {
    fontFamily: '"Arial Narrow", "Roboto Condensed", sans-serif',
    transformClass: "",
    labelClass: "tracking-[0.05em]",
  },
  typewriter: {
    fontFamily: '"American Typewriter", Georgia, serif',
    transformClass: "",
    labelClass: "tracking-[0.03em]",
  },
};

function getAnimationTransform(animationStyle: AnimationStyle, animationIntensity: number) {
  if (animationStyle === "pop") {
    return `scale(${1 + animationIntensity / 1100})`;
  }

  if (animationStyle === "slide") {
    return `translateY(${Math.max(4, Math.round(animationIntensity / 8))}px)`;
  }

  if (animationStyle === "reveal") {
    return `translateY(${Math.max(6, Math.round(animationIntensity / 7))}px) scale(0.99)`;
  }

  if (animationStyle === "bounce") {
    return `translateY(-${Math.max(4, Math.round(animationIntensity / 9))}px) scale(${1 + animationIntensity / 1800})`;
  }

  return "none";
}

function getAnimationOpacity(animationStyle: AnimationStyle, animationIntensity: number) {
  if (animationStyle === "reveal") {
    return Math.min(1, 0.78 + animationIntensity / 220);
  }

  return 1;
}

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

function getEditableCaptionPreset(preset: CaptionLabPreset) {
  return {
    captionPosition: preset.captionPosition,
    animationStyle: preset.animationStyle,
    animationIntensity: preset.animationIntensity,
    wordByWord: preset.wordByWord,
    wordHighlight: preset.wordHighlight,
    typography: preset.typography,
    textSize: preset.textSize,
    letterSpacing: preset.letterSpacing,
    colorStyle: preset.colorStyle,
  };
}

function editablePresetsMatch(left: CaptionLabPreset, right: CaptionLabPreset) {
  const leftPreset = getEditableCaptionPreset(left);
  const rightPreset = getEditableCaptionPreset(right);

  return Object.keys(leftPreset).every((key) => {
    const presetKey = key as keyof typeof leftPreset;
    return leftPreset[presetKey] === rightPreset[presetKey];
  });
}

// ==========================================
// GRAPHIC OVERLAYS CONFIGS & HELPERS
// ==========================================
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
    description: "Bold on-screen motion for keyword emphasis.",
    hint: "Hook moments",
    variants: ["Viral", "Editorial", "Punch"],
  },
  {
    id: "lower-third",
    title: "Lower Third",
    description: "Speaker IDs and contextual scene tags.",
    hint: "Context tag",
    variants: ["Minimal", "Anchor", "Ticker"],
  },
  {
    id: "stat-counter",
    title: "Stat Counter",
    description: "Metric bursts for proof points and growth.",
    hint: "Metric burst",
    variants: ["Burst", "Board", "Pulse"],
  },
];

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
  onPreview: () => void;
  onToggle: (checked: boolean) => void;
  onVariantSelect: (variant: string) => void;
};

function ModuleCard({
  module,
  active,
  currentVariant,
  focused,
  onPreview,
  onToggle,
  onVariantSelect,
}: ModuleCardProps) {
  return (
    <div
      className={`rounded-none border p-3.5 transition-all ${focused
          ? "border-primary bg-primary/8"
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
          <p className="max-w-[260px] text-[11px] leading-relaxed text-muted-foreground font-mono">
            {module.description}
          </p>
        </div>
        <Switch
          className="data-[state=checked]:bg-primary"
          checked={active}
          onCheckedChange={onToggle}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onPreview}
          className={`rounded-none border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all font-mono ${focused
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
            }`}
        >
          {focused && active ? "Previewing" : "Preview"}
        </button>

        {module.variants.map((variant) => (
          <button
            key={variant}
            type="button"
            onClick={() => onVariantSelect(variant)}
            className={`rounded-none border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all font-mono ${currentVariant === variant
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
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
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
        Text Reveal
      </p>
      <div className="space-y-2">
        <p
          className={`text-[1.1rem] font-black uppercase leading-none text-foreground ${options.transformClass}`}
          style={{ fontFamily: options.fontFamily }}
        >
          {label}
        </p>
        <p
          className={`text-[1.7rem] font-black uppercase leading-none text-foreground ${options.transformClass}`}
          style={{ fontFamily: options.fontFamily }}
        >
          with
          <span
            className="ml-3 inline-block rounded-full px-3 py-1 text-black font-mono font-black"
            style={{ backgroundColor: options.accent }}
          >
            {accent}
          </span>
        </p>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/70">
        {variant} preset synced with {options.cadence}
      </p>
    </div>
  );
}

function renderLowerThird(
  variant: string,
  options: { accent: string; fontFamily: string; positionClass: string; positionLabel: string; progress: number }
) {
  const tone =
    variant === "Anchor"
      ? "Studio anchor"
      : variant === "Ticker"
        ? "Live update"
        : "Minimal ID";

  return (
    <div
      className={`absolute inset-x-10 ${options.positionClass}`}
      style={{
        opacity: 0.5 + easeInOut(options.progress) * 0.5,
        transform: `translate3d(${Math.round((1 - easeInOut(options.progress)) * -40)}px, 0px, 0px)`,
      }}
    >
      <div className="rounded-none border border-border bg-card/90 px-4 py-3 backdrop-blur-sm shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 text-left">
            <p className="text-[9px] font-black uppercase tracking-[0.2em]" style={{ color: options.accent }}>
              {tone}
            </p>
            <p className="text-lg font-black uppercase tracking-tight text-foreground" style={{ fontFamily: options.fontFamily }}>
              Maya Chen
            </p>
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground font-mono">
              AI Product Analyst · {options.positionLabel}
            </p>
          </div>
          <Layers3 className="mt-1 h-4 w-4 shrink-0" style={{ color: options.accent }} />
        </div>
      </div>
    </div>
  );
}

function renderStatCounter(
  variant: string,
  options: { accent: string; accentSoft: string; fontFamily: string; progress: number }
) {
  const target = variant === "Board" ? 24_700 : variant === "Pulse" ? 68 : 247;
  const currentValue = Math.round(target * (0.2 + easeInOut(options.progress) * 0.8));
  const value =
    variant === "Board"
      ? `${(currentValue / 1000).toFixed(1)}K`
      : `${currentValue > 0 ? "+" : ""}${currentValue}%`;
  const label =
    variant === "Board" ? "Qualified views" : variant === "Pulse" ? "Retention lift" : "CTR growth";

  return (
    <div className="rounded-none border border-border bg-card/85 px-4 py-3 text-left backdrop-blur-sm shadow-none">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Activity className="h-4 w-4" style={{ color: options.accent }} />
        <span className="text-[8px] font-black uppercase tracking-[0.2em]">
          Stat Counter
        </span>
      </div>
      <p className="mt-3 text-[2rem] font-black leading-none text-foreground" style={{ fontFamily: options.fontFamily }}>
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: options.accentSoft }}>
        {label}
      </p>
    </div>
  );
}

// ==========================================
// CORE COMPONENT
// ==========================================
export function CaptionsLab() {
  const {
    captionsEnabled,
    setCaptionsEnabled,
    captionPreset,
    captionPresetVersion,
    setCaptionPreset,
    graphicsPreset,
    setGraphicsPreset
  } = useEditorLab();

  // Sub Tab Selector state
  const [subTab, setSubTab] = useState<"subtitles" | "overlays">("subtitles");

  // ==========================================
  // SUBTITLES / CAPTIONS STATES & EFFECTS
  // ==========================================
  const syncTimeoutRef = useRef<number | null>(null);
  const [previewProgress, setPreviewProgress] = useState(0);

  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>(captionPreset.captionPosition);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>(captionPreset.animationStyle);
  const [animationIntensity, setAnimationIntensity] = useState(captionPreset.animationIntensity);
  const [wordByWord, setWordByWord] = useState(captionPreset.wordByWord);
  const [wordHighlight, setWordHighlight] = useState(captionPreset.wordHighlight);
  const [typography, setTypography] = useState<TypographyStyle>(captionPreset.typography);
  const [textSize, setTextSize] = useState(captionPreset.textSize);
  const [letterSpacing, setLetterSpacing] = useState(captionPreset.letterSpacing);
  const [colorStyle, setColorStyle] = useState<ColorStyle>(captionPreset.colorStyle);

  const currentPreset = useMemo<CaptionLabPreset>(() => ({
    ...captionPreset,
    captionPosition,
    animationStyle,
    animationIntensity,
    wordByWord,
    wordHighlight,
    typography,
    textSize,
    letterSpacing,
    colorStyle,
  }), [
    animationIntensity,
    animationStyle,
    captionPreset,
    captionPosition,
    colorStyle,
    letterSpacing,
    textSize,
    typography,
    wordByWord,
    wordHighlight,
  ]);

  const latestPresetRef = useRef(currentPreset);

  useEffect(() => {
    latestPresetRef.current = currentPreset;
  }, [currentPreset]);

  const applyPreset = (preset: CaptionLabPreset) => {
    setCaptionPosition(preset.captionPosition);
    setAnimationStyle(preset.animationStyle);
    setAnimationIntensity(preset.animationIntensity);
    setWordByWord(preset.wordByWord);
    setWordHighlight(preset.wordHighlight);
    setTypography(preset.typography);
    setTextSize(preset.textSize);
    setLetterSpacing(preset.letterSpacing);
    setColorStyle(preset.colorStyle);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      applyPreset(captionPreset);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [captionPreset, captionPresetVersion]);

  useEffect(() => {
    if (!editablePresetsMatch(currentPreset, captionPreset)) {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }

      syncTimeoutRef.current = window.setTimeout(() => {
        setCaptionPreset(latestPresetRef.current);
      }, 180);
    }

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [captionPreset, currentPreset, setCaptionPreset]);

  const previewCycleMs = useMemo(() => {
    const motionWeight =
      animationStyle === "none"
        ? 6200
        : animationStyle === "bounce"
          ? 4600
          : animationStyle === "reveal"
            ? 5200
            : 5000;

    return Math.max(3600, motionWeight - animationIntensity * 8);
  }, [animationIntensity, animationStyle]);

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

  const currentTheme = colorThemes[colorStyle as keyof typeof colorThemes] || colorThemes.yellow;
  const typographyStyle = typographyStyles[typography] || typographyStyles.inter;
  const previewWords = ["Keep", "every", "caption", "clear", "fast", "and", "easy", "to", "follow"];
  const animatedWordIndex = Math.floor(previewProgress * previewWords.length) % previewWords.length;
  const activeWordIndex = wordHighlight ? animatedWordIndex : -1;
  const wordRevealProgress = previewProgress * previewWords.length;
  const motionPhase = Math.sin(previewProgress * Math.PI * 2);
  const easedMotion = easeInOut(previewProgress);
  const previewPositionClass: Record<CaptionPosition, string> = {
    top: "justify-start pt-16",
    center: "justify-center",
    bottom: "justify-end pb-16",
    custom: "justify-end pb-28",
  };
  const positionClass = previewPositionClass[captionPosition];

  // ==========================================
  // GRAPHIC OVERLAYS STATES & EFFECTS
  // ==========================================
  const { enabled: graphicsEnabled, focusedModuleId, moduleState, variantState } = graphicsPreset;
  const [graphicsPreviewProgress, setGraphicsPreviewProgress] = useState(0);

  const focusedModule = graphicModules.find((module) => module.id === focusedModuleId) ?? graphicModules[0];
  const activeModules = useMemo(
    () => (graphicsEnabled ? graphicModules.filter((module) => moduleState[module.id]) : []),
    [graphicsEnabled, moduleState]
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
  const captionTypography = captionTypographyStyles[captionPreset.typography as keyof typeof captionTypographyStyles] || captionTypographyStyles.inter;
  const graphicsAccent = "hsl(var(--primary))";
  const graphicsAccentSoft = "hsl(var(--primary) / 0.16)";
  const lowerThirdPlacement =
    captionPreset.captionPosition === "bottom" || captionPreset.captionPosition === "custom"
      ? { positionClass: "top-10", positionLabel: "shifted above captions" }
      : { positionClass: "bottom-10", positionLabel: "clear of caption zone" };
  const captionSyncLabel = `${captionPreset.typography === "typewriter"
      ? "American Typewriter"
      : captionPreset.typography.charAt(0).toUpperCase() + captionPreset.typography.slice(1)
    } / ${captionPreset.colorStyle} / ${captionPreset.wordByWord ? "word-by-word" : "full-line"}`;
  const graphicsPreviewCycleMs = 5200;

  useEffect(() => {
    let frameId = 0;
    let startedAt = 0;

    const loop = (timestamp: number) => {
      if (startedAt === 0) {
        startedAt = timestamp;
      }

      const elapsed = (timestamp - startedAt) % graphicsPreviewCycleMs;
      setGraphicsPreviewProgress(elapsed / graphicsPreviewCycleMs);
      frameId = window.requestAnimationFrame(loop);
    };

    frameId = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const previewMotionProgress = easeInOut(graphicsPreviewProgress);
  const previewPulse = 0.08 + Math.sin(graphicsPreviewProgress * Math.PI * 4) * 0.04;
  const previewStageTransform =
    focusedModuleId === "text-reveal"
      ? `translate3d(0px, ${Math.round((0.5 - previewMotionProgress) * 14)}px, 0px) scale(${1 + previewPulse})`
      : focusedModuleId === "stat-counter"
        ? `translate3d(0px, ${Math.round((0.5 - previewMotionProgress) * 10)}px, 0px)`
        : "translate3d(0px, 0px, 0px)";

  // ==========================================
  // UNIFIED RENDER
  // ==========================================
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Sub Tabs Switcher */}
      <div className="flex justify-start border-b border-border/60 pb-1.5 gap-2">
        <button
          type="button"
          onClick={() => setSubTab("subtitles")}
          className={`px-4 py-2 border-b-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all font-mono -mb-px ${subTab === "subtitles"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          Subtitles Styling
        </button>
        <button
          type="button"
          onClick={() => setSubTab("overlays")}
          className={`px-4 py-2 border-b-2 text-[9px] font-black uppercase tracking-[0.2em] transition-all font-mono -mb-px ${subTab === "overlays"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
        >
          Graphic Overlays
        </button>
      </div>

      {subTab === "subtitles" ? (
        // ==========================================
        // SUBTITLES VIEW (ORIGINAL LAYOUT)
        // ==========================================
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
              <div className=" px-4 py-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">Captions Layer</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                  Toggle global subtitle state for this project.
                </p>
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between rounded-none border border-border bg-background px-3 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-mono">
                      {captionsEnabled ? "Captions enabled" : "Captions disabled"}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground font-mono">
                      {captionsEnabled ? "Caption styling and pacing are active." : "Pacing, palette and typography controls are hidden."}
                    </p>
                  </div>
                  <Switch className="data-[state=checked]:bg-primary" checked={captionsEnabled} onCheckedChange={setCaptionsEnabled} />
                </div>
              </CardContent>
            </Card>

            {captionsEnabled ? (
              <>
                <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                  <div className=" px-4 py-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">Layout</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                      Vertical positioning in frame.
                    </p>
                  </div>
                  <CardContent className="space-y-2.5 p-3">
                    {captionPositions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setCaptionPosition(option.value)}
                        className={`w-full rounded-none border px-3 py-3 text-left transition-all ${captionPosition === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-[0.18em] font-mono">{option.label}</span>
                          <span className={`text-[8px] font-bold uppercase tracking-[0.18em] font-mono ${captionPosition === option.value ? "text-primary/70" : "text-muted-foreground/50"}`}>
                            {option.hint}
                          </span>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                  <div className=" px-4 py-3">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">Pacing & Motion</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                      Rhythm and entry animations for captions.
                    </p>
                  </div>
                  <CardContent className="space-y-3 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {animationOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAnimationStyle(option.id)}
                          className={`rounded-none border px-3 py-3 text-left transition-all ${animationStyle === option.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50"
                            }`}
                        >
                          <span className={`block text-[9px] font-black uppercase tracking-[0.18em] font-mono ${animationStyle === option.id ? "text-primary" : "text-muted-foreground"}`}>
                            {option.label}
                          </span>
                          <span className={`mt-1 block text-[8px] font-bold uppercase tracking-[0.16em] font-mono ${animationStyle === option.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                            {option.hint}
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="rounded-none border border-border bg-background p-3">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                        <span>Energy</span>
                        <span className="text-primary">{animationIntensity}%</span>
                      </div>
                      <div className="mt-2">
                        <Slider
                          value={[animationIntensity]}
                          onValueChange={(value: number | readonly number[]) => setAnimationIntensity(getSliderValue(value, 62))}
                          min={0}
                          max={100}
                          step={1}
                          disabled={animationStyle === "none"}
                          className="**:[[role=slider]]:bg-primary **:[[role=slider]]:border-primary **:[[role=slider]]:w-5 **:[[role=slider]]:h-5 **:[[role=slider]]:rounded-none"
                        />
                      </div>
                    </div>

                    <div className="rounded-none border border-border bg-background p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">Word by word</span>
                        <Switch className="data-[state=checked]:bg-primary" checked={wordByWord} onCheckedChange={setWordByWord} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">Auto highlight</span>
                        <Switch className="data-[state=checked]:bg-primary" checked={wordHighlight} onCheckedChange={setWordHighlight} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                  <div className=" px-4 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">Accent Palette</h3>
                      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                        Emphasis color driven from the project theme.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-border bg-background text-muted-foreground rounded-none font-mono">
                      {currentTheme.chip}
                    </Badge>
                  </div>
                  <CardContent className="space-y-3 p-3">
                    <div className="grid grid-cols-5 gap-2">
                      {([
                        { id: "red", swatch: "bg-[#ef4444]" },
                        { id: "yellow", swatch: "bg-[#facc15]" },
                        { id: "green", swatch: "bg-[#22c55e]" },
                        { id: "blue", swatch: "bg-[#3b82f6]" },
                        { id: "purple", swatch: "bg-[#f97316]" },
                      ] as const).map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setColorStyle(theme.id)}
                          className={`rounded-none border p-1.5 transition-all ${colorStyle === theme.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50"
                            }`}
                        >
                          <div className={`h-7 rounded-none ${theme.id === "purple" ? "bg-primary" : theme.swatch}`} />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
              <div className=" px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <Type className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Caption Preview</span>
                </div>
                <Badge variant="outline" className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono">
                  Source of truth
                </Badge>
              </div>

              <div className="aspect-16/8 min-h-80 relative overflow-hidden bg-background">
                <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-muted/30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--primary)_0.04,transparent_28%),radial-gradient(circle_at_bottom_right,var(--primary)_0.12,transparent_22%)] opacity-25" />
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary),transparent_34%)]"
                  style={{ opacity: captionsEnabled ? 0.06 + Math.max(0, motionPhase) * 0.08 : 0.03 }}
                />

                <div className="absolute top-4 left-4 flex items-center gap-2 rounded-none border border-border bg-card/90 px-3 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-none bg-primary" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground font-mono">
                    {captionsEnabled ? "Caption stage" : "Captions off"}
                  </span>
                </div>

                <div className={`absolute inset-0 flex flex-col items-center p-6 text-center ${positionClass}`}>
                  {captionsEnabled ? (
                    <div
                      className="max-w-3xl space-y-3"
                      style={{
                        transform: `${getAnimationTransform(animationStyle, animationIntensity)} translate3d(0px, ${Math.round(
                          (0.5 - easedMotion) * Math.max(8, animationIntensity / 7),
                        )}px, 0px)`,
                        opacity: getAnimationOpacity(animationStyle, animationIntensity) - (animationStyle === "reveal" ? (1 - easedMotion) * 0.12 : 0),
                      }}
                    >
                      <div className="flex justify-center">
                        <span className={`${colorStyle === "purple" ? "bg-primary text-primary-foreground" : currentTheme.titleBg} inline-flex rounded-none px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.24em] font-mono`}>
                          Caption Style
                        </span>
                      </div>

                      <div
                        className={`font-black uppercase leading-[1.05] text-foreground ${typographyStyle.transformClass} ${typographyStyle.labelClass}`}
                        style={{
                          fontFamily: typographyStyle.fontFamily,
                          fontSize: `${textSize}px,`,
                          letterSpacing: `${letterSpacing}px`,
                        }}
                      >
                        {wordByWord ? (
                          <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                            {previewWords.map((word, index) => (
                              <span
                                key={word}
                                style={{
                                  color: wordHighlight && index === activeWordIndex ? (colorStyle === "purple" ? "var(--primary)" : currentTheme.accent) : (colorStyle === "purple" ? "white" : currentTheme.caption),
                                  opacity: clamp(wordRevealProgress - index + 0.2, 0.18, 1),
                                  transform: index === activeWordIndex ? `translateY(-${Math.max(4, animationIntensity / 18)}px)` : "translateY(0px)",
                                  transition: "transform 180ms ease, opacity 180ms ease, color 180ms ease",
                                }}
                              >
                                {word}
                              </span>
                            ))}
                          </span>
                        ) : (
                          previewWords.map((word, index) => (
                            <span
                              key={word}
                              style={{
                                color: wordHighlight && index === activeWordIndex ? (colorStyle === "purple" ? "var(--primary)" : currentTheme.accent) : (colorStyle === "purple" ? "white" : currentTheme.caption),
                                opacity: index > activeWordIndex && wordHighlight ? 0.72 : 1,
                                transition: "opacity 180ms ease, color 180ms ease",
                              }}
                            >
                              {index > 0 ? " " : ""}
                              {word}
                            </span>
                          ))
                        )}
                      </div>

                      <p className="mx-auto max-w-2xl text-[11px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                        {wordByWord
                          ? "Word-by-word pacing is active for sharper social rhythm."
                          : "Full-line pacing is active for cleaner subtitle readability."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none border border-border bg-card/90">
                        <CaptionsOff className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
                        Preview paused
                      </p>
                      <p className="text-lg font-bold text-foreground/70 font-display uppercase tracking-wider">
                        Captions are disabled
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {captionsEnabled ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                  <div className=" px-4 py-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary font-display">Typography</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                      Font choice and text personality.
                    </p>
                  </div>
                  <CardContent className="space-y-3 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      {typographyOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setTypography(option.id)}
                          className={`rounded-none border px-3 py-3 text-left transition-all ${typography === option.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:border-primary/50"
                            }`}
                        >
                          <span
                            className={`block text-sm font-black uppercase ${typography === option.id ? "text-primary" : "text-foreground"} ${typographyStyles[option.id].transformClass} ${typographyStyles[option.id].labelClass}`}
                            style={{ fontFamily: typographyStyles[option.id].fontFamily }}
                          >
                            {option.sample}
                          </span>
                          <span className={`mt-1 block text-[8px] font-bold uppercase tracking-[0.18em] font-mono ${typography === option.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                  <div className=" px-4 py-3">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary font-display">Type Scale</h3>
                    <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                      Size and letter spacing for readability.
                    </p>
                  </div>
                  <CardContent className="space-y-3 p-3">
                    <div className="rounded-none border border-border bg-background p-3">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                        <span>Text Size</span>
                        <span className="font-mono text-foreground">{textSize}px</span>
                      </div>
                      <div className="mt-2">
                        <Slider
                          value={[textSize]}
                          onValueChange={(value: number | readonly number[]) => setTextSize(getSliderValue(value, 52))}
                          min={24}
                          max={100}
                          step={1}
                          className="**:[[role=slider]]:bg-primary **:[[role=slider]]:border-primary **:[[role=slider]]:w-5 **:[[role=slider]]:h-5 **:[[role=slider]]:rounded-none"
                        />
                      </div>
                    </div>

                    <div className="rounded-none border border-border bg-background p-3">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                        <span>Letter Spacing</span>
                        <span className="font-mono text-foreground">{letterSpacing.toFixed(1)}px</span>
                      </div>
                      <div className="mt-2">
                        <Slider
                          value={[letterSpacing]}
                          onValueChange={(value: number | readonly number[]) => setLetterSpacing(getSliderValue(value, 1.5))}
                          min={0}
                          max={8}
                          step={0.5}
                          className="**:[[role=slider]]:bg-primary **:[[role=slider]]:border-primary **:[[role=slider]]:w-5 **:[[role=slider]]:h-5 **:[[role=slider]]:rounded-none"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        // ==========================================
        // GRAPHIC OVERLAYS VIEW (ORIGINAL GRAPHIC LAB)
        // ==========================================
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
              <div className=" px-4 py-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
                  Graphics Layer
                </h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                  Toggle global overlay state for this project.
                </p>
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between rounded-none border border-border bg-background px-3 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-mono">
                      {graphicsEnabled ? "Graphics enabled" : "Graphics disabled"}
                    </p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground font-mono">
                      {graphicsEnabled ? "Active for all scenes." : "All overlays are currently paused."}
                    </p>
                  </div>
                  <Switch
                    className="data-[state=checked]:bg-primary"
                    checked={graphicsEnabled}
                    onCheckedChange={(checked) =>
                      setGraphicsPreset((current) => ({
                        ...current,
                        enabled: checked,
                      }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {graphicsEnabled ? (
              <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                <div className=" px-4 py-3">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
                    Graphic Modules
                  </h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
                    Select specific overlay modules.
                  </p>
                </div>
                <CardContent className="space-y-3 p-3">
                  {graphicModules.map((module) => (
                    <ModuleCard
                      key={module.id}
                      module={module}
                      active={moduleState[module.id]}
                      currentVariant={variantState[module.id]}
                      focused={focusedModuleId === module.id}
                      onPreview={() =>
                        setGraphicsPreset((current) => ({
                          ...current,
                          focusedModuleId: module.id,
                          moduleState: {
                            ...current.moduleState,
                            [module.id]: true,
                          },
                        }))
                      }
                      onToggle={(checked) => toggleModule(module.id, checked)}
                      onVariantSelect={(variant) => selectVariant(module.id, variant)}
                    />
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
              <div className=" px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] font-display">
                    Graphics Preview
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                >
                  {graphicsEnabled ? previewTitle : "Graphics off"}
                </Badge>
              </div>

              <div className=" px-4 py-3 bg-background">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                  >
                    Synced from captions
                  </Badge>
                  <span className="text-[10px] font-medium text-muted-foreground font-mono">
                    {captionSyncLabel}
                  </span>
                </div>
              </div>

              <div className="aspect-[16/8] min-h-80 relative overflow-hidden bg-background">
                <div className="absolute inset-0 bg-gradient-to-br from-background via-card to-muted/30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--primary)_0.04,transparent_28%),radial-gradient(circle_at_bottom_right,var(--primary)_0.12,transparent_22%)] opacity-25" />
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary),transparent_34%)]"
                  style={{ opacity: graphicsEnabled ? clamp(previewPulse, 0.04, 0.16) : 0.03 }}
                />

                <div className="absolute top-4 left-4 flex items-center gap-2 rounded-none border border-border bg-card/90 px-3 py-1.5">
                  <div className="h-1.5 w-1.5 rounded-none bg-primary" />
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground font-mono">
                    {graphicsEnabled ? "Overlay stage" : "Graphics off"}
                  </span>
                </div>

                <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                  {graphicsEnabled && moduleState[focusedModuleId] ? (
                    <div
                      className="max-w-3xl transition-[transform,opacity] duration-150 will-change-transform"
                      style={{
                        transform: previewStageTransform,
                        opacity: 0.94 + previewPulse,
                      }}
                    >
                      {focusedModuleId === "text-reveal"
                        ? renderTextReveal(variantState["text-reveal"], {
                          accent: graphicsAccent,
                          accentSoft: graphicsAccentSoft,
                          fontFamily: captionTypography.fontFamily,
                          transformClass: captionTypography.transformClass,
                          cadence: captionPreset.wordByWord ? "word-by-word pacing" : "full-line pacing",
                        })
                        : null}
                      {focusedModuleId === "stat-counter"
                        ? renderStatCounter(variantState["stat-counter"], {
                          accent: graphicsAccent,
                          accentSoft: graphicsAccentSoft,
                          fontFamily: captionTypography.fontFamily,
                          progress: graphicsPreviewProgress,
                        })
                        : null}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {graphicsEnabled ? (
                        <>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
                            Preview paused
                          </p>
                          <p className="text-lg font-bold text-foreground/70 font-display uppercase tracking-wider">
                            Select a module
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none border border-border bg-card/90">
                            <Sparkles className="h-6 w-6 text-muted-foreground" />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60">
                            Preview paused
                          </p>
                          <p className="text-lg font-bold text-foreground/70 font-display uppercase tracking-wider">
                            Graphics are disabled
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {graphicsEnabled && moduleState["lower-third"]
                  ? renderLowerThird(variantState["lower-third"], {
                    accent: graphicsAccent,
                    fontFamily: captionTypography.fontFamily,
                    positionClass: lowerThirdPlacement.positionClass,
                    positionLabel: lowerThirdPlacement.positionLabel,
                    progress: graphicsPreviewProgress,
                  })
                  : null}

                <div className="absolute inset-x-0 bottom-0 h-1 bg-border/70">
                  <div
                    className="h-full bg-primary transition-[width] duration-150"
                    style={{ width: graphicsEnabled ? `${Math.round(graphicsPreviewProgress * 100)}%` : "0%" }}
                  />
                </div>
              </div>
            </Card>

            {graphicsEnabled ? (
              <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                <div className=" px-4 py-3 flex items-center justify-between">
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
                <CardContent className="space-y-3 p-3">
                  {activeModules.length > 0 ? (
                    activeModules.map((module) => (
                      <div
                        key={module.id}
                        className="rounded-none border border-border bg-background px-4 py-3 hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-left">
                            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-foreground font-mono">
                              {module.title}
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-muted-foreground font-mono">
                              {variantState[module.id]} preset active
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setGraphicsPreset((current) => ({ ...current, focusedModuleId: module.id }))}
                            className="rounded-none border border-border bg-card px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground font-mono"
                          >
                            Focus
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-none border border-dashed border-border bg-background px-4 py-4 text-center">
                      <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                        No graphics are active yet. Turn on a module on the left to build the overlay stack.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

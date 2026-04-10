"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Type } from "lucide-react";

import { useEditorLab } from "../editor-lab-context";
import {
  type AnimationStyle,
  type CaptionLabPreset,
  type CaptionPosition,
  type ColorStyle,
  type TypographyStyle,
} from "./caption-lab-preset";

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

export function CaptionsLab() {
  const { captionPreset, captionPresetVersion, setCaptionPreset } = useEditorLab();
  const syncTimeoutRef = useRef<number | null>(null);

  const [captionPosition, setCaptionPosition] = useState<CaptionPosition>(captionPreset.captionPosition);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>(captionPreset.animationStyle);
  const [animationIntensity, setAnimationIntensity] = useState(captionPreset.animationIntensity);
  const [wordByWord, setWordByWord] = useState(captionPreset.wordByWord);
  const [wordHighlight, setWordHighlight] = useState(captionPreset.wordHighlight);
  const [typography, setTypography] = useState<TypographyStyle>(captionPreset.typography);
  const [textSize, setTextSize] = useState(captionPreset.textSize);
  const [letterSpacing, setLetterSpacing] = useState(captionPreset.letterSpacing);
  const [colorStyle, setColorStyle] = useState<ColorStyle>(captionPreset.colorStyle);

  const currentPreset: CaptionLabPreset = {
    captionPosition,
    animationStyle,
    animationIntensity,
    wordByWord,
    wordHighlight,
    typography,
    textSize,
    letterSpacing,
    colorStyle,
    strokeEnabled: false,
    strokeWidth: 0,
    strokeOpacity: 0,
    strokeColor: "black",
    watermarkEnabled: false,
    watermarkText: "",
    watermarkOpacity: 0,
    watermarkPosition: "top-right",
  };

  const latestPresetRef = useRef(currentPreset);

  useEffect(() => {
    latestPresetRef.current = currentPreset;
  }, [currentPreset]);

  const presetsMatch = (left: CaptionLabPreset, right: CaptionLabPreset) =>
    left.captionPosition === right.captionPosition &&
    left.animationStyle === right.animationStyle &&
    left.animationIntensity === right.animationIntensity &&
    left.wordByWord === right.wordByWord &&
    left.wordHighlight === right.wordHighlight &&
    left.typography === right.typography &&
    left.textSize === right.textSize &&
    left.letterSpacing === right.letterSpacing &&
    left.colorStyle === right.colorStyle &&
    left.strokeEnabled === right.strokeEnabled &&
    left.strokeWidth === right.strokeWidth &&
    left.strokeOpacity === right.strokeOpacity &&
    left.strokeColor === right.strokeColor &&
    left.watermarkEnabled === right.watermarkEnabled &&
    left.watermarkText === right.watermarkText &&
    left.watermarkOpacity === right.watermarkOpacity &&
    left.watermarkPosition === right.watermarkPosition;

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
    if (!presetsMatch(currentPreset, captionPreset)) {
      applyPreset(captionPreset);
    }
  }, [captionPreset, captionPresetVersion]);

  useEffect(() => {
    if (!presetsMatch(currentPreset, captionPreset)) {
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
  }, [
    animationIntensity,
    animationStyle,
    captionPosition,
    captionPreset,
    colorStyle,
    letterSpacing,
    setCaptionPreset,
    textSize,
    typography,
    wordByWord,
    wordHighlight,
  ]);

  useEffect(() => {
    return () => {
      if (!presetsMatch(latestPresetRef.current, captionPreset)) {
        setCaptionPreset(latestPresetRef.current);
      }
    };
  }, [captionPreset, setCaptionPreset]);

  const currentTheme = colorThemes[colorStyle];
  const typographyStyle = typographyStyles[typography];
  const previewWords = ["Keep", "every", "caption", "clear", "fast", "and", "easy", "to", "follow"];
  const activeWordIndex = wordHighlight ? 2 : -1;
  const previewPositionClass = {
    top: "justify-start pt-16",
    center: "justify-center",
    bottom: "justify-end pb-16",
    custom: "justify-end pb-28",
  }[captionPosition];

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[340px_1fr] animate-in fade-in duration-500">
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Layout</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
              Choose where captions sit in frame.
            </p>
          </div>
          <CardContent className="space-y-3 p-3.5">
            {captionPositions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCaptionPosition(option.value)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${
                  captionPosition === option.value
                    ? "border-white bg-white text-black shadow-[0_10px_20px_-5px_rgba(255,255,255,0.18)]"
                    : "border-white/4 bg-white/2 text-white/30 hover:border-white/15 hover:bg-white/5 hover:text-white/70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em]">{option.label}</span>
                  <span className={`text-[8px] font-bold uppercase tracking-[0.18em] ${captionPosition === option.value ? "text-black/50" : "text-white/15"}`}>
                    {option.hint}
                  </span>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Pacing & Motion</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
              Define the rhythm of how captions enter and read.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="grid grid-cols-2 gap-2">
              {animationOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setAnimationStyle(option.id)}
                  className={`rounded-xl border px-3 py-3 text-left transition-all ${
                    animationStyle === option.id
                      ? "border-white/25 bg-white/6"
                      : "border-white/5 bg-white/2 hover:border-white/15"
                  }`}
                >
                  <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-white/65">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.16em] text-white/22">
                    {option.hint}
                  </span>
                </button>
              ))}
            </div>

            <div className="rounded-xl border border-white/5 bg-white/2 p-3">
              <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                <span>Energy</span>
                <span className="text-white/75">{animationIntensity}%</span>
              </div>
              <div className="mt-2">
                <Slider
                  value={[animationIntensity]}
                  onValueChange={(value) => setAnimationIntensity(getSliderValue(value, 62))}
                  min={0}
                  max={100}
                  step={1}
                  disabled={animationStyle === "none"}
                  className="**:[[role=slider]]:bg-white **:[[role=slider]]:border-[#5c2d91] **:[[role=slider]]:w-5 **:[[role=slider]]:h-5"
                />
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/2 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Word by word</span>
                <Switch className="data-[state=checked]:bg-[#5c2d91]" checked={wordByWord} onCheckedChange={setWordByWord} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">Auto highlight</span>
                <Switch className="data-[state=checked]:bg-[#5c2d91]" checked={wordHighlight} onCheckedChange={setWordHighlight} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5 flex items-center justify-between">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Accent Palette</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-white/22">
                Pick the accent that drives emphasis in the preview.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/2 text-white/30">
              {currentTheme.chip}
            </Badge>
          </div>
          <CardContent className="space-y-3 p-3.5">
            <div className="grid grid-cols-5 gap-2">
              {([
                { id: "red", swatch: "bg-[#ef4444]" },
                { id: "yellow", swatch: "bg-[#facc15]" },
                { id: "green", swatch: "bg-[#22c55e]" },
                { id: "blue", swatch: "bg-[#3b82f6]" },
                { id: "purple", swatch: "bg-[#9b6dff]" },
              ] as const).map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setColorStyle(theme.id)}
                  className={`rounded-xl border p-1.5 transition-all ${
                    colorStyle === theme.id
                      ? "border-white/25 bg-white/6"
                      : "border-white/5 bg-white/2 hover:border-white/15"
                  }`}
                >
                  <div className={`h-7 rounded-full ${theme.swatch}`} />
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
              <Type className="h-4 w-4 text-primary/80" />
              <span className="text-[10px] font-black uppercase tracking-[0.22em]">Caption Preview</span>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]">
              Source of truth
            </Badge>
          </div>

          <div className="aspect-16/8 min-h-105 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(92,45,145,0.08),transparent_30%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.04),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(92,45,145,0.12),transparent_22%)]" />

            <div className={`absolute inset-0 flex flex-col items-center p-8 text-center ${previewPositionClass}`}>
              <div
                className="max-w-4xl space-y-4"
                style={{
                  transform: getAnimationTransform(animationStyle, animationIntensity),
                  opacity: getAnimationOpacity(animationStyle, animationIntensity),
                }}
              >
                <div className="flex justify-center">
                  <span className={`${currentTheme.titleBg} inline-flex rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.24em]`}>
                    Caption Style
                  </span>
                </div>

                <div
                  className={`font-black uppercase leading-[1.05] text-white ${typographyStyle.transformClass} ${typographyStyle.labelClass}`}
                  style={{
                    fontFamily: typographyStyle.fontFamily,
                    fontSize: `${textSize}px`,
                    letterSpacing: `${letterSpacing}px`,
                  }}
                >
                  {wordByWord ? (
                    <span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
                      {previewWords.map((word, index) => (
                        <span
                          key={word}
                          style={{
                            color: wordHighlight && index === activeWordIndex ? currentTheme.accent : currentTheme.caption,
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
                          color: wordHighlight && index === activeWordIndex ? currentTheme.accent : currentTheme.caption,
                        }}
                      >
                        {index > 0 ? " " : ""}
                        {word}
                      </span>
                    ))
                  )}
                </div>

                <p className="mx-auto max-w-2xl text-[11px] uppercase tracking-[0.2em] text-white/28">
                  {wordByWord
                    ? "Word-by-word pacing is active for sharper social rhythm."
                    : "Full-line pacing is active for cleaner subtitle readability."}
                </p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
            <div className="border-b border-white/4 px-5 py-3.5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Typography</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-white/22">
                Choose the voice of the text itself.
              </p>
            </div>
            <CardContent className="space-y-4 p-3.5">
              <div className="grid grid-cols-2 gap-2">
                {typographyOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setTypography(option.id)}
                    className={`rounded-xl border px-3 py-3 text-left transition-all ${
                      typography === option.id
                        ? "border-white/25 bg-white/6"
                        : "border-white/5 bg-white/2 hover:border-white/15"
                    }`}
                  >
                    <span
                      className={`block text-sm font-black uppercase text-white/75 ${typographyStyles[option.id].transformClass} ${typographyStyles[option.id].labelClass}`}
                      style={{ fontFamily: typographyStyles[option.id].fontFamily }}
                    >
                      {option.sample}
                    </span>
                    <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.18em] text-white/25">
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
            <div className="border-b border-white/4 px-5 py-3.5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white/30">Type Scale</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-white/22">
                Fine-tune size and spacing for readability.
              </p>
            </div>
            <CardContent className="space-y-4 p-3.5">
              <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                  <span>Text Size</span>
                  <span className="font-mono text-white/80">{textSize}px</span>
                </div>
                <div className="mt-2">
                  <Slider
                    value={[textSize]}
                    onValueChange={(value) => setTextSize(getSliderValue(value, 52))}
                    min={24}
                    max={100}
                    step={1}
                    className="**:[[role=slider]]:bg-white **:[[role=slider]]:border-[#5c2d91] **:[[role=slider]]:w-5 **:[[role=slider]]:h-5"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                  <span>Letter Spacing</span>
                  <span className="font-mono text-white/80">{letterSpacing.toFixed(1)}px</span>
                </div>
                <div className="mt-2">
                  <Slider
                    value={[letterSpacing]}
                    onValueChange={(value) => setLetterSpacing(getSliderValue(value, 1.5))}
                    min={0}
                    max={8}
                    step={0.5}
                    className="**:[[role=slider]]:bg-white **:[[role=slider]]:border-[#5c2d91] **:[[role=slider]]:w-5 **:[[role=slider]]:h-5"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

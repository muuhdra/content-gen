"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Languages, Mic, Pause, Play, Sparkles, User, Volume2, Wand2 } from "lucide-react";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
import { CloneVoicePanel } from "./cloneVoice";
import { CUSTOM_AUDIO_UPLOAD_ID } from "./voice-clone-storage";
import { useVoicePreview } from "../use-voice-preview";

interface VoiceCloningPlaygroundProps {
  onBack: () => void;
}

type VoiceCloningTab = "clone" | "preset";

type PresetSpeaker = {
  id: string;
  name: string;
  info: string;
  vibe: string;
};

const promptPresets = [
  "Warm and cinematic",
  "Slow documentary pace",
  "More emphasis on key words",
  "Bright social tone",
  "Clean and neutral delivery",
];

// Full delivery directions tailored per content type — one click sets the whole
// narration tone. These feed the Narration Director as the master register.
const contentTonePresets: { label: string; direction: string }[] = [
  { label: "True Crime", direction: "Calm, measured, professional true-crime narration. Low, controlled voice; deliberate pauses before reveals; restrained tension, never sensational." },
  { label: "Documentary", direction: "Composed documentary narrator. Even, authoritative pace; clear diction; thoughtful pauses; understated gravitas." },
  { label: "Motivation", direction: "Energetic, uplifting delivery. Confident and punchy; rising intensity toward key lines; strong emphasis on the payoff." },
  { label: "Storytelling", direction: "Warm, immersive storyteller. Expressive and cinematic; vary pace with the story; lean into emotional beats and suspense." },
  { label: "Explainer", direction: "Friendly, clear and concise. Approachable mid pace; light emphasis on key terms; no drama, just clarity." },
  { label: "Mystery", direction: "Low, intriguing, suspenseful narrator. Hushed at times; slow deliberate pacing; let questions hang before answering." },
];

const sampleScripts = [
  {
    id: "hook",
    label: "Hook",
    text: "This is the exact moment where everything starts to change for the project.",
  },
  {
    id: "explainer",
    label: "Explainer",
    text: "Here is the clear breakdown of what matters, why it matters, and what happens next.",
  },
  {
    id: "cta",
    label: "CTA",
    text: "Stay with us until the end, because the last part is where the insight becomes actionable.",
  },
];

// Curated TTS short-list (budget): ElevenLabs v3 + MiniMax Speech 2.8 HD.
const presetSpeakers: PresetSpeaker[] = [
  { id: "elevenlabs-v3", name: "ElevenLabs v3", info: "ElevenLabs • Multilingual", vibe: "Natural, expressive, broadcast-grade" },
  { id: "minimax-speech-2.8-hd", name: "MiniMax 2.8 HD", info: "MiniMax • Multi", vibe: "Crisp, high-fidelity narration" },
];

export function VoiceCloningPlayground({ onBack }: VoiceCloningPlaygroundProps) {
  const {
    narrationLanguage,
    setNarrationLanguage,
    narrationStyle,
    setNarrationStyle,
    setSelectedVoice,
  } = useEditorLab();
  const [activeTab, setActiveTab] = useState<VoiceCloningTab>("preset");
  const [selectedSpeaker, setSelectedSpeaker] = useState("elevenlabs-v3");
  const [language, setLanguage] = useState(narrationLanguage || "english");
  const [scriptText, setScriptText] = useState("");
  const [styleNote, setStyleNote] = useState(narrationStyle || "");

  const selectedSpeakerProfile =
    useMemo(
      () => presetSpeakers.find((speaker) => speaker.id === selectedSpeaker) ?? presetSpeakers[0],
      [selectedSpeaker],
    );

  const previewText = scriptText.trim().length > 0
    ? scriptText.trim()
    : `Voice preview. ${selectedSpeakerProfile.name}. ${selectedSpeakerProfile.vibe}.`;
  const { isPreviewing, togglePreview } = useVoicePreview(previewText);

  const scriptCount = scriptText.length;
  const noteCount = styleNote.length;

  const appendPromptPreset = (preset: string) => {
    setStyleNote((current) => (current.trim().length === 0 ? preset : `${current.trim()}, ${preset}`));
  };

  const applyCurrentNarrationDirection = () => {
    if (narrationStyle.trim().length > 0) {
      setStyleNote(narrationStyle);
    }
  };

  const clearNotes = () => {
    setStyleNote("");
  };

  const clearScript = () => {
    setScriptText("");
  };

  const handleUsePresetVoice = () => {
    setSelectedVoice(selectedSpeaker);
    if (language !== "auto") {
      setNarrationLanguage(language);
    }
    if (styleNote.trim().length > 0) {
      setNarrationStyle(styleNote.trim());
    }
    onBack();
  };

  const handleUseCustomVoice = (voiceId = CUSTOM_AUDIO_UPLOAD_ID) => {
    setSelectedVoice(voiceId);
    if (language !== "auto") {
      setNarrationLanguage(language);
    }
    if (styleNote.trim().length > 0) {
      setNarrationStyle(styleNote.trim());
    }
    onBack();
  };

  return (
    <div className="mx-auto w-full max-w-[94%] space-y-6 pb-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest font-mono group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>

          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight font-display text-foreground">Open Cloning Lab</h1>
            <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
              Test a preset voice or prepare a custom one, then apply that route back to narration.
            </p>
          </div>
        </div>

        <div className="inline-flex max-w-full flex-wrap rounded-none border border-border bg-card p-1 shadow-none">
          <button
            type="button"
            onClick={() => setActiveTab("preset")}
            className={`px-5 py-2 rounded-none flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all font-mono ${
              activeTab === "preset" ? "bg-primary text-primary-foreground shadow-none" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="h-3 w-3" />
            Preset Voices
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clone")}
            className={`px-5 py-2 rounded-none flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all font-mono ${
              activeTab === "clone" ? "bg-primary text-primary-foreground shadow-none" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Mic className="h-3 w-3" />
            Clone Voice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
            <div className=" px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Test Script</h3>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground font-mono">
                    Use a short line to audition the voice direction.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                >
                  {scriptCount} / 500
                </Badge>
              </div>
            </div>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                {sampleScripts.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => setScriptText(sample.text)}
                    className="rounded-none border border-border bg-background px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground font-mono"
                  >
                    {sample.label}
                  </button>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearScript}
                  className="h-7 rounded-none border border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-primary/10 hover:text-foreground font-mono"
                >
                  Clear
                </Button>
              </div>

              <div className="rounded-none border border-border bg-background p-4">
                <Textarea
                  value={scriptText}
                  onChange={(event) => setScriptText(event.target.value)}
                  placeholder="Write a short line to test the voice..."
                  maxLength={500}
                  className="min-h-36 w-full resize-none border-none bg-transparent p-0 text-[12px] leading-7 text-foreground font-mono placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
            <div className=" px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-foreground">
                    <Wand2 className="h-3.5 w-3.5 text-primary" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Voice Notes</h3>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground font-mono">
                    Add the tone and pacing you want to keep.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                >
                  {noteCount} / 220
                </Badge>
              </div>
            </div>
            <CardContent className="space-y-4 p-4">
              {/* Content-type tone presets — one click sets the full delivery direction */}
              <div className="space-y-2">
                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-primary/70 font-mono">Ton par type de contenu</p>
                <div className="flex flex-wrap gap-2">
                  {contentTonePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      title={preset.direction}
                      onClick={() => {
                        // Fill the editable field AND apply the direction to the
                        // project's narration tone in one click.
                        setStyleNote(preset.direction);
                        setNarrationStyle(preset.direction);
                      }}
                      className={`rounded-none border px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] transition-colors font-mono ${
                        narrationStyle === preset.direction
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-primary/25 bg-primary/5 text-primary/80 hover:bg-primary/15 hover:text-primary"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {promptPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => appendPromptPreset(preset)}
                    className="rounded-none border border-border bg-background px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground font-mono"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={applyCurrentNarrationDirection}
                  className="h-7 rounded-none border border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-primary/10 hover:text-foreground font-mono"
                >
                  Use Current Narration Notes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearNotes}
                  className="h-7 rounded-none border border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground hover:bg-primary/10 hover:text-foreground font-mono"
                >
                  Clear
                </Button>
              </div>

              <div className="rounded-none border border-border bg-background p-4">
                <Textarea
                  value={styleNote}
                  onChange={(event) => setStyleNote(event.target.value)}
                  placeholder="Example: warm delivery, medium pace, cleaner diction, more emphasis on the opening line..."
                  maxLength={220}
                  className="min-h-32 w-full resize-none border-none bg-transparent p-0 text-[12px] leading-7 text-foreground font-mono placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {activeTab === "clone" ? (
          <CloneVoicePanel
            language={language}
            onLanguageChange={setLanguage}
            onUseClone={handleUseCustomVoice}
          />
        ) : (
          <PresetVoicePanel
            language={language}
            onLanguageChange={setLanguage}
            onSelectSpeaker={setSelectedSpeaker}
            onPreviewToggle={togglePreview}
            onUseSpeaker={handleUsePresetVoice}
            presetSpeakers={presetSpeakers}
            selectedSpeaker={selectedSpeaker}
            selectedSpeakerProfile={selectedSpeakerProfile}
            isPreviewing={isPreviewing}
          />
        )}
      </div>
    </div>
  );
}

interface PresetVoicePanelProps {
  language: string;
  onLanguageChange: (value: string) => void;
  onSelectSpeaker: (speakerId: string) => void;
  onPreviewToggle: () => void;
  onUseSpeaker: () => void;
  presetSpeakers: PresetSpeaker[];
  selectedSpeaker: string;
  selectedSpeakerProfile: PresetSpeaker;
  isPreviewing: boolean;
}

function PresetVoicePanel({
  language,
  onLanguageChange,
  onSelectSpeaker,
  onPreviewToggle,
  onUseSpeaker,
  presetSpeakers,
  selectedSpeaker,
  selectedSpeakerProfile,
  isPreviewing,
}: PresetVoicePanelProps) {
  const handleLanguageChange = (value: string | null) => {
    if (typeof value === "string") {
      onLanguageChange(value);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-none border border-border bg-black shadow-none">
        <div className=" px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-foreground">
                <User className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Preset Voices</h3>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground font-mono">
                Audition a preset voice, then apply it back to the narration setup.
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
            >
              {selectedSpeakerProfile.name}
            </Badge>
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-none border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-foreground">
              <Languages className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] font-display">Language</h3>
            </div>
            <Select value={language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="mt-3 h-10 rounded-none border border-border bg-card text-[10px] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Keep project language</SelectItem>
                <SelectItem value="english">English</SelectItem>
                <SelectItem value="french">French</SelectItem>
                <SelectItem value="spanish">Spanish</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {presetSpeakers.map((speaker) => {
              const isSelected = selectedSpeaker === speaker.id;

              return (
                <button
                  key={speaker.id}
                  type="button"
                  onClick={() => onSelectSpeaker(speaker.id)}
                  className={`rounded-none border p-4 text-left transition-all ${
                    isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-none border transition-all ${
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      <Volume2 className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold tracking-tight text-foreground font-mono">{speaker.name}</p>
                      <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground font-mono">{speaker.info}</p>
                      <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">{speaker.vibe}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-none border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[12px] font-semibold tracking-tight text-foreground font-mono">{selectedSpeakerProfile.name}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">{selectedSpeakerProfile.vibe}</p>
              </div>
              <Button
                type="button"
                onClick={onPreviewToggle}
                className="h-9 rounded-none bg-primary text-primary-foreground hover:bg-primary/90 px-4 text-[9px] font-black uppercase tracking-[0.18em] font-mono"
              >
                {isPreviewing ? <Pause className="mr-2 h-3 w-3 fill-current" /> : <Play className="mr-2 h-3 w-3 fill-current" />}
                {isPreviewing ? "Pause" : "Preview"}
              </Button>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-none bg-border">
              <div
                className="h-full rounded-none bg-primary transition-all duration-[3s] ease-linear"
                style={{ width: isPreviewing ? "100%" : "0%" }}
              />
            </div>

            <Button
              type="button"
              onClick={onUseSpeaker}
              className="mt-4 h-10 w-full rounded-none bg-primary px-6 text-[10px] font-black uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 font-mono"
            >
              Use This Voice In Narration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

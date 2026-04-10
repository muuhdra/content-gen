"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Languages, Mic, Pause, Play, Sparkles, User, Volume2, Wand2 } from "lucide-react";

import { useEditorLab } from "../../../editor-lab-context";
import { CloneVoicePanel } from "./cloneVoice";
import { CUSTOM_AUDIO_UPLOAD_ID } from "./voice-clone-storage";

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

const presetSpeakers: PresetSpeaker[] = [
  { id: "male-1", name: "Male 1", info: "Male • English", vibe: "Balanced and editorial" },
  { id: "male-2", name: "Male 2", info: "Male • Multi", vibe: "Direct and grounded" },
  { id: "male-3", name: "Male 3", info: "Male • Multi", vibe: "Bright and engaging" },
  { id: "male-5", name: "Male 5", info: "Male • Multi", vibe: "Neutral and precise" },
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
  const [selectedSpeaker, setSelectedSpeaker] = useState("male-1");
  const [language, setLanguage] = useState(narrationLanguage || "english");
  const [scriptText, setScriptText] = useState("");
  const [styleNote, setStyleNote] = useState(narrationStyle || "");
  const [isPreviewing, setIsPreviewing] = useState(false);

  const selectedSpeakerProfile =
    useMemo(
      () => presetSpeakers.find((speaker) => speaker.id === selectedSpeaker) ?? presetSpeakers[0],
      [selectedSpeaker],
    );

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
            className="flex items-center gap-2 text-[10px] font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" />
            Back
          </button>

          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight">Open Cloning Lab</h1>
            <p className="text-[11px] leading-relaxed text-white/25">
              Test a preset voice or prepare a custom one, then apply that route back to narration.
            </p>
          </div>
        </div>

        <div className="inline-flex max-w-full flex-wrap rounded-full border border-white/4 bg-[#08080c] p-1 shadow-xl">
          <button
            type="button"
            onClick={() => setActiveTab("preset")}
            className={`px-5 py-2 rounded-full flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
              activeTab === "preset" ? "bg-white text-black shadow-lg" : "text-white/25 hover:text-white/45"
            }`}
          >
            <User className="h-3 w-3" />
            Preset Voices
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("clone")}
            className={`px-5 py-2 rounded-full flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.18em] transition-all ${
              activeTab === "clone" ? "bg-white text-black shadow-lg" : "text-white/25 hover:text-white/45"
            }`}
          >
            <Mic className="h-3 w-3" />
            Clone Voice
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
            <div className="border-b border-white/4 px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white/65">
                    <Sparkles className="h-3.5 w-3.5 text-[#9b6dff]" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">Test Script</h3>
                  </div>
                  <p className="text-[10px] font-medium text-white/20">
                    Use a short line to audition the voice direction.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/2 text-white/30 text-[8px] uppercase tracking-[0.18em]"
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
                    className="rounded-full border border-white/10 bg-white/2 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 transition-colors hover:border-white/20 hover:text-white/55"
                  >
                    {sample.label}
                  </button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearScript}
                  className="h-7 rounded-full border border-white/10 bg-white/2 px-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 hover:bg-white/5 hover:text-white/60"
                >
                  Clear
                </Button>
              </div>

              <div className="rounded-[22px] border border-white/5 bg-white/2 p-4">
                <Textarea
                  value={scriptText}
                  onChange={(event) => setScriptText(event.target.value)}
                  placeholder="Write a short line to test the voice..."
                  className="min-h-36 w-full resize-none border-none bg-transparent p-0 text-[12px] leading-7 text-white/70 placeholder:text-white/12 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
            <div className="border-b border-white/4 px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-white/65">
                    <Wand2 className="h-3.5 w-3.5 text-[#9b6dff]" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">Voice Notes</h3>
                  </div>
                  <p className="text-[10px] font-medium text-white/20">
                    Add the tone and pacing you want to keep.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/2 text-white/30 text-[8px] uppercase tracking-[0.18em]"
                >
                  {noteCount} / 220
                </Badge>
              </div>
            </div>
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap gap-2">
                {promptPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => appendPromptPreset(preset)}
                    className="rounded-full border border-white/10 bg-white/2 px-3 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 transition-colors hover:border-white/20 hover:text-white/55"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={applyCurrentNarrationDirection}
                  className="h-7 rounded-full border border-white/10 bg-white/2 px-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 hover:bg-white/5 hover:text-white/60"
                >
                  Use Current Narration Notes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={clearNotes}
                  className="h-7 rounded-full border border-white/10 bg-white/2 px-3 text-[8px] font-black uppercase tracking-[0.16em] text-white/35 hover:bg-white/5 hover:text-white/60"
                >
                  Clear
                </Button>
              </div>

              <div className="rounded-[22px] border border-white/5 bg-white/2 p-4">
                <Textarea
                  value={styleNote}
                  onChange={(event) => setStyleNote(event.target.value)}
                  placeholder="Example: warm delivery, medium pace, cleaner diction, more emphasis on the opening line..."
                  className="min-h-32 w-full resize-none border-none bg-transparent p-0 text-[12px] leading-7 text-white/65 placeholder:text-white/12 focus-visible:ring-0 focus-visible:ring-offset-0"
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
            onPreviewToggle={() => setIsPreviewing((current) => !current)}
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
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-[30px] border-white/5 bg-[#050508] shadow-xl">
        <div className="border-b border-white/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-white/72">
                <User className="h-3.5 w-3.5 text-[#9b6dff]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">Preset Voices</h3>
              </div>
              <p className="text-[10px] font-medium text-white/22">
                Audition a preset voice, then apply it back to the narration setup.
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
            >
              {selectedSpeakerProfile.name}
            </Badge>
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
            <div className="flex items-center gap-2 text-white/65">
              <Languages className="h-3.5 w-3.5 text-[#9b6dff]" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Language</h3>
            </div>
            <Select value={language} onValueChange={onLanguageChange}>
              <SelectTrigger className="mt-3 h-10 rounded-xl border-white/5 bg-black/20 text-[10px] font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-black border-white/10">
                <SelectItem value="auto">Auto-detect</SelectItem>
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
                  className={`rounded-[20px] border p-4 text-left transition-all ${
                    isSelected ? "border-[#5c2d91]/20 bg-[#5c2d91]/8" : "border-white/5 bg-white/2 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                        isSelected ? "border-white bg-white text-black" : "border-white/10 bg-black/20 text-white/20"
                      }`}
                    >
                      <Volume2 className="h-4 w-4" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold tracking-tight text-white/80">{speaker.name}</p>
                      <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/20">{speaker.info}</p>
                      <p className="text-[10px] leading-relaxed text-white/28">{speaker.vibe}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-[12px] font-semibold tracking-tight text-white/85">{selectedSpeakerProfile.name}</p>
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">{selectedSpeakerProfile.vibe}</p>
              </div>
              <Button
                type="button"
                onClick={onPreviewToggle}
                className="h-9 rounded-full bg-white text-black hover:bg-white/90 px-4 text-[9px] font-black uppercase tracking-[0.18em]"
              >
                {isPreviewing ? <Pause className="mr-2 h-3 w-3 fill-current" /> : <Play className="mr-2 h-3 w-3 fill-current" />}
                {isPreviewing ? "Pause" : "Preview"}
              </Button>
            </div>

            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/4">
              <div className={`h-full rounded-full bg-[#9b6dff] transition-all ${isPreviewing ? "w-2/3" : "w-1/4"}`} />
            </div>

            <Button
              type="button"
              onClick={onUseSpeaker}
              className="mt-4 h-10 w-full rounded-full bg-[#5c2d91] px-6 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:bg-[#7140b4]"
            >
              Use This Voice In Narration
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

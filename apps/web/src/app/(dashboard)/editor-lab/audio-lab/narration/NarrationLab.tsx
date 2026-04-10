"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Languages, Mic, Pause, Play, Sparkles, User, Volume2, Wand2 } from "lucide-react";

import { useEditorLab } from "../../editor-lab-context";
import { VoiceCloningPlayground } from "./voice-cloning-lab/PresetVoice";
import { CUSTOM_AUDIO_UPLOAD_ID, findBuiltClone, isCustomVoiceId } from "./voice-cloning-lab/voice-clone-storage";

type VoiceSourceMode = "standard" | "custom";

type VoiceProfile = {
  id: string;
  name: string;
  gender: string;
  tag: string;
  vibe: string;
};

const stylePresets = [
  "Warm tone",
  "Clear diction",
  "Documentary pace",
  "Confident emphasis",
  "Soft pauses",
  "More upbeat",
];

const voices: VoiceProfile[] = [
  { id: "male-1", name: "Male 1", gender: "Male", tag: "Informative", vibe: "Balanced and editorial" },
  { id: "male-2", name: "Male 2", gender: "Male", tag: "Firm", vibe: "Direct and grounded" },
  { id: "male-3", name: "Male 3", gender: "Male", tag: "Optimistic", vibe: "Bright and engaging" },
  { id: "male-4", name: "Male 4", gender: "Male", tag: "Breathy", vibe: "Soft and intimate" },
  { id: "male-5", name: "Male 5", gender: "Male", tag: "Clear", vibe: "Neutral and precise" },
  { id: "male-6", name: "Male 6", gender: "Male", tag: "Relaxed", vibe: "Smooth and calm" },
  { id: "male-7", name: "Male 7", gender: "Male", tag: "Gritty", vibe: "Textured and punchy" },
];

const customVoiceProfile: VoiceProfile = {
  id: CUSTOM_AUDIO_UPLOAD_ID,
  name: "Custom Voice Source",
  gender: "Custom",
  tag: "Uploaded / Cloned",
  vibe: "Use your own recorded or cloned voice later in production",
};

export function NarrationLab() {
  const {
    projectDraft,
    narrationLanguage,
    setNarrationLanguage,
    selectedVoice,
    setSelectedVoice,
    narrationStyle,
    setNarrationStyle,
  } = useEditorLab();
  const [voiceSourceMode, setVoiceSourceMode] = useState<VoiceSourceMode>("standard");
  const [showPlayground, setShowPlayground] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const selectedVoiceProfile = useMemo(() => {
    if (isCustomVoiceId(selectedVoice)) {
      const builtClone = findBuiltClone(selectedVoice);

      if (builtClone) {
        return {
          id: builtClone.id,
          name: builtClone.name,
          gender: "Custom",
          tag: "Cloned",
          vibe: "Custom cloned voice prepared for later narration generation",
        };
      }

      return customVoiceProfile;
    }

    return voices.find((voice) => voice.id === selectedVoice) ?? voices[0];
  }, [selectedVoice]);

  useEffect(() => {
    if (isCustomVoiceId(selectedVoice)) {
      setVoiceSourceMode("custom");
      return;
    }

    setVoiceSourceMode("standard");
  }, [selectedVoice]);

  useEffect(() => {
    if (!projectDraft) {
      return;
    }

    window.setTimeout(() => {
      setNarrationLanguage((current) => (current === "english" ? projectDraft.projectLanguage : current));
      setNarrationStyle((current) => {
        if (current.trim().length > 0) {
          return current;
        }

        if (projectDraft.projectTone.trim().length > 0) {
          return projectDraft.projectTone;
        }

        return projectDraft.projectContext;
      });
    }, 0);
  }, [projectDraft, setNarrationLanguage, setNarrationStyle]);

  const styleChars = narrationStyle.length;

  const appendStylePreset = (preset: string) => {
    setNarrationStyle((current) => (current.trim().length === 0 ? preset : `${current.trim()}, ${preset}`));
  };

  const applyProjectTone = () => {
    if (!projectDraft) {
      return;
    }

    const nextTone = projectDraft.projectTone.trim().length > 0 ? projectDraft.projectTone : projectDraft.projectContext;
    setNarrationStyle(nextTone);
  };

  const clearNarrationStyle = () => {
    setNarrationStyle("");
  };

  const switchToCustomVoice = () => {
    setVoiceSourceMode("custom");
    setSelectedVoice(customVoiceProfile.id);
  };

  const switchToStandardVoice = () => {
    setVoiceSourceMode("standard");
    setSelectedVoice((current) => (isCustomVoiceId(current) ? voices[0].id : current));
  };

  if (showPlayground) {
    return <VoiceCloningPlayground onBack={() => setShowPlayground(false)} />;
  }

  return (
    <div className="mx-auto grid max-w-[94%] grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] animate-in fade-in duration-700">
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Narration Setup
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
              This step defines the narrator and delivery. The final voice generation happens later.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <div className="flex items-center gap-2 text-white/65">
                <Languages className="h-3.5 w-3.5 text-[#9b6dff]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Language</h3>
              </div>
              <Select value={narrationLanguage} onValueChange={(value) => setNarrationLanguage(value)}>
                <SelectTrigger className="mt-3 h-10 rounded-xl border-white/5 bg-black/20 text-[10px] font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="french">French</SelectItem>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="chinese">Chinese</SelectItem>
                  <SelectItem value="spanish">Spanish</SelectItem>
                  <SelectItem value="portuguese">Portuguese</SelectItem>
                  <SelectItem value="japanese">Japanese</SelectItem>
                  <SelectItem value="korean">Korean</SelectItem>
                  <SelectItem value="german">German</SelectItem>
                  <SelectItem value="russian">Russian</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-3 text-[10px] leading-relaxed text-white/22">
                This guides pronunciation and rhythm when narration is generated later.
              </p>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    Current Voice
                  </h4>
                  <p className="text-[12px] font-semibold tracking-tight text-white/84">
                    {selectedVoiceProfile.name}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/2 text-white/30 text-[8px] uppercase tracking-[0.18em]"
                >
                  {selectedVoiceProfile.tag}
                </Badge>
              </div>

              <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/22">
                {selectedVoiceProfile.gender} • {selectedVoiceProfile.vibe}
              </p>

              <Button
                type="button"
                onClick={() => setIsPreviewing((current) => !current)}
                className="mt-4 h-9 w-full rounded-full bg-white text-black hover:bg-white/90 text-[9px] font-black uppercase tracking-[0.18em]"
              >
                {isPreviewing ? (
                  <Pause className="mr-2 h-3 w-3 fill-current" />
                ) : (
                  <Play className="mr-2 h-3 w-3 fill-current" />
                )}
                {isPreviewing ? "Pause Preview" : "Test Voice"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
          <div className="border-b border-white/4 px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Delivery Direction
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-white/22">
              Define tone, pacing and diction. This is the direction the voice engine should follow.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="flex flex-wrap gap-2">
              {stylePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => appendStylePreset(preset)}
                  className="rounded-full border border-white/10 bg-white/2 px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white/35 transition-colors hover:border-white/20 hover:text-white/55"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={applyProjectTone}
                className="h-8 rounded-full border border-white/10 bg-white/2 px-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/40 hover:bg-white/5 hover:text-white/72"
              >
                Use Project Tone
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={clearNarrationStyle}
                className="h-8 rounded-full border border-white/10 bg-white/2 px-3 text-[8px] font-black uppercase tracking-[0.18em] text-white/40 hover:bg-white/5 hover:text-white/72"
              >
                Clear
              </Button>
            </div>

            <div className="rounded-[24px] border border-white/5 bg-white/2 p-4">
              <Textarea
                value={narrationStyle}
                onChange={(event) => setNarrationStyle(event.target.value)}
                placeholder="Example: Warm documentary tone, medium pacing, clean diction, stronger emphasis on the opening hook..."
                className="min-h-44 w-full resize-none border-none bg-transparent p-0 text-[12px] leading-7 text-white/70 placeholder:text-white/12 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/4 sm:block">
                  <div
                    className="h-full rounded-full bg-[#9b6dff] transition-all"
                    style={{ width: `${Math.min(100, (styleChars / 220) * 100)}%` }}
                  />
                </div>
                <span className="ml-auto text-[9px] font-mono font-bold tracking-[0.18em] text-white/20">
                  {styleChars} / 220
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="overflow-hidden rounded-[28px] border-white/5 bg-[#050508] shadow-xl">
          <div className="border-b border-white/5 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-white/65">
                  <Mic className="h-3.5 w-3.5 text-[#9b6dff]" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">Voice Source</h3>
                </div>
                <p className="text-[10px] font-medium text-white/20">
                  Choose a standard preset voice or reserve a custom voice source for later.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-full border border-white/8 bg-white/3 p-1">
                <button
                  type="button"
                  onClick={switchToStandardVoice}
                  className={`rounded-full px-4 py-2 text-[8px] font-black uppercase tracking-[0.18em] transition-all ${
                    voiceSourceMode === "standard" ? "bg-white text-black" : "text-white/30 hover:text-white/55"
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={switchToCustomVoice}
                  className={`rounded-full px-4 py-2 text-[8px] font-black uppercase tracking-[0.18em] transition-all ${
                    voiceSourceMode === "custom" ? "bg-white text-black" : "text-white/30 hover:text-white/55"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>
          </div>

          {voiceSourceMode === "standard" ? (
            <div className="max-h-[440px] space-y-3 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {voices.map((voice) => {
                const isSelected = selectedVoice === voice.id;

                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`w-full rounded-[20px] border p-4 text-left transition-all ${
                      isSelected ? "border-[#5c2d91]/20 bg-[#5c2d91]/8" : "border-white/5 bg-white/2 hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-full border transition-all ${
                            isSelected ? "border-white bg-white text-black" : "border-white/10 bg-black/20 text-white/25"
                          }`}
                        >
                          {isSelected ? <Volume2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-bold tracking-tight text-white/80">{voice.name}</p>
                            <Badge
                              variant="outline"
                              className="border-white/10 bg-white/2 text-white/25 text-[7px] uppercase tracking-[0.16em]"
                            >
                              {voice.tag}
                            </Badge>
                          </div>
                          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/20">
                            {voice.gender} • {voice.vibe}
                          </p>
                        </div>
                      </div>

                      <div className="text-[8px] font-black uppercase tracking-[0.18em] text-white/22">
                        {isSelected ? "Active" : "Select"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="rounded-3xl border border-white/5 bg-white/2 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#5c2d91]/20 bg-[#5c2d91]/10">
                    <Mic className="h-5 w-5 text-[#9b6dff]" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-white/82">Custom Voice Reserved</p>
                    <p className="text-[10px] leading-relaxed text-white/28">
                      This project will use your own uploaded or cloned voice instead of a standard preset voice.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setShowPlayground(true)}
                className="h-11 w-full rounded-full border border-[#5c2d91]/20 bg-[#5c2d91]/15 px-7 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:bg-[#5c2d91]/25"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Cloning Lab
              </Button>
            </div>
          )}
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
                {narrationLanguage}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]"
              >
                {selectedVoiceProfile.name}
              </Badge>
              <Badge
                variant="outline"
                className="border-white/10 bg-white/2 text-white/25 text-[8px] uppercase tracking-[0.18em]"
              >
                {voiceSourceMode === "custom" ? "Custom Source" : selectedVoiceProfile.tag}
              </Badge>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <div className="flex items-center gap-2 text-white/72">
                <Wand2 className="h-4 w-4 text-[#9b6dff]" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                  Workflow Note
                </p>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-white/30">
                {voiceSourceMode === "custom"
                  ? "The project is configured to use your own voice source later. This step only reserves that route and defines the delivery style."
                  : "The project is configured with a preset narrator. This step only defines the voice choice and delivery direction; the actual narration is generated later once the script is ready."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

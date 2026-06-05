"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Languages, Mic, Pause, Play, User, Volume2, Wand2 } from "lucide-react";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
import { VoiceCloningPlayground } from "./voice-cloning-lab/PresetVoice";
import { CUSTOM_AUDIO_UPLOAD_ID, findBuiltClone, isCustomVoiceId } from "./voice-cloning-lab/voice-clone-storage";
import { useVoicePreview } from "./use-voice-preview";

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

// Curated TTS short-list (budget): ElevenLabs v3 + MiniMax Speech 2.8 HD.
const voices: VoiceProfile[] = [
  { id: "elevenlabs-v3", name: "ElevenLabs v3", gender: "ElevenLabs", tag: "Premium", vibe: "Natural, expressive, broadcast-grade" },
  { id: "minimax-speech-2.8-hd", name: "MiniMax 2.8 HD", gender: "MiniMax", tag: "HD", vibe: "Crisp, high-fidelity narration" },
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
  const [showPlayground, setShowPlayground] = useState(false);
  const voiceSourceMode: VoiceSourceMode = isCustomVoiceId(selectedVoice) ? "custom" : "standard";

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

  const { isPreviewing, togglePreview } = useVoicePreview(
    `Voice preview. ${selectedVoiceProfile.name}. ${selectedVoiceProfile.vibe}.`
  );

  useEffect(() => {
    if (!projectDraft) {
      return;
    }

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
    setSelectedVoice(customVoiceProfile.id);
  };

  const switchToStandardVoice = () => {
    setSelectedVoice((current) => (isCustomVoiceId(current) ? voices[0].id : current));
  };

  if (showPlayground) {
    return <VoiceCloningPlayground onBack={() => setShowPlayground(false)} />;
  }

  return (
    <div className="mx-auto grid max-w-[94%] grid-cols-1 gap-6 xl:grid-cols-[360px_1fr] animate-in fade-in duration-700">
      <div className="space-y-5">
        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              Narration Setup
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
              Configure the primary voice profile for project-wide narration.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="rounded-none border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <Languages className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] font-display">Language</h3>
              </div>
              <Select
                value={narrationLanguage}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setNarrationLanguage(value);
                  }
                }}
              >
                <SelectTrigger className="mt-3 h-10 rounded-none border-border bg-card text-[10px] font-mono">
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
              <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground font-mono">
                Pronunciation and rhythm guidelines for generation.
              </p>
            </div>

            <div className="rounded-none border border-border bg-background p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                    Current Voice
                  </h4>
                  <p className="text-[12px] font-semibold tracking-tight text-foreground font-mono">
                    {selectedVoiceProfile.name}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                >
                  {selectedVoiceProfile.tag}
                </Badge>
              </div>

              <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                {selectedVoiceProfile.gender} • {selectedVoiceProfile.vibe}
              </p>

              <Button
                type="button"
                onClick={togglePreview}
                className="mt-4 h-9 w-full rounded-none bg-primary text-primary-foreground hover:bg-primary/90 text-[9px] font-black uppercase tracking-[0.18em] font-mono"
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

        <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
          <div className=" px-5 py-3.5">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
              Delivery Direction
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground font-mono">
              Tone, pacing and diction guidelines for the voice engine.
            </p>
          </div>
          <CardContent className="space-y-4 p-3.5">
            <div className="flex flex-wrap gap-2">
              {stylePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => appendStylePreset(preset)}
                  className="rounded-none border border-border bg-background px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground font-mono"
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={applyProjectTone}
                className="h-8 rounded-none border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-primary/10 hover:text-foreground font-mono"
              >
                Use Project Tone
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={clearNarrationStyle}
                className="h-8 rounded-none border-border bg-background px-3 text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-primary/10 hover:text-foreground font-mono"
              >
                Clear
              </Button>
            </div>

            <div className="rounded-none border border-border bg-background p-4">
              <Textarea
                value={narrationStyle}
                onChange={(event) => setNarrationStyle(event.target.value)}
                placeholder="Example: Warm documentary tone, medium pacing, clean diction, stronger emphasis on the opening hook..."
                maxLength={220}
                className="min-h-44 w-full resize-none border-none bg-transparent p-0 text-[12px] leading-7 text-foreground font-mono placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="hidden h-1.5 w-24 overflow-hidden rounded-none bg-border sm:block">
                  <div
                    className="h-full rounded-none bg-primary transition-all"
                    style={{ width: `${Math.min(100, (styleChars / 220) * 100)}%` }}
                  />
                </div>
                <span className="ml-auto text-[9px] font-mono font-bold tracking-[0.18em] text-muted-foreground">
                  {styleChars} / 220
                </span>
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
                  <Mic className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Voice Source</h3>
                </div>
                <p className="text-[10px] font-medium text-muted-foreground font-mono">
                  Select a preset voice or use a custom source.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-none border border-border bg-background p-1">
                <button
                  type="button"
                  onClick={switchToStandardVoice}
                  className={`rounded-none px-4 py-2 text-[8px] font-black uppercase tracking-[0.18em] transition-all font-mono ${
                    voiceSourceMode === "standard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={switchToCustomVoice}
                  className={`rounded-none px-4 py-2 text-[8px] font-black uppercase tracking-[0.18em] transition-all font-mono ${
                    voiceSourceMode === "custom" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Custom
                </button>
              </div>
            </div>
          </div>

          {voiceSourceMode === "standard" ? (
            <div className="max-h-110 space-y-3 overflow-y-auto p-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {voices.map((voice) => {
                const isSelected = selectedVoice === voice.id;

                return (
                  <button
                    key={voice.id}
                    type="button"
                    onClick={() => setSelectedVoice(voice.id)}
                    className={`w-full rounded-none border p-4 text-left transition-all ${
                      isSelected ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-none border transition-all ${
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"
                          }`}
                        >
                          {isSelected ? <Volume2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[11px] font-bold tracking-tight font-mono text-foreground">{voice.name}</p>
                            <Badge
                              variant="outline"
                              className="border-border bg-background text-muted-foreground text-[7px] uppercase tracking-[0.16em] rounded-none font-mono"
                            >
                              {voice.tag}
                            </Badge>
                          </div>
                          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground font-mono">
                            {voice.gender} • {voice.vibe}
                          </p>
                        </div>
                      </div>

                      <div className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground font-mono">
                        {isSelected ? "Active" : "Select"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="rounded-none border border-border bg-background p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-none border border-border bg-card">
                    <Mic className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-foreground font-display">Custom Voice Reserved</p>
                    <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">
                      This project will use your own uploaded or cloned voice instead of a standard preset voice.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => setShowPlayground(true)}
                className="h-11 w-full rounded-none border border-border bg-primary/10 px-7 text-[10px] font-black uppercase tracking-[0.18em] text-primary hover:bg-primary/20 font-mono"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Cloning Lab
              </Button>
            </div>
          )}
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
                {narrationLanguage}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {selectedVoiceProfile.name}
              </Badge>
              <Badge
                variant="outline"
                className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
              >
                {voiceSourceMode === "custom" ? "Custom Source" : selectedVoiceProfile.tag}
              </Badge>
            </div>

            <div className="rounded-none border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <Wand2 className="h-4 w-4 text-primary" />
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                  Workflow Note
                </p>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground font-mono">
                {voiceSourceMode === "custom"
                  ? "Configured for custom voice source. Delivery style defined."
                  : "Configured with a preset narrator. Delivery direction defined."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useState, type ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Mic, Radio, ShieldCheck, Upload, Waves } from "lucide-react";

import { readBuiltClones, writeBuiltClones, type BuiltClone } from "./voice-clone-storage";

type CloneVoicePanelProps = {
  language: string;
  onLanguageChange: (value: string) => void;
  onUseClone: (voiceId: string) => void;
};

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function CloneVoicePanel({ language, onLanguageChange, onUseClone }: CloneVoicePanelProps) {
  const inputId = useId();
  const [cloneName, setCloneName] = useState("My Custom Voice");
  const [sampleLabel, setSampleLabel] = useState<string | null>(null);
  const [consentGranted, setConsentGranted] = useState(false);
  const [noiseCleanup, setNoiseCleanup] = useState(true);
  const [retainEmotion, setRetainEmotion] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [latestClone, setLatestClone] = useState<BuiltClone | null>(null);
  const [builtClones, setBuiltClones] = useState<BuiltClone[]>([]);
  const [selectedCloneId, setSelectedCloneId] = useState<string | null>(null);

  useEffect(() => {
    const clones = readBuiltClones();
    setBuiltClones(clones);
    setLatestClone(clones[0] ?? null);
    setSelectedCloneId(clones[0]?.id ?? null);
  }, []);

  const readiness = useMemo(() => {
    if (!sampleLabel) {
      return "Waiting Sample";
    }

    if (!consentGranted) {
      return "Needs Consent";
    }

    return "Ready To Clone";
  }, [consentGranted, sampleLabel]);

  const readinessTone =
    readiness === "Ready To Clone"
      ? "border-[#5c2d91]/20 bg-[#5c2d91]/10 text-[#cbb1ff]"
      : "border-white/10 bg-white/2 text-white/35";

  const handleUploadSample = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSampleLabel(`${file.name} • ${formatFileSize(file.size)}`);
    setIsRecording(false);
    event.target.value = "";
  };

  const toggleRecording = () => {
    setIsRecording((current) => {
      const next = !current;

      if (current) {
        setSampleLabel("Recorded sample • 14 sec");
      }

      return next;
    });
  };

  const clearSample = () => {
    setSampleLabel(null);
    setIsRecording(false);
  };

  const buildClone = () => {
    if (!sampleLabel || !consentGranted) {
      return;
    }

    const nextClone: BuiltClone = {
      id: `clone-${Date.now()}`,
      name: cloneName.trim().length > 0 ? cloneName.trim() : "My Custom Voice",
      sourceLabel: sampleLabel,
    };

    const nextClones = [nextClone, ...builtClones].slice(0, 5);
    setBuiltClones(nextClones);
    setLatestClone(nextClone);
    setSelectedCloneId(nextClone.id);
    writeBuiltClones(nextClones);
  };

  const selectedClone =
    builtClones.find((clone) => clone.id === selectedCloneId) ??
    latestClone;

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden rounded-[30px] border-white/5 bg-[#050508] shadow-xl">
        <div className="border-b border-white/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-white/72">
                <Mic className="h-3.5 w-3.5 text-[#9b6dff]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">Clone Voice</h3>
              </div>
              <p className="text-[10px] font-medium text-white/22">
                Add a voice sample, confirm consent, then build a reusable custom voice route.
              </p>
            </div>
            <Badge variant="outline" className={`text-[8px] uppercase tracking-[0.18em] ${readinessTone}`}>
              {readiness}
            </Badge>
          </div>
        </div>

        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <div className="flex items-center gap-2 text-white/65">
                <Upload className="h-3.5 w-3.5 text-[#9b6dff]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Voice Sample</h3>
              </div>

              <input
                id={inputId}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aiff"
                onChange={handleUploadSample}
                className="hidden"
              />

              <div className="mt-4 space-y-3 rounded-3xl border border-dashed border-white/10 bg-black/20 p-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[#5c2d91]/20 bg-[#5c2d91]/10">
                  <Mic className="h-5 w-5 text-[#9b6dff]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-white/78">
                    {sampleLabel ?? (isRecording ? "Recording in progress..." : "Upload or record a clean sample")}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/20">
                    10 to 20 seconds recommended
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label
                    htmlFor={inputId}
                    className="inline-flex h-9 cursor-pointer items-center rounded-full bg-white px-5 text-[9px] font-black uppercase tracking-[0.18em] text-black hover:bg-white/90"
                  >
                    Choose File
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleRecording}
                    className="h-9 rounded-full border-white/10 bg-white/2 px-5 text-[9px] font-black uppercase tracking-[0.18em] text-white/40 hover:bg-white/5 hover:text-white/60"
                  >
                    <Radio className="mr-2 h-3 w-3" />
                    {isRecording ? "Stop Recording" : "Record"}
                  </Button>
                  {sampleLabel ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={clearSample}
                      className="h-9 rounded-full border border-white/10 bg-white/2 px-5 text-[9px] font-black uppercase tracking-[0.18em] text-white/40 hover:bg-white/5 hover:text-white/60"
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <div className="flex items-center gap-2 text-white/65">
                <Waves className="h-3.5 w-3.5 text-[#9b6dff]" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em]">Clone Setup</h3>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Clone Name</p>
                  <Input
                    value={cloneName}
                    onChange={(event) => setCloneName(event.target.value)}
                    className="h-10 rounded-xl border-white/5 bg-black/20 text-[11px] font-medium text-white"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Language</p>
                  <Select value={language} onValueChange={onLanguageChange}>
                    <SelectTrigger className="h-10 rounded-xl border-white/5 bg-black/20 text-[10px] font-bold">
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-white/70">Noise Cleanup</p>
                      <p className="text-[9px] text-white/20">Reduce room noise before extraction.</p>
                    </div>
                    <Switch checked={noiseCleanup} onCheckedChange={setNoiseCleanup} className="data-[state=checked]:bg-[#5c2d91]" />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-white/70">Retain Emotion</p>
                      <p className="text-[9px] text-white/20">Keep the reference expression and dynamics.</p>
                    </div>
                    <Switch checked={retainEmotion} onCheckedChange={setRetainEmotion} className="data-[state=checked]:bg-[#5c2d91]" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-[#9b6dff]" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Consent</p>
                  <p className="text-[10px] leading-relaxed text-white/28">
                    Confirm that you own this voice sample or have permission to clone it.
                  </p>
                </div>
              </div>
              <Switch checked={consentGranted} onCheckedChange={setConsentGranted} className="data-[state=checked]:bg-[#5c2d91]" />
            </div>

            <div className="mt-4 space-y-2">
              {[
                { label: "Reference sample added", done: Boolean(sampleLabel) },
                { label: "Consent confirmed", done: consentGranted },
                { label: "Clone can be built", done: Boolean(sampleLabel) && consentGranted },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-[#9b6dff]" : "text-white/12"}`} />
                  <span className={`text-[9px] font-medium uppercase tracking-[0.18em] ${item.done ? "text-white/45" : "text-white/18"}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Clone Action</p>
                <p className="text-[10px] leading-relaxed text-white/28">
                  Build the custom voice profile first, then apply that custom route back to narration.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!sampleLabel || !consentGranted}
                  onClick={buildClone}
                  className="h-10 rounded-full bg-[#5c2d91] px-6 text-[10px] font-black uppercase tracking-[0.18em] text-white hover:bg-[#7140b4] disabled:bg-white/4 disabled:text-white/20"
                >
                  Build Clone
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedClone}
                  onClick={() => {
                    if (selectedClone) {
                      onUseClone(selectedClone.id);
                    }
                  }}
                  className="h-10 rounded-full border-white/10 bg-white/2 px-6 text-[10px] font-black uppercase tracking-[0.18em] text-white/50 hover:bg-white/5 hover:text-white/75 disabled:opacity-40"
                >
                  {selectedClone ? `Use ${selectedClone.name}` : "Use In Narration"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
        <div className="border-b border-white/4 px-5 py-3.5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
            Clone Library
          </h3>
        </div>
        <CardContent className="space-y-3 p-4">
          {builtClones.length > 0 ? (
            builtClones.map((clone) => (
              <button
                key={clone.id}
                type="button"
                onClick={() => setSelectedCloneId(clone.id)}
                className={`w-full rounded-3xl border p-4 text-left transition-all ${
                  selectedCloneId === clone.id
                    ? "border-[#5c2d91]/30 bg-[#5c2d91]/10"
                    : "border-white/5 bg-white/2 hover:border-white/10"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold tracking-tight text-white/84">{clone.name}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-white/28">{clone.sourceLabel}</p>
                  </div>
                  <span className="text-[8px] font-black uppercase tracking-[0.18em] text-white/24">
                    {selectedCloneId === clone.id ? "Selected" : "Choose"}
                  </span>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
              <p className="text-[11px] leading-relaxed text-white/30">
                No custom voice built yet. Add a sample and build your first clone.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

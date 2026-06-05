"use client";

import { useId, useMemo, useRef, useState, useEffect, type ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Mic, Radio, ShieldCheck, Upload, Waves, Trash2 } from "lucide-react";

import { readBuiltClones, writeBuiltClones, syncBuiltClonesFromServer, removeBuiltClone, type BuiltClone } from "./voice-clone-storage";

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
  const [, setRecordedBlob] = useState<Blob | null>(null);
  const [, setUploadedFile] = useState<File | null>(null);
  const [builtClones, setBuiltClones] = useState<BuiltClone[]>(() => readBuiltClones());
  const [selectedCloneId, setSelectedCloneId] = useState<string | null>(() => readBuiltClones()[0]?.id ?? null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Sync clones from server on mount (Supabase when configured, file otherwise).
  // Mount-only: the initial selectedCloneId is read intentionally once.
  useEffect(() => {
    syncBuiltClonesFromServer().then((clones) => {
      setBuiltClones(clones);
      if (!selectedCloneId && clones.length > 0) {
        setSelectedCloneId(clones[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const chunksRef = useRef<Blob[]>([]);

  // Delete a cloned voice (local cache + server: DELETE /voice-clones/:id).
  const handleDeleteClone = async (id: string) => {
    const next = await removeBuiltClone(id);
    setBuiltClones(next);
    if (selectedCloneId === id) {
      setSelectedCloneId(next[0]?.id ?? null);
    }
  };

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
      ? "border-primary bg-primary/10 text-primary"
      : "border-border bg-card text-muted-foreground";

  const handleUploadSample = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadedFile(file);
    setRecordedBlob(null);
    setSampleLabel(`${file.name} • ${formatFileSize(file.size)}`);
    setIsRecording(false);
    event.target.value = "";
  };

  const startRecording = async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const seconds = Math.max(1, Math.round(blob.size / 16000));
        setRecordedBlob(blob);
        setUploadedFile(null);
        setSampleLabel(`Recorded sample • ~${seconds}s`);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      // Permission denied or mic unavailable — fail silently, UI stays intact
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  const clearSample = () => {
    // Arrêter l'enregistrement en cours s'il y en a un
    if (isRecording) {
      stopRecording();
    }
    setSampleLabel(null);
    setRecordedBlob(null);
    setUploadedFile(null);
    setIsRecording(false);
  };

  const buildClone = () => {
    if (!sampleLabel || !consentGranted) return;

    const nextClone: BuiltClone = {
      id: `clone-${Date.now()}`,
      name: cloneName.trim().length > 0 ? cloneName.trim() : "My Custom Voice",
      sourceLabel: sampleLabel,
    };

    const nextClones = [nextClone, ...builtClones].slice(0, 5);
    setBuiltClones(nextClones);
    setSelectedCloneId(nextClone.id);
    // Persist to server (Supabase / file) + update local cache.
    void writeBuiltClones(nextClones);
  };

  const selectedClone =
    builtClones.find((clone) => clone.id === selectedCloneId) ??
    builtClones[0] ??
    null;

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
                <Mic className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">Clone Voice</h3>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground font-mono">
                Add a voice sample, confirm consent, then build a reusable custom voice route.
              </p>
            </div>
            <Badge variant="outline" className={`text-[8px] uppercase tracking-[0.18em] rounded-none font-mono ${readinessTone}`}>
              {readiness}
            </Badge>
          </div>
        </div>

        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-none border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <Upload className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] font-display">Voice Sample</h3>
              </div>

              <input
                id={inputId}
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aiff"
                onChange={handleUploadSample}
                className="hidden"
              />

              <div className="mt-4 space-y-3 rounded-none border border-dashed border-border bg-card p-4 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-none border border-border bg-background">
                  <Mic className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-bold text-foreground font-mono">
                    {sampleLabel ?? (isRecording ? "Recording in progress..." : "Upload or record a clean sample")}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                    10 to 20 seconds recommended
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <label
                    htmlFor={inputId}
                    className="inline-flex h-9 cursor-pointer items-center rounded-none bg-primary px-5 text-[9px] font-black uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 font-mono"
                  >
                    Choose File
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={toggleRecording}
                    className="h-9 rounded-none border-border bg-background px-5 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-primary/10 hover:text-foreground font-mono"
                  >
                    <Radio className="mr-2 h-3 w-3" />
                    {isRecording ? "Stop Recording" : "Record"}
                  </Button>
                  {sampleLabel ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearSample}
                      className="h-9 rounded-none border-border bg-background px-5 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-primary/10 hover:text-foreground font-mono"
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-none border border-border bg-background p-4">
              <div className="flex items-center gap-2 text-foreground">
                <Waves className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] font-display">Clone Setup</h3>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground font-mono">Clone Name</p>
                  <Input
                    value={cloneName}
                    onChange={(event) => setCloneName(event.target.value)}
                    className="h-10 rounded-none border-border bg-card text-[11px] font-medium text-foreground font-mono"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground font-mono">Language</p>
                  <Select value={language} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="h-10 rounded-none border-border bg-card text-[10px] font-bold font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                      <p className="text-[10px] font-bold text-foreground font-display">Noise Cleanup</p>
                      <p className="text-[9px] text-muted-foreground font-mono">Reduce room noise before extraction.</p>
                    </div>
                    <Switch checked={noiseCleanup} onCheckedChange={setNoiseCleanup} className="data-[state=checked]:bg-primary" />
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-foreground font-display">Retain Emotion</p>
                      <p className="text-[9px] text-muted-foreground font-mono">Keep the reference expression and dynamics.</p>
                    </div>
                    <Switch checked={retainEmotion} onCheckedChange={setRetainEmotion} className="data-[state=checked]:bg-primary" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-none border border-border bg-background p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">Consent</p>
                  <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">
                    Confirm that you own this voice sample or have permission to clone it.
                  </p>
                </div>
              </div>
              <Switch checked={consentGranted} onCheckedChange={setConsentGranted} className="data-[state=checked]:bg-primary" />
            </div>

            <div className="mt-4 space-y-2">
              {[
                { label: "Reference sample added", done: Boolean(sampleLabel) },
                { label: "Consent confirmed", done: consentGranted },
                { label: "Clone can be built", done: Boolean(sampleLabel) && consentGranted },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <CheckCircle2 className={`h-4 w-4 ${item.done ? "text-primary" : "text-muted-foreground/30"}`} />
                  <span className={`text-[9px] font-medium uppercase tracking-[0.18em] font-mono ${item.done ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-none border border-border bg-background p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">Clone Action</p>
                <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">
                  Build the custom voice profile first, then apply that custom route back to narration.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!sampleLabel || !consentGranted}
                  onClick={buildClone}
                  className="h-10 rounded-none bg-primary px-6 text-[10px] font-black uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90 disabled:opacity-40 font-mono"
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
                  className="h-10 rounded-none border-border bg-background px-6 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-primary/10 hover:text-foreground disabled:opacity-40 font-mono"
                >
                  {selectedClone ? `Use ${selectedClone.name}` : "Use In Narration"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
        <div className=" px-5 py-3.5">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
            Clone Library
          </h3>
        </div>
        <CardContent className="space-y-3 p-4">
          {builtClones.length > 0 ? (
            builtClones.map((clone) => (
              <div
                key={clone.id}
                onClick={() => setSelectedCloneId(clone.id)}
                className={`group/clone w-full cursor-pointer rounded-none border p-4 text-left transition-all ${
                  selectedCloneId === clone.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold tracking-tight text-foreground font-mono truncate">{clone.name}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground font-mono truncate">{clone.sourceLabel}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`text-[8px] font-black uppercase tracking-[0.18em] font-mono ${selectedCloneId === clone.id ? "text-primary" : "text-muted-foreground"}`}>
                      {selectedCloneId === clone.id ? "Selected" : "Choose"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleDeleteClone(clone.id); }}
                      title="Delete this cloned voice"
                      className="rounded-none p-1 text-muted-foreground/50 opacity-0 transition-all hover:text-destructive group-hover/clone:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-none border border-border bg-background p-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                No custom voice built yet. Add a sample and build your first clone.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

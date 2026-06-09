"use client";

import { useId, useState, type ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Music2, Sparkles, Upload, Volume2, X } from "lucide-react";
import { clearProjectMusicTracks, deleteProjectMusicTrack, uploadProjectMusicTrack } from "@/lib/projects-api";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";
import { CardInfoHeader } from "@/features/editor-lab/components/CardInfoHeader";
import type { MusicMode, MusicMood, UploadedMusicTrack } from "./music-lab-preset";

const musicModeOptions: Array<{
  id: MusicMode;
  label: string;
  hint: string;
}> = [
  {
    id: "uploaded",
    label: "Upload Tracks",
    hint: "Bring your own music files and keep them as the source for this project.",
  },
  {
    id: "ai",
    label: "AI Generate",
    hint: "Define the music direction now so the soundtrack can be generated later.",
  },
];

const moodOptions: Array<{
  id: MusicMood;
  label: string;
  hint: string;
}> = [
  { id: "cinematic", label: "Cinematic", hint: "Broad, polished, trailer-like." },
  { id: "uplifting", label: "Uplifting", hint: "Brighter and more motivating." },
  { id: "dark", label: "Dark", hint: "More tension and contrast." },
  { id: "editorial", label: "Editorial", hint: "Clean, premium and documentary." },
  { id: "ambient", label: "Ambient", hint: "Soft texture with low distraction." },
];

function getSliderValue(value: number | readonly number[], fallback: number) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return typeof value === "number" ? value : fallback;
}

export function MusicLab() {
  const inputId = useId();
  const { musicPreset, setMusicPreset, projectDraft, projectRecord, setProjectRecord, musicEnabled, setMusicEnabled } = useEditorLab();
  const [isUploadingTracks, setIsUploadingTracks] = useState(false);
  const [isUpdatingTracks, setIsUpdatingTracks] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const hasPersistedProject = Boolean(projectRecord?.id || projectDraft?.projectId);
  const downloadableTrackCount = musicPreset.uploadedTracks.filter((track) => Boolean(track?.storagePath)).length;
  const selectedMode = musicModeOptions.find((option) => option.id === musicPreset.mode) ?? musicModeOptions[0];
  const selectedMood = moodOptions.find((option) => option.id === musicPreset.mood) ?? moodOptions[0];

  const syncProjectAudio = (nextAudio: Awaited<ReturnType<typeof deleteProjectMusicTrack>>) => {
    setProjectRecord((current) => (current ? { ...current, audio: nextAudio } : current));
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const projectId = projectRecord?.id || projectDraft?.projectId || null;

    if (files.length === 0) {
      return;
    }

    if (!projectId) {
      setUploadFeedback("Save this project first, then upload your music tracks.");
      event.target.value = "";
      return;
    }

    setIsUploadingTracks(true);
    setUploadFeedback(null);

    const nextTracks: UploadedMusicTrack[] = [];

    try {
      let latestAudio = null;

      for (const file of files) {
        const result = await uploadProjectMusicTrack(projectId, file);
        nextTracks.push(result.track);
        latestAudio = result.audio;
      }

      if (latestAudio) {
        syncProjectAudio(latestAudio);
      }
    } catch (error) {
      setUploadFeedback(
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Unable to upload the selected tracks right now.",
      );
    } finally {
      setIsUploadingTracks(false);
    }

    if (nextTracks.length > 0) {
      setUploadFeedback(null);
      setMusicPreset((current) => ({
        ...current,
        mode: "uploaded",
        uploadedTracks: [
          ...current.uploadedTracks,
          ...nextTracks.filter((candidate) => !current.uploadedTracks.some((track) => track.id === candidate.id)),
        ],
      }));
    }

    event.target.value = "";
  };

  const removeTrack = async (trackId: string) => {
    const projectId = projectRecord?.id || projectDraft?.projectId || null;

    setIsUpdatingTracks(true);

    try {
      if (projectId) {
        const nextAudio = await deleteProjectMusicTrack(projectId, trackId);
        syncProjectAudio(nextAudio);
      }

      setMusicPreset((current) => ({
        ...current,
        uploadedTracks: current.uploadedTracks.filter((track) => track.id !== trackId),
      }));
    } finally {
      setIsUpdatingTracks(false);
    }
  };

  const clearTracks = async () => {
    const projectId = projectRecord?.id || projectDraft?.projectId || null;

    setIsUpdatingTracks(true);

    try {
      if (projectId) {
        const nextAudio = await clearProjectMusicTracks(projectId);
        syncProjectAudio(nextAudio);
      }

      setMusicPreset((current) => ({
        ...current,
        uploadedTracks: [],
      }));
    } finally {
      setIsUpdatingTracks(false);
    }
  };

  const handleModeChange = async (nextMode: MusicMode) => {
    const projectId = projectRecord?.id || projectDraft?.projectId || null;

    if (nextMode === "uploaded") {
      setMusicPreset((current) => ({
        ...current,
        mode: "uploaded",
      }));
      return;
    }

    if (musicPreset.mode === "uploaded" && musicPreset.uploadedTracks.length > 0) {
      setIsUpdatingTracks(true);

      try {
        if (projectId) {
          const nextAudio = await clearProjectMusicTracks(projectId, "auto");
          syncProjectAudio(nextAudio);
        }

        setMusicPreset((current) => ({
          ...current,
          mode: "ai",
          uploadedTracks: [],
        }));
      } finally {
        setIsUpdatingTracks(false);
      }

      return;
    }

    setMusicPreset((current) => ({
      ...current,
      mode: "ai",
    }));
  };

  return (
    <div className="mx-auto max-w-[90%] space-y-6 animate-in fade-in duration-700">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
        <div className="space-y-5">
          <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
            <CardInfoHeader
              title="Music Layer"
              subtitle="Toggle global music state for this project."
              info={<>
                <p>Active ou désactive la couche musicale pour l'ensemble du projet. Quand désactivée, aucune musique n'est générée ni utilisée lors de l'assemblage — la vidéo finale contient uniquement la narration et les SFX.</p>
                <p className="text-muted-foreground/50">Tu peux désactiver la musique pour livrer un projet "voix sèche" ou pour ajouter ta propre musique en post-production.</p>
              </>}
            />
            <CardContent className="p-3.5">
              <div className="flex items-center justify-between rounded-none border border-border bg-background px-4 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-mono">
                    {musicEnabled ? "Music enabled" : "Music disabled"}
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground font-mono">
                    {musicEnabled ? "Music styling and settings are active." : "Soundtrack generation and custom uploads are hidden."}
                  </p>
                </div>
                <Switch className="data-[state=checked]:bg-primary" checked={musicEnabled} onCheckedChange={setMusicEnabled} />
              </div>
            </CardContent>
          </Card>

          {musicEnabled ? (
            <>
              <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                <CardInfoHeader
                  title="Music Source"
                  subtitle="Select between uploaded tracks or an AI-generated soundtrack."
                  info={<>
                    <p><span className="text-foreground font-bold">Upload Tracks</span> — Tu fournis tes propres fichiers audio (MP3, WAV, AIFF, M4A). Le système les utilise directement lors de l'assemblage sans passer par un générateur IA. Idéal si tu as une bibliothèque musicale ou des droits sur des tracks spécifiques.</p>
                    <p><span className="text-foreground font-bold">AI Generate</span> — Le système génère une bande originale IA adaptée au ton du projet. Tu définis l'ambiance (mood) et une description optionnelle maintenant. La génération effective se fait plus tard à l'étape Audio.</p>
                  </>}
                />
                <CardContent className="space-y-3.5 p-3.5">
                  {musicModeOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => void handleModeChange(option.id)}
                      disabled={isUploadingTracks || isUpdatingTracks}
                      className={`w-full rounded-none border px-4 py-4 text-left transition-all ${
                        musicPreset.mode === option.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      <span className={`block text-[10px] font-black uppercase tracking-[0.18em] font-mono ${musicPreset.mode === option.id ? "text-primary" : "text-muted-foreground"}`}>
                        {option.label}
                      </span>
                      <span className={`mt-1 block text-[11px] leading-relaxed font-mono ${musicPreset.mode === option.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                        {option.hint}
                      </span>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                <CardInfoHeader
                  title="Mix Finish"
                  subtitle="Ending behavior and narration-aware ducking."
                  info={<>
                    <p><span className="text-foreground font-bold">Music Ending</span> — Applique un fondu de sortie progressif sur la musique à la fin de la vidéo. Sans ce fondu, la musique s'arrête abruptement. La durée définit combien de secondes avant la fin le fondu démarre.</p>
                    <p><span className="text-foreground font-bold">Dynamic Volume</span> — Quand activé, le volume de la musique monte légèrement pendant les silences de narration, puis redescend dès que la voix reprend. Donne au mix plus de vie et de profondeur sans masquer la parole.</p>
                  </>}
                />
                <CardContent className="space-y-4 p-3.5">
                  <div className="rounded-none border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                          Music Ending
                        </h4>
                        <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                          Fade the music bed cleanly at the end of the video.
                        </p>
                      </div>
                      <Switch
                        checked={musicPreset.endingFadeEnabled}
                        onCheckedChange={(checked) =>
                          setMusicPreset((current) => ({
                            ...current,
                            endingFadeEnabled: checked,
                          }))
                        }
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>

                    <div className="mt-4 rounded-none border border-border bg-card p-3">
                      <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                        <span>Fade duration</span>
                        <span className="font-mono text-foreground">{musicPreset.endingFadeDuration.toFixed(1)}s</span>
                      </div>
                      <div className="mt-2">
                        <Slider
                          value={[musicPreset.endingFadeDuration]}
                          onValueChange={(value) =>
                            setMusicPreset((current) => ({
                              ...current,
                              endingFadeDuration: getSliderValue(value, 2.5),
                            }))
                          }
                          max={8}
                          min={0.5}
                          step={0.5}
                          disabled={!musicPreset.endingFadeEnabled}
                          className="**:[[role=slider]]:bg-primary **:[[role=slider]]:w-4 **:[[role=slider]]:h-4 **:[[role=slider]]:border-primary **:[[role=slider]]:rounded-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-none border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                          Dynamic Volume
                        </h4>
                        <p className="text-[11px] leading-relaxed text-muted-foreground font-mono">
                          Lift the bed a little when narration pauses.
                        </p>
                      </div>
                      <Switch
                        checked={musicPreset.dynamicVolume}
                        onCheckedChange={(checked) =>
                          setMusicPreset((current) => ({
                            ...current,
                            dynamicVolume: checked,
                          }))
                        }
                        className="data-[state=checked]:bg-primary"
                      />
                    </div>
                    <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground font-mono">
                      {musicPreset.dynamicVolume
                        ? "The bed breathes a little more around the narration."
                        : "The music stays flatter and more constant under the voice."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>

        <div className="space-y-5">
          {musicEnabled ? (
            <>
              <Card className="overflow-hidden rounded-none border border-border bg-black shadow-none">
                <div className=" px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-foreground">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.22em] font-display">
                          Music Direction
                        </h3>
                      </div>
                      <p className="text-[10px] font-medium text-muted-foreground font-mono">
                        Configure imported tracks or AI music design.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                    >
                      {selectedMode.label}
                    </Badge>
                  </div>
                </div>

                <CardContent className="space-y-5 p-5">
                  {musicPreset.mode === "uploaded" ? (
                    <>
                      <div className="rounded-none border border-dashed border-border bg-background p-5 hover:border-primary/50 transition-colors">
                        <input
                          id={inputId}
                          type="file"
                          accept="audio/*,.mp3,.wav,.aiff,.m4a"
                          multiple
                          onChange={handleUpload}
                          className="hidden"
                          disabled={!hasPersistedProject || isUploadingTracks}
                        />
                        <label
                          htmlFor={inputId}
                          className={`flex flex-col items-center justify-center gap-3 text-center ${
                            hasPersistedProject ? "cursor-pointer" : "cursor-not-allowed opacity-60"
                          }`}
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-none border border-border bg-card">
                            {isUploadingTracks ? <Sparkles className="h-5 w-5 animate-spin text-primary" /> : <Upload className="h-5 w-5 text-primary" />}
                          </div>
                          <div className="space-y-1">
                            <p className="text-[11px] font-bold text-foreground font-mono">{isUploadingTracks ? "Uploading Tracks..." : "Upload Audio Tracks"}</p>
                            <p className="text-[10px] leading-relaxed text-muted-foreground font-mono">
                              {hasPersistedProject
                                ? "Add the music files you want this project to use later in production."
                                : "Save this project first, then upload the music files you want to attach to it."}
                            </p>
                            {uploadFeedback ? (
                              <p className="text-[10px] leading-relaxed text-destructive font-mono">{uploadFeedback}</p>
                            ) : null}
                          </div>
                        </label>
                      </div>

                      <div className="rounded-none border border-border bg-background p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                            Uploaded Tracks
                          </p>
                          {musicPreset.uploadedTracks.length > 0 ? (
                            <button
                              type="button"
                              onClick={clearTracks}
                              className="text-[8px] font-black uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground font-mono"
                            >
                              Clear all
                            </button>
                          ) : null}
                        </div>

                        {musicPreset.uploadedTracks.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {musicPreset.uploadedTracks.map((track) => (
                              <div
                                key={track.id}
                                className="flex items-center justify-between gap-3 rounded-none border border-border bg-card px-3 py-3"
                              >
                                <div className="space-y-1">
                                  <p className="text-[11px] font-semibold tracking-tight text-foreground font-mono">
                                    {track.name}
                                  </p>
                                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
                                    {track.sizeLabel}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void removeTrack(track.id)}
                                  disabled={isUpdatingTracks}
                                  className="rounded-none border border-border p-2 text-muted-foreground transition hover:bg-primary/10 hover:border-primary/50 hover:text-foreground"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground font-mono">
                            No tracks added yet. Upload the music files you want to keep for this project.
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-none border border-border bg-background p-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-none border border-border bg-card">
                            <Music2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                              AI Music Brief
                            </p>
                            <p className="text-[15px] font-semibold tracking-tight text-muted-foreground font-mono">
                              {selectedMood.label}
                            </p>
                          </div>
                        </div>
                        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground font-mono">
                          Describe the soundtrack characteristics for the AI generator.
                        </p>
                        <textarea
                          value={musicPreset.generationBrief}
                          onChange={(event) =>
                            setMusicPreset((current) => ({
                              ...current,
                              generationBrief: event.target.value,
                            }))
                          }
                          placeholder="Example: Build a clean cinematic bed with a strong intro lift, subtle percussion, and a softer emotional landing."
                          className="mt-4 min-h-36 w-full resize-none rounded-none border border-border bg-card px-4 py-4 text-[12px] leading-relaxed text-foreground font-mono outline-none transition placeholder:text-muted-foreground/30 focus:border-primary/50"
                        />
                      </div>

                      <Card className="overflow-hidden rounded-none border-border bg-transparent shadow-none">
                        <CardContent className="grid grid-cols-1 gap-3 p-3.5 sm:grid-cols-2 xl:grid-cols-3">
                          {moodOptions.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() =>
                                setMusicPreset((current) => ({
                                  ...current,
                                  mood: option.id,
                                }))
                              }
                              className={`rounded-none border px-4 py-4 text-left transition-all ${
                                musicPreset.mood === option.id
                                  ? "border-primary bg-primary/10"
                                  : "border-border bg-card hover:border-primary/50"
                              }`}
                            >
                              <span className={`block text-[10px] font-black uppercase tracking-[0.18em] font-mono ${musicPreset.mood === option.id ? "text-primary" : "text-muted-foreground"}`}>
                                {option.label}
                              </span>
                              <span className={`mt-1 block text-[11px] leading-relaxed font-mono ${musicPreset.mood === option.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                                {option.hint}
                              </span>
                            </button>
                          ))}
                        </CardContent>
                      </Card>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-none border border-border bg-card shadow-none">
                <div className=" px-5 py-3.5">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-display">
                    Current Plan
                  </h3>
                </div>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                    >
                      {selectedMode.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                    >
                      {musicPreset.mode === "uploaded"
                        ? `${downloadableTrackCount} track${downloadableTrackCount > 1 ? "s" : ""}`
                        : selectedMood.label}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono"
                    >
                      {musicPreset.endingFadeEnabled
                        ? `Fade ${musicPreset.endingFadeDuration.toFixed(1)}s`
                        : "No Fade"}
                    </Badge>
                  </div>

                  <div className="rounded-none border border-border bg-background p-4">
                    <div className="flex items-center gap-2 text-foreground">
                      <Volume2 className="h-4 w-4 text-primary" />
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-foreground font-display">
                        Mix Note
                      </p>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground font-mono">
                      {musicPreset.mode === "uploaded"
                        ? downloadableTrackCount > 0
                          ? "This project will rely on uploaded music tracks instead of generating a new soundtrack."
                          : "Upload the tracks you want to reserve for this project."
                        : musicPreset.generationBrief.trim().length > 0
                          ? musicPreset.generationBrief
                          : "Add a short AI brief so the soundtrack generator knows what to create later."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="flex flex-col items-center justify-center rounded-none border border-border bg-black/40 min-h-[350px] p-6 text-center shadow-none">
              <div className="space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-none border border-border bg-card/90">
                  <Music2 className="h-6 w-6 text-muted-foreground opacity-60" />
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/60 font-mono">
                    Soundtrack off
                  </p>
                  <p className="text-lg font-bold text-foreground/70 font-display uppercase tracking-wider">
                    Music is disabled
                  </p>
                  <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-muted-foreground/50 font-mono">
                    This project will be produced without background music. Enable the music layer if you want to upload tracks or generate an AI-designed soundtrack.
                  </p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

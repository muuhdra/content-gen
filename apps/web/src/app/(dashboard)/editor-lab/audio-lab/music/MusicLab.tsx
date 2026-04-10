"use client";

import { useId, useState, type ChangeEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Music2, Sparkles, Upload, Volume2, X } from "lucide-react";
import { clearProjectMusicTracks, deleteProjectMusicTrack, uploadProjectMusicTrack } from "@/lib/projects-api";

import { useEditorLab } from "../../editor-lab-context";
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
  const { musicPreset, setMusicPreset, projectDraft, projectRecord, setProjectRecord } = useEditorLab();
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

    let nextTracks: UploadedMusicTrack[] = [];

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
          <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
            <div className="border-b border-white/4 px-5 py-3.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                Music Source
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-white/22">
                Choose whether this project uses uploaded tracks or an AI-generated soundtrack.
              </p>
            </div>
            <CardContent className="space-y-3.5 p-3.5">
              {musicModeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => void handleModeChange(option.id)}
                  disabled={isUploadingTracks || isUpdatingTracks}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition-all ${
                    musicPreset.mode === option.id
                      ? "border-white/18 bg-white/6"
                      : "border-white/5 bg-white/2 hover:border-white/12"
                  }`}
                >
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/72">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-relaxed text-white/26">
                    {option.hint}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
            <div className="border-b border-white/4 px-5 py-3.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                Mix Finish
              </h3>
              <p className="mt-1 text-[11px] leading-relaxed text-white/22">
                Shape the ending and how the music behaves around narration.
              </p>
            </div>
            <CardContent className="space-y-4 p-3.5">
              <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                      Music Ending
                    </h4>
                    <p className="text-[11px] leading-relaxed text-white/25">
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
                    className="data-[state=checked]:bg-[#5c2d91]"
                  />
                </div>

                <div className="mt-4 rounded-2xl border border-white/5 bg-black/20 p-3">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
                    <span>Fade duration</span>
                    <span className="font-mono text-white/75">{musicPreset.endingFadeDuration.toFixed(1)}s</span>
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
                      className="**:[[role=slider]]:bg-white **:[[role=slider]]:w-4 **:[[role=slider]]:h-4 **:[[role=slider]]:border-[#5c2d91]"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                      Dynamic Volume
                    </h4>
                    <p className="text-[11px] leading-relaxed text-white/25">
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
                    className="data-[state=checked]:bg-[#5c2d91]"
                  />
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-white/30">
                  {musicPreset.dynamicVolume
                    ? "The bed breathes a little more around the narration."
                    : "The music stays flatter and more constant under the voice."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden rounded-[30px] border-white/5 bg-[#050508] shadow-xl">
            <div className="border-b border-white/5 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-white/72">
                    <Sparkles className="h-3.5 w-3.5 text-[#9b6dff]" />
                    <h3 className="text-[10px] font-black uppercase tracking-[0.22em]">
                      Music Direction
                    </h3>
                  </div>
                  <p className="text-[10px] font-medium text-white/22">
                    This step now splits clearly between imported tracks and AI music design.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
                >
                  {selectedMode.label}
                </Badge>
              </div>
            </div>

            <CardContent className="space-y-5 p-5">
              {musicPreset.mode === "uploaded" ? (
                <>
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/2 p-5">
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
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                        {isUploadingTracks ? <Sparkles className="h-5 w-5 animate-spin text-[#9b6dff]" /> : <Upload className="h-5 w-5 text-[#9b6dff]" />}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-white/82">{isUploadingTracks ? "Uploading Tracks..." : "Upload Audio Tracks"}</p>
                        <p className="text-[10px] leading-relaxed text-white/28">
                          {hasPersistedProject
                            ? "Add the music files you want this project to use later in production."
                            : "Save this project first, then upload the music files you want to attach to it."}
                        </p>
                        {uploadFeedback ? (
                          <p className="text-[10px] leading-relaxed text-amber-300/90">{uploadFeedback}</p>
                        ) : null}
                      </div>
                    </label>
                  </div>

                  <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                        Uploaded Tracks
                      </p>
                      {musicPreset.uploadedTracks.length > 0 ? (
                        <button
                          type="button"
                          onClick={clearTracks}
                          className="text-[8px] font-black uppercase tracking-[0.18em] text-white/35 transition hover:text-white/72"
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
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/20 px-3 py-3"
                          >
                            <div className="space-y-1">
                              <p className="text-[11px] font-semibold tracking-tight text-white/82">
                                {track.name}
                              </p>
                              <p className="text-[9px] uppercase tracking-[0.18em] text-white/24">
                                {track.sizeLabel}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void removeTrack(track.id)}
                              disabled={isUpdatingTracks}
                              className="rounded-full border border-white/10 p-2 text-white/25 transition hover:bg-white/5 hover:text-white/72"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-[11px] leading-relaxed text-white/30">
                        No tracks added yet. Upload the music files you want to keep for this project.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-3xl border border-white/5 bg-[linear-gradient(180deg,rgba(92,45,145,0.12),rgba(255,255,255,0.02))] p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
                        <Music2 className="h-5 w-5 text-[#9b6dff]" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                          AI Music Brief
                        </p>
                        <p className="text-[15px] font-semibold tracking-tight text-white/88">
                          {selectedMood.label}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 text-[11px] leading-relaxed text-white/32">
                      Describe the kind of soundtrack the generator should create for this project.
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
                      className="mt-4 min-h-36 w-full resize-none rounded-3xl border border-white/5 bg-black/20 px-4 py-4 text-[12px] leading-relaxed text-white outline-none transition placeholder:text-white/18 focus:border-white/14"
                    />
                  </div>

                  <Card className="overflow-hidden rounded-3xl border-white/5 bg-white/2 shadow-none">
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
                          className={`rounded-3xl border px-4 py-4 text-left transition-all ${
                            musicPreset.mood === option.id
                              ? "border-white/18 bg-white/6"
                              : "border-white/5 bg-black/20 hover:border-white/12"
                          }`}
                        >
                          <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/72">
                            {option.label}
                          </span>
                          <span className="mt-1 block text-[11px] leading-relaxed text-white/26">
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

          <Card className="overflow-hidden rounded-3xl border-white/4 bg-[#08080c] shadow-xl">
            <div className="border-b border-white/4 px-5 py-3.5">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                Current Plan
              </h3>
            </div>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
                >
                  {selectedMode.label}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
                >
                  {musicPreset.mode === "uploaded"
                    ? `${downloadableTrackCount} track${downloadableTrackCount > 1 ? "s" : ""}`
                    : selectedMood.label}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]"
                >
                  {musicPreset.endingFadeEnabled
                    ? `Fade ${musicPreset.endingFadeDuration.toFixed(1)}s`
                    : "No Fade"}
                </Badge>
              </div>

              <div className="rounded-3xl border border-white/5 bg-white/2 p-4">
                <div className="flex items-center gap-2 text-white/75">
                  <Volume2 className="h-4 w-4 text-[#9b6dff]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
                    Mix Note
                  </p>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-white/30">
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
        </div>
      </div>
    </div>
  );
}

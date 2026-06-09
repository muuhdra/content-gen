"use client";

import React, { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeProjectStyle,
  deleteProjectReferenceAsset,
  getProjectReferencePreviewUrl,
  updateProject,
  uploadProjectReferenceAsset,
  type ProjectReferenceAsset,
} from "@/lib/projects-api";
import { Box, ImageIcon, Map, MapPin, Palette, Search, Trash2, Upload, User, X, Film, PlayCircle as Youtube, Sparkles, Wand2 } from "lucide-react";
import { writeProjectDraft } from "@/features/projects/utils/project-draft";

import { useEditorLab } from "@/features/editor-lab/editor-lab-context";

type VisualReferenceLabel = "Character" | "Scene" | "Object" | "Style" | "Map";

type VisualReference = {
  id: string;
  name: string;
  label: VisualReferenceLabel;
  kind: ProjectReferenceAsset["kind"];
  preview: string | null;
  storagePath?: string | null;
};

const labelOptions: VisualReferenceLabel[] = ["Character", "Scene", "Object", "Style", "Map"];

const stylePresets = [
  "Cinematic lighting",
  "35mm realism",
  "Soft grain",
  "High contrast",
  "Editorial framing",
  "Neon ambience",
];

const formatStarters = {
  short:
    "Vertical short-form framing, thumb-stopping contrast, bold subject separation, fast readability and high-impact compositions built for quick cuts.",
  video:
    "Cinematic long-form framing, premium textures, intentional lighting, realistic depth and strong scene-to-scene visual consistency.",
  slideshow:
    "Editorial slide design, clear hierarchy, persuasive layout structure, premium diagrams and text-first visual logic with restrained motion.",
} as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendPromptChunk(current: string, chunk: string) {
  const nextChunk = chunk.trim();

  if (!nextChunk) {
    return current;
  }

  if (current.toLowerCase().includes(nextChunk.toLowerCase())) {
    return current;
  }

  return current.trim().length === 0 ? nextChunk : `${current.trim()}\n\n${nextChunk}`;
}

function removePromptChunk(current: string, chunk: string) {
  const escapedChunk = escapeRegExp(chunk.trim());

  if (!escapedChunk) {
    return current;
  }

  return current
    .replace(new RegExp(`\\n?\\n?${escapedChunk}`, "i"), "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function togglePresetChunk(current: string, chunk: string) {
  return current.toLowerCase().includes(chunk.toLowerCase())
    ? removePromptChunk(current, chunk)
    : appendPromptChunk(current, chunk);
}

function toVisualLabel(label?: ProjectReferenceAsset["label"] | string | null): VisualReferenceLabel {
  switch ((label ?? "").toLowerCase()) {
    case "character":
      return "Character";
    case "scene":
      return "Scene";
    case "object":
      return "Object";
    case "map-motion":
      return "Map";
    case "style":
    default:
      return "Style";
  }
}

function toAssetLabel(label: VisualReferenceLabel): ProjectReferenceAsset["label"] {
  switch (label) {
    case "Character":
      return "character";
    case "Scene":
      return "scene";
    case "Object":
      return "object";
    case "Map":
      return "map-motion";
    case "Style":
    default:
      return "style";
  }
}

function getReferenceIcon(label: VisualReferenceLabel) {
  if (label === "Character") return User;
  if (label === "Scene") return MapPin;
  if (label === "Object") return Box;
  if (label === "Map") return Map;
  return Palette;
}

export function VisualsLab() {
  const {
    projectDraft,
    setProjectDraft,
    setProjectRecord,
    visualStyle,
    setVisualStyle,
    references,
    setReferences,
    narrationStyle,
  } = useEditorLab();
  const [referenceFilter, setReferenceFilter] = useState<"All" | VisualReferenceLabel | "map-motion">("All");
  const [referenceQuery, setReferenceQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // YouTube modal states
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeName, setYoutubeName] = useState("");
  const [youtubeLabel, setYoutubeLabel] = useState<VisualReferenceLabel>("Style");

  // Style reverse-engineering (vision analysis of uploaded "style" references)
  const [styleBrief, setStyleBrief] = useState<string>("");
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [styleAnalysisError, setStyleAnalysisError] = useState<string | null>(null);
  const hasStyleReferences = (references as ProjectReferenceAsset[]).some(
    (ref) => ref?.label === "style" && (Boolean(ref?.storagePath) || ref?.kind === "reference-youtube"),
  );

  const handleAnalyzeStyle = async () => {
    if (!projectDraft?.projectId) {
      setStyleAnalysisError("Save the project once before analyzing the style.");
      return;
    }
    setIsAnalyzingStyle(true);
    setStyleAnalysisError(null);
    try {
      const { brief } = await analyzeProjectStyle(projectDraft.projectId);
      setStyleBrief(brief);
    } catch (error) {
      setStyleAnalysisError(error instanceof Error ? error.message : "Style analysis failed.");
    } finally {
      setIsAnalyzingStyle(false);
    }
  };

  const getYouTubeThumbnail = (url?: string | null): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    const videoId = (match && match[2].length === 11) ? match[2] : null;
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  };

  const handleAddYoutubeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    const newRef: ProjectReferenceAsset = {
      id: `reference-${Math.random().toString(36).substring(2, 15)}`,
      name: youtubeName.trim() || "YouTube Reference",
      kind: "reference-youtube",
      label: toAssetLabel(youtubeLabel),
      storagePath: youtubeUrl.trim(),
      preview: null,
      scopeId: projectDraft?.projectId || projectDraft?.referenceDraftId || null,
      mimeType: "text/html",
      sizeLabel: "External URL",
      uploadedAt: new Date().toISOString(),
    };

    const mergedReferences = [...(references as ProjectReferenceAsset[]), newRef];

    if (projectDraft?.projectId) {
      try {
        const persistedProject = await updateProject(projectDraft.projectId, {
          references: mergedReferences,
        });
        setProjectRecord(persistedProject);
        persistReferenceList(persistedProject.references ?? mergedReferences);
      } catch (error) {
        console.error("Unable to link YouTube reference.", error);
      }
    } else {
      persistReferenceList(mergedReferences);
    }

    setYoutubeUrl("");
    setYoutubeName("");
    setYoutubeLabel("Style");
    setYoutubeModalOpen(false);
  };

  const normalizedReferences: VisualReference[] = (references as Partial<ProjectReferenceAsset>[])
    .filter((reference) => reference && typeof reference.id === "string")
    .map((reference) => ({
      id: reference.id as string,
      name: reference.name?.trim() || "Untitled reference",
      label: toVisualLabel(reference.label),
      kind: reference.kind || "reference-image",
      storagePath: reference.storagePath ?? null,
      preview: getProjectReferencePreviewUrl(reference as ProjectReferenceAsset),
    }));

  const filteredReferences = normalizedReferences.filter((reference) => {
    const query = referenceQuery.trim().toLowerCase();
    const matchesFilter = referenceFilter === "All" || reference.label === referenceFilter;
    const matchesQuery =
      query.length === 0 ||
      reference.name.toLowerCase().includes(query) ||
      reference.label.toLowerCase().includes(query);

    return matchesFilter && matchesQuery;
  });

  const formatStarter = projectDraft?.projectType ? formatStarters[projectDraft.projectType] : "";
  const projectDNAStarter = [
    projectDraft?.projectDescription?.trim() ? `Project brief: ${projectDraft.projectDescription.trim()}` : "",
    narrationStyle.trim() ? `Tone and direction: ${narrationStyle.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const openReferencePicker = () => {
    if (normalizedReferences.length < 15) {
      fileInputRef.current?.click();
    }
  };

  const handleAddReference = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0) {
      return;
    }

    const remainingSlots = Math.max(15 - normalizedReferences.length, 0);
    const selectedFiles = files.slice(0, remainingSlots);

    try {
      const nextReferences: ProjectReferenceAsset[] = await Promise.all(
        selectedFiles.map(async (file, index) => {
          const { asset, draftId } = await uploadProjectReferenceAsset(file, {
            projectId: projectDraft?.projectId ?? null,
            draftId: projectDraft?.referenceDraftId ?? null,
            label: "style",
          });

          if (!projectDraft?.projectId && draftId && projectDraft?.referenceDraftId !== draftId) {
            setProjectDraft((current) => {
              if (!current) {
                return current;
              }

              const nextDraft = {
                ...current,
                referenceDraftId: draftId,
              };

              writeProjectDraft(nextDraft);
              return nextDraft;
            });
          }

          return {
            ...asset,
            name: asset.name?.trim() || file.name.replace(/\.[^/.]+$/, "") || `Reference ${normalizedReferences.length + index + 1}`,
          };
        }),
      );

      const mergedReferences = [...(references as ProjectReferenceAsset[]), ...nextReferences];

      if (projectDraft?.projectId) {
        try {
          const persistedProject = await updateProject(projectDraft.projectId, {
            references: mergedReferences,
          });

          setProjectRecord(persistedProject);
          persistReferenceList(persistedProject.references ?? mergedReferences);
          // Auto reverse-engineer the style as soon as a Style reference lands.
          if (nextReferences.some((r) => r.label === "style")) {
            void handleAnalyzeStyle();
          }
        } catch (error) {
          await Promise.all(
            nextReferences
              .filter((reference) => reference.storagePath)
              .map((reference) =>
                deleteProjectReferenceAsset({
                  storagePath: reference.storagePath as string,
                  referenceId: reference.id,
                  draftId: reference.scopeId ?? null,
                }).catch((deleteError) => {
                  console.error("Unable to roll back the uploaded reference image.", deleteError);
                }),
              ),
          );

          throw error;
        }
      } else {
        persistReferenceList(mergedReferences);
      }
    } catch (error) {
      console.error("Unable to prepare reference assets.", error);
    }

    event.target.value = "";
  };

  const persistReferenceList = (nextReferences: ProjectReferenceAsset[]) => {
    setReferences(nextReferences);
    setProjectDraft((current) => {
      if (!current) {
        return current;
      }

      const nextDraft = {
        ...current,
        references: nextReferences,
      };

      writeProjectDraft(nextDraft);
      return nextDraft;
    });
  };

  const deleteReferenceFiles = async (removedReferences: ProjectReferenceAsset[]) => {
    await Promise.all(
      removedReferences
        .filter((reference) => reference.storagePath)
        .map((reference) =>
          deleteProjectReferenceAsset({
            storagePath: reference.storagePath as string,
            referenceId: reference.id,
            draftId: reference.scopeId ?? projectDraft?.referenceDraftId ?? null,
          }).catch((error) => {
            console.error("Unable to delete the reference image.", error);
          }),
        ),
    );
  };

  const persistReferenceRemoval = async (
    nextReferences: ProjectReferenceAsset[],
    removedReferences: ProjectReferenceAsset[],
  ) => {
    if (projectDraft?.projectId) {
      const persistedProject = await updateProject(projectDraft.projectId, {
        references: nextReferences,
      });

      setProjectRecord(persistedProject);
      persistReferenceList(persistedProject.references ?? nextReferences);
      await deleteReferenceFiles(removedReferences);
      return;
    }

    await deleteReferenceFiles(removedReferences);
    persistReferenceList(nextReferences);
  };

  const persistReferenceMetadata = async (nextReferences: ProjectReferenceAsset[]) => {
    if (projectDraft?.projectId) {
      const persistedProject = await updateProject(projectDraft.projectId, {
        references: nextReferences,
      });

      setProjectRecord(persistedProject);
      persistReferenceList(persistedProject.references ?? nextReferences);
      return;
    }

    persistReferenceList(nextReferences);
  };

  const handleRemoveReference = async (id: string) => {
    const removedReference = (references as ProjectReferenceAsset[]).find((reference) => reference.id === id);

    if (!removedReference) {
      return;
    }

    const nextReferences = (references as ProjectReferenceAsset[]).filter((reference) => reference.id !== id);

    try {
      await persistReferenceRemoval(nextReferences, [removedReference]);
    } catch (error) {
      console.error("Unable to update the reference kit.", error);
    }
  };

  const handleClearReferences = async () => {
    const removedReferences = [...(references as ProjectReferenceAsset[])];

    if (removedReferences.length === 0) {
      return;
    }

    try {
      await persistReferenceRemoval([], removedReferences);
    } catch (error) {
      console.error("Unable to clear the reference kit.", error);
    }
  };

  const handleUpdateLabel = (id: string, label: VisualReferenceLabel) => {
    const nextReferences = (references as ProjectReferenceAsset[]).map((reference) =>
      reference.id === id ? { ...reference, label: toAssetLabel(label) } : reference
    );

    persistReferenceList(nextReferences);
    void persistReferenceMetadata(nextReferences).catch((error) => {
      console.error("Unable to sync the reference metadata.", error);
    });
  };

  const handleUpdateName = (id: string, name: string) => {
    const nextReferences = (references as ProjectReferenceAsset[]).map((reference) =>
      reference.id === id ? { ...reference, name } : reference
    );

    persistReferenceList(nextReferences);
  };

  const handleCommitName = (id: string) => {
    const nextReferences = references as ProjectReferenceAsset[];
    const targetReference = nextReferences.find((reference) => reference.id === id);

    if (!targetReference) {
      return;
    }

    void persistReferenceMetadata(nextReferences).catch((error) => {
      console.error("Unable to sync the reference metadata.", error);
    });
  };

  const handleUseFormatStarter = () => {
    setVisualStyle((current) => appendPromptChunk(current, formatStarter));
  };

  const handleUseProjectDNA = () => {
    setVisualStyle((current) => appendPromptChunk(current, projectDNAStarter));
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr] animate-in fade-in duration-500">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleAddReference}
      />

      <div className="space-y-4">
        <div className="rounded-none border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-4 pb-3">
            <div className="space-y-1">
              <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-primary font-display">
                Visual Style Lock
              </h3>
              <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground font-sans">
                Locks the animation & art style — character design language, building shapes, environment and palette — applied to every scene of the project.
              </p>
            </div>
            <Badge variant="outline" className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono">
              {visualStyle.length} / 5000
            </Badge>
          </div>

          {/* Reverse-engineer the uploaded style references into a locked directive */}
          <div className="mt-1 space-y-2 rounded-none border border-primary/20 bg-gradient-to-b from-primary/[0.07] to-transparent p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary font-mono">Reverse-engineer style (AI)</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground font-sans">
                  Analyse tes références « Style » (image, extrait vidéo ou motion design) + ta description → directive verrouillée appliquée à chaque scène.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAnalyzeStyle}
                disabled={isAnalyzingStyle || !hasStyleReferences}
                className="h-9 shrink-0 rounded-none bg-primary px-4 text-[9px] font-black uppercase tracking-[0.18em] text-primary-foreground hover:bg-primary/90"
              >
                {isAnalyzingStyle ? <Sparkles className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
                {isAnalyzingStyle ? "Analyse..." : "Analyser & verrouiller"}
              </Button>
            </div>
            {!hasStyleReferences && (
              <p className="text-[10px] text-amber-300/70 font-mono">Upload au moins une référence avec le label « Style » pour activer l&apos;analyse.</p>
            )}
            {styleAnalysisError && (
              <p className="text-[10px] text-destructive/80 font-mono">{styleAnalysisError}</p>
            )}
            {styleBrief && (
              <div className="rounded-none border border-primary/15 bg-black/20 p-2.5">
                <p className="mb-1 text-[8px] font-black uppercase tracking-[0.18em] text-primary/70 font-mono">Directive de style verrouillée</p>
                <p className="text-[11px] leading-relaxed text-foreground/80 font-mono">{styleBrief}</p>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-none border-border bg-background px-4 text-[9px] font-black uppercase tracking-[0.18em] text-foreground hover:bg-card hover:text-foreground"
                onClick={handleUseFormatStarter}
                disabled={!formatStarter}
              >
                Use Format Starter
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-none border-border bg-background px-4 text-[9px] font-black uppercase tracking-[0.18em] text-foreground hover:bg-card hover:text-foreground"
                onClick={handleUseProjectDNA}
                disabled={!projectDNAStarter}
              >
                Use Project DNA
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-none px-4 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-card hover:text-foreground"
                onClick={() => setVisualStyle("")}
                disabled={visualStyle.trim().length === 0}
              >
                Clear
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {stylePresets.map((preset) => {
                const isActive = visualStyle.toLowerCase().includes(preset.toLowerCase());

                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setVisualStyle((current) => togglePresetChunk(current, preset))}
                    className={`rounded-none border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all font-mono ${
                      isActive
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <Textarea
              value={visualStyle}
              onChange={(event) => setVisualStyle(event.target.value)}
              placeholder="Example: Cinematic 35mm realism, premium texture detail, strong subject separation, dramatic but controlled lighting, and a consistent atmosphere across every scene..."
              className="min-h-80 resize-none rounded-none border border-border bg-black/40 px-4 py-3 text-[13px] leading-6 text-foreground font-mono placeholder:text-muted-foreground focus-visible:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="rounded-none border border-border bg-card p-4">
        <div className="flex flex-col gap-3 pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-primary font-display">
                Style Reference Kit
              </h3>
              <p className="max-w-xl text-[13px] leading-relaxed text-muted-foreground font-sans">
                Images & videos (incl. YouTube URLs) that define the project STYLE — character design language, architecture/shapes, environment and overall look. Script-specific subjects are added later in the project workflow.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono">
                {normalizedReferences.length} / 15
              </Badge>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-none border-border bg-background px-4 text-[9px] font-black uppercase tracking-[0.18em] text-foreground hover:bg-card"
                onClick={openReferencePicker}
                disabled={normalizedReferences.length >= 15}
              >
                <Upload className="mr-2 h-3.5 w-3.5" /> Upload
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-none border-border bg-background px-4 text-[9px] font-black uppercase tracking-[0.18em] text-foreground hover:bg-card"
                onClick={() => setYoutubeModalOpen(true)}
                disabled={normalizedReferences.length >= 15}
              >
                <Youtube className="mr-2 h-3.5 w-3.5 text-rose-500" /> Link YouTube
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-none px-4 text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                onClick={handleClearReferences}
                disabled={normalizedReferences.length === 0}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear All
              </Button>
            </div>
          </div>

          {normalizedReferences.length > 0 ? (
            <>
              <div className="relative pb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={referenceQuery}
                  onChange={(event) => setReferenceQuery(event.target.value)}
                  placeholder="Search references..."
                  className="h-10 border-border bg-background pl-10 text-foreground font-mono rounded-none focus-visible:ring-0 focus-visible:border-primary placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["All", ...labelOptions] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setReferenceFilter(filter)}
                    className={`rounded-none border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all font-mono ${
                      referenceFilter === filter
                        ? "border-primary text-primary bg-primary/5"
                        : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {normalizedReferences.length === 0 ? (
          <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-none border border-border bg-background">
              <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-black text-foreground font-display uppercase tracking-widest">No references yet</h4>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground font-mono">
                Upload image references to define how characters, locations, and style evolve across the project.
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/50">
                Use the upload button above
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-132 pt-3">
            <div className="grid grid-cols-1 gap-3 pr-3 md:grid-cols-2">
              {filteredReferences.map((reference) => {
                const ReferenceIcon = getReferenceIcon(reference.label);

                return (
                  <div
                    key={reference.id}
                    className="rounded-none border border-border bg-background p-3 transition-colors hover:bg-card group"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-none border border-border bg-black">
                        {reference.kind === "reference-video" ? (
                          <div className="relative h-full w-full">
                            <video
                              src={reference.preview || undefined}
                              className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                              muted
                              loop
                              playsInline
                              onMouseEnter={(e) => {
                                e.currentTarget.play().catch(() => {});
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.pause();
                              }}
                            />
                            <div className="absolute bottom-1 right-1 bg-black/70 px-1 py-0.5 rounded-none pointer-events-none">
                              <Film className="w-2.5 h-2.5 text-white" />
                            </div>
                          </div>
                        ) : reference.kind === "reference-youtube" ? (
                          <div className="relative h-full w-full bg-black flex items-center justify-center">
                            {getYouTubeThumbnail(reference.storagePath) ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={getYouTubeThumbnail(reference.storagePath) || ""}
                                alt={reference.name}
                                className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                              />
                            ) : (
                              <Youtube className="w-8 h-8 text-rose-500 opacity-60" />
                            )}
                            <div className="absolute inset-0 bg-black/45 flex items-center justify-center pointer-events-none">
                              <Youtube className="w-6 h-6 text-white group-hover:text-rose-500 transition-colors opacity-90" />
                            </div>
                          </div>
                        ) : reference.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={reference.preview}
                            alt={reference.name}
                            className="h-full w-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            <ReferenceIcon className="h-8 w-8" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-start gap-2">
                          <Input
                            value={reference.name}
                            onChange={(event) => handleUpdateName(reference.id, event.target.value)}
                            onBlur={() => handleCommitName(reference.id)}
                            className="h-9 rounded-none border-border bg-black text-[11px] font-bold text-foreground font-mono focus-visible:border-primary focus-visible:ring-0"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-none text-muted-foreground hover:bg-destructive hover:text-destructive-foreground transition-all shrink-0"
                            onClick={() => handleRemoveReference(reference.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {labelOptions.map((label) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => handleUpdateLabel(reference.id, label)}
                              className={`rounded-none border px-2 py-1 text-[7px] font-black uppercase tracking-[0.16em] transition-all font-mono ${
                                reference.label === label
                                  ? "border-primary text-primary bg-primary/5"
                                  : "border-border bg-black text-muted-foreground hover:border-primary/50 hover:text-foreground"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredReferences.length === 0 ? (
              <div className="rounded-none border border-dashed border-border bg-background p-6 text-center">
                <p className="text-sm font-black text-muted-foreground uppercase tracking-widest font-display">No references match this filter.</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/50 font-mono">
                  Try another category or search term
                </p>
              </div>
            ) : null}
          </ScrollArea>
        )}
      </div>

      {/* YouTube Link Modal */}
      {youtubeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="w-full max-w-md border border-border bg-card p-6 shadow-2xl rounded-none relative">
            <button
              type="button"
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setYoutubeModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary font-display">
                  Link YouTube Video
                </h3>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground font-mono">
                  Add a reference video to instruct agentic asset layout and style guides.
                </p>
              </div>

              <form onSubmit={handleAddYoutubeLink} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                    YouTube URL
                  </label>
                  <Input
                    required
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="h-10 border-border bg-background text-foreground font-mono rounded-none focus-visible:ring-0 focus-visible:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                    Reference Name (Optional)
                  </label>
                  <Input
                    type="text"
                    value={youtubeName}
                    onChange={(e) => setYoutubeName(e.target.value)}
                    placeholder="e.g. Kinetic typography reference"
                    className="h-10 border-border bg-background text-foreground font-mono rounded-none focus-visible:ring-0 focus-visible:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground font-mono">
                    Category Label
                  </label>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {labelOptions.map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setYoutubeLabel(label)}
                        className={`rounded-none border py-2 text-[8px] font-black uppercase tracking-[0.16em] transition-all font-mono ${
                          youtubeLabel === label
                            ? "border-primary text-primary bg-primary/5"
                            : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 rounded-none text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground hover:bg-card"
                    onClick={() => setYoutubeModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="h-9 rounded-none bg-primary text-primary-foreground px-6 text-[9px] font-black uppercase tracking-[0.18em] hover:bg-primary/95"
                  >
                    Link Reference
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteProjectReferenceAsset,
  getProjectReferencePreviewUrl,
  updateProject,
  uploadProjectReferenceAsset,
  type ProjectReferenceAsset,
} from "@/lib/projects-api";
import { Box, ImageIcon, MapPin, Palette, Search, Sparkles, Trash2, Upload, User, X } from "lucide-react";
import { writeProjectDraft } from "../../projects/project-draft";

import { useEditorLab } from "../editor-lab-context";

type VisualReferenceLabel = "Character" | "Scene" | "Object" | "Ambient";

type VisualReference = {
  id: string;
  name: string;
  label: VisualReferenceLabel;
  kind: ProjectReferenceAsset["kind"];
  preview: string | null;
};

const labelOptions: VisualReferenceLabel[] = ["Character", "Scene", "Object", "Ambient"];

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
    case "style":
    default:
      return "Ambient";
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
    case "Ambient":
    default:
      return "style";
  }
}

function getReferenceIcon(label: VisualReferenceLabel) {
  if (label === "Character") return User;
  if (label === "Scene") return MapPin;
  if (label === "Object") return Box;
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
  const [referenceFilter, setReferenceFilter] = useState<"All" | VisualReferenceLabel>("All");
  const [referenceQuery, setReferenceQuery] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedReferences: VisualReference[] = (references as Partial<ProjectReferenceAsset>[])
    .filter((reference) => reference && typeof reference.id === "string")
    .map((reference) => ({
      id: reference.id as string,
      name: reference.name?.trim() || "Untitled reference",
      label: toVisualLabel(reference.label),
      kind: "reference-image",
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
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr] animate-in fade-in duration-500">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleAddReference}
      />

      <div className="space-y-5">
        <div className="rounded-3xl border border-white/5 bg-[#08080c] p-5">
          <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-4">
            <div className="space-y-1">
              <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
                Visual Direction
              </h3>
              <p className="max-w-xl text-[11px] leading-relaxed text-white/35">
                Define the visual language the generator should keep consistent across the project.
              </p>
            </div>
            <Badge variant="outline" className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]">
              {visualStyle.length} / 5000
            </Badge>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full border-white/10 bg-white/2 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 hover:bg-white/5"
                onClick={handleUseFormatStarter}
                disabled={!formatStarter}
              >
                Use Format Starter
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full border-white/10 bg-white/2 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 hover:bg-white/5"
                onClick={handleUseProjectDNA}
                disabled={!projectDNAStarter}
              >
                Use Project DNA
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-full px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white/35 hover:bg-white/5 hover:text-white/70"
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
                    className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all ${
                      isActive
                        ? "border-primary/40 bg-primary/10 text-white"
                        : "border-white/10 bg-white/2 text-white/40 hover:border-white/20 hover:text-white/70"
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
              className="min-h-[420px] resize-none rounded-2xl border border-white/8 bg-black/20 px-4 py-3.5 text-[13px] leading-6 text-white/75 placeholder:text-white/15 focus-visible:border-primary/30 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-[#08080c] p-5">
        <div className="flex flex-col gap-4 border-b border-white/6 pb-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1">
              <h3 className="text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
                Reference Kit
              </h3>
              <p className="max-w-xl text-[11px] leading-relaxed text-white/35">
                Organize the image anchors that should keep characters, locations, props and mood consistent.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-white/10 bg-white/2 text-white/35 text-[8px] uppercase tracking-[0.18em]">
                {normalizedReferences.length} / 15
              </Badge>
              <Button
                type="button"
                variant="outline"
                className="h-9 rounded-full border-white/10 bg-white/2 px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 hover:bg-white/5"
                onClick={openReferencePicker}
                disabled={normalizedReferences.length >= 15}
              >
                <Upload className="mr-2 h-3.5 w-3.5" /> Upload
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-9 rounded-full px-4 text-[9px] font-black uppercase tracking-[0.18em] text-white/35 hover:bg-white/5 hover:text-white/70"
                onClick={handleClearReferences}
                disabled={normalizedReferences.length === 0}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Clear All
              </Button>
            </div>
          </div>

          {normalizedReferences.length > 0 ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/20" />
                <Input
                  value={referenceQuery}
                  onChange={(event) => setReferenceQuery(event.target.value)}
                  placeholder="Search references..."
                  className="h-10 border-white/10 bg-white/2 pl-10 text-white/70 placeholder:text-white/20"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {(["All", ...labelOptions] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setReferenceFilter(filter)}
                    className={`rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.18em] transition-all ${
                      referenceFilter === filter
                        ? "border-primary/40 bg-primary/10 text-white"
                        : "border-white/10 bg-white/2 text-white/40 hover:border-white/20 hover:text-white/70"
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
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/8 bg-white/2">
              <ImageIcon className="h-6 w-6 text-white/20" />
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-white/80">No references yet</h4>
              <p className="max-w-xs text-[11px] leading-relaxed text-white/30">
                Add the base image references that define how characters, streets, buildings, maps, trees, locations and overall style should look across the whole project.
              </p>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/20">
                Use the upload button above
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[640px] pt-4">
            <div className="grid grid-cols-1 gap-3 pr-3 md:grid-cols-2">
              {filteredReferences.map((reference) => {
                const ReferenceIcon = getReferenceIcon(reference.label);

                return (
                  <div
                    key={reference.id}
                    className="rounded-2xl border border-white/5 bg-white/2 p-3 transition-colors hover:border-white/10"
                  >
                    <div className="flex gap-3">
                      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl border border-white/5 bg-white/3">
                        {reference.preview ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={reference.preview}
                            alt={reference.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-white/15">
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
                            className="h-9 border-white/10 bg-black/20 text-[11px] font-bold text-white/80"
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-9 w-9 rounded-xl text-white/35 hover:bg-white/10 hover:text-white/70"
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
                              className={`rounded-md border px-2 py-1 text-[7px] font-black uppercase tracking-[0.16em] transition-all ${
                                reference.label === label
                                  ? "border-primary/40 bg-primary/10 text-white"
                                  : "border-white/8 bg-black/20 text-white/35 hover:border-white/15 hover:text-white/65"
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
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/1 p-6 text-center">
                <p className="text-sm font-bold text-white/60">No references match this filter.</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.22em] text-white/20">
                  Try another category or search term
                </p>
              </div>
            ) : null}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

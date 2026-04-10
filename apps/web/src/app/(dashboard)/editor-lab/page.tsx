"use client";

import { startTransition, useEffect, useState, Suspense } from 'react';
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Palette,
  Type,
  Sparkles,
  ArrowLeft,
  Save,
  Music,
  Layers
} from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  createProject,
  deleteProjectReferenceAsset,
  fetchProject,
  updateProject,
  type ProjectCaptionStyle,
  type ProjectMutationPayload,
  type ProjectRecord,
} from "@/lib/projects-api"

// Modular Components
import { VisualsLab } from "./visual-lab/VisualsLab"
import { CaptionsLab } from "./caption-lab/CaptionsLab"
import { defaultCaptionLabPreset, type CaptionLabPreset } from "./caption-lab/caption-lab-preset"
import { GraphicsLab } from "./graphic-lab/GraphicsLab"
import { defaultGraphicsLabPreset, type GraphicsLabPreset } from "./graphic-lab/graphics-lab-preset"
import { EffectsLab } from "./effect-lab/EffectsLab"
import { defaultEffectsLabPreset, type EffectsLabPreset } from "./effect-lab/effects-lab-preset"
import { AudioLab } from "./audio-lab/AudioLab"
import { defaultMusicLabPreset, type MusicLabPreset } from "./audio-lab/music/music-lab-preset"
import { defaultSoundsLabPreset, type SoundsLabPreset } from "./audio-lab/sounds/sounds-lab-preset"
import { CUSTOM_AUDIO_UPLOAD_ID, isCustomVoiceId } from "./audio-lab/narration/voice-cloning-lab/voice-clone-storage"
import { EditorLabContext } from "./editor-lab-context"
import { createProjectDraft, readProjectDraft, writeProjectDraft, type ProjectDraft, type ProjectType } from "../projects/project-draft"

const projectTypeLabels: Record<Exclude<ProjectDraft["projectType"], null>, string> = {
  short: "Short Form",
  video: "YouTube Video",
  slideshow: "Slideshow / VSL",
}

const SCRIPT_DRIVEN_DURATION_LABEL = "Determined by script length";

function inferProjectType(typeLabel: string): ProjectType {
  const normalized = typeLabel.toLowerCase();

  if (normalized.includes("short")) {
    return "short";
  }

  if (normalized.includes("slideshow")) {
    return "slideshow";
  }

  return "video";
}

function deriveProjectTitle(projectDraft: ProjectDraft) {
  if (projectDraft.projectTitle.trim().length > 0) {
    return projectDraft.projectTitle.trim();
  }

  if (projectDraft.templateTitle) {
    return projectDraft.templateTitle;
  }

  if (projectDraft.projectType === "short") {
    return "Untitled Short Project";
  }

  if (projectDraft.projectType === "slideshow") {
    return "Untitled Slideshow / VSL Project";
  }

  return "Untitled YouTube Project";
}

function deriveProjectTypeLabel(projectType: ProjectType) {
  if (projectType === "short") {
    return "Short Form / TikTok";
  }

  if (projectType === "slideshow") {
    return "Slideshow / VSL";
  }

  return "Long Form / YouTube";
}

function deriveTargetDuration(_projectType: ProjectType) {
  return SCRIPT_DRIVEN_DURATION_LABEL;
}

function normalizeSelectedVoice(voiceId?: string | null) {
  if (!voiceId || voiceId === "elevenlabs-default") {
    return "male-1";
  }

  return voiceId;
}

function createDraftFromProject(project: ProjectRecord): ProjectDraft {
  const resolvedVoiceId = project.audio?.narration?.voiceId || project.settings.voiceId;
  const referenceScopeId =
    project.references?.find((reference) => typeof reference?.scopeId === "string" && reference.scopeId.length > 0)?.scopeId
    || project.id;

  return createProjectDraft({
    projectId: project.id,
    referenceDraftId: referenceScopeId,
    projectType: inferProjectType(project.type),
    projectTitle: project.title ?? "",
    projectDescription: project.goal ?? "",
    template: project.templateId ?? null,
    templateTitle: project.templateSnapshot?.title ?? null,
    sourceMode: isCustomVoiceId(resolvedVoiceId) ? "upload" : "generate",
    projectLanguage: project.audio?.narration?.language || project.settings.projectLanguage,
    scriptStrategy: project.script.mode,
    scriptTopic: project.script.topic,
    manualScript: project.script.mode === "manual" ? project.script.content : "",
    scriptAgentModel: project.settings.scriptAgentModel || project.script.model,
    imageGenerationModel: project.settings.imageAgentModel,
    motionEngine: project.settings.videoAgentModel,
    projectTone: project.settings.tone || project.goal || "",
    projectContext: project.settings.visualStyle || project.goal || "",
    references: project.references ?? [],
    updatedAt: project.updatedAt ?? project.createdAt,
    source: "projects-factory",
  });
}

function normalizeGraphicsPreset(input?: Partial<GraphicsLabPreset> | null): GraphicsLabPreset {
  return {
    ...defaultGraphicsLabPreset,
    ...input,
    focusedModuleId:
      input?.focusedModuleId === "text-reveal" ||
      input?.focusedModuleId === "lower-third" ||
      input?.focusedModuleId === "stat-counter"
        ? input.focusedModuleId
        : defaultGraphicsLabPreset.focusedModuleId,
    moduleState: {
      ...defaultGraphicsLabPreset.moduleState,
      ...(input?.moduleState || {}),
    },
    variantState: {
      ...defaultGraphicsLabPreset.variantState,
      ...(input?.variantState || {}),
    },
  };
}

function normalizeEffectsPreset(input?: Partial<EffectsLabPreset> | null): EffectsLabPreset {
  return {
    ...defaultEffectsLabPreset,
    ...input,
    clipMode: input?.clipMode === "video" ? "video" : "static",
    motionStyle:
      input?.motionStyle === "horizontal-pan" || input?.motionStyle === "zoom-in-out"
        ? input.motionStyle
        : defaultEffectsLabPreset.motionStyle,
    moduleState: {
      ...defaultEffectsLabPreset.moduleState,
      ...(input?.moduleState || {}),
    },
    videoEndingDuration:
      typeof input?.videoEndingDuration === "number" ? input.videoEndingDuration : defaultEffectsLabPreset.videoEndingDuration,
  };
}

function normalizeMusicPreset(input?: Partial<MusicLabPreset> | null): MusicLabPreset {
  return {
    ...defaultMusicLabPreset,
    ...input,
    mode: input?.mode === "uploaded" ? "uploaded" : "ai",
    mood:
      input?.mood === "uplifting" ||
      input?.mood === "dark" ||
      input?.mood === "editorial" ||
      input?.mood === "ambient"
        ? input.mood
        : defaultMusicLabPreset.mood,
    generationBrief:
      typeof input?.generationBrief === "string"
        ? input.generationBrief
        : defaultMusicLabPreset.generationBrief,
    uploadedTracks: Array.isArray(input?.uploadedTracks)
      ? input.uploadedTracks
          .filter(
            (track): track is NonNullable<typeof input.uploadedTracks>[number] =>
              Boolean(track && typeof track.id === "string" && typeof track.name === "string"),
          )
          .map((track) => ({
            id: track.id,
            name: track.name,
            sizeLabel: typeof track.sizeLabel === "string" ? track.sizeLabel : "Unknown size",
            mimeType: typeof track.mimeType === "string" ? track.mimeType : undefined,
            storagePath: typeof track.storagePath === "string" ? track.storagePath : undefined,
            uploadedAt: typeof track.uploadedAt === "string" ? track.uploadedAt : undefined,
          }))
      : defaultMusicLabPreset.uploadedTracks,
    endingFadeEnabled:
      typeof input?.endingFadeEnabled === "boolean"
        ? input.endingFadeEnabled
        : defaultMusicLabPreset.endingFadeEnabled,
    endingFadeDuration:
      typeof input?.endingFadeDuration === "number"
        ? input.endingFadeDuration
        : defaultMusicLabPreset.endingFadeDuration,
    dynamicVolume:
      typeof input?.dynamicVolume === "boolean"
        ? input.dynamicVolume
        : defaultMusicLabPreset.dynamicVolume,
  };
}

function normalizeSoundsPreset(input?: Partial<SoundsLabPreset> | null): SoundsLabPreset {
  return {
    ...defaultSoundsLabPreset,
    ...input,
    enabled:
      typeof input?.enabled === "boolean"
        ? input.enabled
        : defaultSoundsLabPreset.enabled,
    density:
      input?.density === "none" || input?.density === "light" || input?.density === "dense"
        ? input.density
        : defaultSoundsLabPreset.density,
    cueFocus: Array.isArray(input?.cueFocus)
      ? input.cueFocus.filter((cue): cue is string => typeof cue === "string")
      : defaultSoundsLabPreset.cueFocus,
  };
}

function getEditorLabScopeKey(projectId: string | null | undefined) {
  return projectId || "draft";
}

function areStringListsEqual(left: string[] | undefined, right: string[] | undefined) {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];

  if (leftList.length !== rightList.length) {
    return false;
  }

  return leftList.every((item, index) => item === rightList[index]);
}

function areUploadedTracksEqual(
  left: Array<{ id: string; name: string; sizeLabel: string; storagePath?: string; mimeType?: string }> | undefined,
  right: Array<{ id: string; name: string; sizeLabel: string; storagePath?: string; mimeType?: string }> | undefined,
) {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];

  if (leftList.length !== rightList.length) {
    return false;
  }

  return leftList.every((track, index) => {
    const candidate = rightList[index];
    return Boolean(candidate)
      && candidate.id === track.id
      && candidate.name === track.name
      && candidate.sizeLabel === track.sizeLabel
      && (candidate.storagePath || "") === (track.storagePath || "")
      && (candidate.mimeType || "") === (track.mimeType || "");
  });
}

function buildProjectPayload({
  projectDraft,
  projectRecord,
  captionPreset,
  musicPreset,
  soundsPreset,
  graphicsPreset,
  effectsPreset,
  visualStyle,
  references,
  narrationLanguage,
  selectedVoice,
  narrationStyle,
}: {
  projectDraft: ProjectDraft;
  projectRecord: ProjectRecord | null;
  captionPreset: CaptionLabPreset;
  musicPreset: MusicLabPreset;
  soundsPreset: SoundsLabPreset;
  graphicsPreset: GraphicsLabPreset;
  effectsPreset: EffectsLabPreset;
  visualStyle: string;
  references: ProjectRecord["references"];
  narrationLanguage: string;
  selectedVoice: string;
  narrationStyle: string;
}): ProjectMutationPayload {
  const currentNarration = projectRecord?.audio?.narration;
  const currentMusic = projectRecord?.audio?.music;
  const currentSfx = projectRecord?.audio?.sfx;
  const narrationChanged =
    currentNarration?.voiceId !== selectedVoice ||
    currentNarration?.language !== narrationLanguage ||
    (currentNarration?.direction || projectRecord?.settings?.narrationStyle || "") !== narrationStyle;
  const uploadOnlyNarrationSelected = selectedVoice === CUSTOM_AUDIO_UPLOAD_ID;
  const preservedUploadedSource = uploadOnlyNarrationSelected ? currentNarration?.uploadedSource || null : null;
  const keepUploadedNarrationSnapshot = uploadOnlyNarrationSelected && Boolean(preservedUploadedSource);
  const nextMusicMode = musicPreset.mode === "uploaded" ? "uploaded" : "auto";
  const uploadedTrackNames = musicPreset.uploadedTracks.map((track) => track.name).join(", ");
  const musicChanged =
    currentMusic?.mode !== nextMusicMode ||
    currentMusic?.mood !== musicPreset.mood ||
    (currentMusic?.generationBrief || "") !== musicPreset.generationBrief ||
    !areUploadedTracksEqual(currentMusic?.uploadedTracks, musicPreset.uploadedTracks) ||
    Boolean(currentMusic?.endingFadeEnabled) !== musicPreset.endingFadeEnabled ||
    (currentMusic?.endingFadeDuration ?? 2.5) !== musicPreset.endingFadeDuration ||
    Boolean(currentMusic?.dynamicVolume) !== musicPreset.dynamicVolume;
  const sfxChanged =
    Boolean(currentSfx?.enabled) !== soundsPreset.enabled ||
    (currentSfx?.density || "light") !== soundsPreset.density ||
    !areStringListsEqual(currentSfx?.cues, soundsPreset.cueFocus);
  const nextNarrationStatus = narrationChanged
    ? keepUploadedNarrationSnapshot
      ? "uploaded"
      : "draft"
    : currentNarration?.status || "draft";
  const nextMusicStatus = musicChanged ? "draft" : currentMusic?.status || "draft";
  const nextSfxStatus = sfxChanged ? "draft" : currentSfx?.status || "draft";
  const nextAudioGeneratedAt =
    narrationChanged || musicChanged || sfxChanged
      ? null
      : projectRecord?.audio?.generatedAt || null;

  return {
    title: deriveProjectTitle(projectDraft),
    goal: projectDraft.projectDescription.trim().length > 0
      ? projectDraft.projectDescription.trim()
      : projectDraft.projectTone.trim().length > 0
        ? projectDraft.projectTone.trim()
        : projectDraft.projectContext.trim().length > 0
          ? projectDraft.projectContext.trim()
        : "Project configured from Editor Lab.",
    type: deriveProjectTypeLabel(projectDraft.projectType),
    status: "Draft",
    templateId: projectDraft.template,
    references,
    script: {
      mode: projectDraft.scriptStrategy,
      topic: projectDraft.scriptTopic,
      content: projectDraft.scriptStrategy === "manual" ? projectDraft.manualScript : "",
      model: projectDraft.scriptAgentModel,
      source: projectDraft.scriptStrategy === "manual" ? "manual" : "draft",
      updatedAt: null,
    },
    audio: {
      ...(projectRecord?.audio || {}),
      generatedAt: nextAudioGeneratedAt,
      narration: {
        ...(currentNarration || {}),
        voiceId: selectedVoice,
        language: narrationLanguage,
        direction: narrationStyle,
        status: nextNarrationStatus,
        textPreview:
          narrationChanged && !keepUploadedNarrationSnapshot
            ? ""
            : currentNarration?.textPreview || "",
        estimatedDuration:
          narrationChanged && !keepUploadedNarrationSnapshot
            ? "00:00"
            : currentNarration?.estimatedDuration || "00:00",
        generatedSource:
          narrationChanged || uploadOnlyNarrationSelected
            ? null
            : currentNarration?.generatedSource || null,
        uploadedSource: preservedUploadedSource,
      },
      music: {
        ...(currentMusic || {}),
        mode: nextMusicMode,
        trackName:
          nextMusicMode === "uploaded"
            ? uploadedTrackNames
            : musicChanged
              ? ""
              : currentMusic?.trackName || "",
        mood: musicPreset.mood,
        generationBrief: musicPreset.generationBrief,
        uploadedTracks: nextMusicMode === "uploaded" ? musicPreset.uploadedTracks : [],
        generatedSource:
          musicChanged || nextMusicMode === "uploaded"
            ? null
            : currentMusic?.generatedSource || null,
        endingFadeEnabled: musicPreset.endingFadeEnabled,
        endingFadeDuration: musicPreset.endingFadeDuration,
        dynamicVolume: musicPreset.dynamicVolume,
        status: nextMusicStatus,
      },
      sfx: {
        ...(currentSfx || {}),
        enabled: soundsPreset.enabled,
        density: soundsPreset.density,
        status: nextSfxStatus,
        cues: soundsPreset.cueFocus,
      },
    },
    captions: {
      style: toProjectCaptionStyle(captionPreset),
    },
    settings: {
      scriptAgentModel: projectDraft.scriptAgentModel,
      imageAgentModel: projectDraft.imageGenerationModel,
      videoAgentModel: projectDraft.motionEngine,
      voiceId: selectedVoice,
      projectLanguage: narrationLanguage,
      tone: projectDraft.projectTone,
      narrationStyle,
      visualStyle,
      targetDuration: deriveTargetDuration(projectDraft.projectType),
      graphics: graphicsPreset,
      effects: effectsPreset,
    },
  };
}

function toCaptionLabPreset(style?: Partial<ProjectCaptionStyle> | null): CaptionLabPreset {
  return {
    ...defaultCaptionLabPreset,
    captionPosition: (["top", "center", "bottom", "custom"] as const).includes(style?.captionPosition as any) ? (style!.captionPosition as any) : defaultCaptionLabPreset.captionPosition,
    animationStyle: style?.animationStyle === "none" || style?.animationStyle === "slide" || style?.animationStyle === "pop" || style?.animationStyle === "reveal" || style?.animationStyle === "bounce"
      ? style.animationStyle
      : defaultCaptionLabPreset.animationStyle,
    wordByWord: style?.wordByWord ?? defaultCaptionLabPreset.wordByWord,
    wordHighlight: style?.wordHighlight ?? defaultCaptionLabPreset.wordHighlight,
    typography: style?.typography === "inter" || style?.typography === "serif" || style?.typography === "mono" || style?.typography === "condensed" || style?.typography === "typewriter"
      ? style.typography
      : "bold",
    textSize: style?.textSize ?? defaultCaptionLabPreset.textSize,
    letterSpacing: style?.letterSpacing ?? defaultCaptionLabPreset.letterSpacing,
    colorStyle: style?.colorStyle === "violet" ? "purple" : style?.colorStyle === "red" || style?.colorStyle === "yellow" || style?.colorStyle === "green" || style?.colorStyle === "blue" || style?.colorStyle === "purple" ? style.colorStyle : defaultCaptionLabPreset.colorStyle,
    strokeEnabled: defaultCaptionLabPreset.strokeEnabled,
    strokeWidth: defaultCaptionLabPreset.strokeWidth,
    strokeOpacity: defaultCaptionLabPreset.strokeOpacity,
    strokeColor: defaultCaptionLabPreset.strokeColor,
    watermarkEnabled: defaultCaptionLabPreset.watermarkEnabled,
    watermarkText: defaultCaptionLabPreset.watermarkText,
    watermarkOpacity: defaultCaptionLabPreset.watermarkOpacity,
    watermarkPosition: defaultCaptionLabPreset.watermarkPosition,
    animationIntensity: typeof style?.animationIntensity === "number" ? style.animationIntensity : defaultCaptionLabPreset.animationIntensity,
  };
}

function toProjectCaptionStyle(preset: CaptionLabPreset): ProjectCaptionStyle {
  return {
    captionPosition: preset.captionPosition,
    animationStyle: preset.animationStyle,
    animationIntensity: preset.animationIntensity,
    wordByWord: preset.wordByWord,
    wordHighlight: preset.wordHighlight,
    typography: preset.typography,
    textSize: preset.textSize,
    letterSpacing: preset.letterSpacing,
    colorStyle: preset.colorStyle === "purple" ? "violet" : preset.colorStyle,
    strokeEnabled: preset.strokeEnabled,
    strokeWidth: preset.strokeWidth,
    strokeOpacity: preset.strokeOpacity,
    strokeColor: preset.strokeColor,
    watermarkEnabled: preset.watermarkEnabled,
    watermarkText: preset.watermarkText,
    watermarkOpacity: preset.watermarkOpacity,
    watermarkPosition: preset.watermarkPosition,
  };
}

function EditorLabContent() {
  const [activeTab, setActiveTab] = useState('visuals');
  const [saveLabel, setSaveLabel] = useState("Save Project Settings");
  const [captionPreset, setCaptionPreset] = useState<CaptionLabPreset>(defaultCaptionLabPreset);
  const [captionPresetVersion, setCaptionPresetVersion] = useState(0);
  const [musicPreset, setMusicPreset] = useState<MusicLabPreset>(defaultMusicLabPreset);
  const [soundsPreset, setSoundsPreset] = useState<SoundsLabPreset>(defaultSoundsLabPreset);
  const [graphicsPreset, setGraphicsPreset] = useState<GraphicsLabPreset>(defaultGraphicsLabPreset);
  const [effectsPreset, setEffectsPreset] = useState<EffectsLabPreset>(defaultEffectsLabPreset);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft | null>(null);
  const [projectRecord, setProjectRecord] = useState<ProjectRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New Global Lab States
  const [visualStyle, setVisualStyle] = useState('');
  const [references, setReferences] = useState<any[]>([]);
  const [narrationLanguage, setNarrationLanguage] = useState('english');
  const [selectedVoice, setSelectedVoice] = useState('male-1');
  const [narrationStyle, setNarrationStyle] = useState('');

  const applyDraftToLab = (draft: ProjectDraft) => {
    setProjectDraft(draft);
    setNarrationLanguage(draft.projectLanguage || 'english');
    setNarrationStyle('');
    setReferences(draft.references ?? []);
  };

  const applyProjectToLab = (project: ProjectRecord, hasScopedLocalLabState: boolean) => {
    const hydratedDraft = createDraftFromProject(project);
    setProjectRecord(project);
    setProjectDraft(hydratedDraft);
    writeProjectDraft(hydratedDraft);

    if (!hasScopedLocalLabState) {
      if (project.captions?.style) {
        setCaptionPreset(toCaptionLabPreset(project.captions.style));
        setCaptionPresetVersion(1);
      }

      setMusicPreset(normalizeMusicPreset(project.audio?.music));
      setSoundsPreset(normalizeSoundsPreset(project.audio?.sfx));
      setGraphicsPreset(normalizeGraphicsPreset(project.settings.graphics));
      setEffectsPreset(normalizeEffectsPreset(project.settings.effects));
    }

    setVisualStyle(project.settings.visualStyle || '');
    setNarrationLanguage(project.audio?.narration?.language || project.settings.projectLanguage || 'english');
    setSelectedVoice(normalizeSelectedVoice(project.audio?.narration?.voiceId || project.settings.voiceId));
    setNarrationStyle(project.settings.narrationStyle || project.settings.tone || project.goal || '');
    setReferences(project.references ?? []);
  };
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const nextDraft = readProjectDraft();
    const requestedProjectId = searchParams.get("projectId");
    const editorLabScopeKey = getEditorLabScopeKey(requestedProjectId || nextDraft?.projectId);
    const savedPreset = window.localStorage.getItem("cosyl-editor-lab");
    let hasScopedLocalLabState = false;

    if (savedPreset) {
      try {
        const parsedPreset = JSON.parse(savedPreset) as {
          scopeKey?: string;
          activeTab?: string;
          captionPreset?: CaptionLabPreset;
          musicPreset?: MusicLabPreset;
          soundsPreset?: SoundsLabPreset;
          graphicsPreset?: GraphicsLabPreset;
          effectsPreset?: EffectsLabPreset;
        };

        if (parsedPreset.scopeKey === editorLabScopeKey) {
          window.setTimeout(() => {
            if (parsedPreset.activeTab && ["visuals", "captions", "graphics", "effects", "audio"].includes(parsedPreset.activeTab)) {
              setActiveTab(parsedPreset.activeTab as any);
            }

            if (parsedPreset.captionPreset) {
              setCaptionPreset(parsedPreset.captionPreset);
              setCaptionPresetVersion((v) => v + 1);
            }

            if (parsedPreset.musicPreset) {
              setMusicPreset(normalizeMusicPreset(parsedPreset.musicPreset));
            }

            if (parsedPreset.soundsPreset) {
              setSoundsPreset(normalizeSoundsPreset(parsedPreset.soundsPreset));
            }

            if (parsedPreset.graphicsPreset) {
              setGraphicsPreset(normalizeGraphicsPreset(parsedPreset.graphicsPreset));
            }

            if (parsedPreset.effectsPreset) {
              setEffectsPreset(normalizeEffectsPreset(parsedPreset.effectsPreset));
            }
          }, 0);
          hasScopedLocalLabState = true;
        }
      } catch {
        window.localStorage.removeItem("cosyl-editor-lab");
      }
    }

    if (!hasScopedLocalLabState) {
      setCaptionPreset(defaultCaptionLabPreset);
      setCaptionPresetVersion((v) => v + 1);
      setMusicPreset(defaultMusicLabPreset);
      setSoundsPreset(defaultSoundsLabPreset);
      setGraphicsPreset(defaultGraphicsLabPreset);
      setEffectsPreset(defaultEffectsLabPreset);
    }

    const requestedTab = searchParams.get("tab");
    if (requestedTab && ["visuals", "captions", "graphics", "effects", "audio"].includes(requestedTab)) {
      window.setTimeout(() => {
        setActiveTab(requestedTab as any);
      }, 0);
    }

    if (nextDraft) {
      applyDraftToLab(nextDraft);
      setVisualStyle(nextDraft.projectContext || '');
      setSelectedVoice(normalizeSelectedVoice(nextDraft.sourceMode === "upload" ? CUSTOM_AUDIO_UPLOAD_ID : "elevenlabs-default"));
    }

    const effectiveProjectId = requestedProjectId || nextDraft?.projectId || null;

    if (effectiveProjectId) {
      void fetchProject(effectiveProjectId)
        .then((project) => {
          if (cancelled) {
            return;
          }

          applyProjectToLab(project, hasScopedLocalLabState);
        })
        .catch(() => {
          if (!cancelled) {
            setProjectRecord(null);
          }
        });
    } else {
      setProjectRecord(null);
    }

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const handleSave = async () => {
    if (!projectDraft) {
      return;
    }

    const hasPersistedProject = Boolean(projectDraft.projectId || projectRecord?.id);

    if (hasPersistedProject && musicPreset.mode === "uploaded" && musicPreset.uploadedTracks.length === 0) {
      setSaveLabel("Add Music Tracks");
      setTimeout(() => setSaveLabel("Save Project Settings"), 2000);
      return;
    }

    if (hasPersistedProject && musicPreset.mode === "uploaded" && musicPreset.uploadedTracks.some((track) => !track.storagePath)) {
      setSaveLabel("Upload Tracks After First Save");
      setTimeout(() => setSaveLabel("Save Project Settings"), 2000);
      return;
    }

    window.localStorage.setItem("cosyl-editor-lab", JSON.stringify({
      scopeKey: getEditorLabScopeKey(projectDraft.projectId),
      activeTab,
      captionPreset,
      musicPreset,
      soundsPreset,
      graphicsPreset,
      effectsPreset,
      savedAt: new Date().toISOString(),
    }));

    const nextDraft = {
      ...projectDraft,
      projectLanguage: narrationLanguage,
      projectTone: projectDraft.projectTone,
      projectContext: visualStyle,
      references,
      updatedAt: new Date().toISOString(),
    };

    setProjectDraft(nextDraft);
    writeProjectDraft(nextDraft);

    setIsSaving(true);

    try {
      const wasUnsavedProject = !nextDraft.projectId;
      const payload = buildProjectPayload({
        projectDraft: nextDraft,
        projectRecord,
        captionPreset,
        musicPreset,
        soundsPreset,
        graphicsPreset,
        effectsPreset,
        visualStyle,
        references,
        narrationLanguage,
        selectedVoice,
        narrationStyle,
      });

      const persistedProject = nextDraft.projectId
        ? await updateProject(nextDraft.projectId, payload)
        : await createProject(payload);
      const removedReferences = (projectRecord?.references ?? []).filter((reference) =>
        Boolean(reference?.storagePath && !references.some((candidate) => candidate?.id === reference.id)),
      );

      await Promise.all(
        removedReferences.map((reference) =>
          deleteProjectReferenceAsset({
            storagePath: reference.storagePath as string,
            referenceId: reference.id,
            draftId: reference.scopeId ?? null,
          }).catch((error) => {
            console.error("Unable to delete an unused reference image.", error);
          }),
        ),
      );

      const hydratedDraft = createDraftFromProject(persistedProject);
      setProjectRecord(persistedProject);
      setProjectDraft(hydratedDraft);
      writeProjectDraft(hydratedDraft);
      window.localStorage.setItem("cosyl-editor-lab", JSON.stringify({
        scopeKey: getEditorLabScopeKey(persistedProject.id),
        activeTab,
        captionPreset,
        musicPreset,
        soundsPreset,
        graphicsPreset,
        effectsPreset,
        savedAt: new Date().toISOString(),
      }));

      const requiresUploadedTracksAfterFirstSave =
        wasUnsavedProject
        && musicPreset.mode === "uploaded"
        && musicPreset.uploadedTracks.length === 0;

      if (requiresUploadedTracksAfterFirstSave) {
        setSaveLabel("Project Saved — Upload Tracks");
        router.replace(`/editor-lab?projectId=${persistedProject.id}&tab=${activeTab}`);
      } else {
        setSaveLabel("Project Saved");
        setTimeout(() => {
          router.push('/projects');
        }, 1500);
      }
    } catch (error) {
      console.error("Unable to persist project parameters.", error);
      setSaveLabel("Save Failed");
      setTimeout(() => setSaveLabel("Save Project Settings"), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setCaptionPreset(defaultCaptionLabPreset);
    setCaptionPresetVersion((current) => current + 1);

    if (projectDraft) {
      window.localStorage.setItem("cosyl-editor-lab", JSON.stringify({
        scopeKey: getEditorLabScopeKey(projectDraft.projectId),
        activeTab,
        captionPreset: defaultCaptionLabPreset,
        musicPreset,
        soundsPreset,
        graphicsPreset,
        effectsPreset,
        savedAt: new Date().toISOString(),
      }));
    }
  };

  const handleTabChange = (nextTab: string) => {
    startTransition(() => {
      setActiveTab(nextTab);
    });
  };

  return (
    <EditorLabContext.Provider
      value={{
        activeTab,
        setActiveTab,
        captionPreset,
        captionPresetVersion,
        setCaptionPreset,
        musicPreset,
        setMusicPreset,
        soundsPreset,
        setSoundsPreset,
        graphicsPreset,
        setGraphicsPreset,
        effectsPreset,
        setEffectsPreset,
        projectDraft,
        setProjectDraft,
        projectRecord,
        setProjectRecord,
        visualStyle,
        setVisualStyle,
        references,
        setReferences,
        narrationLanguage,
        setNarrationLanguage,
        selectedVoice,
        setSelectedVoice,
        narrationStyle,
        setNarrationStyle,
      }}
    >
      <div className="min-h-screen bg-[#0a0a0f] text-white selection:bg-[#5c2d91]/50 font-sans antialiased relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[300px] bg-[#5c2d91]/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50" />

        <div className="max-w-[1440px] mx-auto p-4 space-y-1 relative z-10">

          {/* Header Section */}
          <div className="flex items-center justify-between py-0.5">
            <Link href="/projects/new" className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-white transition-colors group uppercase tracking-widest">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Back to Project Setup</span>
            </Link>
            <div className="flex items-center gap-4">
              {activeTab === "captions" && (
                <Button variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/5 transition-all px-4 h-8 rounded-full text-[9px] font-black uppercase tracking-[0.2em]" onClick={handleReset}>
                  Reset Caption Defaults
                </Button>
              )}
              <Button
                className="bg-[#5c2d91] hover:bg-[#6d39ab] text-white px-6 h-9 rounded-full shadow-[0_5px_20px_-5px_rgba(92,45,145,0.6)] transition-all font-black text-[9px] uppercase tracking-[0.2em] border border-[#7c4dbc]"
                onClick={handleSave}
                disabled={!projectDraft || isSaving}
              >
                <Save className="w-3 h-3 mr-2" /> {saveLabel}
              </Button>
            </div>
          </div>

          {projectDraft?.projectType ? (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="outline" className="border-white/10 bg-white/2 text-white/55 text-[8px] uppercase tracking-[0.18em]">
                {projectTypeLabels[projectDraft.projectType]}
              </Badge>
              <Badge variant="outline" className="border-white/10 bg-white/2 text-white/40 text-[8px] uppercase tracking-[0.18em]">
                {projectDraft.projectLanguage}
              </Badge>
              {projectRecord ? (
                <Badge variant="outline" className="border-white/10 bg-white/2 text-white/40 text-[8px] uppercase tracking-[0.18em]">
                  Project: {projectRecord.title}
                </Badge>
              ) : null}
              {projectDraft.template ? (
                <Badge variant="outline" className="border-white/10 bg-white/2 text-white/40 text-[8px] uppercase tracking-[0.18em]">
                  Template: {projectDraft.templateTitle ?? projectDraft.template}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {/* Lab Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-8">
            <div className="flex justify-center">
              <TabsList className="bg-[#0a0a0f] border border-white/5 p-1 h-auto rounded-full overflow-hidden inline-flex shadow-[0_15px_40px_rgba(0,0,0,0.4)]">
                {[
                  { id: 'visuals', label: 'Visuals Lab', icon: Palette },
                  { id: 'captions', label: 'Captions Lab', icon: Type },
                  { id: 'graphics', label: 'Graphics Lab', icon: Layers },
                  { id: 'effects', label: 'Effects Lab', icon: Sparkles },
                  { id: 'audio', label: 'Audio Lab', icon: Music },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="px-6 py-2.5 gap-2.5 rounded-full data-[state=active]:bg-white/5 data-[state=active]:text-white text-muted-foreground transition-all uppercase text-[8px] font-black tracking-[0.25em] outline-none"
                  >
                    <tab.icon className="w-3 h-3" /> {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Contents */}
            <TabsContent value="visuals" className="outline-none pt-2">
              {activeTab === "visuals" ? <VisualsLab /> : null}
            </TabsContent>

            <TabsContent value="captions" className="outline-none pt-2">
              {activeTab === "captions" ? <CaptionsLab /> : null}
            </TabsContent>

            <TabsContent value="graphics" className="outline-none pt-2">
              {activeTab === "graphics" ? <GraphicsLab /> : null}
            </TabsContent>

            <TabsContent value="effects" className="outline-none pt-2">
              {activeTab === "effects" ? <EffectsLab /> : null}
            </TabsContent>

            <TabsContent value="audio" className="outline-none pt-2">
              {activeTab === "audio" ? <AudioLab /> : null}
            </TabsContent>

          </Tabs>
        </div>
      </div>
    </EditorLabContext.Provider>
  );
}

export default function EditorLabPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-[#050507]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-[#9b6dff] border-t-transparent animate-spin" />
        </div>
      </div>
    }>
      <EditorLabContent />
    </Suspense>
  );
}

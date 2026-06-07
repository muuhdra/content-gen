"use client";

import { startTransition, useEffect, useState, Suspense } from 'react';
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Image as ImageIcon,
  FileText,
  Wand2,
  ArrowLeft,
  Save,
  Mic
} from "lucide-react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"
import {
  createProject,
  deleteProjectReferenceAsset,
  fetchProject,
  updateProject,
  type ProjectCaptionStyle,
  type ProjectRecord,
  type ProjectReferenceAsset,
} from "@/lib/projects-api"

// Modular Components
import { VisualsLab } from "@/features/editor-lab/components/visual-lab/VisualsLab"
import { CaptionsLab } from "@/features/editor-lab/components/caption-lab/CaptionsLab"
import { defaultCaptionLabPreset, type CaptionLabPreset } from "@/features/editor-lab/components/caption-lab/caption-lab-preset"
import { defaultGraphicsLabPreset, type GraphicsLabPreset } from "@/features/editor-lab/components/graphic-lab/graphics-lab-preset"
import { EffectsLab } from "@/features/editor-lab/components/effect-lab/EffectsLab"
import { defaultEffectsLabPreset, type EffectsLabPreset } from "@/features/editor-lab/components/effect-lab/effects-lab-preset"
import { AudioLab } from "@/features/editor-lab/components/audio-lab/AudioLab"
import { defaultMusicLabPreset, type MusicLabPreset } from "@/features/editor-lab/components/audio-lab/music/music-lab-preset"
import { defaultSoundsLabPreset, type SoundsLabPreset } from "@/features/editor-lab/components/audio-lab/sounds/sounds-lab-preset"
import { CUSTOM_AUDIO_UPLOAD_ID, isCustomVoiceId } from "@/features/editor-lab/components/audio-lab/narration/voice-cloning-lab/voice-clone-storage"
import { EditorLabContext } from "@/features/editor-lab/editor-lab-context"
import { createProjectDraft, readProjectDraft, writeProjectDraft, type ProjectDraft, type ProjectType } from "@/features/projects/utils/project-draft"
import { buildProjectPayload } from "@/features/projects/utils/project-payload"
import type { CaptionPosition } from "@/features/editor-lab/components/caption-lab/caption-lab-preset"


const editorLabTabs = ["visuals", "captions", "effects", "audio"] as const;
const editorLabOrigins = ["setup", "templates", "production", "project"] as const;

type EditorLabTab = (typeof editorLabTabs)[number];
type EditorLabOrigin = (typeof editorLabOrigins)[number];

function isEditorLabTab(value: string | null | undefined): value is EditorLabTab {
  return typeof value === "string" && editorLabTabs.includes(value as EditorLabTab);
}

function isEditorLabOrigin(value: string | null | undefined): value is EditorLabOrigin {
  return typeof value === "string" && editorLabOrigins.includes(value as EditorLabOrigin);
}

function isCaptionPosition(value: string | undefined): value is CaptionPosition {
  return value === "top" || value === "center" || value === "bottom" || value === "custom";
}

type GraphicsPresetInput = Partial<GraphicsLabPreset> | {
  enabled?: boolean;
  focusedModuleId?: string;
  moduleState?: Record<string, boolean>;
  variantState?: Record<string, string>;
} | null | undefined;

type EffectsPresetInput = Partial<EffectsLabPreset> | {
  clipMode?: string;
  motionStyle?: string;
  kenBurnsIntensity?: string;
  hybridAnimateRatio?: number;
  moduleState?: Record<string, boolean>;
  videoEndingDuration?: number;
} | null | undefined;

type MusicPresetInput = Partial<MusicLabPreset> | {
  mode?: string;
  mood?: string;
  generationBrief?: string;
  uploadedTracks?: Array<{
    id: string;
    name: string;
    sizeLabel?: string;
    mimeType?: string;
    storagePath?: string;
    uploadedAt?: string;
  }>;
  endingFadeEnabled?: boolean;
  endingFadeDuration?: number;
  dynamicVolume?: boolean;
} | null | undefined;

type SoundsPresetInput = Partial<SoundsLabPreset> | {
  enabled?: boolean;
  density?: string;
  cueFocus?: string[];
  cues?: string[];
} | null | undefined;

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



function normalizeSelectedVoice(voiceId?: string | null) {
  if (!voiceId || voiceId === "elevenlabs-default") {
    return "elevenlabs-v3";
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

function normalizeGraphicsPreset(input?: GraphicsPresetInput): GraphicsLabPreset {
  return {
    ...defaultGraphicsLabPreset,
    ...input,
    enabled: typeof input?.enabled === "boolean" ? input.enabled : defaultGraphicsLabPreset.enabled,
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

function normalizeEffectsPreset(input?: EffectsPresetInput): EffectsLabPreset {
  return {
    ...defaultEffectsLabPreset,
    ...input,
    clipMode: input?.clipMode === "video" || input?.clipMode === "hybrid" ? input.clipMode : "static",
    kenBurnsIntensity:
      input?.kenBurnsIntensity === "subtle" || input?.kenBurnsIntensity === "strong"
        ? input.kenBurnsIntensity
        : "medium",
    hybridAnimateRatio:
      typeof input?.hybridAnimateRatio === "number" && input.hybridAnimateRatio > 0 && input.hybridAnimateRatio <= 1
        ? input.hybridAnimateRatio
        : defaultEffectsLabPreset.hybridAnimateRatio,
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

function normalizeMusicPreset(input?: MusicPresetInput): MusicLabPreset {
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

function normalizeSoundsPreset(input?: SoundsPresetInput): SoundsLabPreset {
  const fallbackCueList = input && typeof input === "object" && "cues" in input
    ? input.cues
    : undefined;

  return {
    ...defaultSoundsLabPreset,
    ...input,
    enabled:
      typeof input?.enabled === "boolean"
        ? input.enabled
        : defaultSoundsLabPreset.enabled,
    density:
      input?.density === "none" || input?.density === "light" || input?.density === "dense" || input?.density === "medium"
        ? input.density
        : defaultSoundsLabPreset.density,
    cueFocus: Array.isArray(input?.cueFocus)
      ? input.cueFocus.filter((cue): cue is string => typeof cue === "string")
      : Array.isArray(fallbackCueList)
        ? fallbackCueList.filter((cue): cue is string => typeof cue === "string")
        : defaultSoundsLabPreset.cueFocus,
  };
}

function getEditorLabScopeKey(projectId: string | null | undefined) {
  return projectId || "draft";
}

function buildEditorLabUrl({
  projectId,
  activeTab,
  origin,
}: {
  projectId: string;
  activeTab: string;
  origin: EditorLabOrigin;
}) {
  const params = new URLSearchParams({
    projectId,
    tab: activeTab,
    from: origin,
  });

  return `/editor-lab?${params.toString()}`;
}





function toCaptionLabPreset(style?: Partial<ProjectCaptionStyle> | null): CaptionLabPreset {
  return {
    ...defaultCaptionLabPreset,
    captionPosition: isCaptionPosition(style?.captionPosition) ? style.captionPosition : defaultCaptionLabPreset.captionPosition,
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



function EditorLabContent() {
  const [activeTab, setActiveTab] = useState<string>('visuals');
  const [saveLabel, setSaveLabel] = useState("Save Project Settings");
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(true);
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
  const [references, setReferences] = useState<ProjectReferenceAsset[]>([]);
  const [narrationLanguage, setNarrationLanguage] = useState('english');
  const [selectedVoice, setSelectedVoice] = useState('elevenlabs-v3');
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
      setCaptionsEnabled(project.captions?.status !== "disabled");
      setMusicEnabled(project.audio?.music?.mode !== "none");
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
  const requestedOrigin = searchParams.get("from");
  const requestedProjectId = searchParams.get("projectId");
  const requestedTemplateId = searchParams.get("template");
  const origin: EditorLabOrigin = isEditorLabOrigin(requestedOrigin)
    ? requestedOrigin
    : requestedProjectId
      ? "project"
      : requestedTemplateId
        ? "templates"
        : "setup";
  const resolvedProjectId = projectRecord?.id ?? projectDraft?.projectId ?? requestedProjectId ?? null;
  const backLink = origin === "production" && resolvedProjectId
    ? { href: `/projects/${resolvedProjectId}/production`, label: "Production" }
    : origin === "setup"
      ? { href: "/projects/new", label: "Factory" }
      : resolvedProjectId
        ? { href: `/projects/${resolvedProjectId}`, label: "Dashboard" }
        : origin === "templates" || Boolean(requestedTemplateId || projectDraft?.template)
          ? { href: "/templates", label: "Library" }
          : { href: "/projects/new", label: "Factory" };

  useEffect(() => {
    let cancelled = false;

    // 1. Initial hydration from Draft (for new projects or quick display)
    const nextDraft = readProjectDraft();
    if (nextDraft) {
      applyDraftToLab(nextDraft);
      setVisualStyle(nextDraft.projectContext || '');
      // If we're coming from setup/templates, default to generative mode or upload
      setSelectedVoice(normalizeSelectedVoice(nextDraft.sourceMode === "upload" ? CUSTOM_AUDIO_UPLOAD_ID : "elevenlabs-default"));
    }

    // 2. Tab restoration from search params
    const requestedTab = searchParams.get("tab");
    if (isEditorLabTab(requestedTab)) {
      window.setTimeout(() => {
        setActiveTab(requestedTab);
      }, 0);
    }

    // 3. Authoritative hydration from API
    const effectiveProjectId = requestedProjectId || nextDraft?.projectId || null;

    if (effectiveProjectId) {
      void fetchProject(effectiveProjectId)
        .then((project) => {
          if (cancelled) return;
          // Apply project data. This will overwrite draft/local state with server truth.
          applyProjectToLab(project, false);
        })
        .catch(() => {
          if (!cancelled) setProjectRecord(null);
        });
    } else {
      setProjectRecord(null);
    }

    return () => {
      cancelled = true;
    };
  }, [requestedProjectId, searchParams]);

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
      captionsEnabled,
      musicEnabled,
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
        captionsEnabled,
        musicEnabled,
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
        captionsEnabled,
        musicEnabled,
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

      const editorLabUrl = buildEditorLabUrl({
        projectId: persistedProject.id,
        activeTab,
        origin,
      });

      // Si c'est une première création ou qu'on vient du flow setup → redirige vers la liste des projets
      const isFirstCreation = wasUnsavedProject || origin === "setup";

      if (isFirstCreation) {
        setSaveLabel("Project Saved");
        router.push("/projects");
      } else if (requiresUploadedTracksAfterFirstSave) {
        setSaveLabel("Project Saved — Upload Tracks");
        router.replace(editorLabUrl);
      } else {
        setSaveLabel("Project Saved");
        router.replace(editorLabUrl);
        setTimeout(() => setSaveLabel("Save Project Settings"), 2000);
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
        captionsEnabled,
        musicEnabled,
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
        captionsEnabled,
        setCaptionsEnabled,
        musicEnabled,
        setMusicEnabled,
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
      <div className="min-h-screen bg-background text-foreground font-sans antialiased relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-250 h-75 bg-primary/5 blur-[120px] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-50" />

        <div className="max-w-360 mx-auto p-3.5 space-y-1 relative z-10">

          {/* Header Section */}
          <div className="flex items-center justify-between py-0.5">
            <Link href={backLink.href} className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors group uppercase tracking-widest font-mono">
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">{backLink.label}</span>
            </Link>
            <div className="flex items-center gap-3">
              {activeTab === "captions" && (
                <Button variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-card transition-all px-4 h-8 rounded-none text-[9px] font-black uppercase tracking-[0.2em] font-mono" onClick={handleReset}>
                  Reset Defaults
                </Button>
              )}
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 h-9 rounded-none transition-all font-black text-[9px] uppercase tracking-[0.2em]"
                onClick={handleSave}
                disabled={!projectDraft || isSaving}
              >
                <Save className="w-3 h-3 mr-2" /> {saveLabel}
              </Button>
            </div>
          </div>

          {projectRecord && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Badge variant="outline" className="border-border bg-card text-muted-foreground text-[8px] uppercase tracking-[0.18em] rounded-none font-mono">
                Project: {projectRecord.title}
              </Badge>
            </div>
          )}

          {/* Lab Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-5">
            <div className="flex justify-center">
              <TabsList className="bg-background border border-border p-1 h-auto rounded-none overflow-x-auto no-scrollbar inline-flex gap-1">
                {[
                  { id: 'visuals', label: 'Visuals Lab', icon: ImageIcon },
                  { id: 'captions', label: 'Captions Lab', icon: FileText },
                  { id: 'effects', label: 'Effects Lab', icon: Wand2 },
                  { id: 'audio', label: 'Audio Lab', icon: Mic },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className="px-4 py-2 gap-2 rounded-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent data-[state=active]:border-primary transition-all uppercase text-[8px] font-black tracking-[0.22em] outline-none"
                  >
                    <tab.icon className="w-3 h-3" /> {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* Tab Contents */}
            <TabsContent value="visuals" className="outline-none pt-1">
              {activeTab === "visuals" ? <VisualsLab /> : null}
            </TabsContent>

            <TabsContent value="captions" className="outline-none pt-1">
              {activeTab === "captions" ? <CaptionsLab /> : null}
            </TabsContent>



            <TabsContent value="effects" className="outline-none pt-1">
              {activeTab === "effects" ? <EffectsLab /> : null}
            </TabsContent>

            <TabsContent value="audio" className="outline-none pt-1">
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-none border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    }>
      <EditorLabContent />
    </Suspense>
  );
}

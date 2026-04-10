"use client";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Play, Settings2, Video, Sparkles, Image as ImageIcon, Music, Save, Activity, FileText, Type, Layout, History, Home, Mic, Upload, Trash2 } from "lucide-react"
import Link from "next/link"
import React, { useEffect, useState } from 'react';
import { useRouter } from "next/navigation"
import {
  approveImageVariant,
  approveVideoVariant,
  deleteProjectReferenceAsset,
  fetchProject,
  fetchProjectRenderStatus,
  getProjectReferencePreviewUrl,
  generateProjectAudio,
  generateProjectAssembly as requestProjectAssembly,
  generateProjectCaptions,
  formatProjectTimestamp,
  generateSceneImages,
  generateSceneVideos,
  generateProjectScenes,
  generateProjectScript,
  regenerateImageVariant,
  saveProjectScript,
  queueProjectRender,
  retryProjectRender,
  uploadProjectReferenceAsset,
  updateProject,
  type ProjectAudio,
  type ProjectAssembly,
  type ProjectCaptionStyle,
  type ProjectCaptions,
  type ProjectImageVariant,
  type ProjectReferenceAsset,
  type ProjectRecord,
  type ProjectReview,
  type ProjectRenderJob,
  type ProjectScene,
  type ProjectScript,
  type ProjectSettings,
} from "@/lib/projects-api"
import { defaultCaptionLabPreset, type CaptionLabPreset } from "../../editor-lab/caption-lab/caption-lab-preset"

const defaultProjectReview: ProjectReview = {
  scenePlan: {
    status: "pending",
    approvedAt: null,
  },
  finalAssembly: {
    status: "pending",
    approvedAt: null,
  },
};

const SCRIPT_DRIVEN_DURATION_LABEL = "Determined by script length";
const REFERENCE_LABEL_OPTIONS: Array<{
  value: ProjectReferenceAsset["label"];
  label: string;
}> = [
  { value: "scene", label: "Place / Scene" },
  { value: "character", label: "Character" },
  { value: "object", label: "Object" },
  { value: "style", label: "Style / Mood" },
];

function formatEstimatedDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return SCRIPT_DRIVEN_DURATION_LABEL;
  }

  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${remainingSeconds}s`;
}

function ProjectNotFound({ projectId }: { projectId: string }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 mt-10 text-left">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Projects
      </Link>
      <Card className="glass-card bg-card/40 border-border/40">
        <CardHeader>
          <CardTitle>Project not found</CardTitle>
          <CardDescription>
            No project matches the id <span className="font-mono text-foreground/80">{projectId}</span>.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  // Extract id from params using React.use (required in Next.js 15 for async params)
  const { id } = React.use(params);
  const [projectData, setProjectData] = useState<ProjectRecord | null>(null);
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [script, setScript] = useState<ProjectScript | null>(null);
  const [audio, setAudio] = useState<ProjectAudio | null>(null);
  const [captions, setCaptions] = useState<ProjectCaptions | null>(null);
  const [assembly, setAssembly] = useState<ProjectAssembly | null>(null);
  const [scenes, setScenes] = useState<ProjectScene[]>([]);
  const [renderJobs, setRenderJobs] = useState<ProjectRenderJob[]>([]);
  const [renderDriver, setRenderDriver] = useState("local");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [isGeneratingAssembly, setIsGeneratingAssembly] = useState(false);
  const [isQueueingRender, setIsQueueingRender] = useState(false);
  const [retryingRenderJobId, setRetryingRenderJobId] = useState<string | null>(null);
  const [activeSceneImageJob, setActiveSceneImageJob] = useState<string | null>(null);
  const [activeSceneVideoJob, setActiveSceneVideoJob] = useState<string | null>(null);
  const [activeImageJob, setActiveImageJob] = useState<string | null>(null);
  const [activeVideoJob, setActiveVideoJob] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [isUpdatingScriptLinkedReferences, setIsUpdatingScriptLinkedReferences] = useState(false);
  const [scriptLinkedReferenceError, setScriptLinkedReferenceError] = useState<string | null>(null);
  const [scriptLinkedReferenceNotice, setScriptLinkedReferenceNotice] = useState<string | null>(null);
  const scriptLinkedReferenceInputRef = React.useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const loadProject = async () => {
      try {
        const nextProject = await fetchProject(id);
        const renderStatus = await fetchProjectRenderStatus(id).catch(() => null);

        if (!isMounted) {
          return;
        }

        setProjectData(nextProject);
        setSettings(nextProject.settings);
        setScript(nextProject.script);
        setAudio(nextProject.audio);
        setCaptions(nextProject.captions);
        setAssembly(nextProject.assembly);
        setScenes(nextProject.scenes ?? []);
        setRenderJobs(renderStatus?.jobs ?? []);
        setRenderDriver(renderStatus?.driver ?? "local");
        setLoadError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setLoadError(error instanceof Error ? error.message : "Unable to load project");
      }
    };

    void loadProject();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    const hasActiveRender = renderJobs.some((job) => job.status === "queued" || job.status === "processing");

    if (!hasActiveRender) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void Promise.all([
        fetchProjectRenderStatus(id),
        fetchProject(id),
      ])
        .then(([statusPayload, nextProject]) => {
          setRenderJobs(statusPayload.jobs);
          setRenderDriver(statusPayload.driver);
          setProjectData(nextProject);
          setSettings(nextProject.settings);
          setScript(nextProject.script);
          setAudio(nextProject.audio);
          setCaptions(nextProject.captions);
          setAssembly(nextProject.assembly);
          setScenes(nextProject.scenes ?? []);
        })
        .catch(() => {
          // Keep the current snapshot if polling fails.
        });
    }, 2000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [id, renderJobs]);

  if (loadError === "Project not found") {
    return <ProjectNotFound projectId={id} />;
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 mt-10 text-left">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <Card className="glass-card bg-card/40 border-border/40">
          <CardHeader>
            <CardTitle>Unable to load project</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!projectData || !settings || !script || !audio || !captions || !assembly) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 mt-10 text-left">
        <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Projects
        </Link>
        <Card className="glass-card bg-card/40 border-border/40">
          <CardHeader>
            <CardTitle>Loading project...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const updateScript = <K extends keyof ProjectScript>(key: K, value: ProjectScript[K]) => {
    setScript((current) => current ? { ...current, [key]: value } : current);
  };

  const updateAudio = (nextAudio: ProjectAudio) => {
    setAudio(nextAudio);
    setProjectData((current) => current ? { ...current, audio: nextAudio } : current);
  };

  const updateCaptions = (nextCaptions: ProjectCaptions) => {
    setCaptions(nextCaptions);
    setProjectData((current) => current ? { ...current, captions: nextCaptions } : current);
  };

  const updateReview = (nextReview: ProjectReview) => {
    setProjectData((current) => current ? { ...current, review: nextReview } : current);
  };

  const applyProjectSnapshot = (nextProject: ProjectRecord) => {
    setProjectData(nextProject);
    setSettings(nextProject.settings);
    setScript(nextProject.script);
    setAudio(nextProject.audio);
    setCaptions(nextProject.captions);
    setAssembly(nextProject.assembly);
    setScenes(nextProject.scenes ?? []);
  };

  const setScriptLinkedReferencesLocal = (nextScriptLinkedReferences: ProjectReferenceAsset[]) => {
    setProjectData((current) => current ? {
      ...current,
      scriptLinkedReferences: nextScriptLinkedReferences,
    } : current);
  };

  const persistScriptLinkedReferences = async (nextScriptLinkedReferences: ProjectReferenceAsset[]) => {
    const updatedProject = await updateProject(projectData.id, {
      scriptLinkedReferences: nextScriptLinkedReferences,
    });
    applyProjectSnapshot(updatedProject);
    return updatedProject;
  };

  const resetReviewStage = (stage: keyof ProjectReview) => {
    updateReview({
      ...(projectData.review || defaultProjectReview),
      [stage]: {
        status: "pending",
        approvedAt: null,
      },
    });
  };

  const markCaptionsStale = () => {
    updateCaptions({
      ...captions,
      status: "draft",
      generatedAt: null,
      cues: [],
    });
  };

  const markAssemblyStale = (reason: string) => {
    resetReviewStage("finalAssembly");
    setAssembly((current) => current ? {
      ...current,
      status: "draft",
      warnings: [reason, ...current.warnings.filter((item) => item !== reason)].slice(0, 4),
      readiness: {
        ...current.readiness,
        readyToRender: false,
      },
    } : current);

    setProjectData((current) => current && current.assembly ? {
      ...current,
      assembly: {
        ...current.assembly,
        status: "draft",
        warnings: [reason, ...current.assembly.warnings.filter((item) => item !== reason)].slice(0, 4),
        readiness: {
          ...current.assembly.readiness,
          readyToRender: false,
        },
      },
    } : current);
  };

  const handleLaunchProduction = () => {
    router.push(`/projects/${projectData.id}/production`);
  }

  const openScriptLinkedReferencePicker = () => {
    if (!scriptIsReady) {
      setScriptLinkedReferenceError("Save or generate the script first before adding script-linked references.");
      setScriptLinkedReferenceNotice(null);
      return;
    }

    setScriptLinkedReferenceError(null);
    setScriptLinkedReferenceNotice(null);
    const input = scriptLinkedReferenceInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;

    if (!input) {
      return;
    }

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  };

  const handleAddScriptLinkedReferences = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const currentScriptLinkedReferences = projectData.scriptLinkedReferences ?? [];
    const availableSlots = Math.max(maxScriptLinkedReferences - currentScriptLinkedReferences.length, 0);
    const selectedFiles = files.slice(0, availableSlots);
    const ignoredCount = Math.max(files.length - selectedFiles.length, 0);

    if (selectedFiles.length === 0) {
      if (files.length > 0 && availableSlots === 0) {
        setScriptLinkedReferenceError(`You already reached the ${maxScriptLinkedReferences} image limit for script-linked references.`);
        setScriptLinkedReferenceNotice(null);
      }
      event.target.value = "";
      return;
    }

    setIsUpdatingScriptLinkedReferences(true);
    setScriptLinkedReferenceError(null);
    setScriptLinkedReferenceNotice(
      ignoredCount > 0
        ? `Only ${availableSlots} image${availableSlots > 1 ? "s were" : " was"} added. ${ignoredCount} extra file${ignoredCount > 1 ? "s were" : " was"} ignored because the limit is ${maxScriptLinkedReferences}.`
        : null
    );

    try {
      const uploadedReferences: ProjectReferenceAsset[] = await Promise.all(
        selectedFiles.map(async (file) => {
          const { asset } = await uploadProjectReferenceAsset(file, {
            projectId: projectData.id,
            label: "scene",
          });

          return asset;
        }),
      );
      const nextScriptLinkedReferences = [...currentScriptLinkedReferences, ...uploadedReferences];

      try {
        await persistScriptLinkedReferences(nextScriptLinkedReferences);
      } catch (error) {
        await Promise.all(
          uploadedReferences
            .filter((reference) => typeof reference.storagePath === "string" && reference.storagePath.length > 0)
            .map((reference) =>
              deleteProjectReferenceAsset({
                storagePath: reference.storagePath as string,
                referenceId: reference.id,
                draftId: reference.scopeId ?? null,
              }).catch(() => {})
            ),
        );
        throw error;
      }
    } catch (error) {
      const refreshedProject = await fetchProject(projectData.id).catch(() => null);

      if (refreshedProject) {
        applyProjectSnapshot(refreshedProject);
      }

      setScriptLinkedReferenceError(error instanceof Error ? error.message : "Unable to upload script-linked references.");
      setScriptLinkedReferenceNotice(null);
    } finally {
      setIsUpdatingScriptLinkedReferences(false);
      event.target.value = "";
    }
  };

  const handleRemoveScriptLinkedReference = async (referenceId: string) => {
    const currentScriptLinkedReferences = projectData.scriptLinkedReferences ?? [];
    const referenceToRemove = currentScriptLinkedReferences.find((reference) => reference.id === referenceId);

    if (!referenceToRemove) {
      return;
    }

    setIsUpdatingScriptLinkedReferences(true);
    setScriptLinkedReferenceError(null);
    setScriptLinkedReferenceNotice(null);

    try {
      const nextScriptLinkedReferences = currentScriptLinkedReferences.filter((reference) => reference.id !== referenceId);
      setScriptLinkedReferencesLocal(nextScriptLinkedReferences);
      await persistScriptLinkedReferences(nextScriptLinkedReferences);

      if (referenceToRemove.storagePath) {
        await deleteProjectReferenceAsset({
          storagePath: referenceToRemove.storagePath,
          referenceId: referenceToRemove.id,
          draftId: referenceToRemove.scopeId ?? null,
        }).catch(() => {});
      }
    } catch (error) {
      const refreshedProject = await fetchProject(projectData.id).catch(() => null);

      if (refreshedProject) {
        applyProjectSnapshot(refreshedProject);
      } else {
        setScriptLinkedReferencesLocal(currentScriptLinkedReferences);
      }

      setScriptLinkedReferenceError(error instanceof Error ? error.message : "Unable to remove this script-linked reference.");
    } finally {
      setIsUpdatingScriptLinkedReferences(false);
    }
  };

  const handleRenameScriptLinkedReference = (referenceId: string, nextName: string) => {
    setProjectData((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        scriptLinkedReferences: (current.scriptLinkedReferences ?? []).map((reference) =>
          reference.id === referenceId
            ? { ...reference, name: nextName }
            : reference
        ),
      };
    });
  };

  const handlePersistScriptLinkedReference = async (
    referenceId: string,
    updates: Partial<Pick<ProjectReferenceAsset, "name" | "label">>,
  ) => {
    const currentScriptLinkedReferences = projectData.scriptLinkedReferences ?? [];
    const referenceToUpdate = currentScriptLinkedReferences.find((reference) => reference.id === referenceId);

    if (!referenceToUpdate) {
      return;
    }

    const nextName = typeof updates.name === "string"
      ? updates.name.trim()
      : referenceToUpdate.name;
    const nextLabel = updates.label ?? referenceToUpdate.label;

    if (!nextName) {
      handleRenameScriptLinkedReference(referenceId, referenceToUpdate.name);
      return;
    }

    const nextScriptLinkedReferences = currentScriptLinkedReferences.map((reference) =>
      reference.id === referenceId
        ? { ...reference, name: nextName, label: nextLabel }
        : reference
    );

    setIsUpdatingScriptLinkedReferences(true);
    setScriptLinkedReferenceError(null);
    setScriptLinkedReferenceNotice(null);
    setScriptLinkedReferencesLocal(nextScriptLinkedReferences);

    try {
      await persistScriptLinkedReferences(nextScriptLinkedReferences);
    } catch (error) {
      const refreshedProject = await fetchProject(projectData.id).catch(() => null);

      if (refreshedProject) {
        applyProjectSnapshot(refreshedProject);
      } else {
        setScriptLinkedReferencesLocal(currentScriptLinkedReferences);
      }

      setScriptLinkedReferenceError(error instanceof Error ? error.message : "Unable to save script-linked reference changes.");
    } finally {
      setIsUpdatingScriptLinkedReferences(false);
    }
  };

  const handleSaveManualScript = async () => {
    setIsSavingScript(true);

    try {
      const nextScript = await saveProjectScript(projectData.id, {
        mode: script.mode,
        topic: script.topic,
        content: script.content,
        model: script.model,
      });

      setScript(nextScript);
      setProjectData((current) => current ? { ...current, script: nextScript } : current);
      setScenes([]);
      resetReviewStage("scenePlan");
      markCaptionsStale();
      markAssemblyStale("Script changed. Regenerate final assembly.");
    } finally {
      setIsSavingScript(false);
    }
  }

  const handleGenerateScript = async () => {
    setIsSavingScript(true);

    try {
      const nextScript = await generateProjectScript(projectData.id, {
        topic: script.topic,
        model: script.model,
      });

      setScript(nextScript);
      setProjectData((current) => current ? { ...current, script: nextScript } : current);
      setScenes([]);
      resetReviewStage("scenePlan");
      markCaptionsStale();
      markAssemblyStale("Script changed. Regenerate final assembly.");
    } finally {
      setIsSavingScript(false);
    }
  }

  const handleGenerateScenes = async () => {
    setIsGeneratingScenes(true);

    try {
      const hasUnsavedScriptChanges = script.mode !== projectData.script.mode
        || script.topic !== projectData.script.topic
        || script.content !== projectData.script.content
        || script.model !== projectData.script.model;

      if (hasUnsavedScriptChanges) {
        const nextScript = await saveProjectScript(projectData.id, {
          mode: script.mode,
          topic: script.topic,
          content: script.content,
          model: script.model,
        });

        setScript(nextScript);
        setProjectData((current) => current ? { ...current, script: nextScript } : current);
        setScenes([]);
        resetReviewStage("scenePlan");
        markCaptionsStale();
        markAssemblyStale("Script changed. Regenerate final assembly.");
      }

      const updatedProject = await generateProjectScenes(projectData.id);
      applyProjectSnapshot(updatedProject);
      markCaptionsStale();
      markAssemblyStale(`${sceneUnitLabelPlural} changed. Regenerate final assembly.`);
    } finally {
      setIsGeneratingScenes(false);
    }
  }

  const handleGenerateAudio = async () => {
    setIsGeneratingAudio(true);

    try {
      const nextAudio = await generateProjectAudio(projectData.id, {
        audio: {
          type: "full",
        },
      });

      updateAudio(nextAudio);
      markCaptionsStale();
      markAssemblyStale("Audio stack changed. Regenerate final assembly.");
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  const handleGenerateCaptions = async () => {
    setIsGeneratingCaptions(true);

    try {
      const savedPreset = window.localStorage.getItem("cosyl-editor-lab");
      let style: Partial<ProjectCaptionStyle> = projectData.captions?.style || defaultCaptionLabPreset;

      if (savedPreset) {
        try {
          const parsedPreset = JSON.parse(savedPreset) as { scopeKey?: string; captionPreset?: CaptionLabPreset };
          if (parsedPreset.scopeKey === projectData.id && parsedPreset.captionPreset) {
            style = parsedPreset.captionPreset;
          }
        } catch {
          // Ignore malformed local preset payload and fall back to defaults.
        }
      }

      const nextCaptions = await generateProjectCaptions(projectData.id, { style });
      updateCaptions(nextCaptions);
      markAssemblyStale("Captions changed. Regenerate final assembly.");
    } finally {
      setIsGeneratingCaptions(false);
    }
  }

  const handleGenerateAssembly = async () => {
    setIsGeneratingAssembly(true);

    try {
      const nextAssembly = await requestProjectAssembly(projectData.id);
      setAssembly(nextAssembly);
      setProjectData((current) => current ? { ...current, assembly: nextAssembly } : current);
    } finally {
      setIsGeneratingAssembly(false);
    }
  }

  const handleQueueRender = async () => {
    setIsQueueingRender(true);

    try {
      const nextRender = await queueProjectRender(projectData.id, {
        source: "project-assembly-tab",
      });

      setRenderDriver(nextRender.driver);
      setRenderJobs((current) => [nextRender.job, ...current]);
    } finally {
      setIsQueueingRender(false);
    }
  }

  const handleRetryRender = async (jobId: string) => {
    setRetryingRenderJobId(jobId);

    try {
      const nextRender = await retryProjectRender(projectData.id, jobId);
      setRenderDriver(nextRender.driver);
      setRenderJobs((current) => [nextRender.job, ...current]);
    } finally {
      setRetryingRenderJobId(null);
    }
  }

  const replaceSceneInState = (nextScene: ProjectScene) => {
    setScenes((current) => current.map((scene) => scene.id === nextScene.id ? nextScene : scene));
    setProjectData((current) => current ? {
      ...current,
      scenes: current.scenes.map((scene) => scene.id === nextScene.id ? nextScene : scene),
    } : current);
  }

  const handleGenerateSceneImages = async (sceneId: string) => {
    setActiveSceneImageJob(sceneId);

    try {
      const nextScene = await generateSceneImages(sceneId);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} visuals changed. Regenerate final assembly.`);
    } finally {
      setActiveSceneImageJob(null);
    }
  }

  const handleApproveImage = async (imageId: string) => {
    setActiveImageJob(imageId);

    try {
      const nextScene = await approveImageVariant(imageId);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} visuals changed. Regenerate final assembly.`);
    } finally {
      setActiveImageJob(null);
    }
  }

  const handleRegenerateImage = async (imageId: string) => {
    setActiveImageJob(imageId);

    try {
      const nextScene = await regenerateImageVariant(imageId);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} visuals changed. Regenerate final assembly.`);
    } finally {
      setActiveImageJob(null);
    }
  }

  const handleGenerateSceneVideos = async (sceneId: string) => {
    setActiveSceneVideoJob(sceneId);

    try {
      const nextScene = await generateSceneVideos(sceneId);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} ${isSlideshowProject ? "motion" : "clips"} changed. Regenerate final assembly.`);
    } finally {
      setActiveSceneVideoJob(null);
    }
  }

  const handleApproveVideo = async (videoId: string) => {
    setActiveVideoJob(videoId);

    try {
      const nextScene = await approveVideoVariant(videoId);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} ${isSlideshowProject ? "motion" : "clips"} changed. Regenerate final assembly.`);
    } finally {
      setActiveVideoJob(null);
    }
  }

  const getVariantPreviewClassName = (palette: ProjectImageVariant["palette"]) => {
    if (palette === "cyan") return "from-cyan-500/30 via-slate-900 to-cyan-950";
    if (palette === "amber") return "from-amber-500/25 via-zinc-900 to-amber-950";
    if (palette === "emerald") return "from-emerald-500/25 via-slate-950 to-emerald-950";
    if (palette === "rose") return "from-rose-500/25 via-zinc-950 to-rose-950";
    return "from-violet-500/30 via-slate-950 to-violet-950";
  }

  const getVideoPreviewClassName = (energy: string) => {
    if (energy === "calm") return "from-sky-500/25 via-slate-950 to-sky-950";
    if (energy === "editorial") return "from-zinc-400/20 via-zinc-950 to-zinc-900";
    if (energy === "punchy") return "from-rose-500/25 via-zinc-950 to-orange-950";
    return "from-violet-500/30 via-slate-950 to-indigo-950";
  }

  const getRenderJobBadgeClassName = (status: string) => {
    if (status === "completed") {
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    }

    if (status === "failed") {
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    }

    if (status === "processing") {
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    }

    return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  };

  const getRenderProgressWidth = (progress?: number) => {
    const safeProgress = typeof progress === "number" ? Math.max(0, Math.min(100, progress)) : 0;
    return `${safeProgress}%`;
  };

  const getScriptModelLabel = (model: string) => {
    if (model === "claude") return "Claude";
    if (model === "gemini") return "Gemini";
    return "GPT";
  };

  const getImageModelLabel = (model: string) => {
    if (model === "kling-3.0") return "Kling 3.0";
    return "Nano Banana";
  };

  const getVideoModelLabel = (model: string) => {
    if (model === "none") return "Disabled";
    if (model === "seedance-2.0") return "Seedance 2.0";
    return "Kling 3.0";
  };

  const estimatedSceneDurationSeconds = scenes.reduce((sum, scene) => sum + (scene.duration || 0), 0);
  const estimatedFinalDuration = assembly.totalDurationLabel && assembly.totalDurationLabel !== "00:00"
    ? assembly.totalDurationLabel
    : formatEstimatedDuration(estimatedSceneDurationSeconds);

  const setupHighlights = [
    { label: "Script Engine", value: getScriptModelLabel(settings.scriptAgentModel) },
    { label: "Image Engine", value: getImageModelLabel(settings.imageAgentModel) },
    { label: "Motion Engine", value: getVideoModelLabel(settings.videoAgentModel) },
    { label: "Language", value: settings.projectLanguage || "Not set" },
    { label: "Voice", value: audio.narration.voiceId || settings.voiceId || "Not set" },
    { label: "Estimated Final Duration", value: estimatedFinalDuration || settings.targetDuration || SCRIPT_DRIVEN_DURATION_LABEL },
  ];

  const isSlideshowProject = projectData.type.toLowerCase().includes("slideshow");
  const sceneUnitLabel = isSlideshowProject ? "Slide" : "Scene";
  const sceneUnitLabelPlural = isSlideshowProject ? "Slides" : "Scenes";
  const review = projectData.review || defaultProjectReview;
  const approvedImageCount = scenes.filter((scene) => Boolean(scene.approvedImageId)).length;
  const approvedVideoCount = scenes.filter((scene) => Boolean(scene.approvedVideoId)).length;
  const allScenesHaveImages = scenes.length > 0 && approvedImageCount === scenes.length;
  const allScenesHaveVideos = isSlideshowProject
    ? true
    : scenes.length > 0 && approvedVideoCount === scenes.length;
  const scenePlanIsCurrent = Boolean(projectData.sceneProduction);
  const scenePlanApproved = review.scenePlan.status === "approved";
  const canApproveFinalAssembly = assembly.timeline.length > 0
    && assembly.readiness.hasScenes
    && assembly.readiness.hasAudio
    && assembly.readiness.hasCaptions
    && assembly.readiness.hasVisualCoverage
    && scenePlanApproved
    && allScenesHaveImages
    && allScenesHaveVideos;
  const canQueueRender = canApproveFinalAssembly
    && review.finalAssembly.status === "approved"
    && allScenesHaveImages
    && allScenesHaveVideos;

  // BUG 2 FIX: Le script doit être généré ET les scènes doivent exister
  const scriptIsReady = script.source === "generated" || script.source === "manual";
  const scriptLinkedReferenceCount = projectData.scriptLinkedReferences?.length ?? 0;
  const maxScriptLinkedReferences = 12;
  const canUploadScriptLinkedReferences = !isUpdatingScriptLinkedReferences
    && scriptLinkedReferenceCount < maxScriptLinkedReferences;
  const canLaunchProduction = scriptIsReady && scenes.length > 0 && scenePlanIsCurrent && scenePlanApproved;
  const productionBlockReason = !scriptIsReady
    ? "Générez d'abord le script (onglet Script)"
    : scenes.length === 0
      ? "Générez d'abord les scènes (onglet Scènes)"
      : !scenePlanIsCurrent
        ? "Regénérez d'abord les scènes pour refléter les dernières références visuelles"
      : !scenePlanApproved
        ? "Validez d'abord le scene plan avant d'entrer en production"
      : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 mt-2 pb-20">
      <input
        ref={scriptLinkedReferenceInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleAddScriptLinkedReferences}
      />
      <div className="relative group">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <Link 
              href="/projects" 
              className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all mb-2"
            >
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Projects
            </Link>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">{projectData.title}</h2>
              <Badge className="bg-primary/20 text-primary border-none text-[10px] uppercase font-black px-3 py-1">
                {projectData.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-medium flex items-center gap-2">
              <span className="text-primary/60">{projectData.type}</span> 
              <span className="w-1 h-1 rounded-full bg-white/10" />
              Created {formatProjectTimestamp(projectData.createdAt)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-3 pt-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveTab("settings")}
                className="inline-flex items-center h-10 px-4 rounded-full border border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10 gap-2 text-[10px] font-black uppercase tracking-wider text-foreground transition-all"
              >
                <Settings2 className="w-3.5 h-3.5 text-primary" /> Setup Snapshot
              </Button>
              <Button 
                size="sm" 
                onClick={handleLaunchProduction}
                disabled={!canLaunchProduction}
                className="h-10 px-6 rounded-full bg-primary hover:bg-primary/90 text-white gap-2 text-[10px] font-black uppercase tracking-wider shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Launch Production
              </Button>
            </div>
            {productionBlockReason && (
              <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider text-amber-400">
                <Sparkles className="w-3 h-3" /> {productionBlockReason}
              </p>
            )}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md pt-2 pb-4 -mx-4 px-4">
          <TabsList className="bg-white/2 border border-white/5 p-1.5 h-auto min-h-13 w-full justify-start overflow-x-auto no-scrollbar rounded-2xl gap-1">
            <TabsTrigger value="overview" className="gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Home className="w-3.5 h-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger value="script" className="gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <FileText className="w-3.5 h-3.5" /> Script
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Settings2 className="w-3.5 h-3.5" /> Setup
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Mic className="w-3.5 h-3.5" /> Audio
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <ImageIcon className="w-3.5 h-3.5" /> Assets
            </TabsTrigger>
            <TabsTrigger value="scenes" className="gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
              <Layout className="w-3.5 h-3.5" /> Scene
            </TabsTrigger>
          </TabsList>
        </div>


        <TabsContent value="overview" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="pb-6 border-b border-white/5 bg-white/2">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <FileText className="w-4 h-4 text-purple-400" /> Script Objective
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground mt-1">The primary theme for the script agent.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="p-6 rounded-2xl bg-white/3 border border-white/5 text-lg font-bold leading-relaxed text-white italic">
                  &ldquo;{script.topic || "No topic defined yet."}&rdquo;
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden text-left">
              <CardHeader className="pb-6 border-b border-white/5 bg-white/2">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <Mic className="w-4 h-4 text-primary" /> Vocal Direction
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground mt-1">Tone and pacing instructions for the narrator.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="p-6 rounded-2xl bg-white/3 border border-white/5 text-lg font-medium leading-relaxed text-white/90 italic">
                  &ldquo;{audio.narration.direction || settings.narrationStyle || settings.tone || "No narrator direction defined yet."}&rdquo;
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="script" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[0.6fr_1.4fr] gap-8">
            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden self-start">
              <CardHeader className="pb-6 border-b border-white/5 bg-white/2">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <Sparkles className="w-4 h-4 text-purple-400" /> Creation Lab
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground mt-1">Source your content theme.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80">Input Mode</Label>
                  <Select value={script.mode} onValueChange={(value) => updateScript("mode", value as ProjectScript["mode"])}>
                    <SelectTrigger className="h-11 bg-white/3 border-white/10 rounded-xl focus:ring-primary/50 transition-all">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-white/10 rounded-xl">
                      <SelectItem value="ai" className="text-xs uppercase font-bold text-white">AI Generation</SelectItem>
                      <SelectItem value="manual" className="text-xs uppercase font-bold text-white">Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {script.mode === "ai" && (
                  <div className="space-y-2.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80">Topic / Idea</Label>
                    <Textarea
                      value={script.topic}
                      onChange={(event) => updateScript("topic", event.target.value)}
                      placeholder="Describe the subject..."
                      className="min-h-35 bg-white/3 border-white/10 rounded-xl focus:ring-primary/50 transition-all text-sm resize-none leading-relaxed"
                    />
                  </div>
                )}
              </CardContent>
              <CardFooter className="justify-end border-t border-white/5 pt-4 bg-white/1 gap-3">
                <Button 
                  className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 text-white gap-2 text-[10px] font-black uppercase tracking-wider shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)] transition-all active:scale-95" 
                  onClick={script.mode === "manual" ? handleSaveManualScript : handleGenerateScript} 
                  disabled={isSavingScript}
                >
                  {script.mode === "manual" ? <Save className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {script.mode === "manual" ? "Save Manual Script" : "Generate Script"}
                </Button>
              </CardFooter>
            </Card>

            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
              <CardHeader className="pb-6 border-b border-white/5 bg-white/2">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <FileText className="w-4 h-4 text-blue-400" /> {script.mode === "manual" ? "Script Editor" : "Generated Output"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 flex-1 flex flex-col">
                <div className="relative flex-1 group/editor">
                  <Textarea
                    value={script.content}
                    onChange={(event) => updateScript("content", event.target.value)}
                    placeholder="Script content..."
                    className="h-full min-h-112.5 bg-white/3 border-white/10 rounded-2xl focus:ring-primary/50 transition-all text-sm leading-relaxed resize-none font-mono p-6"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="mt-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5 bg-white/2">
              <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                    <Settings2 className="w-4 h-4 text-primary" /> Technical Setup Snapshot
                  </CardTitle>
                  <CardDescription className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground mt-1">
                    Configured once in Editor Lab during project creation. This page is now execution-only.
                  </CardDescription>
                </div>
                <Badge className="border-none bg-primary/15 text-primary text-[9px] uppercase tracking-[0.2em] font-black">
                  Setup Locked
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-3 bg-white/1">
              <div className="rounded-2xl border border-white/5 bg-white/2 px-4 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Workflow Rule</p>
                <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-white/65">
                  The technical stack is defined in <span className="font-semibold text-white">Editor Lab</span> during creation, then this project page is used to run the pipeline:
                  script, scenes, assets, approvals, assembly and render.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
                {setupHighlights.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/5 bg-white/2 p-2.5 space-y-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30">{item.label}</p>
                    <p className="text-[12px] font-bold text-white/85 leading-snug">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/5 bg-white/2 p-3.5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Creative Direction</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">Project Goal</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-white/70 line-clamp-2">{projectData.goal || "No project goal captured."}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">Creative Tone</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-white/70 line-clamp-2">{settings.tone || "No creative tone defined."}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25">Visual Style</p>
                      <p className="mt-0.5 text-[12px] leading-relaxed text-white/70 line-clamp-2">{settings.visualStyle || "No visual style defined."}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-white/2 p-3.5 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Caption Preset</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">Animation</p>
                      <p className="mt-1 text-[11px] font-bold text-white/75">{captions.style.animationStyle}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">Palette</p>
                      <p className="mt-1 text-[11px] font-bold text-white/75">{captions.style.colorStyle}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">Typography</p>
                      <p className="mt-1 text-[11px] font-bold text-white/75">{captions.style.typography}</p>
                    </div>
                    <div className="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                      <p className="text-[8px] font-black uppercase tracking-[0.18em] text-white/25">Pacing</p>
                      <p className="mt-1 text-[11px] font-bold text-white/75">{captions.style.wordByWord ? "Word by word" : "Full line"}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-white/5 bg-white/2">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <Mic className="w-4 h-4 text-emerald-400" /> Audio Deck Configuration
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground mt-1">Read-only snapshot of the audio setup frozen during project creation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 bg-white/1">
                <div className="space-y-2.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80">Narration Voice</Label>
                  <div className="p-3 rounded-2xl bg-white/3 border border-white/10 flex items-center justify-between group/voice transition-all hover:bg-white/5">
                    <div className="space-y-1">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        Synced from Engine
                      </div>
                      <p className="text-xs font-mono font-bold text-white/90">{audio.narration.voiceId || settings.voiceId || "No voice ID selected"}</p>
                      {audio.narration.uploadedSource?.name && audio.narration.uploadedSource?.storagePath ? (
                        <p className="text-[10px] text-white/45">
                          Source: {audio.narration.uploadedSource.name}
                        </p>
                      ) : null}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-3 rounded-lg border-white/10 bg-white/5 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                      onClick={() => setActiveTab("settings")}
                    >
                      View Setup
                    </Button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80">Narration Direction</Label>
                  <div className="rounded-2xl bg-white/3 border border-white/10 p-3">
                    <p className="text-[13px] leading-relaxed text-white/80 italic">
                      {audio.narration.direction || settings.narrationStyle || settings.tone || "No narration direction defined yet."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/3 border border-white/10 p-3 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">Music Mode</p>
                    <p className="text-xs font-bold text-white/85">
                      {audio.music.mode === "uploaded"
                        ? "Uploaded tracks"
                        : audio.music.mode === "none"
                          ? "No music"
                          : "Auto generate"}
                    </p>
                    <p className="text-[10px] text-white/45">
                      {audio.music.mode === "uploaded" && Array.isArray(audio.music.uploadedTracks)
                        ? `${audio.music.uploadedTracks.filter((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0).length} reserved track${audio.music.uploadedTracks.filter((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0).length > 1 ? "s" : ""}`
                        : "Defined once in Audio Lab"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/3 border border-white/10 p-3 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">Ambient Mood</p>
                    <p className="text-xs font-bold text-white/85">{audio.music.mood || "No mood selected"}</p>
                    <p className="text-[10px] text-white/45">
                      {audio.music.trackName || (audio.music.mode === "none" ? "Music disabled for this project" : "Will be applied during generation")}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/3 border border-white/10 p-3 space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">SFX Soundscape</p>
                    <p className="text-xs font-bold text-white/85">
                      {audio.sfx.enabled ? audio.sfx.density : "Disabled"}
                    </p>
                    <p className="text-[10px] text-white/45">Read-only snapshot from Editor Lab</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end border-t border-white/5 pt-3 bg-white/1">
                <Button 
                  className="h-9 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white gap-2 text-[10px] font-black uppercase tracking-wider shadow-[0_0_15px_-3px_rgba(168,85,247,0.4)] transition-all active:scale-95" 
                  onClick={handleGenerateAudio} 
                  disabled={isGeneratingAudio}
                >
                  <Music className="w-3.5 h-3.5" /> Render stack
                </Button>
              </CardFooter>
            </Card>

            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden flex flex-col">
              <CardHeader className="pb-4 border-b border-white/5 bg-white/2">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <Activity className="w-4 h-4 text-purple-400" /> Audio Master Trace
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-bold tracking-tight text-muted-foreground mt-1">
                  {audio.generatedAt ? `Mastered on ${formatProjectTimestamp(audio.generatedAt)}` : "No master output yet."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="p-3 rounded-2xl bg-white/2 border border-white/5 space-y-1.5">
                    <p className="text-[9px] uppercase font-black tracking-widest text-emerald-400/60">Voice Stream</p>
                    <p className="text-[11px] text-foreground/80 font-mono leading-relaxed italic line-clamp-3">{audio.narration.textPreview || "No voiceover data."}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("settings")}
                    className="w-full flex items-center justify-between p-3 rounded-2xl border border-white/5 bg-white/1 hover:bg-white/3 transition-all group text-left"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Music className="w-3.5 h-3.5 text-purple-400" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Setup Reminder</p>
                      </div>
                      <p className="text-[9px] text-muted-foreground/50 leading-relaxed">Technical configuration was frozen during creation in Editor Lab.</p>
                    </div>
                    <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden xl:col-span-4">
            <CardHeader className="pb-6 border-b border-white/5 bg-white/2 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <ImageIcon className="w-4 h-4 text-primary" /> Foundation Reference Library
                </CardTitle>
                <CardDescription className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Global visual DNA from Editor Lab for characters, places and environments.
                </CardDescription>
              </div>
              <Badge className="border-none bg-white/5 text-white/40 text-[9px] uppercase tracking-[0.18em] font-black">
                Setup Frozen
              </Badge>
            </CardHeader>
            <CardContent className="pt-6">
              {(projectData.references?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 gap-4">
                  {projectData.references?.map((reference) => (
                    <div key={reference.id} className="group/asset relative rounded-2xl border border-white/5 bg-white/1 p-2 transition-all hover:bg-white/3">
                      <div className="aspect-[4/5] rounded-xl overflow-hidden bg-zinc-900 border border-white/5 relative">
                        {getProjectReferencePreviewUrl(reference) ? (
                          <img src={getProjectReferencePreviewUrl(reference) ?? undefined} alt={reference.name} className="h-full w-full object-cover grayscale group-hover/asset:grayscale-0 transition-all duration-500" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-white/10"><ImageIcon className="w-8 h-8" /></div>
                        )}
                      </div>
                      <div className="mt-2 space-y-1 px-1">
                        <p className="text-[11px] font-black text-white/80 uppercase tracking-tighter truncate">{reference.name}</p>
                        <p className="text-[8px] uppercase tracking-[0.18em] text-white/35">Foundation Reference</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                  <div className="p-8 text-center border border-dashed border-white/5 rounded-[28px] bg-white/1">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-white italic">No foundation references</h3>
                    <div className="mt-6 inline-flex items-center rounded-2xl border border-primary/20 bg-primary/5 px-6 py-3 text-[11px] font-black uppercase tracking-widest text-primary/80">
                    Set in Editor Lab
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden xl:col-span-8">
            <CardHeader className="pb-6 border-b border-white/5 bg-white/2 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-white">
                  <ImageIcon className="w-4 h-4 text-amber-400" /> Script-Linked References
                </CardTitle>
                <CardDescription className="text-[10px] uppercase tracking-[0.16em] text-white/35">
                  Optional images tied to exact script subjects, places, objects or events.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="border-none bg-amber-500/10 text-amber-300 text-[9px] uppercase tracking-[0.18em] font-black">
                  Optional
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openScriptLinkedReferencePicker}
                  disabled={!canUploadScriptLinkedReferences}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {isUpdatingScriptLinkedReferences ? "Uploading..." : "Upload Images"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/55">
                  {scriptLinkedReferenceCount}/{maxScriptLinkedReferences} linked refs
                </p>
                <p className="text-[10px] text-white/35">
                  Match the image name to the script wording for better scene selection.
                </p>
              </div>
              {scriptLinkedReferenceError ? (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-[11px] font-medium text-rose-200">
                  {scriptLinkedReferenceError}
                </div>
              ) : null}
              {scriptLinkedReferenceNotice ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] font-medium text-amber-100/90">
                  {scriptLinkedReferenceNotice}
                </div>
              ) : null}
              {!scriptIsReady ? (
                <div className="p-10 text-center border border-dashed border-white/5 rounded-[28px] bg-white/1">
                  <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Script first</h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/35 max-w-xl mx-auto">
                    Save the script first, then add optional images using the same wording as the script.
                  </p>
                </div>
              ) : (projectData.scriptLinkedReferences?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                  {(projectData.scriptLinkedReferences ?? []).map((reference) => (
                    <div key={reference.id} className="group/asset relative rounded-2xl border border-white/5 bg-white/1 p-2 transition-all hover:bg-white/3">
                      <div className="aspect-[4/5] rounded-xl overflow-hidden bg-zinc-900 border border-white/5 relative">
                        {getProjectReferencePreviewUrl(reference) ? (
                          <img src={getProjectReferencePreviewUrl(reference) ?? undefined} alt={reference.name} className="h-full w-full object-cover grayscale group-hover/asset:grayscale-0 transition-all duration-500" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-white/10"><ImageIcon className="w-8 h-8" /></div>
                        )}
                      </div>
                      <div className="mt-2 space-y-2 px-1">
                        <Input
                          value={reference.name}
                          onChange={(event) => handleRenameScriptLinkedReference(reference.id, event.target.value)}
                          onBlur={(event) => void handlePersistScriptLinkedReference(reference.id, { name: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            }
                          }}
                          disabled={isUpdatingScriptLinkedReferences}
                          className="h-8 border-white/10 bg-black/20 text-[11px] font-black uppercase tracking-tight text-white placeholder:text-white/20"
                          placeholder="Use exact script wording"
                        />
                        <Select
                          value={reference.label}
                          onValueChange={(value: ProjectReferenceAsset["label"]) => {
                            void handlePersistScriptLinkedReference(reference.id, { label: value });
                          }}
                          disabled={isUpdatingScriptLinkedReferences}
                        >
                          <SelectTrigger className="h-8 border-white/10 bg-black/20 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REFERENCE_LABEL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[8px] uppercase tracking-[0.18em] text-white/35">Script-Linked</p>
                          <Badge className="border-none bg-white/6 text-white/60 text-[8px] uppercase tracking-[0.18em] font-black">
                            {REFERENCE_LABEL_OPTIONS.find((option) => option.value === reference.label)?.label ?? reference.label}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mt-2 h-7 w-full text-[10px] uppercase tracking-widest"
                        onClick={() => handleRemoveScriptLinkedReference(reference.id)}
                        disabled={isUpdatingScriptLinkedReferences}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center border border-dashed border-white/5 rounded-[28px] bg-white/1">
                  <ImageIcon className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Optional layer</h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-white/35 max-w-xl mx-auto">
                    Add script-specific images here, or leave this empty and rely on the foundation library only.
                  </p>
                </div>
              )}
              {scriptIsReady ? (
                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/6 px-4 py-3 text-[11px] leading-relaxed text-amber-100/80">
                  Name each image with the exact script wording, then choose the right type.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenes" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden">
              <CardHeader className="pb-4 border-b border-white/5">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                  <Play className="w-3.5 h-3.5 text-primary" /> Render Control
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <Badge className={`${assembly.readiness.readyToRender ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} w-full justify-center py-2 text-[9px] font-black`}>
                  {assembly.readiness.readyToRender ? "MASTER READY" : "DRAFT MODE"}
                </Badge>
                <Button className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-[10px]" onClick={handleQueueRender} disabled={isQueueingRender || !canQueueRender}>
                  Queue Master Render
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden md:col-span-2">
              <CardHeader className="pb-4 border-b border-white/5 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white">Production Blueprint</CardTitle>
                <Button variant="outline" size="sm" className="h-8 text-[9px] font-black uppercase tracking-widest" onClick={handleGenerateAssembly}>Re-Compile Timeline</Button>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-muted-foreground/40 uppercase">Duration</p>
                    <p className="text-sm font-black text-white">{assembly.totalDurationLabel}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-muted-foreground/40 uppercase">Assets</p>
                    <p className="text-sm font-black text-white">{assembly.summary.approvedVideos}/{assembly.summary.sceneCount}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-muted-foreground/40 uppercase">Captions</p>
                    <p className="text-sm font-black text-white">{assembly.readiness.hasCaptions ? "SYNCED" : "NULL"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-card bg-white/2 border-white/5 shadow-2xl rounded-3xl overflow-hidden mt-6">
            <CardHeader className="pb-4 border-b border-white/5 flex flex-row items-center justify-between">
              <div className="space-y-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-white">Scene breakdown</CardTitle>
                {scenes.length > 0 && !scenePlanIsCurrent ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/80">
                    Current scenes are stale. Regenerate the scene plan before production.
                  </p>
                ) : null}
              </div>
              <Button className="h-9 px-6 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest border border-purple-500/20" onClick={handleGenerateScenes} disabled={isGeneratingScenes}>
                {isGeneratingScenes ? "Mastering..." : "Generate Production Scenes"}
              </Button>
            </CardHeader>
            <CardContent className="pt-8">
              {scenes.length > 0 && !scenePlanIsCurrent ? (
                <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-[11px] leading-relaxed text-amber-100/85">
                  The scenes below are kept as a visual snapshot, but they no longer reflect the current foundation or script-linked references. Generate the scenes again to realign the pipeline before moving into production.
                </div>
              ) : null}
              {scenes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {scenes.map((scene) => {
                    const sceneStatus = !scenePlanIsCurrent
                      ? "stale"
                      : scene.approvedVideoId
                        ? "completed"
                        : (scene.videoVariants.length > 0 ? "draft" : "pending");
                    return (
                      <div key={scene.id} className="group/scene p-4 rounded-2xl border border-white/5 bg-white/1 hover:bg-white/3 transition-all">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest">Scene {scene.id}</span>
                          <Badge className={`${
                            sceneStatus === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : sceneStatus === 'stale'
                                ? 'bg-rose-500/10 text-rose-300'
                                : 'bg-amber-500/10 text-amber-400'
                          } border-none text-[8px]`}>
                            {sceneStatus.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3 mb-4 italic">&ldquo;{scene.visualIntent}&rdquo;</p>
                        <div className="aspect-video bg-zinc-900 rounded-xl overflow-hidden border border-white/5 relative group-hover/scene:border-primary/30 transition-all">
                           <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover/scene:opacity-40 transition-opacity">
                              <Play className="w-10 h-10" />
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-20 text-center">
                  <Layout className="w-10 h-10 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">Studio Empty — Start Generation</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Render History at the bottom of Scene tab */}
          <HistorySection renderJobs={renderJobs} assembly={assembly} formatProjectTimestamp={formatProjectTimestamp} handleRetryRender={handleRetryRender} retryingRenderJobId={retryingRenderJobId} getRenderJobBadgeClassName={getRenderJobBadgeClassName} getRenderProgressWidth={getRenderProgressWidth} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function HistorySection({ renderJobs, assembly, formatProjectTimestamp, handleRetryRender, retryingRenderJobId, getRenderJobBadgeClassName, getRenderProgressWidth }: any) {
  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center gap-2 px-1">
        <History className="w-4 h-4 text-white/40" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Render History & Master Logs</h3>
      </div>
      {renderJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderJobs.map((job: any) => (
            <Card key={job.id} className="glass-card bg-white/1 border-white/5 rounded-2xl overflow-hidden">
               <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-white uppercase">{formatProjectTimestamp(job.createdAt)}</p>
                    <p className="text-[9px] text-muted-foreground/60 uppercase font-bold">{job.status}</p>
                  </div>
                  <Badge className={`${getRenderJobBadgeClassName(job.status)} border-none text-[8px]`}>{job.status.toUpperCase()}</Badge>
               </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-[9px] text-muted-foreground/40 italic px-1">No production logs available.</p>
      )}
    </div>
  )
}

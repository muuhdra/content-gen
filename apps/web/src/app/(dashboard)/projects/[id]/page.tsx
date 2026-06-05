"use client";

import { Button } from "@/components/ui/button"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Play, Wand2, Image as ImageIcon, Music, Save, Activity, FileText, Layout, History, Mic, Upload, Trash2, Scissors, Cpu, LayoutTemplate } from "lucide-react"
import Link from "next/link"
import { SaveTemplateDialog } from "@/features/projects/components/SaveTemplateDialog"
import { saveCustomTemplateFromProject } from "@/features/projects/utils/custom-templates"
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from "next/navigation"
import {
  approveImageVariant,
  approveVideoVariant,
  deleteProjectReferenceAsset,
  fetchProject,
  fetchProjectRenderStatus,
  getProjectReferencePreviewUrl,
  generateProjectAudio,
  generateProjectAssembly as requestProjectAssembly,
  formatProjectTimestamp,
  generateSceneImages,
  generateSceneVideos,
  generateProjectScenes,
  generateProjectScript,
  saveProjectScript,
  queueProjectRender,
  uploadProjectReferenceAsset,
  updateProject,
  type ProjectAudio,
  type ProjectAssembly,
  type ProjectCaptions,
  type ProjectReferenceAsset,
  type ProjectRecord,
  type ProjectReview,
  generateProjectThumbnailPrompt,
  setProjectAssemblyMode,
  type ProjectRenderJob,
  type ProjectScene,
  type ProjectScript,
  type ProjectSettings,
} from "@/lib/projects-api"

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

// Workflow references are SCRIPT-LINKED subjects only (specific places, characters,
// objects from the script). The global visual STYLE is locked in Editor Lab.
const REFERENCE_LABEL_OPTIONS: Array<{
  value: ProjectReferenceAsset["label"];
  label: string;
}> = [
  { value: "scene", label: "Scene / Location" },
  { value: "character", label: "Character" },
  { value: "object", label: "Object / Prop" },
];

function ProjectNotFound({ projectId }: { projectId: string }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6 mt-10 text-left">
      <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Projects
      </Link>
      <Card className="technical-card rounded-none bg-card border-border">
        <CardHeader>
          <CardTitle className="font-display uppercase tracking-wider">Project not found</CardTitle>
          <CardDescription className="font-mono text-xs">
            No project matches the id <span className="text-primary">{projectId}</span>.
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isCreatingThumbnail, setIsCreatingThumbnail] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [saveTemplateMsg, setSaveTemplateMsg] = useState<string | null>(null);
  const [isTogglingAssemblyMode, setIsTogglingAssemblyMode] = useState(false);
  const [isGeneratingScenes, setIsGeneratingScenes] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isGeneratingAssembly, setIsGeneratingAssembly] = useState(false);
  const [isQueueingRender, setIsQueueingRender] = useState(false);
  const [activeSceneImageJob, setActiveSceneImageJob] = useState<string | null>(null);
  const [activeSceneVideoJob, setActiveSceneVideoJob] = useState<string | null>(null);
  const [activeImageJob, setActiveImageJob] = useState<string | null>(null);
  const [activeVideoJob, setActiveVideoJob] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = ["script", "audio", "assets", "scenes"].includes(requestedTab ?? "")
    ? (requestedTab as string)
    : "script";
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [selectedDuration, setSelectedDuration] = useState<string>("10-12 mins");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdatingScriptLinkedReferences, setIsUpdatingScriptLinkedReferences] = useState(false);
  const [scriptLinkedReferenceError, setScriptLinkedReferenceError] = useState<string | null>(null);
  const [scriptLinkedReferenceNotice, setScriptLinkedReferenceNotice] = useState<string | null>(null);
  const scriptLinkedReferenceInputRef = React.useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  const clearActionError = () => setActionError(null);

  useEffect(() => {
    let isMounted = true;

    const loadProject = async () => {
      try {
        const nextProject = await fetchProject(id);
        const renderStatus = await fetchProjectRenderStatus(id).catch(() => null);

        if (!isMounted) {
          return;
        }

        applyProjectSnapshot(nextProject);
        setRenderJobs(renderStatus?.jobs ?? []);
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
          applyProjectSnapshot(nextProject);
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
        <Card className="technical-card rounded-none bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wider">Unable to load project</CardTitle>
            <CardDescription className="font-mono text-xs">{loadError}</CardDescription>
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
        <Card className="technical-card rounded-none bg-card border-border">
          <CardHeader>
            <CardTitle className="font-display uppercase tracking-wider text-primary">Loading project...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const updateScript = <K extends keyof ProjectScript>(key: K, value: ProjectScript[K]) => {
    setScript((current) => current ? { ...current, [key]: value } : current);
    setProjectData((current) => current ? { ...current, script: { ...current.script, [key]: value } } : current);
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

  function applyProjectSnapshot(nextProject: ProjectRecord) {
    setProjectData(nextProject);
    setSettings(nextProject.settings);
    setScript(nextProject.script);
    setAudio(nextProject.audio);
    setCaptions(nextProject.captions);
    setAssembly(nextProject.assembly);
    setScenes(nextProject.scenes ?? []);
    if (nextProject.settings?.targetDuration && nextProject.settings.targetDuration !== "Determined by script length") {
      setSelectedDuration(nextProject.settings.targetDuration || "10-12 mins");
    }
  }

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
    router.push(productionAccessHref);
  };

  // Save this project's configuration as a reusable custom template.
  const handleSaveAsTemplate = async ({ title, description }: { title: string; description: string }) => {
    const tpl = await saveCustomTemplateFromProject(projectData, { title, description });
    setShowSaveTemplate(false);
    setSaveTemplateMsg(`Saved "${tpl.title}" to your templates.`);
    setTimeout(() => setSaveTemplateMsg(null), 4000);
  };

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
    setActionError(null);

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
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save script.");
    } finally {
      setIsSavingScript(false);
      // Auto-trigger scene generation for seamless workflow
      if (script.content.trim().length > 0) {
        void handleGenerateScenes();
      }
    }
  }

  // Generate a thumbnail prompt from the script/title, then open the Thumbnail
  // Studio pre-filled (prompt + suggested format from the project type).
  const handleCreateThumbnail = async () => {
    setIsCreatingThumbnail(true);
    setActionError(null);
    try {
      const result = await generateProjectThumbnailPrompt(projectData.id);
      const params = new URLSearchParams({
        prompt: result.prompt,
        format: result.suggestedFormat,
        projectId: projectData.id,
      });
      router.push(`/thumbnail-studio?${params.toString()}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to create a thumbnail prompt.");
      setIsCreatingThumbnail(false);
    }
  };

  const handleToggleAssemblyMode = async () => {
    const currentMode = settings?.assemblyMode ?? "auto";
    const nextMode = currentMode === "auto" ? "manual" : "auto";
    setIsTogglingAssemblyMode(true);
    try {
      const updated = await setProjectAssemblyMode(projectData.id, nextMode);
      setSettings(updated.settings);
      setProjectData((cur) => cur ? { ...cur, settings: updated.settings } : cur);
    } catch {
      // keep current mode on failure
    } finally {
      setIsTogglingAssemblyMode(false);
    }
  };

  const handleGenerateScript = async () => {
    setIsSavingScript(true);
    setActionError(null);

    try {
      const nextScript = await generateProjectScript(projectData.id, {
        topic: script.topic,
        model: script.model,
        duration: selectedDuration,
      });

      setScript(nextScript);
      setProjectData((current) => current ? {
        ...current,
        script: nextScript,
        settings: {
          ...current.settings,
          targetDuration: selectedDuration,
        }
      } : current);
      setSettings((current) => current ? {
        ...current,
        targetDuration: selectedDuration,
      } : current);
      setScenes([]);
      resetReviewStage("scenePlan");
      markCaptionsStale();
      markAssemblyStale("Script changed. Regenerate final assembly.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to generate script.");
    } finally {
      setIsSavingScript(false);
      // Auto-trigger scene generation for seamless workflow
      void handleGenerateScenes();
    }
  }

  const handleGenerateScenes = async () => {
    setIsGeneratingScenes(true);
    setActionError(null);

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
      // applyProjectSnapshot already restores captions and assembly from the server response,
      // which returns them already invalidated — no need to manually mark them stale again.
      applyProjectSnapshot(updatedProject);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to generate scenes.");
    } finally {
      setIsGeneratingScenes(false);
    }
  }

  const handleGenerateAudio = async () => {
    setIsGeneratingAudio(true);
    setActionError(null);

    try {
      const nextAudio = await generateProjectAudio(projectData.id, {
        audio: {
          type: "full",
        },
      });

      updateAudio(nextAudio);
      markCaptionsStale();
      markAssemblyStale("Audio stack changed. Regenerate final assembly.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to generate audio.");
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  const handleGenerateAssembly = async () => {
    setIsGeneratingAssembly(true);
    setActionError(null);

    try {
      const nextAssembly = await requestProjectAssembly(projectData.id);
      setAssembly(nextAssembly);
      setProjectData((current) => current ? { ...current, assembly: nextAssembly } : current);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to generate assembly.");
    } finally {
      setIsGeneratingAssembly(false);
    }
  }

  const handleQueueRender = async () => {
    setIsQueueingRender(true);
    setActionError(null);

    try {
      // Smart Pipeline: Auto-verify assembly before render to avoid stale output
      const needsAssemblyUpdate = !assembly.readiness.hasCaptions || !scenePlanIsCurrent || assembly.status === "draft";
      
      if (needsAssemblyUpdate) {
        console.log("Master Render: Assembly requires update. Re-compiling before launch...");
        const nextAssembly = await requestProjectAssembly(projectData.id);
        setAssembly(nextAssembly);
        setProjectData((current) => current ? { ...current, assembly: nextAssembly } : current);
        
        if (!nextAssembly.readiness.readyToRender) {
          throw new Error("Timeline is not ready. Please ensure all scenes are mastered and audio is generated.");
        }
      }

      const nextRender = await queueProjectRender(projectData.id, {
        source: "project-assembly-tab",
      });

      setRenderJobs((current) => [nextRender.job, ...current]);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to queue render.");
    } finally {
      setIsQueueingRender(false);
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
      const nextScene = await generateSceneImages(sceneId, projectData.id);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} visuals changed. Regenerate final assembly.`);
    } finally {
      setActiveSceneImageJob(null);
    }
  }

  const handleApproveImage = async (imageId: string) => {
    setActiveImageJob(imageId);

    try {
      const nextScene = await approveImageVariant(imageId, projectData.id);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} visuals changed. Regenerate final assembly.`);
    } finally {
      setActiveImageJob(null);
    }
  }

  const handleGenerateSceneVideos = async (sceneId: string) => {
    setActiveSceneVideoJob(sceneId);

    try {
      const nextScene = await generateSceneVideos(sceneId, projectData.id);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} ${isSlideshowProject ? "motion" : "clips"} changed. Regenerate final assembly.`);
    } finally {
      setActiveSceneVideoJob(null);
    }
  }

  const handleApproveVideo = async (videoId: string) => {
    setActiveVideoJob(videoId);

    try {
      const nextScene = await approveVideoVariant(videoId, projectData.id);
      replaceSceneInState(nextScene);
      markAssemblyStale(`${sceneUnitLabel} ${isSlideshowProject ? "motion" : "clips"} changed. Regenerate final assembly.`);
    } finally {
      setActiveVideoJob(null);
    }
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

  const isSlideshowProject = projectData.type.toLowerCase().includes("slideshow");
  const sceneUnitLabel = isSlideshowProject ? "Slide" : "Scene";
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
  // canQueueRender requires canApproveFinalAssembly (which already checks allScenesHaveImages,
  // allScenesHaveVideos, scenePlanApproved and readiness flags) plus the finalAssembly approval.
  const canQueueRender = canApproveFinalAssembly
    && review.finalAssembly.status === "approved";

  // BUG 2 FIX: Le script doit être généré ET les scènes doivent exister
  const scriptIsReady = script.source === "generated" || script.source === "manual";
  const scriptLinkedReferenceCount = projectData.scriptLinkedReferences?.length ?? 0;
  const maxScriptLinkedReferences = 12;
  const canUploadScriptLinkedReferences = !isUpdatingScriptLinkedReferences
    && scriptLinkedReferenceCount < maxScriptLinkedReferences;
  const productionBlockReason = !scriptIsReady
    ? "Générez d'abord le script (onglet Script)"
    : scenes.length === 0
      ? "Générez d'abord les scènes (onglet Scènes)"
      : !scenePlanIsCurrent
        ? "Regénérez d'abord les scènes pour refléter les dernières références visuelles"
      : !scenePlanApproved
        ? "Validez d'abord le scene plan avant d'entrer en production"
      : null;
  const productionAccessHref = productionBlockReason
    ? `/projects/${projectData.id}/production?unlock=1`
    : `/projects/${projectData.id}/production`;
  const productionAccessNotice = productionBlockReason
    ? `Acces temporaire au studio active. ${productionBlockReason}.`
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
              <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Projects
            </Link>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-display font-black tracking-tight text-white uppercase">{projectData.title}</h2>
              <Badge className="bg-primary/20 text-primary border border-primary/30 text-[10px] uppercase font-black px-3 py-1 rounded-none font-mono tracking-widest">
                {projectData.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono uppercase tracking-widest flex items-center gap-2">
              <span className="text-primary/60">{projectData.type}</span> 
              <span className="w-1 h-3 bg-primary/30" />
              Created {formatProjectTimestamp(projectData.createdAt)}
            </p>
          </div>

            <div className="flex flex-col items-end gap-3 pt-2">

              {/* Assembly mode toggle */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black uppercase tracking-widest font-mono transition-colors ${(settings?.assemblyMode ?? "auto") === "manual" ? "text-primary" : "text-muted-foreground/40"}`}>
                    Manual Export
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleAssemblyMode}
                    disabled={isTogglingAssemblyMode}
                    title={(settings?.assemblyMode ?? "auto") === "auto" ? "Switch to Manual Export (download files for NLE)" : "Switch to Auto Assembly (AI renders the final video)"}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 cursor-pointer ${
                      (settings?.assemblyMode ?? "auto") === "manual"
                        ? "bg-primary border-primary"
                        : "bg-muted border-border"
                    }`}
                    aria-pressed={(settings?.assemblyMode ?? "auto") === "manual"}
                  >
                    <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
                      (settings?.assemblyMode ?? "auto") === "manual" ? "translate-x-4" : "translate-x-0.5"
                    }`} />
                  </button>
                  <span className={`text-[9px] font-black uppercase tracking-widest font-mono transition-colors ${(settings?.assemblyMode ?? "auto") === "auto" ? "text-primary" : "text-muted-foreground/40"}`}>
                    Auto Assembly
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 text-[8.5px] font-mono uppercase tracking-widest px-2 py-1 border ${(settings?.assemblyMode ?? "auto") === "manual" ? "text-amber-400 border-amber-500/20 bg-amber-500/10" : "text-primary/60 border-primary/20 bg-primary/5"}`}>
                  {(settings?.assemblyMode ?? "auto") === "manual" ? <Scissors className="w-2.5 h-2.5" /> : <Cpu className="w-2.5 h-2.5" />}
                  {(settings?.assemblyMode ?? "auto") === "manual" ? "NLE Export mode" : "AI Render mode"}
                </div>
              </div>

              <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setSaveTemplateMsg(null); setShowSaveTemplate(true); }}
                title="Save this project's configuration as a reusable template"
                className="h-10 px-4 rounded-none border-border bg-background hover:border-primary/50 text-foreground gap-2 text-[10px] font-black uppercase tracking-wider font-mono"
              >
                <LayoutTemplate className="w-3.5 h-3.5" /> Save as Template
              </Button>
              <Button
                size="sm"
                onClick={handleLaunchProduction}
                className="h-10 px-6 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-[10px] font-black uppercase tracking-wider font-mono"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Launch Production
              </Button>
            </div>
            {saveTemplateMsg && (
              <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-none bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-wider text-primary font-mono">
                <LayoutTemplate className="w-3 h-3" /> {saveTemplateMsg}
              </p>
            )}
            {productionAccessNotice && (
              <p className="inline-flex items-center gap-2 px-3 py-1.5 rounded-none bg-amber-500/10 border border-amber-500/20 text-[9px] font-black uppercase tracking-wider text-amber-400 font-mono">
                <Activity className="w-3 h-3" /> {productionAccessNotice}
              </p>
            )}
          </div>
        </div>

        {showSaveTemplate && (
          <SaveTemplateDialog
            defaultTitle={projectData.title || ""}
            defaultDescription={projectData.goal || ""}
            onSave={handleSaveAsTemplate}
            onClose={() => setShowSaveTemplate(false)}
          />
        )}
      </div>

      {actionError && (
        <div className="flex items-start gap-3 rounded-none border border-destructive/20 bg-destructive/10 px-4 py-3">
          <p className="flex-1 text-[11px] font-medium text-destructive-foreground leading-relaxed font-mono">{actionError}</p>
          <button
            type="button"
            onClick={clearActionError}
            className="text-rose-400/60 hover:text-rose-400 transition-colors shrink-0 mt-0.5"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="sticky top-0 z-40 bg-background pt-2 pb-4 -mx-4 px-4 mb-6">
          <TabsList className="bg-card border border-border p-1.5 h-auto min-h-13 w-full justify-start overflow-x-auto no-scrollbar rounded-none gap-1 mt-2">
            <TabsTrigger value="script" className="gap-2 px-4 py-2.5 rounded-none text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all font-mono">
              <FileText className="w-3.5 h-3.5" /> Script
            </TabsTrigger>
            <TabsTrigger value="audio" className="gap-2 px-4 py-2.5 rounded-none text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all font-mono">
              <Mic className="w-3.5 h-3.5" /> Audio
            </TabsTrigger>
            <TabsTrigger value="assets" className="gap-2 px-4 py-2.5 rounded-none text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all font-mono">
              <ImageIcon className="w-3.5 h-3.5" /> Assets
            </TabsTrigger>
            <TabsTrigger value="scenes" className="gap-2 px-4 py-2.5 rounded-none text-[10px] font-black uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground hover:text-foreground transition-all font-mono">
              <Layout className="w-3.5 h-3.5" /> Scene
            </TabsTrigger>
          </TabsList>
        </div>



        <TabsContent value="script" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-[0.6fr_1.4fr] gap-8">
            <Card className="technical-card bg-card border-border rounded-none self-start">
              <CardHeader className="pb-6 bg-card">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-primary font-display">
                  <Wand2 className="w-4 h-4" /> Lab
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mt-1">Script engine config.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80">Input Mode</Label>
                  <Select value={script.mode} onValueChange={(value) => updateScript("mode", value as ProjectScript["mode"])}>
                    <SelectTrigger className="h-11 rounded-none border border-border bg-background focus:ring-primary font-mono text-[10px] uppercase tracking-widest">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border border-border bg-background">
                      <SelectItem value="ai" className="text-[10px] uppercase font-mono text-foreground hover:bg-primary/10">AI Generation</SelectItem>
                      <SelectItem value="manual" className="text-[10px] uppercase font-mono text-foreground hover:bg-primary/10">Manual Entry</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {script.mode === "ai" && (
                  <>
                    <div className="space-y-2.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80">Topic / Idea</Label>
                      <Textarea
                        value={script.topic}
                        onChange={(event) => updateScript("topic", event.target.value)}
                        placeholder="Describe the subject..."
                        className="min-h-35 rounded-none border border-border bg-background focus:ring-primary text-sm font-mono resize-none placeholder:text-muted-foreground/30"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80">Target Duration</Label>
                        <span className="text-[8px] font-mono tracking-widest text-muted-foreground uppercase">AI Sizing</span>
                      </div>
                      <Select value={selectedDuration} onValueChange={(value) => setSelectedDuration(value || "10-12 mins")}>
                        <SelectTrigger className="h-11 rounded-none border border-border bg-background focus:ring-primary font-mono text-[10px] uppercase tracking-widest">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none border border-border bg-background">
                          <SelectItem value="6-8 mins" className="text-[10px] uppercase font-mono text-foreground hover:bg-primary/10">
                            6-8 mins <span className="text-white/45 ml-1.5">— Quick & engaging</span>
                          </SelectItem>
                          <SelectItem value="10-12 mins" className="text-[10px] uppercase font-mono text-foreground hover:bg-primary/10">
                            10-12 mins <span className="text-white/45 ml-1.5">— Standard length</span>
                          </SelectItem>
                          <SelectItem value="18-20 mins" className="text-[10px] uppercase font-mono text-foreground hover:bg-primary/10">
                            18-20 mins <span className="text-white/45 ml-1.5">— In-depth content</span>
                          </SelectItem>
                          <SelectItem value="30-40 mins" className="text-[10px] uppercase font-mono text-foreground hover:bg-primary/10">
                            30-40 mins <span className="text-white/45 ml-1.5">— Documentary style</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="justify-end pt-4 bg-background gap-3">
                <Button 
                  className="h-10 px-6 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-[10px] font-black uppercase tracking-widest transition-all" 
                  onClick={script.mode === "manual" ? handleSaveManualScript : handleGenerateScript} 
                  disabled={isSavingScript}
                >
                  {script.mode === "manual" ? <Save className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
                  {script.mode === "manual" ? "Save Manual Script" : "Generate Script"}
                </Button>
              </CardFooter>
            </Card>

            <Card className="technical-card bg-card border-border text-left rounded-none flex flex-col">
              <CardHeader className="pb-6 bg-card flex flex-row items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-primary font-display">
                  <FileText className="w-4 h-4" /> {script.mode === "manual" ? "Script Editor" : "Generated Output"}
                </CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateThumbnail}
                  disabled={isCreatingThumbnail || !script.content.trim()}
                  title={!script.content.trim() ? "Generate or write a script first" : "Create a thumbnail from this script"}
                  className="h-8 px-3 rounded-none border-border bg-background hover:border-primary/50 text-[10px] font-black uppercase tracking-[0.15em] font-mono gap-2 disabled:opacity-40"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  {isCreatingThumbnail ? "Preparing…" : "Create Thumbnail"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 pt-6 flex-1 flex flex-col">
                <div className="relative flex-1 group/editor">
                  <Textarea
                    value={script.content}
                    onChange={(event) => updateScript("content", event.target.value)}
                    placeholder="Script content..."
                    className="h-full min-h-112.5 rounded-none border border-border bg-background focus:ring-primary transition-all text-sm leading-relaxed resize-none font-mono p-6 placeholder:text-muted-foreground/30 shadow-inner"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>


        <TabsContent value="audio" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Card className="technical-card bg-card border-border rounded-none shadow-none">
              <CardHeader className="pb-4 bg-card/50">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-primary font-display">
                  <Mic className="w-4 h-4" /> Audio Deck Configuration
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mt-1">Read-only snapshot of the audio setup frozen during project creation.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5">
                <div className="space-y-2.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80 font-mono">Narration Voice</Label>
                  <div className="p-4 rounded-none bg-background border border-border flex items-center justify-between group/voice transition-all hover:border-primary/30">
                    <div className="space-y-1.5">
                      <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2 font-mono">
                        <div className="w-1.5 h-1.5 rounded-none bg-primary shadow-[0_0_8px_rgba(255,51,0,0.5)]" />
                        Synced from Engine
                      </div>
                      <p className="text-xs font-mono font-bold text-foreground">{audio.narration.voiceId || settings.voiceId || "No voice ID selected"}</p>
                      {audio.narration.uploadedSource?.name && audio.narration.uploadedSource?.storagePath ? (
                        <p className="text-[10px] text-muted-foreground/50 font-mono italic">
                          Source: {audio.narration.uploadedSource.name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary/80 font-mono">Narration Direction</Label>
                  <div className="rounded-none bg-background border border-border p-4 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                    <p className="text-[12px] leading-relaxed text-foreground/80 font-mono italic">
                      &ldquo;{audio.narration.direction || settings.narrationStyle || settings.tone || "No narration direction defined yet."}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
                  <div className="rounded-none bg-background border border-border p-3 space-y-1 hover:border-primary/20 transition-colors">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 font-mono">Music Mode</p>
                    <p className="text-[11px] font-bold text-foreground font-mono">
                      {audio.music.mode === "uploaded"
                        ? "Uploaded tracks"
                        : audio.music.mode === "none"
                           ? "No music"
                           : "Auto generate"}
                    </p>
                    <p className="text-[8px] text-muted-foreground/40 font-mono uppercase">
                      {audio.music.mode === "uploaded" && Array.isArray(audio.music.uploadedTracks)
                        ? `${audio.music.uploadedTracks.filter((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0).length} reserved tracks`
                        : "System Managed"}
                    </p>
                  </div>

                  <div className="rounded-none bg-background border border-border p-3 space-y-1 hover:border-primary/20 transition-colors">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 font-mono">Music Mood</p>
                    <p className="text-[11px] font-bold text-foreground font-mono">{audio.music.mood || "No mood selected"}</p>
                    <p className="text-[8px] text-muted-foreground/40 font-mono uppercase">
                      {audio.music.trackName || (audio.music.mode === "none" ? "Disabled" : "Auto-applied")}
                    </p>
                  </div>

                  <div className="rounded-none bg-background border border-border p-3 space-y-1 hover:border-primary/20 transition-colors">
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary/60 font-mono">SFX Soundscape</p>
                    <p className="text-[11px] font-bold text-foreground font-mono">
                      {audio.sfx.enabled ? audio.sfx.density : "Disabled"}
                    </p>
                    <p className="text-[8px] text-muted-foreground/40 font-mono uppercase">Engine Preset</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end pt-3 bg-background/50">
                <Button 
                  className="h-10 px-6 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground gap-2 text-[10px] font-black uppercase tracking-widest transition-all font-mono shadow-[0_0_15px_-5px_hsl(var(--primary))]" 
                  onClick={handleGenerateAudio} 
                  disabled={isGeneratingAudio}
                >
                  <Music className="w-3.5 h-3.5" /> Render stack
                </Button>
              </CardFooter>
            </Card>

            <Card className="technical-card bg-card border-border rounded-none flex flex-col shadow-none">
              <CardHeader className="pb-4 bg-card/50">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-primary font-display">
                  <Activity className="w-4 h-4" /> Master Trace
                </CardTitle>
                <CardDescription className="text-[10px] uppercase font-mono tracking-widest text-muted-foreground mt-1">
                  {audio.generatedAt ? `Mastered on ${formatProjectTimestamp(audio.generatedAt)}` : "No master output yet."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-5 flex-1 flex flex-col">
                <div className="space-y-3 flex-1">
                  <div className="p-4 rounded-none bg-background border border-border space-y-2 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-3 opacity-5">
                      <Mic className="h-16 w-16" />
                    </div>
                    <p className="text-[9px] uppercase font-black tracking-widest text-primary font-mono flex items-center gap-2">
                       Voice Stream
                    </p>
                    <p className="text-[11px] text-foreground/70 font-mono leading-relaxed line-clamp-4 italic">{audio.narration.textPreview || "No voiceover data stream detected."}</p>
                  </div>


                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assets" className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          <Card className="technical-card bg-card border-border rounded-none xl:col-span-4 shadow-none">
            <CardHeader className="pb-6 bg-card/50 flex flex-row items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-primary font-display">
                  <ImageIcon className="w-4 h-4" /> Foundation
                </CardTitle>
                <CardDescription className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 font-mono">
                  Locked visual & animation style from Editor Lab — applied to every scene.
                </CardDescription>
              </div>
              <Badge className="border border-border bg-background text-muted-foreground text-[8px] uppercase tracking-[0.18em] font-black rounded-none">
                Setup Frozen
              </Badge>
            </CardHeader>
            <CardContent className="pt-6">
              {(projectData.references?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-2 gap-4">
                  {projectData.references?.map((reference) => (
                    <div key={reference.id} className="group/asset relative rounded-none border border-border bg-background p-2 transition-all hover:border-primary/50">
                      <div className="aspect-4/5 rounded-none overflow-hidden bg-black border border-border relative">
                        {getProjectReferencePreviewUrl(reference) ? (
                          <Image
                            src={getProjectReferencePreviewUrl(reference) ?? ""}
                            fill
                            sizes="(min-width: 1280px) 16vw, (min-width: 768px) 25vw, 50vw"
                            alt={reference.name}
                            className="object-cover grayscale opacity-60 group-hover/asset:grayscale-0 group-hover/asset:opacity-100 transition-all duration-700"
                            unoptimized
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground/30"><ImageIcon className="w-8 h-8" /></div>
                        )}
                        <div className="absolute inset-0 border border-white/5 pointer-events-none" />
                      </div>
                      <div className="mt-2 space-y-1 px-1">
                        <p className="text-[10px] font-black text-foreground uppercase tracking-tight truncate font-display">{reference.name}</p>
                        <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground/40 font-mono">Foundation Reference</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                  <div className="p-10 text-center border border-dashed border-border rounded-none bg-background/30">
                    <ImageIcon className="w-10 h-10 text-muted-foreground/10 mx-auto mb-4" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground/40 font-display">No foundation references</h3>
                    <div className="mt-6 inline-flex items-center rounded-none border border-primary/20 bg-primary/5 px-6 py-2 text-[10px] font-black uppercase tracking-widest text-primary/40">
                    Set in Editor Lab
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="technical-card bg-card border-border rounded-none xl:col-span-8 shadow-none">
            <CardHeader className="pb-6 bg-card/50 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2.5 text-sm font-black uppercase tracking-widest text-primary font-display">
                  <ImageIcon className="w-4 h-4" /> Linked Assets
                </CardTitle>
                <CardDescription className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60 font-mono">
                  Optional images tied to exact script subjects. Name each one descriptively (script wording + how it looks) so it attaches to the right scene and renders faithfully.
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="border border-primary/30 text-primary bg-primary/5 text-[9px] uppercase tracking-[0.18em] font-black rounded-none">
                  Optional
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  onClick={openScriptLinkedReferencePicker}
                  disabled={!canUploadScriptLinkedReferences}
                  className="gap-2 rounded-none border border-border bg-background hover:bg-card hover:border-primary/50 text-[10px] font-black uppercase tracking-widest h-10 px-6 font-mono transition-all"
                >
                  <Upload className="w-4 h-4" />
                  {isUpdatingScriptLinkedReferences ? "Uploading..." : "Upload Images"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-none border border-border bg-background px-4 py-4">
                <div className="space-y-0.5">
                   <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary font-mono">
                    {scriptLinkedReferenceCount}/{maxScriptLinkedReferences} linked references
                  </p>
                  <p className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-widest">
                    Match the image name to the script wording precisely.
                  </p>
                </div>
              </div>
              {scriptLinkedReferenceError ? (
                <div className="rounded-none border border-destructive/50 bg-destructive/10 px-4 py-3 text-[11px] font-medium text-destructive-foreground font-mono">
                  {scriptLinkedReferenceError}
                </div>
              ) : null}
              {scriptLinkedReferenceNotice ? (
                <div className="rounded-none border border-primary/20 bg-primary/10 px-4 py-3 text-[11px] font-medium text-primary font-mono">
                  {scriptLinkedReferenceNotice}
                </div>
              ) : null}
              {!scriptIsReady ? (
                <div className="p-20 text-center border border-dashed border-border rounded-none bg-background/30">
                  <FileText className="w-10 h-10 text-muted-foreground/10 mx-auto mb-4" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/40 font-display">Script validation first</h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/50 max-w-xl mx-auto font-mono">
                    Save the script first, then add optional images using the same wording as the script.
                  </p>
                </div>
              ) : (projectData.scriptLinkedReferences?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                  {(projectData.scriptLinkedReferences ?? []).map((reference) => (
                    <div key={reference.id} className="group/asset relative rounded-none border border-border bg-background p-2.5 transition-all hover:border-primary/30">
                      <div className="aspect-4/5 rounded-none overflow-hidden bg-black border border-border relative">
                        {getProjectReferencePreviewUrl(reference) ? (
                          <Image
                            src={getProjectReferencePreviewUrl(reference) ?? ""}
                            fill
                            sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 768px) 25vw, 50vw"
                            alt={reference.name}
                            className="object-cover grayscale opacity-60 group-hover/asset:grayscale-0 group-hover/asset:opacity-100 transition-all duration-700"
                            unoptimized
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-muted-foreground/20 italic font-mono text-[9px]"><ImageIcon className="w-8 h-8 mb-2" /> No preview</div>
                        )}
                        <button
                           onClick={() => handleRemoveScriptLinkedReference(reference.id)}
                           disabled={isUpdatingScriptLinkedReferences}
                           className="absolute top-2 right-2 p-1.5 bg-black/60 text-white/40 border border-white/5 hover:bg-destructive hover:text-white hover:border-destructive opacity-0 group-hover/asset:opacity-100 transition-all rounded-none"
                        >
                           <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-3 space-y-2">
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
                          title="Name it descriptively: include the script wording (so it attaches to the right scene) AND its visual look (so it renders faithfully)."
                          className="h-8 rounded-none border-border bg-card/50 text-[11px] font-medium tracking-tight text-foreground focus:ring-primary placeholder:text-muted-foreground/30 font-mono p-3"
                          placeholder="e.g. Curia of Pompey — Roman marble columns, apse"
                        />
                        <Select
                          value={reference.label}
                          onValueChange={(value) => {
                            if (value) {
                              void handlePersistScriptLinkedReference(reference.id, { label: value });
                            }
                          }}
                          disabled={isUpdatingScriptLinkedReferences}
                        >
                          <SelectTrigger className="h-8 rounded-none border-border bg-card/50 text-[10px] font-black uppercase tracking-[0.18em] text-foreground focus:ring-primary font-mono">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-none border-border bg-background">
                            {REFERENCE_LABEL_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="uppercase font-mono text-[10px] hover:bg-primary/10">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <p className="text-[8px] uppercase tracking-[0.18em] text-muted-foreground/40 font-mono">Category</p>
                          <Badge className="border border-border bg-background text-muted-foreground/60 text-[8px] uppercase tracking-[0.18em] font-black rounded-none">
                            {REFERENCE_LABEL_OPTIONS.find((option) => option.value === reference.label)?.label ?? reference.label}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-20 text-center border border-dashed border-border rounded-none bg-background/30">
                  <ImageIcon className="w-10 h-10 text-muted-foreground/10 mx-auto mb-4" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground/40 font-display text-center">Optional asset layer</h3>
                  <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/50 max-w-xl mx-auto font-mono text-center">
                    Add script-specific images here, or leave this empty and rely on the foundation library only.
                  </p>
                </div>
              )}
              {scriptIsReady ? (
                <div className="rounded-none border border-primary/10 bg-primary/5 px-4 py-3 text-[10px] leading-relaxed text-primary/60 font-mono tracking-widest uppercase text-center">
                  Link image labels to specific script subjects for high-fidelity asset selection.
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scenes" className="mt-6 space-y-6">

          {/* ── MANUAL EXPORT PACK (mode manuel seulement) ─────────────────── */}
          {(settings?.assemblyMode ?? "auto") === "manual" && (
            <div className="rounded-none border border-amber-500/30 bg-amber-500/5 p-5 space-y-5">
              <div className="flex items-center gap-3">
                <Scissors className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-mono">NLE Export Pack — Manual Assembly Mode</p>
                  <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">All generated assets are available for download. Import them into Capcut, DaVinci Resolve, After Effects, or any NLE.</p>
                </div>
                <div className="ml-auto text-[8px] font-mono text-muted-foreground/40 border border-border px-2 py-1">AI RENDER DISABLED</div>
              </div>

              {/* Per-scene download grid */}
              <div className="space-y-3">
                {scenes.length === 0 && (
                  <p className="text-[9px] font-mono text-muted-foreground/40 uppercase tracking-widest text-center py-4">Generate scenes first to unlock asset downloads.</p>
                )}
                {scenes.map((scene, idx) => {
                  return (
                    <div key={scene.id} className="border border-border/50 bg-background/30 p-3 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground font-mono">Scene {idx + 1} — {scene.narration?.slice(0, 50)}{(scene.narration?.length ?? 0) > 50 ? "…" : ""}</p>
                      <div className="flex flex-wrap gap-2">
                        {/* All image variants */}
                        {(scene.imageVariants || []).map((v) => (
                          <a key={v.id} href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/media/images/${v.id}?projectId=${projectData.id}&download=1`} download className="flex items-center gap-1.5 h-7 px-3 border border-border bg-background hover:border-primary/50 text-[8.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors no-underline">
                            <ImageIcon className="w-3 h-3" /> Img {v.variantIndex}
                          </a>
                        ))}
                        {/* All video variants */}
                        {(scene.videoVariants || []).map((v) => (
                          <a key={v.id} href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/media/videos/${v.id}?projectId=${projectData.id}&download=1`} download className="flex items-center gap-1.5 h-7 px-3 border border-primary/30 bg-primary/5 hover:border-primary/60 text-[8.5px] font-mono uppercase tracking-widest text-primary/80 hover:text-primary transition-colors no-underline">
                            <Play className="w-3 h-3" /> {v.previewTitle || `Clip ${v.variantIndex}`}
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Audio downloads */}
              {(() => {
                const narrationReady = audio.narration?.status === "generated" || audio.narration?.status === "uploaded";
                const musicReady = audio.music?.status === "generated";
                if (!narrationReady && !musicReady) return null;
                return (
                  <div className="border border-border/50 bg-background/30 p-3 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground font-mono">Audio Stems</p>
                    <div className="flex flex-wrap gap-2">
                      {narrationReady && (
                        <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/projects/${projectData.id}/audio/narration-file?download=1`} download className="flex items-center gap-1.5 h-7 px-3 border border-border bg-background hover:border-primary/50 text-[8.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors no-underline">
                          <Mic className="w-3 h-3" /> Narration
                        </a>
                      )}
                      {musicReady && (
                        <a href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/projects/${projectData.id}/audio/music-file?download=1`} download className="flex items-center gap-1.5 h-7 px-3 border border-border bg-background hover:border-primary/50 text-[8.5px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors no-underline">
                          <Music className="w-3 h-3" /> Soundtrack
                        </a>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="technical-card bg-card border-border rounded-none shadow-none">
              <CardHeader className="pb-4 bg-card/50">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 font-mono">
                  <Play className="w-3.5 h-3.5" /> Render Control
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4 bg-background/30">
                <Badge className={`${assembly.readiness.readyToRender ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/50 bg-rose-500/10 text-rose-400'} w-full justify-center py-2.5 text-[9px] font-black rounded-none border font-mono tracking-widest`}>
                  {assembly.readiness.readyToRender ? "MASTER READY" : "DRAFT MODE"}
                </Badge>
                <Button className="w-full h-12 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase tracking-widest text-[11px] font-mono shadow-[0_0_20px_-5px_rgba(255,51,0,0.5)] transition-all" onClick={handleQueueRender} disabled={isQueueingRender || !canQueueRender}>
                   Launch Master Render
                </Button>
              </CardContent>
            </Card>

            <Card className="technical-card bg-card border-border rounded-none md:col-span-2 shadow-none">
              <CardHeader className="pb-4 bg-card/50 flex flex-row items-center justify-between">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary font-mono">Production Blueprint</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-[9px] font-black uppercase tracking-widest rounded-none border border-border bg-background hover:bg-card hover:border-primary/50 transition-all font-mono"
                  onClick={handleGenerateAssembly}
                  disabled={isGeneratingAssembly}
                >
                  {isGeneratingAssembly ? "Compiling..." : "Re-Compile Timeline"}
                </Button>
              </CardHeader>
              <CardContent className="pt-8">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div className="space-y-1.5 px-2 border-r border-border">
                    <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest font-mono">Total Duration</p>
                    <p className="text-sm font-black text-foreground font-mono">{assembly.totalDurationLabel}</p>
                  </div>
                  <div className="space-y-1.5 px-2 border-r border-border">
                    <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest font-mono">Visual Assets</p>
                    <p className="text-sm font-black text-foreground font-mono">{assembly.summary.approvedVideos}/{assembly.summary.sceneCount}</p>
                  </div>
                  <div className="space-y-1.5 px-2">
                    <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest font-mono">Captions Deck</p>
                    <p className="text-sm font-black text-primary font-mono">{assembly.readiness.hasCaptions ? "SYNCED" : "MISSING"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="technical-card bg-card border-border rounded-none mt-6 shadow-none">
            <CardHeader className="pb-4 bg-card/50 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary font-display flex items-center gap-2">
                   <Layout className="w-3.5 h-3.5" /> Scene Mastery
                </CardTitle>
                {scenes.length > 0 && !scenePlanIsCurrent ? (
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-amber-500 font-mono flex items-center gap-1.5">
                    <Activity className="w-3 h-3" /> Scenes stale - update required
                  </p>
                ) : null}
              </div>
              <Button 
                className="h-10 px-8 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] font-black uppercase tracking-widest font-mono shadow-[0_0_15px_-5px_rgba(255,51,0,0.5)] transition-all" 
                onClick={handleGenerateScenes} 
                disabled={isGeneratingScenes}
              >
                {isGeneratingScenes ? "Mastering..." : "Generate Production Plan"}
              </Button>
            </CardHeader>
            <CardContent className="pt-8 bg-background">
              {scenes.length > 0 && !scenePlanIsCurrent ? (
                <div className="mb-8 rounded-none border border-amber-500/20 bg-amber-500/5 px-4 py-4 text-[10px] leading-relaxed text-amber-500/80 font-mono flex flex-col gap-1">
                   <p className="font-black uppercase tracking-widest">Desynchronization Warning</p>
                   <p>The scenes below are stale. Foundation visuals or script wording has changed. Regenerate to realign the pipeline.</p>
                </div>
              ) : null}
              {scenes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-8">
                  {scenes.map((scene) => {
                    const sceneStatus = !scenePlanIsCurrent
                      ? "stale"
                      : scene.approvedVideoId
                        ? "completed"
                        : (scene.videoVariants.length > 0 ? "draft" : "pending");
                    const isImageJobActive = activeSceneImageJob === scene.id;
                    const isVideoJobActive = activeSceneVideoJob === scene.id;
                    return (
                      <div key={scene.id} className="group/scene p-4 rounded-none border border-border bg-card over:border-primary/20 transition-all space-y-5">
                        <div className="flex items-center justify-between pb-3/50">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-black text-primary uppercase tracking-[0.2em] font-mono">{sceneUnitLabel} {String(scene.sceneId).padStart(2, '0')}</span>
                          </div>
                          <Badge className={`${
                            sceneStatus === 'completed'
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500'
                              : sceneStatus === 'stale'
                                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                                : 'border-amber-500/50 bg-amber-500/10 text-amber-500'
                          } border text-[8px] rounded-none font-black uppercase tracking-widest font-mono`}>
                            {sceneStatus}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground/80 font-mono leading-relaxed line-clamp-3 italic opacity-80">&ldquo;{scene.visualIntent}&rdquo;</p>

                        {/* ── Image production ──────────────────────── */}
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 font-mono">Imagery Deck</p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-4 text-[8px] font-black uppercase tracking-widest border-border bg-background hover:bg-card hover:border-primary/50 rounded-none font-mono transition-all"
                              onClick={() => void handleGenerateSceneImages(scene.id)}
                              disabled={isImageJobActive || !scenePlanIsCurrent}
                            >
                              {isImageJobActive ? "PROMPTING…" : scene.imageVariants.length > 0 ? "RE-SHOOT" : "GENERATE"}
                            </Button>
                          </div>
                          {scene.imageVariants.length > 0 ? (
                            <div className="grid grid-cols-3 gap-2">
                              {scene.imageVariants.map((variant) => (
                                <div key={variant.id} className={`relative rounded-none overflow-hidden border transition-all ${variant.id === scene.approvedImageId ? 'border-primary ring-1 ring-primary/20' : 'border-border/60 hover:border-primary/40'}`}>
                                  <div className={`aspect-video bg-black flex items-center justify-center relative`}>
                                    <span className="text-[6px] font-black uppercase text-muted-foreground/30 text-center px-1 font-mono">{variant.previewTitle}</span>
                                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-10 transition-opacity" />
                                  </div>
                                  {variant.id !== scene.approvedImageId && (
                                    <button
                                      type="button"
                                      onClick={() => void handleApproveImage(variant.id)}
                                      disabled={activeImageJob === variant.id}
                                      className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 hover:opacity-100 transition-opacity text-[8px] font-black uppercase text-foreground font-mono"
                                    >
                                      {activeImageJob === variant.id ? "…" : "SELECT"}
                                    </button>
                                  )}
                                  {variant.id === scene.approvedImageId && (
                                    <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-none bg-primary shadow-[0_0_8px_rgba(255,51,0,0.8)]" />
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="aspect-video bg-background rounded-none border border-dashed border-border/40 flex items-center justify-center">
                              <p className="text-[8px] text-muted-foreground/20 uppercase font-black font-mono tracking-widest">No variants found</p>
                            </div>
                          )}
                        </div>

                        {/* ── Video production (non-slideshow only) ─── */}
                        {!isSlideshowProject && (
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 font-mono">Motion Clips</p>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-4 text-[8px] font-black uppercase tracking-widest border-border bg-background hover:bg-card hover:border-primary/50 rounded-none font-mono transition-all"
                                onClick={() => void handleGenerateSceneVideos(scene.id)}
                                disabled={isVideoJobActive || !scene.approvedImageId || !scenePlanIsCurrent}
                              >
                                {isVideoJobActive ? "RENDERING…" : scene.videoVariants.length > 0 ? "RE-GENERATE" : "DIRECTOR CUT"}
                              </Button>
                            </div>
                            {scene.videoVariants.length > 0 ? (
                              <div className="grid grid-cols-3 gap-2">
                                {scene.videoVariants.map((variant) => (
                                  <div key={variant.id} className={`relative rounded-none overflow-hidden border transition-all ${variant.id === scene.approvedVideoId ? 'border-primary ring-1 ring-primary/20' : 'border-border/60 hover:border-primary/40'}`}>
                                    <div className={`aspect-video bg-black flex items-center justify-center relative`}>
                                      <span className="text-[6px] font-black uppercase text-muted-foreground/30 font-mono">{variant.previewTitle}</span>
                                       <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-10 transition-opacity" />
                                    </div>
                                    {variant.id !== scene.approvedVideoId && (
                                      <button
                                        type="button"
                                        onClick={() => void handleApproveVideo(variant.id)}
                                        disabled={activeVideoJob === variant.id}
                                        className="absolute inset-0 flex items-center justify-center bg-black/80 opacity-0 hover:opacity-100 transition-opacity text-[8px] font-black uppercase text-foreground font-mono"
                                      >
                                        {activeVideoJob === variant.id ? "…" : "MASTER"}
                                      </button>
                                    )}
                                    {variant.id === scene.approvedVideoId && (
                                      <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-none bg-primary shadow-[0_0_8px_rgba(255,51,0,0.8)]" />
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="aspect-video bg-background rounded-none border border-dashed border-border/40 flex items-center justify-center">
                                <p className="text-[8px] text-muted-foreground/20 uppercase font-black font-mono tracking-widest">
                                  {scene.approvedImageId ? "Awaiting cut" : "Imagery required"}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-24 text-center border border-dashed border-border/30 rounded-none bg-background/5">
                  <Layout className="w-12 h-12 text-muted-foreground/5 mx-auto mb-6" />
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground/20 font-mono">Production timeline empty - Generate scenes to begin</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Render History at the bottom of Scene tab */}
          <HistorySection
            renderJobs={renderJobs}
            formatProjectTimestamp={formatProjectTimestamp}
            getRenderJobBadgeClassName={getRenderJobBadgeClassName}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

type HistorySectionProps = {
  renderJobs: ProjectRenderJob[];
  formatProjectTimestamp: (timestamp: string) => string;
  getRenderJobBadgeClassName: (status: string) => string;
};

function HistorySection({ renderJobs, formatProjectTimestamp, getRenderJobBadgeClassName }: HistorySectionProps) {
  return (
    <div className="mt-12 space-y-6">
      <div className="flex items-center gap-2 px-1">
        <History className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Render History & Master Logs</h3>
      </div>
      {renderJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {renderJobs.map((job) => (
            <Card key={job.id} className="technical-card bg-card border-border rounded-none overflow-hidden">
               <CardContent className="p-5 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-foreground uppercase">{formatProjectTimestamp(job.createdAt)}</p>
                    <p className="text-[9px] text-muted-foreground uppercase font-bold font-mono">{job.status}</p>
                  </div>
                  <Badge className={`${getRenderJobBadgeClassName(job.status)} border rounded-none text-[8px]`}>{job.status.toUpperCase()}</Badge>
               </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-[9px] text-muted-foreground italic px-1 font-mono">No production logs available.</p>
      )}
    </div>
  )
}

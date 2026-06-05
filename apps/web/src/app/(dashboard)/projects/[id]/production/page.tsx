"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  fetchProject,
  generateSceneImages,
  approveImageVariant,
  regenerateImageVariant,
  generateSceneVideos,
  approveVideoVariant,
  regenerateVideoVariant,
  setSceneMotionMode,
  sceneRequiresMotion,
  generateProjectAssembly,
  generateProjectAudio,
  generateProjectCaptions,
  fetchProjectRenderStatus,
  uploadProjectNarrationSource,
  queueProjectRender,
  updateProject,
  type ProjectRecord,
  type ProjectRenderJob,
  type ProjectScene,
} from "@/lib/projects-api";

// Composants de l'Étape
import { StepIndicator } from '@/features/projects/components/production/StepIndicator';
import { SceneSidebar } from '@/features/projects/components/production/SceneSidebar';
import { Step1VisualSelection } from "@/features/projects/components/production/Step1ImageSelection";
import { Step2VideoSelection } from '@/features/projects/components/production/Step2VideoSelection';
import { Step3AudioAndAssembly } from '@/features/projects/components/production/Step3AudioAndAssembly';

interface ToastState {
  message: string;
  type: 'error' | 'success';
}

export default function ProductionPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = params.id as string;

  // Global State
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isExportDone, setIsExportDone] = useState(false);
  const [renderJobs, setRenderJobs] = useState<ProjectRenderJob[]>([]);

  // Loading States pour l'UX
  const [loadingSceneId, setLoadingSceneId] = useState<string | null>(null);
  const [loadingVariantId, setLoadingVariantId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [isUploadingNarrationSource, setIsUploadingNarrationSource] = useState(false);

  // Ref pour savoir si une action est en cours (évite de recréer l'intervalle de polling)
  const isActionInProgress = useRef(false);

  // Toast helper
  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Sync du ref avec les états de chargement —— sans recréer loadProject
  useEffect(() => {
    isActionInProgress.current = !!(
      loadingSceneId
      || loadingVariantId
      || isExporting
      || loadingAudio
      || isGeneratingCaptions
      || isUploadingNarrationSource
    );
  }, [loadingSceneId, loadingVariantId, isExporting, loadingAudio, isGeneratingCaptions, isUploadingNarrationSource]);

  const applyProjectSnapshot = (data: ProjectRecord) => {
    setProject(data);
    setSelectedSceneId((prev) => {
      if (data.scenes.length === 0) return null;
      if (prev && data.scenes.some((scene) => scene.id === prev)) return prev;
      return data.scenes[0].id;
    });
  };

  const loadProject = useCallback(async () => {
    try {
      const [data, renderStatus] = await Promise.all([
        fetchProject(projectId),
        fetchProjectRenderStatus(projectId).catch(() => null),
      ]);
      applyProjectSnapshot(data);
      setRenderJobs(renderStatus?.jobs ?? []);
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const selectedScene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const scenes = project?.scenes ?? [];
  const sceneIndex = scenes.findIndex((s) => s.id === selectedSceneId);
  const scenePlanIsCurrent = Boolean(project?.sceneProduction);
  const scenePlanApproved = project?.review?.scenePlan?.status === "approved";
  const temporaryAccessUnlocked = searchParams.get("unlock") === "1";
  const isSlideshowProject = (project?.type || "").toLowerCase().includes("slideshow");
  // Effects LAB "static" clip mode renders from approved images (no motion clips
  // required), just like a slideshow. motionOptional gates the motion step so a
  // static project can reach assembly/render without approving videos.
  const isStaticClipMode = project?.settings?.effects?.clipMode === "static";
  const motionOptional = isSlideshowProject || isStaticClipMode;
  // Per-scene aware gating (handles hybrid): how many scenes need a clip, and
  // whether every one of those has an approved clip. Static scenes never block.
  const requiresMotion = (scene: ProjectScene) => (project ? sceneRequiresMotion(project, scene) : false);
  const motionRequiredCount = scenes.filter((s) => requiresMotion(s)).length;
  const motionApprovedCount = scenes.filter((s) => requiresMotion(s) && Boolean(s.approvedVideoId)).length;
  const motionSatisfied = scenes.length > 0 && motionApprovedCount === motionRequiredCount;
  const hasActiveRender = renderJobs.some((job) => job.status === "queued" || job.status === "processing");
  const isRenderQueued = isExportDone || hasActiveRender;

  useEffect(() => {
    loadProject();
    const interval = setInterval(() => {
      // Fast polling (2s) if rendering, otherwise slow (6s). Pauses during active studio actions.
      if (!isActionInProgress.current) {
        loadProject();
      }
    }, hasActiveRender ? 2000 : 7000);
    return () => clearInterval(interval);
  }, [hasActiveRender, loadProject]);
  // ── Handlers Étape 1 ──
  const handleGenerateImages = async (sceneId: string) => {
    setLoadingSceneId(sceneId);
    try {
      await generateSceneImages(sceneId, projectId);
      await loadProject();
    } catch {
      showToast("Error generating visuals. Please retry.");
    } finally {
      setLoadingSceneId(null);
    }
  };

  const handleApproveImage = async (imageId: string) => {
    setLoadingVariantId(imageId);
    try {
      await approveImageVariant(imageId, projectId);
      await loadProject();
      showToast("Frame approved");
    } catch {
      showToast("Error approving frame.");
    } finally {
      setLoadingVariantId(null);
    }
  };

  const handleRegenerateImage = async (imageId: string) => {
    setLoadingVariantId(imageId);
    try {
      await regenerateImageVariant(imageId, projectId);
      showToast("Regenerating visual...");
      await loadProject();
    } catch {
      showToast("Error regenerating visual.");
    } finally {
      setLoadingVariantId(null);
    }
  };

  // ── Handlers Étape 2 ──
  const handleGenerateVideos = async (sceneId: string) => {
    setLoadingSceneId(sceneId);
    try {
      await generateSceneVideos(sceneId, projectId);
      await loadProject();
    } catch {
      showToast("Error generating motion. Please retry.");
    } finally {
      setLoadingSceneId(null);
    }
  };

  const handleApproveVideo = async (videoId: string) => {
    setLoadingVariantId(videoId);
    try {
      await approveVideoVariant(videoId, projectId);
      await loadProject();
      showToast("Animation approved");
    } catch {
      showToast("Error approving animation.");
    } finally {
      setLoadingVariantId(null);
    }
  };

  const handleRegenerateVideo = async (videoId: string) => {
    setLoadingVariantId(videoId);
    try {
      await regenerateVideoVariant(videoId, projectId);
      showToast("Regenerating clip...");
      await loadProject();
    } catch {
      showToast("Error regenerating clip.");
    } finally {
      setLoadingVariantId(null);
    }
  };

  const handleToggleSceneMotion = async (sceneId: string, motionMode: "animate" | "static") => {
    try {
      await setSceneMotionMode(sceneId, motionMode, projectId);
      await loadProject();
      showToast(motionMode === "animate" ? "Scene set to animated" : "Scene set to static (Ken Burns)");
    } catch {
      showToast("Error updating scene motion mode.");
    }
  };

  const handleToggleMusic = async (enabled: boolean) => {
    if (!project) return;
    const currentMusic = project.audio?.music ?? {};
    // "uploaded" mode is user-managed in the Audio Lab — never override it here.
    if (currentMusic.mode === "uploaded" && enabled) return;
    try {
      await updateProject(projectId, {
        audio: {
          ...project.audio,
          music: { ...currentMusic, mode: enabled ? "auto" : "none", status: enabled ? "draft" : currentMusic.status },
        },
      });
      await loadProject();
      showToast(enabled ? "Music enabled" : "Music disabled for this render");
    } catch {
      showToast("Error updating music setting.");
    }
  };

  const handleToggleSfx = async (enabled: boolean) => {
    if (!project) return;
    const currentSfx = project.audio?.sfx ?? {};
    try {
      await updateProject(projectId, {
        audio: {
          ...project.audio,
          sfx: { ...currentSfx, enabled, status: enabled ? "draft" : currentSfx.status },
        },
      });
      await loadProject();
      showToast(enabled ? "SFX enabled" : "SFX disabled for this render");
    } catch {
      showToast("Error updating SFX setting.");
    }
  };

  // ── Handlers Étape 3 ──
  // BUG 3 FIX: Voice and Music handlers are now distinct with a type discriminator
  const handleGenerateVoice = async () => {
    if (project?.audio?.narration?.voiceId === "custom-audio-upload") {
      showToast("Upload a custom narration source instead of generating a voice.");
      return;
    }

    setLoadingAudio(true);
    try {
      await generateProjectAudio(projectId, { audio: { type: "voice" } });
      await loadProject();
      showToast("Voice narration generated successfully.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate voice. Check your Audio Lab configuration.");
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleGenerateMusic = async () => {
    if (project?.audio?.music?.mode === "uploaded") {
      showToast("This project uses uploaded music tracks. No soundtrack generation is needed.");
      return;
    }

    if (project?.audio?.music?.mode === "none") {
      showToast("Music is disabled for this project.");
      return;
    }

    setLoadingAudio(true);
    try {
      await generateProjectAudio(projectId, { audio: { type: "music" } });
      await loadProject();
      showToast(
        project?.audio?.sfx?.enabled === false
          ? "Music track generated successfully."
          : "Soundtrack and sound design updated successfully.",
        "success",
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate music. Please retry.");
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleUploadNarrationSource = async (file: File) => {
    setIsUploadingNarrationSource(true);

    try {
      await uploadProjectNarrationSource(projectId, file);
      await loadProject();
      showToast("Narration source uploaded successfully.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to upload the narration source.");
    } finally {
      setIsUploadingNarrationSource(false);
    }
  };

  const handleGenerateCaptions = async () => {
    setIsGeneratingCaptions(true);

    try {
      await generateProjectCaptions(projectId);
      await loadProject();
      showToast("Captions generated successfully.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to generate captions.");
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  const handleOpenAudioLab = () => {
    router.push(`/editor-lab?projectId=${projectId}&tab=audio&from=production`);
  };

  const handleOpenCaptionsLab = () => {
    router.push(`/editor-lab?projectId=${projectId}&tab=captions&from=production`);
  };


  // BUG 4 FIX: Export pipeline — assembly → approve → queue render
  const handleExportFinal = async () => {
    if (!project) {
      return;
    }

    if (isRenderQueued) {
      showToast("A render is already queued for this project.");
      return;
    }

    setIsExporting(true);
    const previousReview = project.review;
    let didApproveForExport = false;
    let didQueueRender = false;

    try {
      await generateProjectAssembly(projectId);
      await updateProject(projectId, {
        review: {
          ...previousReview,
          finalAssembly: { status: "approved", approvedAt: new Date().toISOString() },
        },
      });
      didApproveForExport = true;
      const renderResponse = await queueProjectRender(projectId, { source: "production-studio" });
      didQueueRender = true;
      setRenderJobs((current) => {
        const nextJobs = [...current.filter((job) => job.id !== renderResponse.job.id), renderResponse.job];
        return nextJobs;
      });
      await loadProject();
      setIsExportDone(true);
      showToast("Export queued successfully! Redirecting...", "success");
      setTimeout(() => router.push(`/projects/${projectId}`), 2000);
    } catch (err) {
      if (didApproveForExport && !didQueueRender) {
        await updateProject(projectId, {
          review: previousReview,
        }).catch(() => {});
      }

      await loadProject().catch(() => {});
      const message = err instanceof Error ? err.message : "Export failed. Please retry.";
      showToast(message);
    } finally {
      setIsExporting(false);
    }
  };

  // ── Rendu du squelette ──
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-none border-2 border-primary/20 animate-ping" />
            <div className="h-full w-full rounded-none border-2 border-t-primary border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/30 font-mono">Loading Studio...</p>
        </div>
      </div>
    );
  }

  if (!temporaryAccessUnlocked && (!project?.scenes || project.scenes.length === 0)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground px-6">
        <div className="max-w-md w-full rounded-none border border-primary/30 bg-card p-8 text-center space-y-6 shadow-2xl">
          <div className="h-16 w-16 mx-auto rounded-none bg-primary/10 flex items-center justify-center border border-primary/30">
            <span className="text-2xl text-primary">▣</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black uppercase tracking-tight text-foreground font-display">One step before production</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground font-sans">
              The production studio needs a scene plan first. Open the <span className="text-foreground font-mono">Scenes</span> tab to segment your script into scenes, then return here.
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => router.push(`/projects/${projectId}?tab=scenes`)}
              className="w-full h-11 rounded-none bg-primary hover:bg-primary/80 text-primary-foreground text-[10px] font-black uppercase tracking-[0.15em] border border-primary transition-all font-mono"
            >
              Generate Scenes →
            </button>
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="w-full h-9 rounded-none bg-transparent hover:bg-white/5 text-muted-foreground hover:text-foreground text-[10px] font-black uppercase tracking-[0.15em] border border-border transition-all font-mono"
            >
              Back to Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!temporaryAccessUnlocked && (!scenePlanIsCurrent || !scenePlanApproved)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background text-foreground px-6">
        <div className="max-w-md w-full rounded-none border border-amber-500/20 bg-card p-8 text-center space-y-6">
          <div className="h-16 w-16 mx-auto rounded-none bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <span className="text-2xl text-amber-300">!</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black uppercase tracking-tight text-amber-300 font-display">Scene Plan Outdated</h2>
            <p className="text-[13px] leading-relaxed text-muted-foreground font-sans">
              {!scenePlanIsCurrent
                ? "The current scenes no longer reflect the latest foundation or script-linked references. Regenerate the scene plan from the project page before entering the production studio."
                : "The current scene plan still needs approval before entering the production studio. Return to the project page and validate it first."}
            </p>
          </div>
          <button
            onClick={() => router.push(`/projects/${projectId}?tab=scenes`)}
            className="w-full h-11 rounded-none bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-[0.15em] border border-amber-500/30 transition-all font-mono"
          >
            Return to Scene Breakdown
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* ── 1. Top Bar d'état global ── */}
      <StepIndicator
        step={step}
        onStepChange={setStep}
        scenes={scenes}
        isExportDone={isRenderQueued}
        motionOptional={motionOptional}
        motionSatisfied={motionSatisfied}
        motionRequiredCount={motionRequiredCount}
        motionApprovedCount={motionApprovedCount}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── 2. Sidebar réutilisée pour les étapes 1 et 2 ── */}
        {step !== 3 && (
          <SceneSidebar
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            step={step}
            motionOptional={motionOptional}
            requiresMotion={requiresMotion}
            onSelect={setSelectedSceneId}
          />
        )}

        {/* ── 3. Contenu Dynamique par Étape ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {step === 1 && (
            <Step1VisualSelection
              selectedScene={selectedScene}
              scenes={scenes}
              sceneIndex={sceneIndex}
              loadingSceneId={loadingSceneId}
              loadingVariantId={loadingVariantId}
              onGenerateVisuals={handleGenerateImages}
              onApproveFrame={handleApproveImage}
              onRegenerateFrame={handleRegenerateImage}
              onSelectScene={(id) => setSelectedSceneId(id)}
              onGoToStep2={() => setStep(2)}
            />
          )}

          {step === 2 && (
            <Step2VideoSelection
              selectedScene={selectedScene}
              scenes={scenes}
              sceneIndex={sceneIndex}
              loadingSceneId={loadingSceneId}
              loadingVariantId={loadingVariantId}
              onGenerateVideos={handleGenerateVideos}
              onApproveVideo={handleApproveVideo}
              onRegenerateVideo={handleRegenerateVideo}
              isSlideshowProject={isSlideshowProject}
              motionOptional={motionOptional}
              motionSatisfied={motionSatisfied}
              clipMode={project?.settings?.effects?.clipMode}
              requiresMotion={requiresMotion}
              onToggleSceneMotion={handleToggleSceneMotion}
              onSelectScene={setSelectedSceneId}
              onGoBackToStep1={() => setStep(1)}
              onGoToStep3={() => setStep(3)}
            />
          )}

          {step === 3 && (
        <Step3AudioAndAssembly
          project={project}
          scenes={scenes}
          onExport={handleExportFinal}
          isExporting={isExporting}
          onGenerateVoice={handleGenerateVoice}
          onGenerateMusic={handleGenerateMusic}
          onToggleMusic={handleToggleMusic}
          onToggleSfx={handleToggleSfx}
          isLoadingAudio={loadingAudio}
          onGenerateCaptions={handleGenerateCaptions}
          isLoadingCaptions={isGeneratingCaptions}
          onUploadNarrationSource={handleUploadNarrationSource}
          isUploadingNarrationSource={isUploadingNarrationSource}
          onOpenAudioLab={handleOpenAudioLab}
          onOpenCaptionsLab={handleOpenCaptionsLab}
          isSlideshowProject={isSlideshowProject}
          motionOptional={motionOptional}
          motionSatisfied={motionSatisfied}
          isRenderQueued={isRenderQueued}
          timelineStudioHref={`/projects/${projectId}/production/timeline${temporaryAccessUnlocked ? "?unlock=1" : ""}`}
        />
          )}
        </div>
      </div>

      {/* ── Toast Notification (Errors & Success) ── */}
      {toast && (
        <div
          className={`fixed bottom-8 right-8 z-50 max-w-sm rounded-none border px-6 py-5 transition-all duration-300 animate-in slide-in-from-bottom-4 ${
            toast.type === 'error'
              ? 'border-destructive/30 bg-card text-destructive'
              : 'border-emerald-500/30 bg-card text-emerald-400'
          }`}
        >
          <p className="mt-1.5 text-[11px] leading-relaxed font-medium opacity-90 font-mono">{toast.message}</p>
        </div>
      )}
    </div>
  );
}

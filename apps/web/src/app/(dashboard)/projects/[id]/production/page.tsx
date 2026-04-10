"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  fetchProject,
  generateSceneImages,
  approveImageVariant,
  regenerateImageVariant,
  generateSceneVideos,
  approveVideoVariant,
  generateProjectAssembly,
  generateProjectAudio,
  uploadProjectNarrationSource,
  queueProjectRender,
  updateProject,
  type ProjectRecord,
} from "@/lib/projects-api";

// Composants de l'Étape
import { StepIndicator } from './components/StepIndicator';
import { SceneSidebar } from './components/SceneSidebar';
import { Step1ImageSelection } from './components/Step1ImageSelection';
import { Step2VideoSelection } from './components/Step2VideoSelection';
import { Step3AudioAndAssembly } from './components/Step3AudioAndAssembly';

interface ToastState {
  message: string;
  type: 'error' | 'success';
}

export default function ProductionPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  // Global State
  const [project, setProject] = useState<ProjectRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isExportDone, setIsExportDone] = useState(false);

  // Loading States pour l'UX
  const [loadingSceneId, setLoadingSceneId] = useState<string | null>(null);
  const [loadingVariantId, setLoadingVariantId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
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
    isActionInProgress.current = !!(loadingSceneId || loadingVariantId || isExporting || loadingAudio || isUploadingNarrationSource);
  }, [loadingSceneId, loadingVariantId, isExporting, loadingAudio, isUploadingNarrationSource]);

  // BUG 1 FIX: loadProject ne dépend plus de selectedSceneId
  // On utilise setSelectedSceneId(prev => ...) pour initialiser la scène sélectionnée
  const loadProject = useCallback(async () => {
    try {
      const data = await fetchProject(projectId);
      setProject(data);
      // Sélectionne la première scène uniquement si aucune n'est encore sélectionnée
      setSelectedSceneId(prev => (prev === null && data.scenes.length > 0) ? data.scenes[0].id : prev);
    } catch (err) {
      console.error("Failed to load project:", err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]); // BUG 1 FIX: plus de selectedSceneId dans les dépendances

  // BUG 1 FIX: useEffect stable — cleanup toujours défini, pause via ref
  useEffect(() => {
    loadProject();
    const interval = setInterval(() => {
      // Le polling se met en pause automatiquement pendant les actions
      if (!isActionInProgress.current) {
        loadProject();
      }
    }, 6000);
    return () => clearInterval(interval);
  }, [loadProject]);

  const selectedScene = project?.scenes.find((s) => s.id === selectedSceneId) ?? null;
  const scenes = project?.scenes ?? [];
  const sceneIndex = scenes.findIndex((s) => s.id === selectedSceneId);
  const scenePlanIsCurrent = Boolean(project?.sceneProduction);
  const scenePlanApproved = project?.review?.scenePlan?.status === "approved";

  // ── Handlers Étape 1 ──
  const handleGenerateImages = async (sceneId: string) => {
    setLoadingSceneId(sceneId);
    try {
      await generateSceneImages(sceneId);
      await loadProject();
    } catch {
      showToast("Erreur lors de la génération des images. Réessayez.");
    } finally {
      setLoadingSceneId(null);
    }
  };

  const handleApproveImage = async (imageId: string) => {
    setLoadingVariantId(imageId);
    try {
      await approveImageVariant(imageId);
      await loadProject();
    } catch {
      showToast("Erreur lors de la validation de l'image.");
    } finally {
      setLoadingVariantId(null);
    }
  };

  const handleRegenerateImage = async (imageId: string) => {
    setLoadingVariantId(imageId);
    try {
      await regenerateImageVariant(imageId);
      await loadProject();
    } catch {
      showToast("Erreur lors de la régénération de l'image.");
    } finally {
      setLoadingVariantId(null);
    }
  };

  // ── Handlers Étape 2 ──
  const handleGenerateVideos = async (sceneId: string) => {
    setLoadingSceneId(sceneId);
    try {
      await generateSceneVideos(sceneId);
      await loadProject();
    } catch {
      showToast("Erreur lors de la génération des vidéos. Réessayez.");
    } finally {
      setLoadingSceneId(null);
    }
  };

  const handleApproveVideo = async (videoId: string) => {
    setLoadingVariantId(videoId);
    try {
      await approveVideoVariant(videoId);
      await loadProject();
    } catch {
      showToast("Erreur lors de la validation de la vidéo.");
    } finally {
      setLoadingVariantId(null);
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

  const handleOpenAudioLab = () => {
    router.push(`/editor-lab?projectId=${projectId}&tab=audio`);
  };

  // BUG 4 FIX: Export pipeline — assembly → approve → queue render
  const handleExportFinal = async () => {
    setIsExporting(true);
    const previousReview = project?.review ?? null;
    let didApproveForExport = false;
    let didQueueRender = false;

    try {
      await generateProjectAssembly(projectId);
      await updateProject(projectId, {
        review: {
          finalAssembly: { status: "approved", approvedAt: new Date().toISOString() },
        }
      });
      didApproveForExport = true;
      await queueProjectRender(projectId, { source: "production-studio" });
      didQueueRender = true;
      await loadProject();
      setIsExportDone(true);
      showToast("Export queued successfully! Redirecting...", "success");
      setTimeout(() => router.push(`/projects/${projectId}`), 2000);
    } catch (err) {
      if (previousReview && didApproveForExport && !didQueueRender) {
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
      <div className="flex h-screen items-center justify-center bg-[#050507]">
        <div className="flex flex-col items-center gap-5">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 rounded-full border-2 border-[#9b6dff]/20 animate-ping" />
            <div className="h-full w-full rounded-full border-2 border-t-[#9b6dff] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Booting Studio...</p>
        </div>
      </div>
    );
  }

  if (!project?.scenes || project.scenes.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#050507] text-white selection:bg-[#5c2d91]/30 px-6">
        <div className="max-w-md w-full rounded-3xl border border-red-500/20 bg-[#0a0005] p-8 text-center space-y-6 shadow-[0_0_40px_-10px_rgba(239,68,68,0.15)]">
          <div className="h-16 w-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
            <span className="text-2xl text-red-400">⚠</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black uppercase tracking-tight text-red-400">Production Unavailable</h2>
            <p className="text-xs leading-relaxed text-red-200/60 font-medium">
              No scenes detected. You must generate your script and segment it into scenes before accessing the production studio.
            </p>
          </div>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="w-full h-11 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-[0.15em] border border-red-500/30 transition-all duration-300"
          >
            Return to Project Details
          </button>
        </div>
      </div>
    );
  }

  if (!scenePlanIsCurrent || !scenePlanApproved) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#050507] text-white selection:bg-[#5c2d91]/30 px-6">
        <div className="max-w-md w-full rounded-3xl border border-amber-500/20 bg-[#0a0700] p-8 text-center space-y-6 shadow-[0_0_40px_-10px_rgba(245,158,11,0.12)]">
          <div className="h-16 w-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <span className="text-2xl text-amber-300">!</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-black uppercase tracking-tight text-amber-300">Scene Plan Outdated</h2>
            <p className="text-xs leading-relaxed text-amber-100/70 font-medium">
              {!scenePlanIsCurrent
                ? "The current scenes no longer reflect the latest foundation or script-linked references. Regenerate the scene plan from the project page before entering the production studio."
                : "The current scene plan still needs approval before entering the production studio. Return to the project page and validate it first."}
            </p>
          </div>
          <button
            onClick={() => router.push(`/projects/${projectId}?tab=scenes`)}
            className="w-full h-11 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase tracking-[0.15em] border border-amber-500/30 transition-all duration-300"
          >
            Return to Scene Breakdown
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050507] text-white selection:bg-[#5c2d91]/30">
      {/* ── 1. Top Bar d'état global ── */}
      <StepIndicator step={step} onStepChange={setStep} scenes={scenes} isExportDone={isExportDone} />

      <div className="flex flex-1 overflow-hidden">
        {/* ── 2. Sidebar réutilisée pour les étapes 1 et 2 ── */}
        {step !== 3 && (
          <SceneSidebar
            scenes={scenes}
            selectedSceneId={selectedSceneId}
            step={step}
            onSelect={setSelectedSceneId}
          />
        )}

        {/* ── 3. Contenu Dynamique par Étape ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#050507]">
          {step === 1 && (
            <Step1ImageSelection
              selectedScene={selectedScene}
              scenes={scenes}
              sceneIndex={sceneIndex}
              loadingSceneId={loadingSceneId}
              loadingVariantId={loadingVariantId}
              onGenerateImages={handleGenerateImages}
              onApproveImage={handleApproveImage}
              onRegenerateImage={handleRegenerateImage}
              onSelectScene={setSelectedSceneId}
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
          isLoadingAudio={loadingAudio}
          onUploadNarrationSource={handleUploadNarrationSource}
          isUploadingNarrationSource={isUploadingNarrationSource}
          onOpenAudioLab={handleOpenAudioLab}
        />
          )}
        </div>
      </div>

      {/* ── Toast Notification (Errors & Success) ── */}
      {toast && (
        <div
          className={`fixed bottom-8 right-8 z-50 max-w-sm rounded-3xl border px-6 py-5 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-4 ${
            toast.type === 'error'
              ? 'border-red-500/30 bg-[#0a0005] text-red-400'
              : 'border-[#22c55e]/30 bg-[#00110a] text-[#22c55e]'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.2em]">
            {toast.type === 'error' ? '⚠ Error' : '✓ Success'}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed font-medium opacity-90">{toast.message}</p>
        </div>
      )}
    </div>
  );
}

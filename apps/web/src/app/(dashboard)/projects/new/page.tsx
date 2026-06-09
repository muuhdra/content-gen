"use client";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { ArrowLeft, Sparkles, Video, Zap, Layout, Mic, FileText, ImageIcon, Network } from "lucide-react"
import Link from "next/link"
import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from "next/navigation"
import {
  createProject,
  fetchTemplate,
  updateProject,
  type ProjectMutationPayload,
} from "@/lib/projects-api"
import {
  applyTemplateToProjectDraft,
  clearProjectDraft,
  defaultProjectDraft,
  readProjectDraft,
  writeProjectDraft,
  type ProjectDraft,
  type ProjectType,
} from "@/features/projects/utils/project-draft"

import { buildProjectPayload } from "@/features/projects/utils/project-payload"
import { saveCustomTemplateFromDraft } from "@/features/projects/utils/custom-templates"
import { SaveTemplateDialog } from "@/features/projects/components/SaveTemplateDialog"
import { defaultCaptionLabPreset } from "@/features/editor-lab/components/caption-lab/caption-lab-preset"
import { defaultMusicLabPreset } from "@/features/editor-lab/components/audio-lab/music/music-lab-preset"
import { defaultSoundsLabPreset } from "@/features/editor-lab/components/audio-lab/sounds/sounds-lab-preset"
import { defaultGraphicsLabPreset } from "@/features/editor-lab/components/graphic-lab/graphics-lab-preset"
import { defaultEffectsLabPreset } from "@/features/editor-lab/components/effect-lab/effects-lab-preset"
import { CUSTOM_AUDIO_UPLOAD_ID } from "@/features/editor-lab/components/audio-lab/narration/voice-cloning-lab/voice-clone-storage"

function NewProjectContent() {
  const [step, setStep] = useState(1);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(defaultProjectDraft);
  const [isPersistingProject, setIsPersistingProject] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTemplate = searchParams.get("template");
  const isFreshStart = searchParams.get("fresh") === "1";
  const isAdvanceShortcut = searchParams.get("advance") === "1";

  useEffect(() => {
    let cancelled = false;

    const bootstrapDraft = async () => {
      const savedDraft = readProjectDraft() ?? defaultProjectDraft;
      const sanitizedSavedDraft = {
        ...savedDraft,
        references: [],
        referenceDraftId: null,
        scriptTopic: "",
        manualScript: "",
      };

      if (isFreshStart) {
        clearProjectDraft();

        if (!cancelled) {
          setProjectDraft({
            ...defaultProjectDraft,
            isAdvanceContent: isAdvanceShortcut
          });
          setStep(1);
        }

        router.replace("/projects/new");
        return;
      }

      if (selectedTemplate) {
        try {
          const templatePreset = await fetchTemplate(selectedTemplate);
          const nextDraft = applyTemplateToProjectDraft(templatePreset, {
            ...sanitizedSavedDraft,
            source: "templates-library",
          });
          const sanitizedTemplateDraft = {
            ...nextDraft,
            scriptTopic: "",
            manualScript: "",
          };

          if (!cancelled) {
            setProjectDraft(sanitizedTemplateDraft);
            setStep(2);
          }
          return;
        } catch (error) {
          console.error("Unable to load selected template preset.", error);
        }
      }

      if (!cancelled) {
        setProjectDraft(sanitizedSavedDraft);
        setStep(sanitizedSavedDraft.projectType ? 2 : 1);
      }
    };

    void bootstrapDraft();

    return () => {
      cancelled = true;
    };
  }, [isFreshStart, isAdvanceShortcut, router, selectedTemplate]);

  const updateDraft = <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => {
    setProjectDraft((current) => {
      const nextDraft = {
        ...current,
        [key]: value,
      };

      writeProjectDraft(nextDraft);
      return nextDraft;
    });
    setPersistError(null);
  };

  const handleScriptStrategyChange = (value: ProjectDraft["scriptStrategy"]) => {
    setProjectDraft((current) => {
      const nextDraft = {
        ...current,
        scriptStrategy: value,
        scriptTopic: "",
        manualScript: "",
      };

      writeProjectDraft(nextDraft);
      return nextDraft;
    });
    setPersistError(null);
  };

  const handleSelectProjectType = (nextType: ProjectType) => {
    const nextDraft = {
      ...projectDraft,
      projectType: nextType,
      template: null,
      templateTitle: null,
      scriptTopic: "",
      manualScript: "",
      source: "factory-setup" as const,
      motionEngine: nextType === "slideshow"
        ? "none"
        : projectDraft.motionEngine === "none" ? "hailuo-2.3-fast" : projectDraft.motionEngine,
    };

    setProjectDraft(nextDraft);
    writeProjectDraft(nextDraft);
    setPersistError(null);

    if (selectedTemplate) {
      router.replace("/projects/new");
    }

    setStep(2);
  };

  const handleReturnToFormat = () => {
    if (selectedTemplate || projectDraft.template) {
      const resetDraft = {
        ...projectDraft,
        template: null,
        templateTitle: null,
        source: "factory-setup" as const,
      };

      setProjectDraft(resetDraft);
      writeProjectDraft(resetDraft);
      setPersistError(null);

      if (selectedTemplate) {
        router.replace("/projects/new");
      }
    }

    setStep(1);
  };



  const syncDraftToLocal = (overrides: Partial<ProjectDraft> = {}) => {
    const nextDraft = {
      ...projectDraft,
      ...overrides,
    };

    if (!nextDraft.template) {
      nextDraft.templateTitle = null;
      nextDraft.source = overrides.source ?? "factory-setup";
    } else if (!overrides.source) {
      nextDraft.source = "templates-library";
    }

    setProjectDraft(nextDraft);
    writeProjectDraft(nextDraft);
    setPersistError(null);

    return nextDraft;
  };

  const persistProject = async () => {
    const setupDraft = {
      ...projectDraft,
      projectTone: projectDraft.projectTone || projectDraft.projectContext,
    };
    
    // Use centralized payload utility for consistency
    const payload = buildProjectPayload({
      projectDraft: setupDraft,
      projectRecord: null, // Initial setup doesn't have a record yet or we want to overwrite basic settings
      captionsEnabled: true,
      musicEnabled: true,
      captionPreset: defaultCaptionLabPreset,
      musicPreset: defaultMusicLabPreset,
      soundsPreset: defaultSoundsLabPreset,
      graphicsPreset: defaultGraphicsLabPreset,
      effectsPreset: defaultEffectsLabPreset,
      visualStyle: setupDraft.projectContext,
      references: [],
      narrationLanguage: setupDraft.projectLanguage,
      selectedVoice: setupDraft.sourceMode === "upload" ? CUSTOM_AUDIO_UPLOAD_ID : "elevenlabs-v3",
      narrationStyle: "",
    });

    syncDraftToLocal(setupDraft);
    setIsPersistingProject(true);
    setPersistError(null);

    try {
      const persistedProject = setupDraft.projectId
        ? await updateProject(setupDraft.projectId, payload as ProjectMutationPayload)
        : await createProject(payload as ProjectMutationPayload);

      syncDraftToLocal({
        projectId: persistedProject.id,
      });

      return persistedProject;
    } catch (error) {
      console.error("Unable to persist project before opening Editor Lab.", error);
      setPersistError(error instanceof Error ? error.message : "Unable to save the project before opening Editor Lab.");
      return null;
    } finally {
      setIsPersistingProject(false);
    }
  };

  const editorLabEntryTab = "visuals";

  const handleLaunchProduction = async () => {
    const persistedProject = await persistProject();

    if (persistedProject?.id) {
      if (projectDraft.isAdvanceContent) {
        router.push(`/advance-editor?projectId=${persistedProject.id}`);
      } else {
        router.push(`/editor-lab?tab=${editorLabEntryTab}&projectId=${persistedProject.id}&from=setup`);
      }
    }
  };

  // Save the current configuration as a reusable custom template (appears under
  // "Mes Modèles" in the Template Library). Does not create a project.
  // Throws on failure so the dialog surfaces the error and stays open.
  const handleConfirmSaveTemplate = async ({ title, description }: { title: string; description: string }) => {
    const tpl = await saveCustomTemplateFromDraft(projectDraft, { title, description });
    setShowSaveTemplate(false);
    setTemplateMsg({ ok: true, text: `Saved "${tpl.title}" to your templates.` });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-4 text-left pb-20">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        {step === 1 ? (
          <Link href="/projects" className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all">
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Back to Factory
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleReturnToFormat}
            className="group inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-all"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" /> Change Format
          </button>
        )}
      </div>

      <div className="space-y-2 border-l-4 border-primary pl-4">
        <h2 className="text-3xl font-display uppercase font-black tracking-tight flex items-center gap-3 m-0">
          Initialize New Project <Sparkles className="w-8 h-8 text-primary opacity-50" />
        </h2>
        {projectDraft.template && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary uppercase tracking-widest text-[10px] rounded-none">
            Template: {projectDraft.templateTitle ?? projectDraft.template}
          </Badge>
        )}
      </div>
      {/* Step 1: Content Type Selection */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {[
            { id: 'short', name: 'Short Form', desc: 'TikTok, Reels, Shorts (Vertical 9:16)', icon: Zap },
            { id: 'video', name: 'YouTube Video', desc: 'Long-form cinematic content (Horizontal 16:9)', icon: Video },
            { id: 'slideshow', name: 'Slideshow / VSL', desc: 'Educational or Sales presentations', icon: Layout },
          ].map((type) => (
              <button
                type="button"
                key={type.id}
                className="group block w-full h-[280px] text-left focus-visible:outline-none"
                onClick={() => {
                  handleSelectProjectType(type.id as ProjectType);
                }}
              >
                <div className={`h-full border shadow-2xl transition-all duration-300 flex flex-col items-center justify-center p-8 text-center rounded-none
                  ${projectDraft.projectType === type.id
                    ? 'border-primary/60 bg-primary/10 shadow-[0_0_40px_-10px_rgba(255,51,0,0.35)]'
                    : 'border-[hsl(240_6%_34%)] bg-[hsl(240_5%_13%)] hover:border-primary/60 hover:bg-[hsl(15_35%_12%)] hover:shadow-[0_0_30px_-10px_rgba(255,51,0,0.3)]'
                  }`}
                >
                  <div className={`w-16 h-16 flex items-center justify-center mb-6 transition-all duration-300 group-hover:-translate-y-2 rounded-none
                    ${projectDraft.projectType === type.id
                      ? 'bg-primary/20 text-primary shadow-[0_0_30px_0_rgba(255,51,0,0.4)] border border-primary/40'
                      : 'bg-[hsl(240_5%_18%)] border border-[hsl(240_6%_40%)] text-foreground group-hover:text-primary group-hover:border-primary/60 group-hover:bg-primary/10'
                    }`}
                  >
                    <type.icon className="w-7 h-7" />
                  </div>
                  <h3 className={`text-sm font-black uppercase tracking-[0.2em] mb-3 transition-colors duration-300 font-display
                    ${projectDraft.projectType === type.id ? 'text-primary' : 'text-foreground group-hover:text-foreground'}`}>{type.name}</h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-[200px] font-mono">{type.desc}</p>
                </div>
              </button>
          ))}
        </div>
      )}

      {/* Step 2: Project Initialization */}
      {step === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <Card className="technical-card rounded-none bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-display uppercase tracking-wider">Project Identity</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-[1.05fr_1.45fr]">
              <div className="space-y-2">
                <Label>Project Name</Label>
                <Input
                  value={projectDraft.projectTitle}
                  onChange={(event) => updateDraft("projectTitle", event.target.value)}
                  placeholder={projectDraft.projectType === "short"
                    ? "Ex: AI News Flash #01"
                    : projectDraft.projectType === "slideshow"
                      ? "Ex: VSL Growth Masterclass"
                      : "Ex: The Future of AI Workflows"}
                  className="bg-background border-border rounded-none font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Project Description</Label>
                <Textarea
                  value={projectDraft.projectDescription}
                  onChange={(event) => updateDraft("projectDescription", event.target.value)}
                  placeholder={projectDraft.projectType === "slideshow"
                    ? "Describe the purpose of the deck, the promise, and what this project is meant to communicate."
                    : "Describe what this project is about in one or two sentences. This is the project description, not the script."}
                  className="min-h-[108px] resize-none bg-background border-border rounded-none font-mono focus-visible:ring-primary/50"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Narration & Script */}
            <Card className="technical-card rounded-none bg-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-display uppercase tracking-wider flex items-center gap-2">
                  <Mic className="w-4 h-4 text-primary" /> 1. Narration & Voice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Mode</Label>
                  <Select value={projectDraft.sourceMode} onValueChange={(value) => updateDraft("sourceMode", value as ProjectDraft["sourceMode"])}>
                    <SelectTrigger className="bg-background border-border rounded-none font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border bg-background">
                      <SelectItem value="generate" className="font-mono text-[10px]">AI Voice Generation (ElevenLabs)</SelectItem>
                      <SelectItem value="upload" className="font-mono text-[10px]">Upload Custom Audio (.mp3, .wav)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project Language</Label>
                  <Select value={projectDraft.projectLanguage} onValueChange={(value) => updateDraft("projectLanguage", value as string)}>
                    <SelectTrigger className="bg-background border-border rounded-none font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border bg-background">
                      <SelectItem value="french" className="font-mono text-[10px]">French</SelectItem>
                      <SelectItem value="english" className="font-mono text-[10px]">English</SelectItem>
                      <SelectItem value="chinese" className="font-mono text-[10px]">Chinese</SelectItem>
                      <SelectItem value="spanish" className="font-mono text-[10px]">Spanish</SelectItem>
                      <SelectItem value="portuguese" className="font-mono text-[10px]">Portuguese</SelectItem>
                      <SelectItem value="japanese" className="font-mono text-[10px]">Japanese</SelectItem>
                      <SelectItem value="korean" className="font-mono text-[10px]">Korean</SelectItem>
                      <SelectItem value="german" className="font-mono text-[10px]">German</SelectItem>
                      <SelectItem value="russian" className="font-mono text-[10px]">Russian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-[1px] w-full bg-border/10" />
                <div className="space-y-2 pt-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> 2. Script Strategy
                  </Label>
                  <Select value={projectDraft.scriptStrategy} onValueChange={(value) => handleScriptStrategyChange(value as ProjectDraft["scriptStrategy"])}>
                    <SelectTrigger className="bg-background border-border rounded-none font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border bg-background">
                      <SelectItem value="ai" className="font-mono text-[10px]">AI Generation Later</SelectItem>
                      <SelectItem value="manual" className="font-mono text-[10px]">Manual Input Later</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Visual Engines */}
            <Card className="technical-card rounded-none bg-card border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg font-display uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-primary" /> {projectDraft.projectType === "slideshow" ? "3. Visual & Motion Engines" : "3. Visual & Video Engines"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Script Model</Label>
                  <Select value={projectDraft.scriptAgentModel} onValueChange={(value) => updateDraft("scriptAgentModel", value as string)}>
                    <SelectTrigger className="bg-background border-border rounded-none font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border bg-background">
                      <SelectItem value="claude-sonnet-4-6" className="font-mono text-[10px]">Claude Sonnet 4.6</SelectItem>
                      <SelectItem value="gpt-4o" className="font-mono text-[10px]">GPT-4o</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Image Generation Model</Label>
                  <Select value={projectDraft.imageGenerationModel} onValueChange={(value) => updateDraft("imageGenerationModel", value as string)}>
                    <SelectTrigger className="bg-background border-border rounded-none font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border bg-background">
                      <SelectItem value="qwen-image-plus" className="font-mono text-[10px]">Qwen-image-plus — budget ($0.03)</SelectItem>
                      <SelectItem value="gemini-2.5-flash-image" className="font-mono text-[10px]">Nano Banana (Gemini 2.5 Flash) — défaut ($0.04)</SelectItem>
                      <SelectItem value="seedream-4.5" className="font-mono text-[10px]">Seedream 4.5 — photo premium ($0.04)</SelectItem>
                      <SelectItem value="nano-banana-pro" className="font-mono text-[10px]">Nano Banana Pro (Gemini 3 Pro) — premium max ($0.12)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{projectDraft.projectType === "slideshow" ? "Slide Motion Engine" : "Video Animation Engine"}</Label>
                  <Select value={projectDraft.motionEngine} onValueChange={(value) => updateDraft("motionEngine", value as string)}>
                    <SelectTrigger className="bg-background border-border rounded-none font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-none border-border bg-background">
                      {projectDraft.projectType === "slideshow" ? (
                        <SelectItem value="none" className="font-mono text-[10px]">No Motion - Static Slides</SelectItem>
                      ) : null}
                      <SelectItem value="hailuo-2.3-fast" className="font-mono text-[10px]">Hailuo 2.3 Fast — Budget 768p (recommandé)</SelectItem>
                      <SelectItem value="wan-2.7" className="font-mono text-[10px]">Wan 2.7 — Budget 720p</SelectItem>
                      <SelectItem value="kling-2.5-turbo-pro" className="font-mono text-[10px]">Kling 2.5 Turbo Pro — Premium</SelectItem>
                      <SelectItem value="seedance-2.0-fast" className="font-mono text-[10px]">Seedance 2.0 Fast — Premium</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Context */}
          <Card className="technical-card rounded-none bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg font-display uppercase tracking-wider">4. Project Context & DNA</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={projectDraft.projectContext}
                onChange={(event) => updateDraft("projectContext", event.target.value)}
                placeholder={projectDraft.projectType === "slideshow"
                  ? "Exemple: This is a premium educational VSL. The slides should feel clear, persuasive and text-first, with strong hierarchy, clean diagrams and subtle Ken Burns motion..."
                  : "Exemple: This is a tech news project for Gen Z. The tone should be sarcastic, energetic, with quick edits and neon-cyberpunk visual style..."}
                className="bg-background border-border rounded-none min-h-[120px] resize-none font-mono focus-visible:ring-primary/50 mb-6"
              />
              
              <div className="flex flex-row items-center justify-between rounded-none border border-border bg-background p-4 shadow-sm">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2 text-base font-display tracking-wider uppercase text-foreground">
                    <Network className="w-4 h-4 text-primary" /> Advance Content Mode
                  </Label>
                  <p className="text-[13px] leading-relaxed text-muted-foreground font-sans">
                    Enable deep research capabilities. Automatically extract insights from web pages, YouTube videos, and attached assets to generate highly factual and detailed scripts.
                  </p>
                </div>
                <Switch
                  checked={projectDraft.isAdvanceContent}
                  onCheckedChange={(checked) => updateDraft("isAdvanceContent", checked)}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>



          <div className="flex justify-end">
            <div className="space-y-2 text-right">
              {persistError ? (
                <p className="text-sm text-destructive font-mono">{persistError}</p>
              ) : null}
              {templateMsg ? (
                <p className={`text-[11px] font-mono ${templateMsg.ok ? "text-primary" : "text-destructive"}`}>{templateMsg.text}</p>
              ) : null}
              <div className="inline-flex items-center gap-2">
                <Button
                  size="lg"
                  type="button"
                  variant="outline"
                  onClick={() => { setTemplateMsg(null); setShowSaveTemplate(true); }}
                  disabled={isPersistingProject || !projectDraft.projectType}
                  title="Save this configuration as a reusable template"
                  className="rounded-none gap-2 px-5 font-display uppercase tracking-widest border-border bg-background hover:border-primary/50 text-foreground transition-all disabled:opacity-50"
                >
                  Save as Template
                </Button>
                <Button
                  size="lg"
                  type="button"
                  onClick={handleLaunchProduction}
                  disabled={isPersistingProject}
                  className="rounded-none gap-2 bg-primary hover:bg-primary/80 px-6 font-display uppercase tracking-widest text-primary-foreground border border-primary transition-all"
                >
                  {isPersistingProject ? "Opening..." : "Open Editor Lab"}
                </Button>
              </div>
            </div>
          </div>

        </div>
      )}

      {showSaveTemplate && (
        <SaveTemplateDialog
          defaultTitle={projectDraft.projectTitle || projectDraft.templateTitle || ""}
          defaultDescription={projectDraft.projectContext || ""}
          onSave={handleConfirmSaveTemplate}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}
    </div>
  )
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-background"><div className="h-8 w-8 rounded-none border-2 border-primary border-t-transparent animate-spin" /></div>}>
      <NewProjectContent />
    </Suspense>
  );
}

"use client";

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Sparkles, Video, Zap, Layout, Mic, FileText, ImageIcon } from "lucide-react"
import Link from "next/link"
import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from "next/navigation"
import {
  createProject,
  fetchTemplate,
  updateProject,
} from "@/lib/projects-api"
import {
  applyTemplateToProjectDraft,
  clearProjectDraft,
  defaultProjectDraft,
  readProjectDraft,
  writeProjectDraft,
  type ProjectDraft,
  type ProjectType,
} from "../project-draft"

const SCRIPT_DRIVEN_DURATION_LABEL = "Determined by script length";

function NewProjectContent() {
  const [step, setStep] = useState(1);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(defaultProjectDraft);
  const [isPersistingProject, setIsPersistingProject] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTemplate = searchParams.get("template");
  const isFreshStart = searchParams.get("fresh") === "1";

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
          setProjectDraft(defaultProjectDraft);
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
  }, [isFreshStart, selectedTemplate]);

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
        ? projectDraft.motionEngine === "kling-3.0" ? "none" : projectDraft.motionEngine
        : projectDraft.motionEngine === "none" ? "kling-3.0" : projectDraft.motionEngine,
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

  const projectTypeLabel = projectDraft.projectType === "short"
    ? "Short Form / TikTok"
    : projectDraft.projectType === "slideshow"
      ? "Slideshow / VSL"
      : "Long Form / YouTube";

  const inferredTitle = projectDraft.templateTitle
    ? projectDraft.projectTitle.trim() || projectDraft.templateTitle
    : projectDraft.projectTitle.trim()
      ? projectDraft.projectTitle.trim()
      : projectDraft.projectType === "short"
        ? "Untitled Short Project"
        : projectDraft.projectType === "slideshow"
          ? "Untitled Slideshow / VSL Project"
          : "Untitled YouTube Project";
  const editorLabEntryTab = "visuals";

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
      scriptTopic: "",
      manualScript: "",
    };
    const narrationVoiceId = setupDraft.sourceMode === "upload" ? "custom-audio-upload" : "male-1";
    const payload = {
      title: inferredTitle,
      goal: setupDraft.projectDescription.trim().length > 0
        ? setupDraft.projectDescription.trim()
        : setupDraft.projectContext.trim().length > 0
          ? setupDraft.projectContext.trim()
          : "Project draft created from factory setup.",
      type: projectTypeLabel,
      status: "Draft",
      templateId: setupDraft.template,
      references: [],
      script: {
        mode: setupDraft.scriptStrategy,
        topic: "",
        content: "",
        model: setupDraft.scriptAgentModel,
        source: "draft" as const,
        updatedAt: null,
      },
      audio: {
        narration: {
          voiceId: narrationVoiceId,
          language: setupDraft.projectLanguage,
          status: "draft" as const,
        },
      },
      settings: {
        scriptAgentModel: setupDraft.scriptAgentModel,
        imageAgentModel: setupDraft.imageGenerationModel,
        videoAgentModel: setupDraft.motionEngine,
        voiceId: narrationVoiceId,
        projectLanguage: setupDraft.projectLanguage,
        tone: setupDraft.projectTone,
        narrationStyle: "",
        visualStyle: setupDraft.projectContext,
        targetDuration: SCRIPT_DRIVEN_DURATION_LABEL,
      },
    };

    syncDraftToLocal(setupDraft);
    setIsPersistingProject(true);
    setPersistError(null);

    try {
      const persistedProject = setupDraft.projectId
        ? await updateProject(setupDraft.projectId, payload)
        : await createProject(payload);

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

  const handleLaunchProduction = async () => {
    const persistedProject = await persistProject();

    if (persistedProject?.id) {
      router.push(`/editor-lab?tab=${editorLabEntryTab}&projectId=${persistedProject.id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 mt-4 text-left pb-20">
      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
        {step === 1 ? (
          <Link href="/projects" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Factory
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleReturnToFormat}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Change Format
          </button>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          Initialize New Project <Sparkles className="w-8 h-8 text-primary opacity-50" />
        </h2>
        <p className="text-muted-foreground">Configure the DNA of your automated production engine.</p>
        {projectDraft.template && (
          <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary uppercase tracking-widest text-[10px]">
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
                <div className={`h-full rounded-3xl border transition-all duration-500 flex flex-col items-center justify-center p-8 text-center
                  ${projectDraft.projectType === type.id 
                    ? 'border-[#9b6dff]/50 bg-[#9b6dff]/10 shadow-[0_0_40px_-10px_rgba(155,109,255,0.3)]' 
                    : 'border-white/4 bg-white/1 hover:border-[#9b6dff]/30 hover:bg-white/2 hover:shadow-[0_0_30px_-10px_rgba(155,109,255,0.15)]'
                  }`}
                >
                  <div className={`w-16 h-16 rounded-[18px] flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 group-hover:-translate-y-2
                    ${projectDraft.projectType === type.id 
                      ? 'bg-[#9b6dff]/20 text-[#9b6dff] shadow-[0_0_30px_0_rgba(155,109,255,0.4)] border border-[#9b6dff]/30' 
                      : 'bg-[#08080c] border border-white/10 text-white/40 group-hover:text-[#9b6dff] group-hover:border-[#9b6dff]/30'
                    }`}
                  >
                    <type.icon className="w-7 h-7" />
                  </div>
                  <h3 className={`text-xs font-black uppercase tracking-[0.2em] mb-3 transition-colors duration-300
                    ${projectDraft.projectType === type.id ? 'text-[#9b6dff]' : 'text-white group-hover:text-white/80'}`}>{type.name}</h3>
                  <p className="text-[10px] text-white/40 leading-relaxed max-w-[200px]">{type.desc}</p>
                </div>
              </button>
          ))}
        </div>
      )}

      {/* Step 2: Project Initialization */}
      {step === 2 && (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
          <Card className="glass-card bg-card/40 border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">Project Identity</CardTitle>
              <CardDescription>
                Give the project a clear name and a short description before opening Editor Lab.
              </CardDescription>
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
                  className="bg-background/50 border-border/50"
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
                  className="min-h-[108px] resize-none bg-background/50 border-border/50 focus-visible:ring-primary/50"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Narration & Script */}
            <Card className="glass-card bg-card/40 border-border/40">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Mic className="w-4 h-4 text-purple-400" /> 1. Narration & Voice
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Source Mode</Label>
                  <Select value={projectDraft.sourceMode} onValueChange={(value) => updateDraft("sourceMode", value as ProjectDraft["sourceMode"])}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generate">AI Voice Generation (ElevenLabs)</SelectItem>
                      <SelectItem value="upload">Upload Custom Audio (.mp3, .wav)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Project Language</Label>
                  <Select value={projectDraft.projectLanguage} onValueChange={(value) => updateDraft("projectLanguage", value as string)}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="french">French</SelectItem>
                      <SelectItem value="english">English</SelectItem>
                      <SelectItem value="chinese">Chinese</SelectItem>
                      <SelectItem value="spanish">Spanish</SelectItem>
                      <SelectItem value="portuguese">Portuguese</SelectItem>
                      <SelectItem value="japanese">Japanese</SelectItem>
                      <SelectItem value="korean">Korean</SelectItem>
                      <SelectItem value="german">German</SelectItem>
                      <SelectItem value="russian">Russian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="h-[1px] w-full bg-border/10" />
                <div className="space-y-2 pt-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" /> 2. Script Strategy
                  </Label>
                  <Select value={projectDraft.scriptStrategy} onValueChange={(value) => handleScriptStrategyChange(value as ProjectDraft["scriptStrategy"])}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai">AI Generation Later</SelectItem>
                      <SelectItem value="manual">Manual Input Later</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-white/10 bg-background/30 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                    Script handling
                  </p>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    No script is written here. We only decide whether the script will be AI-generated or manually provided later, right before production.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Visual Engines */}
            <Card className="glass-card bg-card/40 border-border/40">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-pink-400" /> {projectDraft.projectType === "slideshow" ? "3. Visual & Motion Engines" : "3. Visual & Video Engines"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Image Generation Model</Label>
                  <Select value={projectDraft.imageGenerationModel} onValueChange={(value) => updateDraft("imageGenerationModel", value as string)}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nano-banana">Nano Banana</SelectItem>
                      <SelectItem value="kling-3.0">Kling 3.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{projectDraft.projectType === "slideshow" ? "Slide Motion Engine" : "Video Animation Engine"}</Label>
                  <Select value={projectDraft.motionEngine} onValueChange={(value) => updateDraft("motionEngine", value as string)}>
                    <SelectTrigger className="bg-background/50 border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {projectDraft.projectType === "slideshow" ? (
                        <SelectItem value="none">No Motion - Static Slides</SelectItem>
                      ) : null}
                      <SelectItem value="kling-3.0">Kling 3.0</SelectItem>
                      <SelectItem value="seedance-2.0">Seedance 2.0</SelectItem>
                    </SelectContent>
                  </Select>
                  {projectDraft.projectType === "slideshow" ? (
                    <p className="text-[10px] text-muted-foreground">
                      Optional for subtle motion passes. Static slides can still render with Ken Burns pacing.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Context */}
          <Card className="glass-card bg-card/40 border-border/40">
            <CardHeader>
              <CardTitle className="text-lg">4. Project Context & DNA</CardTitle>
              <CardDescription>
                {projectDraft.projectType === "slideshow"
                  ? "Describe the promise, pacing and editorial direction of the deck."
                  : "Describe how the script and the overall tone should be."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={projectDraft.projectContext}
                onChange={(event) => updateDraft("projectContext", event.target.value)}
                placeholder={projectDraft.projectType === "slideshow"
                  ? "Exemple: This is a premium educational VSL. The slides should feel clear, persuasive and text-first, with strong hierarchy, clean diagrams and subtle Ken Burns motion..."
                  : "Exemple: This is a tech news project for Gen Z. The tone should be sarcastic, energetic, with quick edits and neon-cyberpunk visual style..."}
                className="bg-background/50 border-border/50 min-h-[120px] resize-none focus-visible:ring-primary/50"
              />
            </CardContent>
          </Card>

          <Card className="glass-card bg-card/40 border-border/40">
            <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-lg">5. Visual References</CardTitle>
                <CardDescription>
                  Everything related to reference images is now centralized in Visual Lab after the project is created.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-2xl border border-dashed border-border/50 bg-background/20 p-5 space-y-3">
                <p className="text-sm font-semibold text-foreground/85">
                  Add and organize references inside <span className="text-primary">Visual Lab</span>.
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  This keeps the workflow cleaner: project creation defines the setup, then Visual Lab becomes the single place to upload, rename, label and curate the reference kit used by the scene, image and video agents.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <div className="space-y-2 text-right">
              {persistError ? (
                <p className="text-sm text-red-400">{persistError}</p>
              ) : null}
              <div className="inline-flex overflow-hidden rounded-xl border border-primary/20 shadow-lg shadow-primary/10">
                <Button
                  size="lg"
                  type="button"
                  onClick={handleLaunchProduction}
                  disabled={isPersistingProject}
                  className="rounded-none gap-2 bg-[#5c2d91] hover:bg-[#6d39ab] px-6 hover:opacity-90 transition-all font-bold shadow-none text-white border border-[#7c4dbc]"
                >
                  {isPersistingProject ? "Opening..." : "Open Editor Lab"}
                </Button>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-[#050507]"><div className="h-8 w-8 rounded-full border-2 border-[#9b6dff] border-t-transparent animate-spin" /></div>}>
      <NewProjectContent />
    </Suspense>
  );
}

"use client";

import type { ProjectReferenceAsset, TemplatePreset } from "@/lib/projects-api";

export type ProjectType = "short" | "video" | "slideshow" | null;

export type ProjectDraft = {
  projectId: string | null;
  referenceDraftId: string | null;
  projectType: ProjectType;
  projectTitle: string;
  projectDescription: string;
  template: string | null;
  templateTitle: string | null;
  sourceMode: "generate" | "upload";
  projectLanguage: string;
  scriptStrategy: "ai" | "manual";
  scriptTopic: string;
  manualScript: string;
  scriptAgentModel: string;
  imageGenerationModel: string;
  motionEngine: string;
  projectTone: string;
  projectContext: string;
  references: ProjectReferenceAsset[];
  updatedAt: string | null;
  source: "factory-setup" | "templates-library" | "projects-factory";
  isAdvanceContent: boolean;
};

export const projectDraftStorageKey = "cosyl-project-draft";
const MAX_DRAFT_STORAGE_SIZE = 1_500_000;

export const defaultProjectDraft: ProjectDraft = {
  projectId: null,
  referenceDraftId: null,
  projectType: null,
  projectTitle: "",
  projectDescription: "",
  template: null,
  templateTitle: null,
  sourceMode: "generate",
  projectLanguage: "english",
  scriptStrategy: "ai",
  scriptTopic: "",
  manualScript: "",
  scriptAgentModel: "claude-sonnet-4-6",
  imageGenerationModel: "gemini-2.5-flash-image",
  motionEngine: "hailuo-2.3-fast",
  projectTone: "",
  projectContext: "",
  references: [],
  updatedAt: null,
  source: "factory-setup",
  isAdvanceContent: false,
};

export function createProjectDraft(overrides: Partial<ProjectDraft> = {}): ProjectDraft {
  return {
    ...defaultProjectDraft,
    ...overrides,
  };
}

export function applyTemplateToProjectDraft(template: TemplatePreset, draft: ProjectDraft): ProjectDraft {
  const scriptMode = template.defaults.script?.mode === "manual" ? "manual" : "ai";

  return {
    ...draft,
    projectType: template.type,
    referenceDraftId: draft.referenceDraftId,
    projectDescription: template.description || draft.projectDescription,
    template: template.id,
    templateTitle: template.title,
    projectLanguage: template.defaults.settings?.projectLanguage ?? draft.projectLanguage,
    scriptStrategy: scriptMode,
    scriptTopic: scriptMode === "ai"
      ? template.defaults.script?.topic ?? draft.scriptTopic
      : draft.scriptTopic,
    manualScript: scriptMode === "manual"
      ? template.defaults.script?.content ?? draft.manualScript
      : draft.manualScript,
    scriptAgentModel: template.defaults.script?.model ?? template.defaults.settings?.scriptAgentModel ?? draft.scriptAgentModel,
    imageGenerationModel: template.defaults.settings?.imageAgentModel ?? draft.imageGenerationModel,
    motionEngine: template.defaults.settings?.videoAgentModel ?? draft.motionEngine,
    projectTone: template.description || draft.projectTone,
    projectContext: template.style || template.description || draft.projectContext,
  };
}

export function inferProjectTypeFromLabel(label: string): ProjectType {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("short")) {
    return "short";
  }

  if (normalizedLabel.includes("slideshow")) {
    return "slideshow";
  }

  return "video";
}

function normalizeLegacyImageModel(value?: string) {
  if (value === "midjourney" || value === "midjourney-v6" || value === "dalle3" || value === "dall-e-3" || value === "sdxl" || value === "flux" || value === "stable-diffusion-3") return "nano-banana";
  if (value === "kling-ai") return "kling-3.0";
  return value ?? defaultProjectDraft.imageGenerationModel;
}

function normalizeLegacyMotionEngine(value?: string) {
  if (value === "kling" || value === "kling-ai") return "kling-3.0";
  if (value === "runway" || value === "runway-gen3" || value === "luma" || value === "luma-dream-machine" || value === "pika") return "seedance-2.0";
  return value ?? defaultProjectDraft.motionEngine;
}

function normalizeLegacyScriptModel(value?: string) {
  if (value === "claude-3-5" || value === "claude-3-5-sonnet") return "claude";
  if (value === "gemini-pro" || value === "gemini-1-5-pro") return "gemini";
  if (value === "gpt-4o") return "gpt";
  return value ?? defaultProjectDraft.scriptAgentModel;
}

export function readProjectDraft(): ProjectDraft | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawDraft = window.localStorage.getItem(projectDraftStorageKey);

  if (!rawDraft) {
    return null;
  }

  try {
    const parsedDraft = JSON.parse(rawDraft) as ProjectDraft & { videoAnimationEngine?: string };

    return {
      ...defaultProjectDraft,
      ...parsedDraft,
      scriptAgentModel: normalizeLegacyScriptModel(parsedDraft.scriptAgentModel),
      imageGenerationModel: normalizeLegacyImageModel(parsedDraft.imageGenerationModel),
      motionEngine: normalizeLegacyMotionEngine(parsedDraft.motionEngine ?? parsedDraft.videoAnimationEngine),
      projectTone:
        typeof parsedDraft.projectTone === "string"
          ? parsedDraft.projectTone
          : typeof parsedDraft.projectContext === "string"
            ? parsedDraft.projectContext
            : defaultProjectDraft.projectTone,
    } as ProjectDraft;
  } catch {
    window.localStorage.removeItem(projectDraftStorageKey);
    return null;
  }
}

function compactDraftReferences(references: ProjectReferenceAsset[]) {
  return references.map((reference) => ({
    ...reference,
    preview: null,
  }));
}

export function writeProjectDraft(draft: ProjectDraft) {
  if (typeof window === "undefined") {
    return;
  }

  const updatedAt = new Date().toISOString();
  const fullDraft = JSON.stringify({
    ...draft,
    updatedAt,
  });
  const compactDraft = JSON.stringify({
    ...draft,
    references: compactDraftReferences(draft.references),
    updatedAt,
  });

  try {
    if (fullDraft.length <= MAX_DRAFT_STORAGE_SIZE) {
      window.localStorage.setItem(projectDraftStorageKey, fullDraft);
      return;
    }

    window.localStorage.setItem(projectDraftStorageKey, compactDraft);
  } catch {
    try {
      window.localStorage.setItem(projectDraftStorageKey, compactDraft);
    } catch {
      window.localStorage.removeItem(projectDraftStorageKey);
    }
  }
}

export function clearProjectDraft() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(projectDraftStorageKey);
}

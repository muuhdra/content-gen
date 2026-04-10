import { createTemplate, type TemplatePreset } from "@/lib/projects-api";
import type { ProjectDraft, ProjectType } from "./project-draft";

const SCRIPT_DRIVEN_DURATION_LABEL = "Determined by script length";

function getTypeLabel(type: ProjectType) {
  if (type === "short") {
    return "Short Form";
  }

  if (type === "slideshow") {
    return "Slideshow / VSL";
  }

  return "YouTube Video";
}

function getTargetDuration(_type: ProjectType) {
  return SCRIPT_DRIVEN_DURATION_LABEL;
}

function getPreview(type: ProjectType): TemplatePreset["preview"] {
  if (type === "slideshow") {
    return "deck";
  }

  if (type === "short") {
    return "skeleton";
  }

  return "noir";
}

export async function saveCustomTemplateFromDraft(draft: ProjectDraft) {
  const baseTitle = draft.templateTitle
    ? `My ${draft.templateTitle}`
    : `Custom ${getTypeLabel(draft.projectType)} Template`;
  
  // Note: createUniqueTitle is harder to do client-side without fetching all templates first.
  // We'll let the server handle it or just use the title directly for now.
  const title = baseTitle;

  const template: Partial<TemplatePreset> = {
    id: `custom-template-${Date.now()}`,
    title,
    type: draft.projectType ?? "video",
    description: draft.projectContext.trim().length > 0
      ? draft.projectContext.trim()
      : `Reusable ${getTypeLabel(draft.projectType).toLowerCase()} setup generated from your current project configuration.`,
    style: draft.projectContext.trim().length > 0
      ? draft.projectContext.trim()
      : `Reusable ${getTypeLabel(draft.projectType).toLowerCase()} production direction.`,
    params: [
      `Language: ${draft.projectLanguage}`,
      `Script: ${draft.scriptAgentModel}`,
      `Image: ${draft.imageGenerationModel}`,
      draft.motionEngine === "none" ? "Motion: static slides" : `Motion: ${draft.motionEngine}`,
    ],
    preview: getPreview(draft.projectType),
    isCustom: true,
    sourceProjectId: draft.projectId,
    defaults: {
      script: {
        mode: draft.scriptStrategy,
        model: draft.scriptAgentModel,
        topic: "",
        content: "",
      },
      settings: {
        scriptAgentModel: draft.scriptAgentModel,
        imageAgentModel: draft.imageGenerationModel,
        videoAgentModel: draft.motionEngine,
        projectLanguage: draft.projectLanguage,
        tone: draft.projectTone,
        visualStyle: draft.projectContext,
        targetDuration: getTargetDuration(draft.projectType),
      },
    },
  };

  return await createTemplate(template);
}

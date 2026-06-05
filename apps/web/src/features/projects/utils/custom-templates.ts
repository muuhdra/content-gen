import { createTemplate, type TemplatePreset, type ProjectRecord, type ProjectReferenceAsset } from "@/lib/projects-api";
import type { ProjectDraft, ProjectType } from "./project-draft";

const SCRIPT_DRIVEN_DURATION_LABEL = "Determined by script length";

type TemplateOverrides = { title?: string; description?: string };

function getTypeLabel(type: ProjectType) {
  if (type === "short") {
    return "Short Form";
  }

  if (type === "slideshow") {
    return "Slideshow / VSL";
  }

  return "YouTube Video";
}

// Persisted project types are human labels ("Short Form / TikTok", "Slideshow / VSL",
// "Long Form / YouTube") — map them back to the template type key.
function inferTemplateType(projectType: string): TemplatePreset["type"] {
  const t = (projectType || "").toLowerCase();
  if (t.includes("short")) return "short";
  if (t.includes("slideshow") || t.includes("vsl")) return "slideshow";
  return "video";
}

// Capture the foundation (Editor Lab) STYLE references as reusable name+label
// descriptors — the visual DNA. Binaries are NOT carried (storage policy + the
// agents consume references by name/label text anyway). Caps to a sane number.
function captureStyleReferences(
  references: ProjectReferenceAsset[] | undefined,
): Array<{ name: string; label: ProjectReferenceAsset["label"] }> {
  return (Array.isArray(references) ? references : [])
    .filter((ref) => typeof ref?.name === "string" && ref.name.trim().length > 0)
    .slice(0, 12)
    .map((ref) => ({ name: ref.name.trim(), label: ref.label || "style" }));
}

function getTargetDuration() {
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

export async function saveCustomTemplateFromDraft(draft: ProjectDraft, overrides: TemplateOverrides = {}) {
  // Prefer an explicit override, then the draft's template/project title, else a label.
  const title =
    (overrides.title && overrides.title.trim()) ||
    (draft.templateTitle && draft.templateTitle.trim()) ||
    (draft.projectTitle && draft.projectTitle.trim()) ||
    `Custom ${getTypeLabel(draft.projectType)} Template`;
  const description =
    (overrides.description && overrides.description.trim()) ||
    (draft.projectContext.trim().length > 0
      ? draft.projectContext.trim()
      : `Reusable ${getTypeLabel(draft.projectType).toLowerCase()} setup generated from your current project configuration.`);

  const template: Partial<TemplatePreset> = {
    id: `custom-template-${Date.now()}`,
    title,
    type: draft.projectType ?? "video",
    description,
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
        targetDuration: getTargetDuration(),
      },
      references: captureStyleReferences(draft.references),
    },
  };

  return await createTemplate(template);
}

// Save an EXISTING (already-configured) project as a reusable template.
export async function saveCustomTemplateFromProject(project: ProjectRecord, overrides: TemplateOverrides = {}) {
  const type = inferTemplateType(project.type);
  const settings = project.settings;
  const typeLabel = getTypeLabel(type);

  const title =
    (overrides.title && overrides.title.trim()) ||
    (project.title && project.title.trim()) ||
    `Custom ${typeLabel} Template`;
  const description =
    (overrides.description && overrides.description.trim()) ||
    (project.goal && project.goal.trim()) ||
    `Reusable ${typeLabel.toLowerCase()} setup saved from "${project.title || "a project"}".`;

  const motion = settings?.videoAgentModel || "kling-3.0";

  const template: Partial<TemplatePreset> = {
    id: `custom-template-${Date.now()}`,
    title,
    type,
    description,
    style: (settings?.visualStyle && settings.visualStyle.trim()) || description,
    params: [
      `Language: ${settings?.projectLanguage || "english"}`,
      `Script: ${settings?.scriptAgentModel || "—"}`,
      `Image: ${settings?.imageAgentModel || "—"}`,
      motion === "none" ? "Motion: static slides" : `Motion: ${motion}`,
    ],
    preview: getPreview(type),
    isCustom: true,
    sourceProjectId: project.id,
    defaults: {
      script: {
        mode: project.script?.mode === "manual" ? "manual" : "ai",
        model: settings?.scriptAgentModel,
        topic: "",
        content: "",
      },
      settings: {
        scriptAgentModel: settings?.scriptAgentModel,
        imageAgentModel: settings?.imageAgentModel,
        videoAgentModel: settings?.videoAgentModel,
        voiceId: settings?.voiceId,
        projectLanguage: settings?.projectLanguage,
        tone: settings?.tone,
        narrationStyle: settings?.narrationStyle,
        visualStyle: settings?.visualStyle,
        targetDuration: settings?.targetDuration || getTargetDuration(),
        assemblyMode: settings?.assemblyMode,
      },
      // Reusable audio direction (music mood/brief) — assets & uploaded tracks are
      // deliberately NOT carried over (they belong to the source project).
      audio: {
        music: {
          mode: project.audio?.music?.mode === "uploaded" ? "auto" : (project.audio?.music?.mode || "auto"),
          trackName: "",
          mood: project.audio?.music?.mood || "",
          generationBrief: project.audio?.music?.generationBrief || "",
          status: "draft",
        },
      },
      // Reusable caption STYLE (not the per-project cues/text).
      ...(project.captions?.style ? { captions: { style: project.captions.style } } : {}),
      // Visual DNA: foundation (Editor Lab) style references as name+label descriptors.
      references: captureStyleReferences(project.references),
    },
  };

  return await createTemplate(template);
}

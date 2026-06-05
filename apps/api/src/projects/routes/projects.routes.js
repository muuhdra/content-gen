/**
 * CRUD project routes — list, get, create, patch, delete.
 *
 * Mounted LAST in the aggregator so the more specific paths (script, scenes,
 * audio, captions, render, reference-assets) win over `GET /:id` etc.
 *
 * The PATCH handler holds the central cascade: when meaningful content (script,
 * scenes, references) changes, downstream stages are invalidated and the
 * project's status is promoted to "Active".
 */
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");

const { withErrorHandling } = require("../../lib/http");
const { sanitizeFileSegment } = require("../../lib/files");
const { dataRoot } = require("../../lib/paths");
const { PROJECT_STATUSES, resolveWorkingStatus } = require("@cosyl/shared/types/production");
const {
  defaultAssembly,
  normalizeAssembly,
  invalidateAssembly,
} = require("@cosyl/shared");
const { createTemplateSnapshot, getTemplateById } = require("@cosyl/config/templates");
const {
  buildScriptAnalysisHandoff,
  buildVoiceDirectionHandoff,
  buildSoundtrackDirectionHandoff,
} = require("@cosyl/agents/productionHandoff");
const { invalidateAudioForScriptChange } = require("../audio-generator");
const { normalizeCaptions, invalidateCaptions } = require("../caption-generator");
const {
  normalizeReview,
  withReviewReset,
  normalizeReferences,
  referencesStructureChanged,
  referencesSemanticChanged,
  normalizeSettings,
  createProjectId,
  resolveProjectStatus,
  isSlideshowProjectType,
  applyTemplateDefaults,
  normalizeProject,
} = require("../project-model");
const {
  narrationUploadsRoot,
  musicUploadsRoot,
  deleteReferenceAsset,
  deleteLocalUploadIfPresent,
} = require("../asset-storage");
const {
  projectsRepository,
  templatesRepository,
  maxScriptLinkedReferences,
  normalizeScriptLinkedReferences,
  exceedsScriptLinkedReferencesLimit,
} = require("./context");

// Resolve a template by id: built-in (config) first, then a CUSTOM template from
// the store. Without this, custom templates' defaults (settings/audio/captions)
// would not be applied when creating a project from them.
async function resolveTemplate(templateId) {
  if (!templateId) return null;
  const builtIn = getTemplateById(templateId);
  if (builtIn) return builtIn;
  try {
    return await templatesRepository.getTemplate(templateId);
  } catch {
    return null;
  }
}

const router = express.Router();

router.get("/", withErrorHandling(async (_req, res) => {
  const projects = await projectsRepository.listProjects();
  res.json({ data: projects.map(normalizeProject) });
}));

router.get("/:id", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project) });
}));

router.post("/", withErrorHandling(async (req, res) => {
  const now = new Date().toISOString();
  const incomingSettings = req.body.settings && typeof req.body.settings === "object" ? req.body.settings : {};
  const incomingScript = req.body.script && typeof req.body.script === "object" ? req.body.script : {};
  const incomingAudio = req.body.audio && typeof req.body.audio === "object" ? req.body.audio : {};
  const incomingCaptions = req.body.captions && typeof req.body.captions === "object" ? req.body.captions : {};
  const incomingReview = req.body.review && typeof req.body.review === "object" ? req.body.review : {};
  const incomingReferences = Array.isArray(req.body.references) ? req.body.references : [];
  const rawScriptLinkedReferences = Array.isArray(req.body.scriptLinkedReferences)
    ? req.body.scriptLinkedReferences
    : [];
  const incomingAdvanceLinks = Array.isArray(req.body.advanceLinks) ? req.body.advanceLinks : [];
  const incomingAdvanceAssets = Array.isArray(req.body.advanceAssets) ? req.body.advanceAssets : [];
  const isAdvanceContent = typeof req.body.isAdvanceContent === "boolean" ? req.body.isAdvanceContent : false;

  if (exceedsScriptLinkedReferencesLimit(rawScriptLinkedReferences)) {
    res.status(400).json({ error: `Script-linked references are limited to ${maxScriptLinkedReferences} images.` });
    return;
  }

  const incomingScriptLinkedReferences = normalizeScriptLinkedReferences(rawScriptLinkedReferences);
  const templateId = typeof req.body.templateId === "string" ? req.body.templateId : "";
  const matchedTemplate = await resolveTemplate(templateId);
  const title = typeof req.body.title === "string" && req.body.title.trim().length > 0 ? req.body.title.trim() : "Untitled Project";
  const project = applyTemplateDefaults(matchedTemplate, {
    id: createProjectId(title),
    title,
    goal: typeof req.body.goal === "string" ? req.body.goal : "",
    type: typeof req.body.type === "string" ? req.body.type : "",
    status: resolveProjectStatus(typeof req.body.status === "string" ? req.body.status : PROJECT_STATUSES[0]),
    createdAt: now,
    updatedAt: now,
    templateId: matchedTemplate?.id || null,
    templateSnapshot: matchedTemplate ? createTemplateSnapshot(matchedTemplate) : null,
    isAdvanceContent,
    advanceLinks: incomingAdvanceLinks,
    advanceAssets: incomingAdvanceAssets,
    review: normalizeReview(incomingReview),
    references: normalizeReferences(incomingReferences),
    scriptLinkedReferences: incomingScriptLinkedReferences,
    script: incomingScript,
    scenes: Array.isArray(req.body.scenes) ? req.body.scenes : [],
    audio: incomingAudio,
    captions: incomingCaptions,
    assembly: normalizeAssembly(req.body.assembly || defaultAssembly),
    settings: incomingSettings,
  });
  project.script.production = project.script.content.trim().length > 0
    ? buildScriptAnalysisHandoff({
        topic: project.script.topic || project.goal || project.title || "project",
        project,
        output: project.script,
      })
    : null;
  project.audio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project,
      audio: project.audio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project,
      audio: project.audio,
    }),
  };

  await projectsRepository.createProject(project);

  res.status(201).json({ data: normalizeProject(project) });
}));

router.patch("/:id", withErrorHandling(async (req, res) => {
  const currentProject = await projectsRepository.getProject(req.params.id);

  if (!currentProject) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const incomingSettings = req.body.settings && typeof req.body.settings === "object" ? req.body.settings : {};
  const incomingScript = req.body.script && typeof req.body.script === "object" ? req.body.script : {};
  const incomingAudio = req.body.audio && typeof req.body.audio === "object" ? req.body.audio : {};
  const incomingCaptions = req.body.captions && typeof req.body.captions === "object" ? req.body.captions : {};
  const incomingReview = req.body.review && typeof req.body.review === "object" ? req.body.review : {};
  const incomingReferences = Array.isArray(req.body.references) ? req.body.references : currentProject.references;
  const rawScriptLinkedReferences = Array.isArray(req.body.scriptLinkedReferences)
    ? req.body.scriptLinkedReferences
    : currentProject.scriptLinkedReferences;
  const incomingAdvanceLinks = Array.isArray(req.body.advanceLinks) ? req.body.advanceLinks : currentProject.advanceLinks;
  const incomingAdvanceAssets = Array.isArray(req.body.advanceAssets) ? req.body.advanceAssets : currentProject.advanceAssets;
  const isAdvanceContent = typeof req.body.isAdvanceContent === "boolean" ? req.body.isAdvanceContent : currentProject.isAdvanceContent;

  if (Array.isArray(req.body.scriptLinkedReferences) && exceedsScriptLinkedReferencesLimit(rawScriptLinkedReferences)) {
    res.status(400).json({ error: `Script-linked references are limited to ${maxScriptLinkedReferences} images.` });
    return;
  }

  const incomingScriptLinkedReferences = Array.isArray(req.body.scriptLinkedReferences)
    ? normalizeScriptLinkedReferences(rawScriptLinkedReferences)
    : currentProject.scriptLinkedReferences;
  const incomingScenes = Array.isArray(req.body.scenes) ? req.body.scenes : currentProject.scenes;
  const incomingAssembly = req.body.assembly && typeof req.body.assembly === "object" ? req.body.assembly : {};
  const scenePlanTouched = Array.isArray(req.body.scenes);
  const foundationReferencesTouched = Array.isArray(req.body.references);
  const foundationReferencesMeaningChanged = foundationReferencesTouched
    ? referencesStructureChanged(currentProject.references, incomingReferences)
      || referencesSemanticChanged(currentProject.references, incomingReferences)
    : false;
  const scriptLinkedReferencesTouched = Array.isArray(req.body.scriptLinkedReferences);
  const scriptLinkedReferenceStructureChanged = scriptLinkedReferencesTouched
    ? referencesStructureChanged(currentProject.scriptLinkedReferences, incomingScriptLinkedReferences)
    : false;
  const scriptLinkedReferenceMeaningChanged = scriptLinkedReferencesTouched
    ? referencesSemanticChanged(currentProject.scriptLinkedReferences, incomingScriptLinkedReferences)
    : false;
  const scriptTouched = Boolean(
    req.body.script
    && typeof req.body.script === "object"
    && ["content", "topic", "mode", "model", "source"].some((key) => Object.prototype.hasOwnProperty.call(req.body.script, key))
  );
  const nextTemplateId = typeof req.body.templateId === "string"
    ? req.body.templateId
    : currentProject.templateId || "";
  const matchedTemplate = await resolveTemplate(nextTemplateId);

  const updatedProject = applyTemplateDefaults(matchedTemplate, {
    ...currentProject,
    title: typeof req.body.title === "string" ? req.body.title : currentProject.title,
    goal: typeof req.body.goal === "string" ? req.body.goal : currentProject.goal,
    type: typeof req.body.type === "string" ? req.body.type : currentProject.type,
    status: resolveProjectStatus(typeof req.body.status === "string" ? req.body.status : currentProject.status),
    updatedAt: new Date().toISOString(),
    templateId: matchedTemplate?.id || null,
    templateSnapshot: matchedTemplate ? createTemplateSnapshot(matchedTemplate) : currentProject.templateSnapshot || null,
    isAdvanceContent,
    advanceLinks: incomingAdvanceLinks,
    advanceAssets: incomingAdvanceAssets,
    review: normalizeReview({
      ...(currentProject.review || {}),
      ...incomingReview,
    }),
    references: normalizeReferences(incomingReferences),
    scriptLinkedReferences: incomingScriptLinkedReferences,
    script: {
      ...currentProject.script,
      ...incomingScript,
    },
    scenes: incomingScenes,
    audio: {
      ...(currentProject.audio || {}),
      ...incomingAudio,
      narration: {
        ...(currentProject.audio?.narration || {}),
        ...(incomingAudio.narration || {}),
      },
      music: {
        ...(currentProject.audio?.music || {}),
        ...(incomingAudio.music || {}),
      },
      sfx: {
        ...(currentProject.audio?.sfx || {}),
        ...(incomingAudio.sfx || {}),
        cues: Array.isArray(incomingAudio.sfx?.cues)
          ? incomingAudio.sfx.cues
          : Array.isArray(currentProject.audio?.sfx?.cues)
            ? currentProject.audio.sfx.cues
            : [],
      },
    },
    captions: normalizeCaptions({
      ...(currentProject.captions || {}),
      ...incomingCaptions,
    }),
    assembly: normalizeAssembly({
      ...(currentProject.assembly || {}),
      ...incomingAssembly,
    }),
    settings: {
      ...normalizeSettings({
        ...(currentProject.settings || {}),
        ...incomingSettings,
      }),
    },
  });
  updatedProject.script.production = updatedProject.script.content.trim().length > 0
    ? buildScriptAnalysisHandoff({
        topic: updatedProject.script.topic || updatedProject.goal || updatedProject.title || "project",
        project: updatedProject,
        output: updatedProject.script,
      })
    : null;
  updatedProject.audio.production = {
    audioPlanRef: `audio-plan-${updatedProject.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project: updatedProject,
      audio: updatedProject.audio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project: updatedProject,
      audio: updatedProject.audio,
    }),
  };
  updatedProject.sceneProduction = scenePlanTouched || scriptTouched || foundationReferencesMeaningChanged || scriptLinkedReferenceMeaningChanged
    ? null
    : currentProject.sceneProduction || null;

  if (scriptTouched) {
    updatedProject.review = withReviewReset(updatedProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.scenes = [];
    updatedProject.audio = invalidateAudioForScriptChange(updatedProject.audio);
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(currentProject, "Script changed. Regenerate final assembly.");
  } else if (scenePlanTouched) {
    updatedProject.review = withReviewReset(updatedProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(
      currentProject,
      isSlideshowProjectType(updatedProject.type)
        ? "Slides changed. Regenerate final assembly."
        : "Scenes changed. Regenerate final assembly."
    );
  } else if (foundationReferencesMeaningChanged) {
    updatedProject.review = withReviewReset(updatedProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.sceneProduction = null;
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(
      currentProject,
      "Foundation references changed. Regenerate scenes and final assembly."
    );
  } else if (scriptLinkedReferenceStructureChanged || scriptLinkedReferenceMeaningChanged) {
    updatedProject.review = withReviewReset(updatedProject.review, ["scenePlan", "finalAssembly"]);
    updatedProject.sceneProduction = null;
    updatedProject.captions = invalidateCaptions(currentProject.captions);
    updatedProject.assembly = invalidateAssembly(
      currentProject,
      "Script-linked references changed. Regenerate scenes and final assembly."
    );
  } else if (scriptLinkedReferencesTouched) {
    updatedProject.sceneProduction = currentProject.sceneProduction || null;
  }

  // A meaningful content change means the project is being worked on → promote
  // Draft/Completed to Active (a render in flight keeps "Rendering").
  if (
    scriptTouched
    || scenePlanTouched
    || foundationReferencesMeaningChanged
    || scriptLinkedReferenceStructureChanged
    || scriptLinkedReferenceMeaningChanged
  ) {
    updatedProject.status = resolveWorkingStatus(currentProject.status);
  }

  await projectsRepository.updateProject(req.params.id, updatedProject);

  const previousNarrationUploadPath = currentProject.audio?.narration?.uploadedSource?.storagePath || null;
  const nextNarrationUploadPath = updatedProject.audio?.narration?.uploadedSource?.storagePath || null;

  if (previousNarrationUploadPath && previousNarrationUploadPath !== nextNarrationUploadPath) {
    await deleteLocalUploadIfPresent(narrationUploadsRoot, previousNarrationUploadPath);
  }

  res.json({ data: normalizeProject(updatedProject) });
}));

router.delete("/:id", withErrorHandling(async (req, res) => {
  const projectId = req.params.id;
  // Fetch the project before deletion to gather its data roots for cleanup.
  const project = await projectsRepository.getProject(projectId);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const wasDeleted = await projectsRepository.deleteProject(projectId);

  if (!wasDeleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Best-effort local disk cleanup — errors are suppressed to never block the delete response.
  // __dirname = apps/api/src/projects/routes → ../../../data
  const safeProjectSegment = sanitizeFileSegment(projectId);
  const localDataRoot = dataRoot;
  const dirsToRemove = [
    path.join(narrationUploadsRoot, safeProjectSegment),
    path.join(musicUploadsRoot, safeProjectSegment),
    path.join(localDataRoot, "generated-media", "images", safeProjectSegment),
    path.join(localDataRoot, "generated-media", "videos", safeProjectSegment),
    path.join(localDataRoot, "generated-media", "audio", safeProjectSegment),
  ];

  await Promise.allSettled(
    dirsToRemove.map((dir) => fs.rm(dir, { recursive: true, force: true }))
  );

  // Also purge any reference assets stored under the project's scope.
  const references = [
    ...(Array.isArray(project.references) ? project.references : []),
    ...(Array.isArray(project.scriptLinkedReferences) ? project.scriptLinkedReferences : []),
  ];

  await Promise.allSettled(
    references
      .filter((ref) => typeof ref?.storagePath === "string" && ref.storagePath.length > 0)
      .map((ref) => deleteReferenceAsset(ref.storagePath))
  );

  res.status(204).send();
}));

module.exports = router;

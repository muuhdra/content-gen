export type ProjectSettings = {
  scriptAgentModel: string;
  imageAgentModel: string;
  videoAgentModel: string;
  voiceId: string;
  projectLanguage: string;
  tone: string;
  narrationStyle?: string;
  visualStyle: string;
  targetDuration: string;
  graphics: {
    focusedModuleId: string;
    moduleState: Record<string, boolean>;
    variantState: Record<string, string>;
  };
  effects: {
    clipMode: string;
    motionStyle: string;
    moduleState: Record<string, boolean>;
    videoEndingDuration: number;
  };
};

export type ProjectReferenceAsset = {
  id: string;
  name: string;
  kind: "reference-image";
  label: "character" | "scene" | "style" | "object";
  scopeId?: string | null;
  preview?: string | null;
  storagePath?: string | null;
  mimeType?: string | null;
  sizeLabel?: string | null;
  uploadedAt?: string | null;
};

export type ProductionAgentMetadata = {
  agent_name: string;
  role: string;
  stage: string;
  schema_version?: string;
};

export type ProductionSchemaPayload<T = Record<string, unknown>> = {
  schema: string;
  output: T;
};

export type ScriptProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  global_analysis: Record<string, unknown>;
  beat_analysis: Record<string, unknown>[];
};

export type SceneProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  global_continuity: Record<string, unknown>;
  scenes: Record<string, unknown>[];
};

export type ImagePromptProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  scene_id: string;
  main_prompt: string;
  negative_prompt?: string;
  visual_anchors: string[];
  continuity_note: string;
};

export type ImageGenerationProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  scene_id: string;
  optimized_prompt: string;
  negative_prompt?: string;
  generation_config: Record<string, unknown>;
  model_notes: string;
  continuity_protection: string;
  generation_priority: string;
};

export type MotionVideoProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  scene_id: string;
  source_context: Record<string, unknown>;
  scene_analysis: Record<string, unknown>;
  motion_direction: Record<string, unknown>;
  cinematic_constraints: Record<string, unknown>;
  final_video_prompt: string;
  negative_prompt?: string;
};

export type VoiceDirectionProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  project_id: string;
  voice_plan: Record<string, unknown>;
};

export type SoundtrackDirectionProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  project_id: string;
  music_plan: Record<string, unknown>;
  sfx_plan: Record<string, unknown>;
};

export type AssemblyProductionOutput = {
  agent_metadata: ProductionAgentMetadata;
  project_id: string;
  readiness: Record<string, unknown>;
  warnings: string[];
  timeline: Record<string, unknown>[];
  render_handoff: Record<string, unknown>;
};

export type TemplatePreset = {
  id: string;
  title: string;
  type: "short" | "video" | "slideshow";
  description: string;
  style: string;
  params: string[];
  preview: "noir" | "cartoon" | "skeleton" | "deck" | "empty";
  isCustom?: boolean;
  sourceProjectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  defaults: {
    script?: Partial<ProjectScript>;
    settings?: Partial<ProjectSettings>;
    audio?: Partial<ProjectAudio>;
    captions?: Partial<ProjectCaptions>;
  };
};

export type ProjectScript = {
  mode: "ai" | "manual";
  topic: string;
  content: string;
  model: string;
  source: "generated" | "manual" | "draft";
  updatedAt: string | null;
  production?: ProductionSchemaPayload<ScriptProductionOutput> | null;
};

export type ProjectAudio = {
  narration: {
    voiceId: string;
    language: string;
    status: string;
    textPreview: string;
    estimatedDuration: string;
    direction?: string;
    generatedSource?: {
      id: string;
      name: string;
      sizeLabel: string;
      mimeType?: string;
      storagePath?: string;
      uploadedAt?: string;
    } | null;
    uploadedSource?: {
      id: string;
      name: string;
      sizeLabel: string;
      mimeType?: string;
      storagePath?: string;
      uploadedAt?: string;
    } | null;
  };
  music: {
    mode: string;
    trackName: string;
    mood: string;
    generationBrief?: string;
    generatedSource?: {
      id: string;
      name: string;
      sizeLabel: string;
      mimeType?: string;
      storagePath?: string;
      uploadedAt?: string;
    } | null;
    uploadedTracks?: Array<{
      id: string;
      name: string;
      sizeLabel: string;
      mimeType?: string;
      storagePath?: string;
      uploadedAt?: string;
    }>;
    endingFadeEnabled?: boolean;
    endingFadeDuration?: number;
    dynamicVolume?: boolean;
    status: string;
  };
  sfx: {
    enabled: boolean;
    density: string;
    status: string;
    cues: string[];
  };
  type?: "voice" | "music" | "full";
  generatedAt: string | null;
  production?: {
    audioPlanRef: string;
    voiceDirection: ProductionSchemaPayload<VoiceDirectionProductionOutput>;
    soundtrackDirection: ProductionSchemaPayload<SoundtrackDirectionProductionOutput>;
  } | null;
};

export type ProjectCaptionStyle = {
  captionPosition: string;
  animationStyle: string;
  animationIntensity?: number;
  wordByWord: boolean;
  wordHighlight: boolean;
  typography: string;
  textSize: number;
  letterSpacing: number;
  colorStyle: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeOpacity: number;
  strokeColor: string;
  watermarkEnabled: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkPosition: string;
};

export type ProjectCaptionCue = {
  id: string;
  sceneId: number;
  startMs: number;
  endMs: number;
  text: string;
  highlightedWord: string | null;
};

export type ProjectCaptions = {
  status: string;
  generatedAt: string | null;
  style: ProjectCaptionStyle;
  cues: ProjectCaptionCue[];
};

export type ProjectAssemblyTimelineItem = {
  id: string;
  sceneId: number;
  duration: number;
  sourceType: "video" | "image" | "placeholder";
  sourceLabel: string;
  visualDirective: string;
  narrationPreview: string;
  motion: string;
  audioLayer: string;
  slideHeadline?: string | null;
  slideBullets?: string[];
  slideLayout?: string | null;
  textDensity?: string | null;
  pacingStrategy?: string | null;
  transition?: string | null;
};

export type ProjectAssemblyHistoryItem = {
  id: string;
  createdAt: string;
  status: string;
  label: string;
  duration: string;
  notes: string;
};

export type ProjectAssembly = {
  status: string;
  generatedAt: string | null;
  aspectRatio: string;
  resolution: string;
  totalDurationSeconds: number;
  totalDurationLabel: string;
  readiness: {
    hasScenes: boolean;
    hasAudio: boolean;
    hasCaptions: boolean;
    hasVisualCoverage: boolean;
    readyToRender: boolean;
  };
  summary: {
    sceneCount: number;
    approvedImages: number;
    approvedVideos: number;
    captionCueCount: number;
    fallbackImages: number;
    placeholders: number;
    musicEnabled: boolean;
    sfxEnabled: boolean;
  };
  timeline: ProjectAssemblyTimelineItem[];
  warnings: string[];
  output: {
    title: string;
    fileName: string;
    format: string;
    previewLabel: string;
  };
  history: ProjectAssemblyHistoryItem[];
  production?: ProductionSchemaPayload<AssemblyProductionOutput> | null;
};

export type ProjectReviewStage = {
  status: "pending" | "approved";
  approvedAt: string | null;
};

export type ProjectReview = {
  scenePlan: ProjectReviewStage;
  finalAssembly: ProjectReviewStage;
};

export type ProjectRenderJob = {
  id: string;
  projectId: string;
  status: string;
  step: string;
  progress?: number;
  attempts?: number;
  retryOf?: string | null;
  payload: Record<string, unknown>;
  output: Record<string, unknown> & {
    renderMode?: string;
    layoutProfile?: string;
    motionProfile?: string;
    pacingProfile?: string;
    audioPlan?: {
      narration?: Record<string, unknown>;
      music?: Record<string, unknown>;
      sfx?: Record<string, unknown>;
    };
    sceneCount?: number;
    events?: Array<{
      id: string;
      level: string;
      step: string;
      message: string;
      createdAt: string;
    }>;
    finalAsset?: {
      fileName: string;
      storagePath: string;
      resolution: string;
      format: string;
      aspectRatio: string;
      renderMode?: string;
      layoutProfile?: string;
      motionProfile?: string;
      pacingProfile?: string;
      audioPlan?: {
        narration?: Record<string, unknown>;
        music?: Record<string, unknown>;
        sfx?: Record<string, unknown>;
      };
    };
  };
  createdAt: string;
  updatedAt: string;
};

export type ProjectScene = {
  id: string;
  sceneId: number;
  narration: string;
  visualIntent: string;
  emotion: string;
  duration: number;
  approvedImageId: string | null;
  imageVariants: ProjectImageVariant[];
  approvedVideoId: string | null;
  videoVariants: ProjectVideoVariant[];
};

export type ProjectImageVariant = {
  id: string;
  variantIndex: number;
  status: "pending" | "approved";
  palette: string;
  shot: string;
  mood: string;
  previewTitle: string;
  prompt: string;
  productionPrompt?: ProductionSchemaPayload<ImagePromptProductionOutput>;
  productionGeneration?: ProductionSchemaPayload<ImageGenerationProductionOutput>;
};

export type ProjectVideoVariant = {
  id: string;
  variantIndex: number;
  status: "pending" | "approved";
  engine: string;
  motion: string;
  energy: string;
  previewTitle: string;
  prompt: string;
  productionMotion?: ProductionSchemaPayload<MotionVideoProductionOutput>;
};

export type ProjectRecord = {
  id: string;
  title: string;
  goal: string;
  type: string;
  status: string;
  templateId?: string | null;
  templateSnapshot?: Omit<TemplatePreset, "defaults"> | null;
  review: ProjectReview;
  references?: ProjectReferenceAsset[];
  scriptLinkedReferences?: ProjectReferenceAsset[];
  createdAt: string;
  updatedAt?: string;
  script: ProjectScript;
  audio: ProjectAudio;
  captions: ProjectCaptions;
  assembly: ProjectAssembly;
  scenes: ProjectScene[];
  sceneProduction?: ProductionSchemaPayload<SceneProductionOutput> | null;
  settings: ProjectSettings;
};

export type ProjectMutationPayload = {
  title?: string;
  goal?: string;
  type?: string;
  status?: string;
  templateId?: string | null;
  review?: Partial<ProjectReview>;
  references?: ProjectReferenceAsset[];
  scriptLinkedReferences?: ProjectReferenceAsset[];
  script?: Partial<ProjectScript>;
  audio?: Partial<ProjectAudio>;
  captions?: Partial<ProjectCaptions>;
  settings?: Partial<ProjectSettings>;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

export function getProjectReferencePreviewUrl(reference?: Pick<ProjectReferenceAsset, "preview" | "storagePath"> | null) {
  if (!reference) {
    return null;
  }

  if (typeof reference.storagePath === "string" && reference.storagePath.length > 0) {
    return `${apiBaseUrl}/projects/reference-assets/file?path=${encodeURIComponent(reference.storagePath)}`;
  }

  if (typeof reference.preview === "string" && reference.preview.length > 0) {
    return reference.preview;
  }

  return null;
}

export function getImageVariantUrl(imageId: string, download = false) {
  const url = new URL(`${apiBaseUrl}/media/images/${imageId}`);
  if (download) {
    url.searchParams.set("download", "1");
  }
  return url.toString();
}

export function getVideoVariantUrl(videoId: string, download = false) {
  const url = new URL(`${apiBaseUrl}/media/videos/${videoId}`);
  if (download) {
    url.searchParams.set("download", "1");
  }
  return url.toString();
}

export function getProjectNarrationDownloadUrl(projectId: string, download = false) {
  const url = new URL(`${apiBaseUrl}/projects/${projectId}/audio/narration-file`);
  if (download) {
    url.searchParams.set("download", "1");
  }
  return url.toString();
}

export function getProjectMusicDownloadUrl(projectId: string, download = false) {
  const url = new URL(`${apiBaseUrl}/projects/${projectId}/audio/music-file`);
  if (download) {
    url.searchParams.set("download", "1");
  }
  return url.toString();
}

export function getProjectUploadedMusicTrackDownloadUrl(projectId: string, trackId: string, download = false) {
  const url = new URL(`${apiBaseUrl}/projects/${projectId}/audio/music-tracks/${trackId}/file`);
  if (download) {
    url.searchParams.set("download", "1");
  }
  return url.toString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const errorPayload = (await response.json()) as { error?: string };
      message = errorPayload.error ?? message;
    } catch {
      // Ignore malformed error payloads and keep generic message.
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function fetchProjects() {
  const response = await request<{ data: ProjectRecord[] }>("/projects");
  return response.data;
}

export async function fetchTemplates() {
  const response = await request<{ data: TemplatePreset[] }>("/templates");
  return response.data;
}

export async function fetchTemplate(templateId: string) {
  const response = await request<{ data: TemplatePreset }>(`/templates/${templateId}`);
  return response.data;
}

export async function createTemplate(payload: Partial<TemplatePreset>) {
  const response = await request<{ data: TemplatePreset }>("/templates", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function deleteTemplate(templateId: string) {
  await request(`/templates/${templateId}`, {
    method: "DELETE",
  });
}

export async function fetchProject(projectId: string) {
  const response = await request<{ data: ProjectRecord }>(`/projects/${projectId}`);
  return response.data;
}

export async function createProject(payload: ProjectMutationPayload) {
  const response = await request<{ data: ProjectRecord }>("/projects", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function updateProject(projectId: string, payload: ProjectMutationPayload) {
  const response = await request<{ data: ProjectRecord }>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function uploadProjectReferenceAsset(
  file: File,
  options: {
    projectId?: string | null;
    draftId?: string | null;
    label?: ProjectReferenceAsset["label"];
  } = {},
) {
  const params = new URLSearchParams({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    label: options.label ?? "style",
  });

  if (options.projectId) {
    params.set("projectId", options.projectId);
  }

  if (options.draftId) {
    params.set("draftId", options.draftId);
  }

  const response = await fetch(`${apiBaseUrl}/projects/reference-assets/upload-binary?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: file,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const errorPayload = (await response.json()) as { error?: string };
      message = errorPayload.error ?? message;
    } catch {
      // Ignore malformed error payloads and keep generic message.
    }

    throw new Error(message);
  }

  const parsed = await response.json() as { data: { asset: ProjectReferenceAsset; draftId: string | null } };

  return parsed.data;
}

export async function fetchProjectReferenceAssets(options: {
  projectId?: string | null;
  draftId?: string | null;
}) {
  const params = new URLSearchParams();

  if (options.projectId) {
    params.set("projectId", options.projectId);
  }

  if (options.draftId) {
    params.set("draftId", options.draftId);
  }

  const response = await request<{ data: ProjectReferenceAsset[] }>(`/projects/reference-assets?${params.toString()}`);
  return response.data;
}

export async function deleteProjectReferenceAsset(options: {
  storagePath: string;
  referenceId?: string | null;
  draftId?: string | null;
}) {
  await request(`/projects/reference-assets`, {
    method: "DELETE",
    body: JSON.stringify({
      storagePath: options.storagePath,
      referenceId: options.referenceId ?? null,
      draftId: options.draftId ?? null,
    }),
  });
}

export async function deleteProjectReferenceScope(options: {
  draftId: string;
}) {
  await request(`/projects/reference-assets/scope`, {
    method: "DELETE",
    body: JSON.stringify({
      draftId: options.draftId,
    }),
  });
}

export async function deleteProjectReferenceManifest(options: {
  draftId: string;
}) {
  await request(`/projects/reference-assets/manifest`, {
    method: "DELETE",
    body: JSON.stringify({
      draftId: options.draftId,
    }),
  });
}

export async function deleteProject(projectId: string) {
  await request(`/projects/${projectId}`, {
    method: "DELETE",
  });
}

export async function fetchProjectScript(projectId: string) {
  const response = await request<{ data: ProjectScript }>(`/projects/${projectId}/script`);
  return response.data;
}

export async function saveManualProjectScript(projectId: string, payload: { content: string; model?: string }) {
  const response = await request<{ data: ProjectScript }>(`/projects/${projectId}/script/manual`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function saveProjectScript(projectId: string, payload: { mode: ProjectScript["mode"]; topic: string; content: string; model?: string }) {
  const response = await request<{ data: ProjectScript }>(`/projects/${projectId}/script/save`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function generateProjectScript(projectId: string, payload: { topic: string; model?: string }) {
  const response = await request<{ data: ProjectScript }>(`/projects/${projectId}/script/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function fetchProjectScenes(projectId: string) {
  const response = await request<{ data: ProjectScene[] }>(`/projects/${projectId}/scenes`);
  return response.data;
}

export async function generateProjectScenes(projectId: string) {
  const response = await request<{ data: ProjectRecord }>(`/projects/${projectId}/scenes/generate`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export async function generateSceneImages(sceneId: string) {
  const response = await request<{ data: ProjectScene }>(`/scenes/${sceneId}/images/generate`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export async function approveImageVariant(imageId: string) {
  const response = await request<{ data: ProjectScene }>(`/images/${imageId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export async function regenerateImageVariant(imageId: string) {
  const response = await request<{ data: ProjectScene }>(`/images/${imageId}/regenerate`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export async function generateSceneVideos(sceneId: string) {
  const response = await request<{ data: ProjectScene }>(`/scenes/${sceneId}/videos/generate`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export async function approveVideoVariant(videoId: string) {
  const response = await request<{ data: ProjectScene }>(`/videos/${videoId}/approve`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export async function fetchProjectAudio(projectId: string) {
  const response = await request<{ data: ProjectAudio }>(`/projects/${projectId}/audio`);
  return response.data;
}

export async function generateProjectAudio(projectId: string, payload: { audio: Partial<ProjectAudio> }) {
  const response = await request<{ data: ProjectAudio }>(`/projects/${projectId}/audio/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function uploadProjectNarrationSource(projectId: string, file: File) {
  const params = new URLSearchParams({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  });

  const response = await fetch(`${apiBaseUrl}/projects/${projectId}/audio/narration-source?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: file,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const errorPayload = (await response.json()) as { error?: string };
      message = errorPayload.error ?? message;
    } catch {
      // Ignore malformed error payloads and keep generic message.
    }

    throw new Error(message);
  }

  const parsed = await response.json() as { data: ProjectAudio };
  return parsed.data;
}

export async function uploadProjectMusicTrack(projectId: string, file: File) {
  const params = new URLSearchParams({
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  });

  const response = await fetch(`${apiBaseUrl}/projects/${projectId}/audio/music-tracks/upload-binary?${params.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: file,
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Request failed";

    try {
      const errorPayload = (await response.json()) as { error?: string };
      message = errorPayload.error ?? message;
    } catch {
      // Ignore malformed error payloads and keep generic message.
    }

    throw new Error(message);
  }

  const parsed = await response.json() as {
    data: {
      audio: ProjectAudio;
      track: ProjectAudio["music"]["uploadedTracks"] extends Array<infer T> ? T : never;
    };
  };
  return parsed.data;
}

export async function deleteProjectMusicTrack(projectId: string, trackId: string) {
  const response = await request<{ data: ProjectAudio }>(`/projects/${projectId}/audio/music-tracks/${trackId}`, {
    method: "DELETE",
  });

  return response.data;
}

export async function clearProjectMusicTracks(projectId: string, nextMode?: "auto" | "uploaded") {
  const suffix = nextMode ? `?nextMode=${encodeURIComponent(nextMode)}` : "";
  const response = await request<{ data: ProjectAudio }>(`/projects/${projectId}/audio/music-tracks${suffix}`, {
    method: "DELETE",
  });

  return response.data;
}

export async function fetchProjectCaptions(projectId: string) {
  const response = await request<{ data: ProjectCaptions }>(`/projects/${projectId}/captions`);
  return response.data;
}

export async function generateProjectCaptions(projectId: string, payload: { style?: Partial<ProjectCaptionStyle> } = {}) {
  const response = await request<{ data: ProjectCaptions }>(`/projects/${projectId}/captions/generate`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function fetchProjectAssembly(projectId: string) {
  const response = await request<{ data: ProjectAssembly }>(`/projects/${projectId}/assembly`);
  return response.data;
}

export async function generateProjectAssembly(projectId: string) {
  const response = await request<{ data: ProjectAssembly }>(`/projects/${projectId}/assembly/generate`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export async function queueProjectRender(projectId: string, payload: { source?: string } = {}) {
  const response = await request<{ data: { job: ProjectRenderJob; driver: string } }>(`/projects/${projectId}/render`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function fetchProjectRenderStatus(projectId: string) {
  const response = await request<{ data: { driver: string; latestJob: ProjectRenderJob | null; jobs: ProjectRenderJob[] } }>(`/projects/${projectId}/render/status`);
  return response.data;
}

export async function retryProjectRender(projectId: string, jobId: string) {
  const response = await request<{ data: { job: ProjectRenderJob; driver: string } }>(`/projects/${projectId}/render/${jobId}/retry`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  return response.data;
}

export function formatProjectTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return formatter.format(diffDays, "day");
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

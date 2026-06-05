import type { 
  ProjectMutationPayload, 
  ProjectRecord, 
  ProjectCaptionStyle 
} from "@/lib/projects-api";
import { type ProjectDraft, type ProjectType } from "./project-draft";
import { type CaptionLabPreset } from "@/features/editor-lab/components/caption-lab/caption-lab-preset";
import { type MusicLabPreset } from "@/features/editor-lab/components/audio-lab/music/music-lab-preset";
import { type SoundsLabPreset } from "@/features/editor-lab/components/audio-lab/sounds/sounds-lab-preset";
import { type GraphicsLabPreset } from "@/features/editor-lab/components/graphic-lab/graphics-lab-preset";
import { type EffectsLabPreset } from "@/features/editor-lab/components/effect-lab/effects-lab-preset";
import { CUSTOM_AUDIO_UPLOAD_ID } from "@/features/editor-lab/components/audio-lab/narration/voice-cloning-lab/voice-clone-storage";

export const SCRIPT_DRIVEN_DURATION_LABEL = "Determined by script length";

export function deriveProjectTitle(projectDraft: ProjectDraft) {
  if (projectDraft.projectTitle.trim().length > 0) {
    return projectDraft.projectTitle.trim();
  }

  if (projectDraft.templateTitle) {
    return projectDraft.templateTitle;
  }

  if (projectDraft.projectType === "short") {
    return "Untitled Short Project";
  }

  if (projectDraft.projectType === "slideshow") {
    return "Untitled Slideshow / VSL Project";
  }

  return "Untitled YouTube Project";
}

export function deriveProjectTypeLabel(projectType: ProjectType) {
  if (projectType === "short") {
    return "Short Form / TikTok";
  }

  if (projectType === "slideshow") {
    return "Slideshow / VSL";
  }

  return "Long Form / YouTube";
}

export function deriveTargetDuration() {
  return SCRIPT_DRIVEN_DURATION_LABEL;
}

export function areStringListsEqual(left: string[] | undefined, right: string[] | undefined) {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];

  if (leftList.length !== rightList.length) {
    return false;
  }

  return leftList.every((item, index) => item === rightList[index]);
}

export function areUploadedTracksEqual(
  left: Array<{ id: string; name: string; sizeLabel: string; storagePath?: string; mimeType?: string }> | undefined,
  right: Array<{ id: string; name: string; sizeLabel: string; storagePath?: string; mimeType?: string }> | undefined,
) {
  const leftList = Array.isArray(left) ? left : [];
  const rightList = Array.isArray(right) ? right : [];

  if (leftList.length !== rightList.length) {
    return false;
  }

  return leftList.every((track, index) => {
    const candidate = rightList[index];
    return Boolean(candidate)
      && candidate.id === track.id
      && candidate.name === track.name
      && candidate.sizeLabel === track.sizeLabel
      && (candidate.storagePath || "") === (track.storagePath || "")
      && (candidate.mimeType || "") === (track.mimeType || "");
  });
}

export function toProjectCaptionStyle(preset: CaptionLabPreset): ProjectCaptionStyle {
  return {
    captionPosition: preset.captionPosition,
    animationStyle: preset.animationStyle,
    animationIntensity: preset.animationIntensity,
    wordByWord: preset.wordByWord,
    wordHighlight: preset.wordHighlight,
    typography: preset.typography,
    textSize: preset.textSize,
    letterSpacing: preset.letterSpacing,
    colorStyle: preset.colorStyle === "purple" ? "violet" : preset.colorStyle,
    strokeEnabled: preset.strokeEnabled,
    strokeWidth: preset.strokeWidth,
    strokeOpacity: preset.strokeOpacity,
    strokeColor: preset.strokeColor,
    watermarkEnabled: preset.watermarkEnabled,
    watermarkText: preset.watermarkText,
    watermarkOpacity: preset.watermarkOpacity,
    watermarkPosition: preset.watermarkPosition,
  };
}

export function buildProjectPayload({
  projectDraft,
  projectRecord,
  captionsEnabled,
  musicEnabled,
  captionPreset,
  musicPreset,
  soundsPreset,
  graphicsPreset,
  effectsPreset,
  visualStyle,
  references,
  narrationLanguage,
  selectedVoice,
  narrationStyle,
}: {
  projectDraft: ProjectDraft;
  projectRecord: ProjectRecord | null;
  captionsEnabled: boolean;
  musicEnabled: boolean;
  captionPreset: CaptionLabPreset;
  musicPreset: MusicLabPreset;
  soundsPreset: SoundsLabPreset;
  graphicsPreset: GraphicsLabPreset;
  effectsPreset: EffectsLabPreset;
  visualStyle: string;
  references: ProjectRecord["references"];
  narrationLanguage: string;
  selectedVoice: string;
  narrationStyle: string;
}): ProjectMutationPayload {
  const currentNarration = projectRecord?.audio?.narration;
  const currentMusic = projectRecord?.audio?.music;
  const currentSfx = projectRecord?.audio?.sfx;
  const currentCaptions = projectRecord?.captions;
  
  const narrationChanged =
    currentNarration?.voiceId !== selectedVoice ||
    currentNarration?.language !== narrationLanguage ||
    (currentNarration?.direction || projectRecord?.settings?.narrationStyle || "") !== narrationStyle;
    
  const uploadOnlyNarrationSelected = selectedVoice === CUSTOM_AUDIO_UPLOAD_ID;
  const preservedUploadedSource = uploadOnlyNarrationSelected ? currentNarration?.uploadedSource || null : null;
  const keepUploadedNarrationSnapshot = uploadOnlyNarrationSelected && Boolean(preservedUploadedSource);
  
  const nextMusicMode = musicEnabled
    ? musicPreset.mode === "uploaded" ? "uploaded" : "auto"
    : "none";
  const uploadedTrackNames = musicPreset.uploadedTracks.map((track) => track.name).join(", ");
  
  const currentMusicMode = currentMusic?.mode || "auto";
  const musicChanged =
    currentMusicMode !== nextMusicMode ||
    currentMusic?.mood !== musicPreset.mood ||
    (currentMusic?.generationBrief || "") !== musicPreset.generationBrief ||
    !areUploadedTracksEqual(currentMusic?.uploadedTracks, musicPreset.uploadedTracks) ||
    Boolean(currentMusic?.endingFadeEnabled) !== musicPreset.endingFadeEnabled ||
    (currentMusic?.endingFadeDuration ?? 2.5) !== musicPreset.endingFadeDuration ||
    Boolean(currentMusic?.dynamicVolume) !== musicPreset.dynamicVolume;
    
  const sfxChanged =
    Boolean(currentSfx?.enabled) !== soundsPreset.enabled ||
    (currentSfx?.density || "light") !== soundsPreset.density ||
    !areStringListsEqual(currentSfx?.cues, soundsPreset.cueFocus);
    
  const nextNarrationStatus = narrationChanged
    ? keepUploadedNarrationSnapshot
      ? "uploaded"
      : "draft"
    : currentNarration?.status || "draft";
    
  const nextMusicStatus = musicChanged ? "draft" : currentMusic?.status || "draft";
  const nextSfxStatus = sfxChanged ? "draft" : currentSfx?.status || "draft";
  
  const nextCaptionsStatus = captionsEnabled
    ? currentCaptions?.status === "disabled"
      ? "draft"
      : currentCaptions?.status || "draft"
    : "disabled";
    
  const nextCaptionGeneratedAt = captionsEnabled && currentCaptions?.status !== "disabled"
    ? currentCaptions?.generatedAt || null
    : null;
    
  const nextCaptionCues = captionsEnabled && currentCaptions?.status !== "disabled"
    ? currentCaptions?.cues || []
    : [];
    
  const nextAudioGeneratedAt =
    narrationChanged || musicChanged || sfxChanged
      ? null
      : projectRecord?.audio?.generatedAt || null;

  return {
    title: deriveProjectTitle(projectDraft),
    goal: projectDraft.projectDescription.trim().length > 0
      ? projectDraft.projectDescription.trim()
      : projectDraft.projectTone.trim().length > 0
        ? projectDraft.projectTone.trim()
        : projectDraft.projectContext.trim().length > 0
          ? projectDraft.projectContext.trim()
          : "Project configured from Editor Lab.",
    type: deriveProjectTypeLabel(projectDraft.projectType),
    status: projectRecord?.status || "Draft",
    templateId: projectDraft.template,
    references,
    isAdvanceContent: projectDraft.isAdvanceContent,
    script: {
      mode: projectDraft.scriptStrategy,
      topic: projectDraft.scriptTopic || (projectDraft.scriptStrategy === "ai" ? projectRecord?.script?.topic || "" : ""),
      content: projectDraft.scriptStrategy === "manual" ? projectDraft.manualScript : (projectRecord?.script?.content || ""),
      model: projectDraft.scriptAgentModel,
      source: projectDraft.scriptStrategy === "manual" ? "manual" : (projectRecord?.script?.source || "draft"),
      updatedAt: projectRecord?.script?.updatedAt || null,
    },
    audio: {
      ...(projectRecord?.audio || {}),
      generatedAt: nextAudioGeneratedAt,
      narration: {
        ...(currentNarration || {}),
        voiceId: selectedVoice,
        language: narrationLanguage,
        direction: narrationStyle,
        status: nextNarrationStatus,
        textPreview:
          narrationChanged && !keepUploadedNarrationSnapshot
            ? ""
            : currentNarration?.textPreview || "",
        estimatedDuration:
          narrationChanged && !keepUploadedNarrationSnapshot
            ? "00:00"
            : currentNarration?.estimatedDuration || "00:00",
        generatedSource:
          narrationChanged || uploadOnlyNarrationSelected
            ? null
            : currentNarration?.generatedSource || null,
        uploadedSource: preservedUploadedSource,
      },
      music: {
        ...(currentMusic || {}),
        mode: nextMusicMode,
        trackName:
          nextMusicMode === "uploaded"
            ? uploadedTrackNames
            : musicChanged
              ? ""
              : currentMusic?.trackName || "",
        mood: musicPreset.mood,
        generationBrief: musicPreset.generationBrief,
        uploadedTracks: nextMusicMode === "uploaded" ? musicPreset.uploadedTracks : [],
        generatedSource:
          musicChanged || nextMusicMode === "uploaded"
            ? null
            : currentMusic?.generatedSource || null,
        endingFadeEnabled: musicPreset.endingFadeEnabled,
        endingFadeDuration: musicPreset.endingFadeDuration,
        dynamicVolume: musicPreset.dynamicVolume,
        status: nextMusicStatus,
      },
      sfx: {
        ...(currentSfx || {}),
        enabled: soundsPreset.enabled,
        density: soundsPreset.density,
        status: nextSfxStatus,
        cues: soundsPreset.cueFocus,
      },
    },
    captions: {
      ...(currentCaptions || {}),
      status: nextCaptionsStatus,
      generatedAt: nextCaptionGeneratedAt,
      cues: nextCaptionCues,
      style: toProjectCaptionStyle(captionPreset),
    },
    settings: {
      scriptAgentModel: projectDraft.scriptAgentModel,
      imageAgentModel: projectDraft.imageGenerationModel,
      videoAgentModel: projectDraft.motionEngine,
      voiceId: selectedVoice,
      projectLanguage: narrationLanguage,
      tone: projectDraft.projectTone,
      narrationStyle,
      visualStyle,
      targetDuration: deriveTargetDuration(),
      graphics: graphicsPreset,
      effects: effectsPreset,
    },
  };
}

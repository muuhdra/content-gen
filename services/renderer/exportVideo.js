function isSlideshowProject(projectType = "") {
  return projectType.toLowerCase().includes("slideshow");
}

function createStoragePath(project, jobId) {
  return isSlideshowProject(project.type)
    ? `render-outputs/${project.id}/vsl-decks/${jobId}.mp4`
    : `render-outputs/${project.id}/${jobId}.mp4`;
}

function hasUploadedNarrationSource(project) {
  return typeof project.audio?.narration?.uploadedSource?.storagePath === "string"
    && project.audio.narration.uploadedSource.storagePath.length > 0;
}

function isNarrationReady(project) {
  const narration = project.audio?.narration || {};

  if (narration.voiceId === "custom-audio-upload") {
    return narration.status === "uploaded" && hasUploadedNarrationSource(project);
  }

  return narration.status === "generated";
}

function isMusicReady(project) {
  const music = project.audio?.music || {};

  if (music.mode === "none") {
    return true;
  }

  if (music.mode === "uploaded") {
    return Array.isArray(music.uploadedTracks)
      && music.uploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0);
  }

  return music.status === "generated";
}

function isSfxReady(project) {
  const sfx = project.audio?.sfx || {};

  if (sfx.enabled === false) {
    return true;
  }

  return sfx.status === "generated";
}

function getNarrationSource(project) {
  const narration = project.audio?.narration || {};

  if (narration.voiceId === "custom-audio-upload" && hasUploadedNarrationSource(project)) {
    return {
      type: "uploaded-source",
      ready: isNarrationReady(project),
      voiceId: narration.voiceId,
      fileName: narration.uploadedSource.name,
      storagePath: narration.uploadedSource.storagePath || "",
      status: narration.status || "uploaded",
    };
  }

  return {
    type: "generated-voice",
    ready: isNarrationReady(project),
    voiceId: narration.voiceId || project.settings?.voiceId || "",
    status: narration.status || "draft",
    estimatedDuration: narration.estimatedDuration || "00:00",
    fileName: narration.generatedSource?.name || "",
    storagePath: narration.generatedSource?.storagePath || "",
  };
}

function getMusicSource(project) {
  const music = project.audio?.music || {};

  if (music.mode === "uploaded") {
    const downloadableTracks = Array.isArray(music.uploadedTracks)
      ? music.uploadedTracks.filter((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0)
      : [];

    return {
      type: "uploaded-tracks",
      ready: isMusicReady(project),
      status: music.status || "draft",
      trackCount: downloadableTracks.length,
      tracks: downloadableTracks
        .map((track) => ({
            id: track.id,
            name: track.name,
            sizeLabel: track.sizeLabel,
            storagePath: track.storagePath || "",
          }))
        ,
    };
  }

  if (music.mode === "none") {
    return {
      type: "disabled",
      ready: isMusicReady(project),
      status: music.status || "disabled",
    };
  }

  return {
    type: "generated-track",
    ready: isMusicReady(project),
    status: music.status || "draft",
    trackName: music.trackName || "",
    mood: music.mood || "cinematic",
    generationBrief: music.generationBrief || "",
    fileName: music.generatedSource?.name || "",
    storagePath: music.generatedSource?.storagePath || "",
  };
}

function getSfxSource(project) {
  const sfx = project.audio?.sfx || {};

  return {
    ready: isSfxReady(project),
    enabled: Boolean(sfx.enabled),
    status: sfx.status || "draft",
    density: sfx.density || "medium",
    cueCount: Array.isArray(sfx.cues) ? sfx.cues.length : 0,
    cues: Array.isArray(sfx.cues) ? sfx.cues : [],
  };
}

function buildAudioPlan(project) {
  return {
    ready: isNarrationReady(project) && isMusicReady(project) && isSfxReady(project),
    masteredAt: project.audio?.generatedAt || null,
    narration: getNarrationSource(project),
    music: getMusicSource(project),
    sfx: getSfxSource(project),
  };
}

function exportVideoPackage({ project, job, assembly }) {
  const slideshowProject = isSlideshowProject(project.type);
  const audioPlan = buildAudioPlan(project);

  return {
    storagePath: createStoragePath(project, job.id),
    driver: job.output?.driver || "local",
    fileName: assembly.output.fileName,
    format: assembly.output.format,
    duration: assembly.totalDurationLabel,
    aspectRatio: assembly.aspectRatio,
    resolution: assembly.resolution,
    fallbackImages: assembly.summary.fallbackImages,
    approvedVideos: assembly.summary.approvedVideos,
    captionCueCount: assembly.summary.captionCueCount,
    previewLabel: assembly.output.previewLabel,
    renderMode: slideshowProject ? "vsl-slide-deck" : "standard-video",
    layoutProfile: slideshowProject ? "text-first slide deck" : "cinematic sequence",
    motionProfile: slideshowProject
      ? assembly.summary.approvedVideos > 0
        ? "hybrid motion + Ken Burns"
        : "Ken Burns image motion"
      : "clip-led motion",
    pacingProfile: slideshowProject ? "narration-led text pacing" : "scene-led pacing",
    audioPlan,
    sceneCount: assembly.summary.sceneCount,
    completedAt: new Date().toISOString(),
  };
}

module.exports = {
  exportVideoPackage,
};

/**
 * Audio routes — narration / music / SFX stems plus upload + generate endpoints.
 *
 * Read endpoints stream the cached stems, write endpoints run the audio-change
 * cascade (review.finalAssembly reset, captions + assembly invalidated, status
 * promoted to Active).
 */
const express = require("express");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const { withErrorHandling } = require("../../lib/http");
const { sanitizeFileSegment, formatFileSize } = require("../../lib/files");
const { resolveWorkingStatus } = require("@cosyl/shared/types/production");
const { invalidateAssembly } = require("@cosyl/shared");
const {
  buildVoiceDirectionHandoff,
  buildSoundtrackDirectionHandoff,
} = require("@cosyl/agents/productionHandoff");
const {
  ensureGeneratedNarrationAsset,
  ensureGeneratedMusicAsset,
  ensureGeneratedSfxAsset,
  sendGeneratedMediaFile,
} = require("../../media/assets");
const {
  generateAudioStack,
  invalidateAudioForScriptChange, // eslint-disable-line no-unused-vars
} = require("../audio-generator");
const { invalidateCaptions } = require("../caption-generator");
const {
  normalizeProject,
  withReviewReset,
  isMusicReady,
  isNarrationReady,
  isSfxReady,
} = require("../project-model");
const {
  narrationUploadsRoot,
  musicUploadsRoot,
  sendNarrationSourceAsset,
  sendMusicTrackAsset,
  flushPendingUploadCleanupEntries,
  deleteLocalUploadIfPresent,
} = require("../asset-storage");
const { projectsRepository } = require("./context");

const router = express.Router();

router.get("/:id/audio", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ data: normalizeProject(project).audio });
}));

router.get("/:id/audio/narration-file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const narration = normalizedProject.audio?.narration || {};

  if (
    narration.voiceId === "custom-audio-upload"
    && typeof narration.uploadedSource?.storagePath === "string"
    && narration.uploadedSource.storagePath.length > 0
  ) {
    await sendNarrationSourceAsset(narration.uploadedSource, res, {
      download: req.query.download === "1",
    });
    return;
  }

  let generatedSource = narration.generatedSource || null;

  if (narration.status === "generated") {
    generatedSource = await ensureGeneratedNarrationAsset({
      project: normalizedProject,
      audio: normalizedProject.audio,
    });

    if (
      !narration.generatedSource
      || narration.generatedSource.storagePath !== generatedSource.storagePath
      || narration.generatedSource.id !== generatedSource.id
    ) {
      const updatedProject = {
        ...project,
        updatedAt: new Date().toISOString(),
        audio: {
          ...normalizedProject.audio,
          narration: {
            ...normalizedProject.audio.narration,
            generatedSource,
          },
        },
      };

      await projectsRepository.updateProject(project.id, updatedProject);
    }
  }

  if (!generatedSource) {
    res.status(404).json({ error: "No downloadable narration track is available yet." });
    return;
  }

  await sendNarrationSourceAsset(generatedSource, res, {
    download: req.query.download === "1",
  });
}));

router.get("/:id/audio/music-file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const music = normalizedProject.audio?.music || {};

  if (music.mode === "uploaded" || music.mode === "none" || music.status !== "generated") {
    res.status(404).json({ error: "No downloadable soundtrack is available yet." });
    return;
  }

  const asset = await ensureGeneratedMusicAsset({
    project: normalizedProject,
    audio: normalizedProject.audio,
  });

  if (
    !music.generatedSource
    || music.generatedSource.storagePath !== asset.source.storagePath
    || music.generatedSource.id !== asset.source.id
  ) {
    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      audio: {
        ...normalizedProject.audio,
        music: {
          ...normalizedProject.audio.music,
          generatedSource: asset.source,
        },
      },
    };

    await projectsRepository.updateProject(project.id, updatedProject);
  }

  await sendGeneratedMediaFile(asset, res, {
    download: req.query.download === "1",
  });
}));

router.get("/:id/audio/sfx-file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const sfx = normalizedProject.audio?.sfx || {};

  if (sfx.enabled === false || sfx.status !== "generated") {
    res.status(404).json({ error: "No downloadable SFX stem is available yet." });
    return;
  }

  const asset = await ensureGeneratedSfxAsset({
    project: normalizedProject,
    audio: normalizedProject.audio,
  });

  if (!asset) {
    res.status(404).json({ error: "No downloadable SFX stem is available yet." });
    return;
  }

  if (
    !sfx.generatedSource
    || sfx.generatedSource.storagePath !== asset.source.storagePath
    || sfx.generatedSource.id !== asset.source.id
  ) {
    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      audio: {
        ...normalizedProject.audio,
        sfx: {
          ...normalizedProject.audio.sfx,
          generatedSource: asset.source,
        },
      },
    };

    await projectsRepository.updateProject(project.id, updatedProject);
  }

  await sendGeneratedMediaFile(asset, res, {
    download: req.query.download === "1",
  });
}));

router.post(
  "/:id/audio/music-tracks/upload-binary",
  express.raw({ type: "application/octet-stream", limit: "25mb" }),
  withErrorHandling(async (req, res) => {
    await flushPendingUploadCleanupEntries();
    const project = await projectsRepository.getProject(req.params.id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const fileName = typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
    const mimeType = typeof req.query.mimeType === "string" ? req.query.mimeType.trim() : "application/octet-stream";
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!fileName || fileBuffer.length === 0) {
      res.status(400).json({ error: "A music track file is required." });
      return;
    }

    if (!mimeType.startsWith("audio/")) {
      res.status(400).json({ error: "Only audio files are supported for uploaded tracks." });
      return;
    }

    const projectUploadDir = path.join(musicUploadsRoot, sanitizeFileSegment(project.id));
    await fs.mkdir(projectUploadDir, { recursive: true });

    const sanitizedFileName = `${randomUUID()}-${sanitizeFileSegment(fileName)}`;
    const relativeStoragePath = path.join("uploads", "music", sanitizeFileSegment(project.id), sanitizedFileName);
    const absoluteStoragePath = path.join(projectUploadDir, sanitizedFileName);
    await fs.writeFile(absoluteStoragePath, fileBuffer);

    const normalizedProject = normalizeProject(project);
    const nextTrack = {
      id: `music-track-${randomUUID()}`,
      name: fileName,
      sizeLabel: formatFileSize(fileBuffer.length),
      mimeType,
      storagePath: relativeStoragePath,
      uploadedAt: new Date().toISOString(),
    };
    const nextUploadedTracks = [
      ...(normalizedProject.audio?.music?.uploadedTracks || []),
      nextTrack,
    ];
    const nextAudio = {
      ...normalizedProject.audio,
      generatedAt: null,
      music: {
        ...normalizedProject.audio.music,
        mode: "uploaded",
        uploadedTracks: nextUploadedTracks,
        trackName: nextUploadedTracks.map((track) => track.name).join(", "),
        generatedSource: null,
        status: nextUploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0)
          ? "uploaded"
          : "draft",
      },
    };

    nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
      ? new Date().toISOString()
      : null;
    nextAudio.production = {
      audioPlanRef: `audio-plan-${project.id}-v1`,
      voiceDirection: buildVoiceDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
      soundtrackDirection: buildSoundtrackDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
    };

    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      status: resolveWorkingStatus(project.status),
      review: withReviewReset(project.review, ["finalAssembly"]),
      audio: nextAudio,
      captions: invalidateCaptions(project.captions),
      assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
    };
    try {
      await projectsRepository.updateProject(project.id, updatedProject);
    } catch (error) {
      await deleteLocalUploadIfPresent(musicUploadsRoot, relativeStoragePath);
      throw error;
    }

    res.json({
      data: {
        audio: nextAudio,
        track: nextTrack,
      },
    });
  }),
);

router.get("/:id/audio/music-tracks/:trackId/file", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const track = (normalizedProject.audio?.music?.uploadedTracks || []).find((item) => item.id === req.params.trackId);

  if (!track?.storagePath) {
    res.status(404).json({ error: "Music track not found." });
    return;
  }

  await sendMusicTrackAsset(track, res, {
    download: req.query.download === "1",
  });
}));

router.delete("/:id/audio/music-tracks", withErrorHandling(async (req, res) => {
  await flushPendingUploadCleanupEntries();
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const currentTracks = normalizedProject.audio?.music?.uploadedTracks || [];
  const nextMode = typeof req.query.nextMode === "string" && req.query.nextMode === "auto"
    ? "auto"
    : "uploaded";
  const nextAudio = {
    ...normalizedProject.audio,
    generatedAt: null,
    music: {
      ...normalizedProject.audio.music,
      mode: nextMode,
      uploadedTracks: [],
      trackName: "",
      generatedSource: null,
      status: "draft",
    },
  };

  nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
    ? new Date().toISOString()
    : null;
  nextAudio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
  };

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: resolveWorkingStatus(project.status),
    review: withReviewReset(project.review, ["finalAssembly"]),
    audio: nextAudio,
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);

  await Promise.all(
    currentTracks
      .map((track) => deleteLocalUploadIfPresent(musicUploadsRoot, track.storagePath)),
  );

  res.json({ data: nextAudio });
}));

router.delete("/:id/audio/music-tracks/:trackId", withErrorHandling(async (req, res) => {
  await flushPendingUploadCleanupEntries();
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const normalizedProject = normalizeProject(project);
  const currentTracks = normalizedProject.audio?.music?.uploadedTracks || [];
  const removedTrack = currentTracks.find((item) => item.id === req.params.trackId);

  if (!removedTrack) {
    res.status(404).json({ error: "Music track not found." });
    return;
  }

  const nextUploadedTracks = currentTracks.filter((item) => item.id !== req.params.trackId);
  const nextAudio = {
    ...normalizedProject.audio,
    generatedAt: null,
    music: {
      ...normalizedProject.audio.music,
      uploadedTracks: nextUploadedTracks,
      trackName: nextUploadedTracks.map((track) => track.name).join(", "),
      generatedSource: null,
      status: nextUploadedTracks.some((track) => typeof track?.storagePath === "string" && track.storagePath.length > 0)
        ? "uploaded"
        : "draft",
    },
  };

  nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
    ? new Date().toISOString()
    : null;
  nextAudio.production = {
    audioPlanRef: `audio-plan-${project.id}-v1`,
    voiceDirection: buildVoiceDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
    soundtrackDirection: buildSoundtrackDirectionHandoff({
      project: normalizedProject,
      audio: nextAudio,
    }),
  };

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: resolveWorkingStatus(project.status),
    review: withReviewReset(project.review, ["finalAssembly"]),
    audio: nextAudio,
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);

  await deleteLocalUploadIfPresent(musicUploadsRoot, removedTrack.storagePath);

  res.json({ data: nextAudio });
}));

router.post(
  "/:id/audio/narration-source",
  express.raw({ type: "application/octet-stream", limit: "25mb" }),
  withErrorHandling(async (req, res) => {
    await flushPendingUploadCleanupEntries();
    const project = await projectsRepository.getProject(req.params.id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const fileName = typeof req.query.fileName === "string" ? req.query.fileName.trim() : "";
    const mimeType = typeof req.query.mimeType === "string" ? req.query.mimeType.trim() : "application/octet-stream";
    const fileBuffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (!fileName || fileBuffer.length === 0) {
      res.status(400).json({ error: "A narration source file is required." });
      return;
    }

    if (!mimeType.startsWith("audio/")) {
      res.status(400).json({ error: "Only audio files are supported for uploaded narration." });
      return;
    }

    const projectUploadDir = path.join(narrationUploadsRoot, sanitizeFileSegment(project.id));
    await fs.mkdir(projectUploadDir, { recursive: true });

    const sanitizedFileName = `${randomUUID()}-${sanitizeFileSegment(fileName)}`;
    const relativeStoragePath = path.join("uploads", "narration", sanitizeFileSegment(project.id), sanitizedFileName);
    const absoluteStoragePath = path.join(projectUploadDir, sanitizedFileName);
    await fs.writeFile(absoluteStoragePath, fileBuffer);

    const normalizedProject = normalizeProject(project);
    const previousUploadedSource = normalizedProject.audio?.narration?.uploadedSource || null;
    const nextAudio = {
      ...normalizedProject.audio,
      generatedAt: null,
      narration: {
        ...normalizedProject.audio?.narration,
        voiceId: "custom-audio-upload",
        status: "uploaded",
        textPreview: `Uploaded narration source: ${fileName}`,
        generatedSource: null,
        uploadedSource: {
          id: `narration-source-${randomUUID()}`,
          name: fileName,
          sizeLabel: formatFileSize(fileBuffer.length),
          mimeType,
          storagePath: relativeStoragePath,
          uploadedAt: new Date().toISOString(),
        },
      },
    };

    nextAudio.generatedAt = isNarrationReady(nextAudio) && isMusicReady(nextAudio) && isSfxReady(nextAudio)
      ? new Date().toISOString()
      : null;
    nextAudio.production = {
      audioPlanRef: `audio-plan-${project.id}-v1`,
      voiceDirection: buildVoiceDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
      soundtrackDirection: buildSoundtrackDirectionHandoff({
        project: normalizedProject,
        audio: nextAudio,
      }),
    };

    const updatedProject = {
      ...project,
      updatedAt: new Date().toISOString(),
      status: resolveWorkingStatus(project.status),
      review: withReviewReset(project.review, ["finalAssembly"]),
      audio: nextAudio,
      captions: invalidateCaptions(project.captions),
      assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
    };

    try {
      await projectsRepository.updateProject(project.id, updatedProject);
    } catch (error) {
      await deleteLocalUploadIfPresent(narrationUploadsRoot, relativeStoragePath);
      throw error;
    }

    if (previousUploadedSource?.storagePath && previousUploadedSource.storagePath !== relativeStoragePath) {
      await deleteLocalUploadIfPresent(narrationUploadsRoot, previousUploadedSource.storagePath);
    }

    res.json({ data: nextAudio });
  }),
);

router.post("/:id/audio/generate", withErrorHandling(async (req, res) => {
  const project = await projectsRepository.getProject(req.params.id);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const overrides = req.body.audio && typeof req.body.audio === "object" ? req.body.audio : {};
  const normalizedProject = normalizeProject(project);
  let nextAudio;

  try {
    nextAudio = generateAudioStack(normalizedProject, overrides);

    if (nextAudio?.narration?.status === "generated" && nextAudio?.narration?.voiceId !== "custom-audio-upload") {
      nextAudio.narration.generatedSource = await ensureGeneratedNarrationAsset({
        project: normalizedProject,
        audio: nextAudio,
      });
      nextAudio.narration.uploadedSource = null;
    }

    if (nextAudio?.music?.status === "generated" && nextAudio?.music?.mode !== "uploaded" && nextAudio?.music?.mode !== "none") {
      const soundtrackAsset = await ensureGeneratedMusicAsset({
        project: normalizedProject,
        audio: nextAudio,
      });
      nextAudio.music.generatedSource = soundtrackAsset.source;
    } else if (nextAudio?.music) {
      nextAudio.music.generatedSource = null;
    }

    if (nextAudio?.sfx?.enabled !== false && nextAudio?.sfx?.status === "generated") {
      const sfxAsset = await ensureGeneratedSfxAsset({
        project: normalizedProject,
        audio: nextAudio,
      });
      nextAudio.sfx.generatedSource = sfxAsset?.source || null;
    } else if (nextAudio?.sfx) {
      nextAudio.sfx.generatedSource = null;
    }
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Unable to generate audio for this project.",
    });
    return;
  }

  const updatedProject = {
    ...project,
    updatedAt: new Date().toISOString(),
    status: resolveWorkingStatus(project.status),
    review: withReviewReset(project.review, ["finalAssembly"]),
    audio: nextAudio,
    captions: invalidateCaptions(project.captions),
    assembly: invalidateAssembly(project, "Audio stack changed. Regenerate final assembly."),
  };

  await projectsRepository.updateProject(project.id, updatedProject);

  const previousNarrationUploadPath = normalizedProject.audio?.narration?.uploadedSource?.storagePath || null;
  const nextNarrationUploadPath = nextAudio?.narration?.uploadedSource?.storagePath || null;

  if (previousNarrationUploadPath && previousNarrationUploadPath !== nextNarrationUploadPath) {
    await deleteLocalUploadIfPresent(narrationUploadsRoot, previousNarrationUploadPath);
  }

  res.json({ data: nextAudio });
}));

module.exports = router;

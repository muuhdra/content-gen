const { generateProjectAssembly } = require("../../../apps/api/src/projects/assembly-generator");
const { getRenderQueueError, isSlideshowProject } = require("../../../apps/api/src/projects/render-validation");
const { randomUUID } = require("node:crypto");
const { PROJECT_STATUSES, RENDER_JOB_STATUSES } = require("../../../libs/types/production");
const { exportVideoPackage } = require("../../renderer/exportVideo");

function appendEvent(output, { level = "info", step, message }) {
  const nextEvent = {
    id: `event-${randomUUID()}`,
    level,
    step,
    message,
    createdAt: new Date().toISOString(),
  };

  return {
    ...(output || {}),
    events: [...((output && Array.isArray(output.events)) ? output.events : []), nextEvent],
    logs: [...((output && Array.isArray(output.logs)) ? output.logs : []), message],
  };
}

async function updateJob(jobsRepository, job, overrides) {
  const nextJob = {
    ...job,
    ...overrides,
    updatedAt: new Date().toISOString(),
  };

  await jobsRepository.updateJob(job.id, nextJob);
  return nextJob;
}

async function updateProjectWithLatest(projectsRepository, projectId, buildNextProject) {
  const latestProject = await projectsRepository.getProject(projectId);

  if (!latestProject) {
    return null;
  }

  const nextProject = buildNextProject(latestProject);
  await projectsRepository.updateProject(projectId, nextProject);
  return nextProject;
}

async function processRenderJob(job, { jobsRepository, projectsRepository }) {
  let activeJob = await updateJob(jobsRepository, job, {
    status: RENDER_JOB_STATUSES[1],
    step: "validate_project",
    progress: 20,
    output: appendEvent(job.output, {
      step: "validate_project",
      message: "Render worker picked up the job.",
    }),
  });
  try {
    const project = await projectsRepository.getProject(job.projectId);

    if (!project) {
      await updateJob(jobsRepository, activeJob, {
        status: RENDER_JOB_STATUSES[3],
        progress: activeJob.progress,
        output: {
          ...appendEvent(activeJob.output, {
            level: "error",
            step: "validate_project",
            message: "Project not found.",
          }),
          error: "Project not found.",
        },
      });
      return;
    }

    const slideshowProject = isSlideshowProject(project.type || "");
    const nextAssembly = generateProjectAssembly(project);

    const renderQueueError = getRenderQueueError(project, { assembly: nextAssembly });

    if (renderQueueError) {
      await updateJob(jobsRepository, activeJob, {
        status: RENDER_JOB_STATUSES[3],
        progress: activeJob.progress,
        output: {
          ...appendEvent(activeJob.output, {
            level: "error",
            step: "validate_project",
            message: renderQueueError,
          }),
          error: renderQueueError,
        },
      });
      return;
    }

    await updateProjectWithLatest(projectsRepository, project.id, (latestProject) => ({
      ...latestProject,
      status: PROJECT_STATUSES[2],
      updatedAt: new Date().toISOString(),
      assembly: nextAssembly,
    }));

    activeJob = await updateJob(jobsRepository, activeJob, {
      step: "compose_video",
      progress: 60,
      output: appendEvent(activeJob.output, {
        step: "compose_video",
        message: slideshowProject
          ? "VSL deck locked. Text-first composition pass is underway."
          : "Assembly locked. Composition pass is underway.",
      }),
    });

    activeJob = await updateJob(jobsRepository, activeJob, {
      step: "export_video",
      progress: 90,
      output: appendEvent(activeJob.output, {
        step: "export_video",
        message: slideshowProject
          ? "Ken Burns and narration pacing package is being prepared."
          : "Assembly locked. Export package is being prepared.",
      }),
    });

    const exportedPackage = exportVideoPackage({
      project,
      job: activeJob,
      assembly: nextAssembly,
    });
    const output = {
      ...exportedPackage,
      finalAsset: {
        fileName: nextAssembly.output.fileName,
        storagePath: exportedPackage.storagePath,
        resolution: nextAssembly.resolution,
        format: nextAssembly.output.format,
        aspectRatio: nextAssembly.aspectRatio,
        renderMode: exportedPackage.renderMode,
        layoutProfile: exportedPackage.layoutProfile,
        motionProfile: exportedPackage.motionProfile,
        pacingProfile: exportedPackage.pacingProfile,
        audioPlan: exportedPackage.audioPlan,
      },
      ...appendEvent(activeJob.output, {
        step: "export_video",
        message: slideshowProject
          ? "VSL deck export completed."
          : "Render export completed.",
      }),
    };
    const completedAt = output.completedAt;

    await updateProjectWithLatest(projectsRepository, project.id, (latestProject) => ({
      ...latestProject,
      status: PROJECT_STATUSES[3],
      updatedAt: completedAt,
      assembly: nextAssembly,
    }));

    await updateJob(jobsRepository, activeJob, {
      status: RENDER_JOB_STATUSES[2],
      step: "export_video",
      progress: 100,
      output,
    });
  } catch (error) {
    const project = await projectsRepository.getProject(job.projectId).catch(() => null);

    if (project && project.status === PROJECT_STATUSES[2]) {
      await projectsRepository.updateProject(project.id, {
        ...project,
        status: PROJECT_STATUSES[1],
        updatedAt: new Date().toISOString(),
      }).catch(() => {});
    }

    await updateJob(jobsRepository, activeJob, {
      status: RENDER_JOB_STATUSES[3],
      progress: activeJob.progress,
      output: {
        ...appendEvent(activeJob.output, {
          level: "error",
          step: activeJob.step,
          message: error instanceof Error ? error.message : "Unexpected render worker error.",
        }),
        error: error instanceof Error ? error.message : "Unexpected render worker error.",
      },
    });
  }
}

module.exports = {
  processRenderJob,
};

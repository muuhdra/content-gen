import {
  fetchProjectRenderStatus,
  fetchProjects,
  type ProjectRecord,
  type ProjectRenderJob,
} from "./projects-api";

export type RecentContentItem = {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  createdAt: string;
  duration: string;
  format: string;
  status: string;
  renderMode: string | null;
};

function getCompletedRenderJobs(jobs: ProjectRenderJob[]) {
  return jobs.filter((job) => job.status === "completed" && job.output?.finalAsset);
}

function getContentTitle(project: ProjectRecord, job: ProjectRenderJob) {
  if (typeof job.output.finalAsset?.fileName === "string" && job.output.finalAsset.fileName.length > 0) {
    return job.output.finalAsset.fileName.replace(/\.mp4$/i, "");
  }

  if (typeof job.output.fileName === "string" && job.output.fileName.length > 0) {
    return job.output.fileName.replace(/\.mp4$/i, "");
  }

  if (typeof project.assembly?.output?.title === "string" && project.assembly.output.title.length > 0) {
    return project.assembly.output.title;
  }

  return project.title;
}

function buildRecentContentItems(projects: ProjectRecord[], jobsByProject: Map<string, ProjectRenderJob[]>) {
  return projects
    .flatMap((project) => {
      const jobs = jobsByProject.get(project.id) ?? [];

      return getCompletedRenderJobs(jobs).map((job) => ({
        id: job.id,
        title: getContentTitle(project, job),
        projectId: project.id,
        projectTitle: project.title,
        createdAt: job.updatedAt ?? job.createdAt,
        duration: typeof job.output.duration === "string" ? job.output.duration : project.assembly?.totalDurationLabel || "00:00",
        format: typeof job.output.finalAsset?.format === "string"
          ? job.output.finalAsset.format.toUpperCase()
          : typeof job.output.format === "string"
            ? job.output.format.toUpperCase()
            : "MP4",
        status: "Rendered",
        renderMode: typeof job.output.renderMode === "string" ? job.output.renderMode : null,
      }));
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function loadRecentContentFeed() {
  const projects = await fetchProjects();
  const renderStatusEntries = await Promise.all(
    projects.map(async (project) => {
      try {
        const status = await fetchProjectRenderStatus(project.id);
        return [project.id, status.jobs] as const;
      } catch {
        return [project.id, [] as ProjectRenderJob[]] as const;
      }
    })
  );

  const jobsByProject = new Map<string, ProjectRenderJob[]>(renderStatusEntries);
  const recentContent = buildRecentContentItems(projects, jobsByProject);
  const hasActiveRender = Array.from(jobsByProject.values()).some((jobs) =>
    jobs.some((job) => job.status === "queued" || job.status === "processing")
  );

  return {
    projects,
    recentContent,
    hasActiveRender,
  };
}

const { readRenderJobs, writeRenderJobs } = require("./store");
const { createSupabaseAdminClient } = require("../../../../libs/db/supabase");
const { createSupabaseRenderJobsStore } = require("./supabase-store");

function sortJobsDescending(jobs) {
  return [...jobs].sort((left, right) => {
    return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
  });
}

function createFileRenderJobsStore() {
  return {
    async listJobsByProject(projectId) {
      const jobs = await readRenderJobs();
      return sortJobsDescending(jobs.filter((job) => job.projectId === projectId));
    },

    async getJob(jobId) {
      const jobs = await readRenderJobs();
      return jobs.find((job) => job.id === jobId) ?? null;
    },

    async createJob(job) {
      const jobs = await readRenderJobs();
      jobs.push(job);
      await writeRenderJobs(jobs);
      return job;
    },

    async updateJob(jobId, nextJob) {
      const jobs = await readRenderJobs();
      const jobIndex = jobs.findIndex((job) => job.id === jobId);

      if (jobIndex === -1) {
        return null;
      }

      jobs[jobIndex] = nextJob;
      await writeRenderJobs(jobs);
      return nextJob;
    },
  };
}

function createRenderJobsRepository() {
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    return createSupabaseRenderJobsStore(supabaseClient);
  }

  return createFileRenderJobsStore();
}

module.exports = {
  createRenderJobsRepository,
};

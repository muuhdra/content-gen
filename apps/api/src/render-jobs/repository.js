const {
  readRenderJobs,
  createJob,
  updateJob,
} = require("./store");
const { createSupabaseAdminClient } = require("@cosyl/shared/db/supabase");
const { createSupabaseRenderJobsStore } = require("./supabase-store");

function sortJobsDescending(jobs) {
  return [...jobs].sort((a, b) =>
    new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );
}

function createFileRenderJobsStore() {
  return {
    async listJobsByProject(projectId) {
      const jobs = await readRenderJobs();
      return sortJobsDescending(jobs.filter((j) => j.projectId === projectId));
    },

    async getJob(jobId) {
      const jobs = await readRenderJobs();
      return jobs.find((j) => j.id === jobId) ?? null;
    },

    // Atomic mutations — all run inside the store's write mutex.
    createJob,
    updateJob,
  };
}

function createRenderJobsRepository() {
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    return createSupabaseRenderJobsStore(supabaseClient);
  }

  return createFileRenderJobsStore();
}

module.exports = { createRenderJobsRepository };

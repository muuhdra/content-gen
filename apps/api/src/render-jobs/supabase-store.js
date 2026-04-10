function mapRenderJobRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    status: row.status,
    step: row.step,
    progress: row.progress,
    attempts: row.attempts,
    retryOf: row.retry_of,
    payload: row.payload,
    output: row.output,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRenderJobPayload(job) {
  return {
    id: job.id,
    project_id: job.projectId,
    status: job.status,
    step: job.step,
    progress: job.progress,
    attempts: job.attempts,
    retry_of: job.retryOf,
    payload: job.payload,
    output: job.output,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

function createSupabaseRenderJobsStore(client) {
  return {
    async listJobsByProject(projectId) {
      const { data, error } = await client
        .from("render_jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(mapRenderJobRow);
    },

    async getJob(jobId) {
      const { data, error } = await client
        .from("render_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapRenderJobRow(data) : null;
    },

    async createJob(job) {
      const { data, error } = await client
        .from("render_jobs")
        .insert(mapRenderJobPayload(job))
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapRenderJobRow(data);
    },

    async updateJob(jobId, nextJob) {
      const { data, error } = await client
        .from("render_jobs")
        .update(mapRenderJobPayload(nextJob))
        .eq("id", jobId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapRenderJobRow(data);
    },
  };
}

module.exports = {
  createSupabaseRenderJobsStore,
};

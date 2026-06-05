const {
  readProjects,
  createProject,
  updateProject,
  deleteProject,
} = require("./store");
const { createSupabaseAdminClient } = require("@cosyl/shared/db/supabase");
const { createSupabaseProjectsStore } = require("./supabase-store");

function createFileProjectsStore() {
  return {
    async listProjects() {
      const projects = await readProjects();
      return [...projects].sort((a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
      );
    },

    async getProject(projectId) {
      const projects = await readProjects();
      return projects.find((p) => p.id === projectId) ?? null;
    },

    // Atomic mutations — all run inside the store's write mutex.
    createProject,
    updateProject,
    deleteProject,
  };
}

function createProjectsRepository() {
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    return createSupabaseProjectsStore(supabaseClient);
  }

  return createFileProjectsStore();
}

module.exports = { createProjectsRepository };

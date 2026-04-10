const { readProjects, writeProjects } = require("./store");
const { createSupabaseAdminClient } = require("../../../../libs/db/supabase");
const { createSupabaseProjectsStore } = require("./supabase-store");

function createFileProjectsStore() {
  return {
    async listProjects() {
      const projects = await readProjects();
      return [...projects].sort((left, right) => {
        return new Date(right.updatedAt || right.createdAt).getTime() - new Date(left.updatedAt || left.createdAt).getTime();
      });
    },

    async getProject(projectId) {
      const projects = await readProjects();
      return projects.find((item) => item.id === projectId) ?? null;
    },

    async createProject(project) {
      const projects = await readProjects();
      projects.push(project);
      await writeProjects(projects);
      return project;
    },

    async updateProject(projectId, nextProject) {
      const projects = await readProjects();
      const projectIndex = projects.findIndex((item) => item.id === projectId);

      if (projectIndex === -1) {
        return null;
      }

      projects[projectIndex] = nextProject;
      await writeProjects(projects);
      return nextProject;
    },

    async deleteProject(projectId) {
      const projects = await readProjects();
      const remainingProjects = projects.filter((item) => item.id !== projectId);

      if (remainingProjects.length === projects.length) {
        return false;
      }

      await writeProjects(remainingProjects);
      return true;
    },
  };
}

function createProjectsRepository() {
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    return createSupabaseProjectsStore(supabaseClient);
  }

  return createFileProjectsStore();
}

module.exports = {
  createProjectsRepository,
};

function mapProjectRow(row) {
  return {
    id: row.id,
    title: row.title,
    goal: row.goal,
    type: row.type,
    status: row.status,
    templateId: row.template_id,
    templateSnapshot: row.template_id ? row.template_snapshot : null,
    review: row.review,
    references: row.references,
    scriptLinkedReferences: row.script_linked_references,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    script: row.script,
    audio: row.audio,
    captions: row.captions,
    assembly: row.assembly,
    scenes: row.scenes,
    sceneProduction: row.scene_production,
    settings: row.settings,
  };
}

function mapProjectPayload(project) {
  return {
    id: project.id,
    title: project.title,
    goal: project.goal,
    type: project.type,
    status: project.status,
    template_id: project.templateId,
    template_snapshot: project.templateSnapshot || {},
    review: project.review || {},
    references: project.references || [],
    script_linked_references: project.scriptLinkedReferences || [],
    created_at: project.createdAt,
    updated_at: project.updatedAt,
    script: project.script,
    audio: project.audio,
    captions: project.captions,
    assembly: project.assembly,
    scenes: project.scenes,
    scene_production: project.sceneProduction || null,
    settings: project.settings,
  };
}

function createSupabaseProjectsStore(client) {
  return {
    async listProjects() {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data.map(mapProjectRow);
    },

    async getProject(projectId) {
      const { data, error } = await client
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapProjectRow(data) : null;
    },

    async createProject(project) {
      const { data, error } = await client
        .from("projects")
        .insert(mapProjectPayload(project))
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapProjectRow(data);
    },

    async updateProject(projectId, updates) {
      const { data, error } = await client
        .from("projects")
        .update(mapProjectPayload(updates))
        .eq("id", projectId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapProjectRow(data);
    },

    async deleteProject(projectId) {
      const { error } = await client
        .from("projects")
        .delete()
        .eq("id", projectId);

      if (error) {
        throw new Error(error.message);
      }

      return true;
    },
  };
}

module.exports = {
  createSupabaseProjectsStore,
};

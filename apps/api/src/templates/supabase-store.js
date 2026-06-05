const { DEFAULT_TEMPLATES } = require("@cosyl/config/templates");

function mapTemplateRow(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    description: row.description,
    style: row.style,
    params: row.params,
    preview: row.preview,
    defaults: row.defaults,
    isCustom: row.is_custom,
    sourceProjectId: row.source_project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTemplatePayload(template) {
  return {
    id: template.id,
    title: template.title,
    type: template.type,
    description: template.description || "",
    style: template.style || "",
    params: template.params || [],
    preview: template.preview || "empty",
    defaults: template.defaults || {},
    is_custom: !!template.isCustom,
    source_project_id: template.sourceProjectId || null,
  };
}

function createSupabaseTemplatesStore(client) {
  return {
    async listTemplates() {
      const { data, error } = await client
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      // First run on a fresh Supabase project: seed the built-in templates so the
      // library is never empty (the file store seeds these locally; Supabase does not).
      if (!data || data.length === 0) {
        const seeded = await this.seedDefaults();
        if (seeded.length > 0) return seeded;
      }

      return (data || []).map(mapTemplateRow);
    },

    async seedDefaults() {
      const rows = DEFAULT_TEMPLATES.map(mapTemplatePayload);
      const { data, error } = await client
        .from("templates")
        .upsert(rows, { onConflict: "id" })
        .select("*");

      if (error) {
        // Seeding is best-effort — never block listing on a seed failure.
        return [];
      }
      return (data || []).map(mapTemplateRow);
    },

    async getTemplate(templateId) {
      const { data, error } = await client
        .from("templates")
        .select("*")
        .eq("id", templateId)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data ? mapTemplateRow(data) : null;
    },

    async createTemplate(template) {
      const { data, error } = await client
        .from("templates")
        .insert(mapTemplatePayload(template))
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapTemplateRow(data);
    },

    async updateTemplate(templateId, updates) {
      const { data, error } = await client
        .from("templates")
        .update(mapTemplatePayload(updates))
        .eq("id", templateId)
        .select("*")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return mapTemplateRow(data);
    },

    async deleteTemplate(templateId) {
      const { error } = await client
        .from("templates")
        .delete()
        .eq("id", templateId);

      if (error) {
        throw new Error(error.message);
      }
      return true;
    },
  };
}

module.exports = {
  createSupabaseTemplatesStore,
};

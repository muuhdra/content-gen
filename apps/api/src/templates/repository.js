const { readTemplates, writeTemplates } = require("./store");
const { createSupabaseAdminClient } = require("@cosyl/shared/db/supabase");
const { createSupabaseTemplatesStore } = require("./supabase-store");

function createFileTemplatesStore() {
  return {
    async listTemplates() {
      return await readTemplates();
    },

    async getTemplate(templateId) {
      const templates = await readTemplates();
      return templates.find((item) => item.id === templateId) ?? null;
    },

    async createTemplate(template) {
      const templates = await readTemplates();
      templates.push(template);
      await writeTemplates(templates);
      return template;
    },

    async updateTemplate(templateId, nextTemplate) {
      const templates = await readTemplates();
      const index = templates.findIndex((item) => item.id === templateId);

      if (index === -1) {
        return null;
      }

      templates[index] = nextTemplate;
      await writeTemplates(templates);
      return nextTemplate;
    },

    async deleteTemplate(templateId) {
      const templates = await readTemplates();
      const filtered = templates.filter((item) => item.id !== templateId);

      if (filtered.length === templates.length) {
        return false;
      }

      await writeTemplates(filtered);
      return true;
    },
  };
}

function createTemplatesRepository() {
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    return createSupabaseTemplatesStore(supabaseClient);
  }

  return createFileTemplatesStore();
}

module.exports = {
  createTemplatesRepository,
};

/**
 * Repository for voice clone metadata.
 * Templates policy: Supabase when configured, local file otherwise.
 */
const { createSupabaseAdminClient } = require("@cosyl/shared/db/supabase");
const fileStore = require("./store");
const { createSupabaseVoiceClonesStore } = require("./supabase-store");

function createVoiceClonesRepository() {
  const supabaseClient = createSupabaseAdminClient();
  if (supabaseClient) {
    return createSupabaseVoiceClonesStore(supabaseClient);
  }

  // File-based fallback: adapt to the same interface as the Supabase store.
  return {
    async readClones() {
      return fileStore.readClones();
    },
    async upsertClone(clone) {
      const clones = await fileStore.readClones();
      const next = clones.filter((c) => c.id !== clone.id);
      const saved = { ...clone, createdAt: clone.createdAt || new Date().toISOString() };
      next.unshift(saved);
      await fileStore.writeClones(next);
      return saved;
    },
    async deleteClone(id) {
      const clones = await fileStore.readClones();
      await fileStore.writeClones(clones.filter((c) => c.id !== id));
    },
  };
}

module.exports = { createVoiceClonesRepository };

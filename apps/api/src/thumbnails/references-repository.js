/**
 * Repository for the Thumbnail Studio reference library.
 *
 * Thumbnail references are TEMPLATES, so they live in Supabase when it is
 * configured (same policy as content templates), and fall back to the local
 * JSON file store for offline / local-only development.
 */
const { createSupabaseAdminClient } = require("@cosyl/shared/db/supabase");
const fileStore = require("./references-store");
const { createSupabaseReferencesStore } = require("./references-supabase-store");

function createReferencesRepository() {
  const supabaseClient = createSupabaseAdminClient();

  if (supabaseClient) {
    return createSupabaseReferencesStore(supabaseClient);
  }

  return {
    readLibrary: fileStore.readLibrary,
    writeLibrary: fileStore.writeLibrary,
  };
}

module.exports = { createReferencesRepository };

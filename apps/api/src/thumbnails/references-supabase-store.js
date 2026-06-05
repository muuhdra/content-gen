/**
 * Supabase-backed store for the Thumbnail Studio reference library.
 *
 * The library is a single document ({ categories, references }) stored as one
 * JSONB row in `thumbnail_reference_library` (id = 'default'). This mirrors the
 * whole-document GET/PUT contract used by the file store, so the repository can
 * swap between the two transparently.
 */
const { sanitizeLibrary } = require("./references-store");

const TABLE = "thumbnail_reference_library";
const ROW_ID = "default";

function createSupabaseReferencesStore(client) {
  return {
    // Returns null when the library has never been saved (lets the route seed it).
    async readLibrary() {
      const { data, error } = await client
        .from(TABLE)
        .select("data")
        .eq("id", ROW_ID)
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        return null;
      }

      return sanitizeLibrary(data.data || {});
    },

    async writeLibrary(library) {
      const clean = sanitizeLibrary(library);

      const { data, error } = await client
        .from(TABLE)
        .upsert({ id: ROW_ID, data: clean, updated_at: new Date().toISOString() })
        .select("data")
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return sanitizeLibrary(data.data || {});
    },
  };
}

module.exports = { createSupabaseReferencesStore };

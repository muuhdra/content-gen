/**
 * Supabase-backed store for voice clone metadata.
 * Table: voice_clones { id text PK, name text, source_label text, created_at timestamptz }
 */
function createSupabaseVoiceClonesStore(client) {
  return {
    async readClones() {
      const { data, error } = await client
        .from("voice_clones")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data.map((r) => ({
        id: r.id,
        name: r.name,
        sourceLabel: r.source_label,
        createdAt: r.created_at,
      }));
    },

    async upsertClone(clone) {
      const { data, error } = await client
        .from("voice_clones")
        .upsert({ id: clone.id, name: clone.name, source_label: clone.sourceLabel || "" })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { id: data.id, name: data.name, sourceLabel: data.source_label, createdAt: data.created_at };
    },

    async deleteClone(id) {
      const { error } = await client.from("voice_clones").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

module.exports = { createSupabaseVoiceClonesStore };

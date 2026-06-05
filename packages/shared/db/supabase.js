let cachedFactory = null;

function loadSupabaseFactory() {
  if (cachedFactory !== null) {
    return cachedFactory;
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    cachedFactory = createClient;
    return cachedFactory;
  } catch {
    cachedFactory = undefined;
    return cachedFactory;
  }
}

function createSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const createClient = loadSupabaseFactory();

  if (!supabaseUrl || !serviceRoleKey || !createClient) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

module.exports = {
  createSupabaseAdminClient,
};

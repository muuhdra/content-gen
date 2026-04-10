# Supabase Bootstrap

1. Create a Supabase project.
2. Copy `.env.example` into your local env file and fill:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Run the SQL in [`schema.sql`](./schema.sql) inside the Supabase SQL editor.
4. Install workspace dependencies so `@supabase/supabase-js` is available.

Current behavior:
- If Supabase env vars are configured in `apps/api`, the project CRUD uses Supabase.
- If they are missing, the API falls back to `apps/api/data/projects.json`.

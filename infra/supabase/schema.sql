create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.projects (
  id text primary key,
  title text not null,
  goal text not null default '',
  type text not null,
  status text not null default 'Draft',
  template_id text,
  template_snapshot jsonb not null default '{}'::jsonb,
  review jsonb not null default '{}'::jsonb,
  "references" jsonb not null default '[]'::jsonb,
  script_linked_references jsonb not null default '[]'::jsonb,
  script jsonb not null default '{}'::jsonb,
  audio jsonb not null default '{}'::jsonb,
  captions jsonb not null default '{}'::jsonb,
  assembly jsonb not null default '{}'::jsonb,
  scenes jsonb not null default '[]'::jsonb,
  scene_production jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects
add column if not exists assembly jsonb not null default '{}'::jsonb;

alter table public.projects
add column if not exists captions jsonb not null default '{}'::jsonb;

alter table public.projects
add column if not exists template_id text;

alter table public.projects
add column if not exists template_snapshot jsonb not null default '{}'::jsonb;

alter table public.projects
add column if not exists review jsonb not null default '{}'::jsonb;

alter table public.projects
add column if not exists "references" jsonb not null default '[]'::jsonb;

alter table public.projects
add column if not exists script_linked_references jsonb not null default '[]'::jsonb;

alter table public.projects
add column if not exists scene_production jsonb;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  kind text not null,
  name text not null,
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id text primary key,
  title text not null,
  type text not null,
  description text not null default '',
  style text not null default '',
  params jsonb not null default '[]'::jsonb,
  preview text not null default 'empty',
  defaults jsonb not null default '{}'::jsonb,
  is_custom boolean not null default false,
  source_project_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists templates_set_updated_at on public.templates;
create trigger templates_set_updated_at
before update on public.templates
for each row
execute function public.set_updated_at();

-- Thumbnail Studio reference library (templates): a single JSONB document
-- holding { categories, references }. Generated thumbnails themselves stay local.
create table if not exists public.thumbnail_reference_library (
  id text primary key default 'default',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists thumbnail_reference_library_set_updated_at on public.thumbnail_reference_library;
create trigger thumbnail_reference_library_set_updated_at
before update on public.thumbnail_reference_library
for each row
execute function public.set_updated_at();

create table if not exists public.render_jobs (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  status text not null default 'queued',
  step text not null default 'generate_script',
  progress integer not null default 0,
  attempts integer not null default 1,
  retry_of text,
  payload jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.render_jobs
add column if not exists progress integer not null default 0;

alter table public.render_jobs
add column if not exists attempts integer not null default 1;

alter table public.render_jobs
add column if not exists retry_of text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'render_jobs'
      and column_name = 'id'
      and data_type = 'uuid'
  ) then
    alter table public.render_jobs drop constraint if exists render_jobs_pkey;
    alter table public.render_jobs alter column id type text using id::text;
    alter table public.render_jobs add primary key (id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'render_jobs_retry_of_fkey'
  ) then
    alter table public.render_jobs
    add constraint render_jobs_retry_of_fkey
    foreign key (retry_of) references public.render_jobs(id)
    on delete set null;
  end if;
end;
$$;

drop trigger if exists render_jobs_set_updated_at on public.render_jobs;
create trigger render_jobs_set_updated_at
before update on public.render_jobs
for each row
execute function public.set_updated_at();

create index if not exists idx_projects_updated_at on public.projects(updated_at desc);
create index if not exists idx_project_assets_project_id on public.project_assets(project_id);
create index if not exists idx_render_jobs_project_id on public.render_jobs(project_id);
create index if not exists idx_render_jobs_created_at on public.render_jobs(created_at desc);

insert into storage.buckets (id, name, public)
values
  ('project-assets', 'project-assets', false),
  ('render-outputs', 'render-outputs', false),
  ('voice-samples', 'voice-samples', false)
on conflict (id) do nothing;

-- Activer RLS pour satisfaire les warnings Supabase (Usage interne / Autoriser tout)
alter table public.projects enable row level security;
drop policy if exists "Allow all access on projects" on public.projects;
create policy "Allow all access on projects" on public.projects for all using (true);

alter table public.project_assets enable row level security;
drop policy if exists "Allow all access on project_assets" on public.project_assets;
create policy "Allow all access on project_assets" on public.project_assets for all using (true);

alter table public.templates enable row level security;
drop policy if exists "Allow all access on templates" on public.templates;
create policy "Allow all access on templates" on public.templates for all using (true);

alter table public.render_jobs enable row level security;
drop policy if exists "Allow all access on render_jobs" on public.render_jobs;
create policy "Allow all access on render_jobs" on public.render_jobs for all using (true);

alter table public.thumbnail_reference_library enable row level security;
drop policy if exists "Allow all access on thumbnail_reference_library" on public.thumbnail_reference_library;
create policy "Allow all access on thumbnail_reference_library" on public.thumbnail_reference_library for all using (true);

-- Voice clones metadata (Editor Lab). Actual model IDs stored, not audio files.
create table if not exists public.voice_clones (
  id text primary key,
  name text not null,
  source_label text not null default '',
  created_at timestamptz not null default now()
);

alter table public.voice_clones enable row level security;
drop policy if exists "Allow all access on voice_clones" on public.voice_clones;
create policy "Allow all access on voice_clones" on public.voice_clones for all using (true);

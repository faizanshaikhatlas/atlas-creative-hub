-- 0002 — projects, pages, components + composite ownership FKs + updated_at triggers
-- Composite (ref_id, owner) FKs guarantee a row can only reference another row
-- owned by the same user. The projects<->assets cycle is resolved by adding all
-- FKs after every table + its unique(id, owner) target exists.

create table public.projects (
  id             uuid primary key default gen_random_uuid(),  -- synced rows supply local UUID (D1)
  owner          uuid not null references auth.users(id) on delete cascade,
  name           text not null default 'Untitled design',
  type           text not null,
  width          integer not null check (width  between 50 and 5000),
  height         integer not null check (height between 50 and 5000),
  active_page_id uuid,                                 -- soft ref (no FK: avoids insert cycle)
  cover_asset_id uuid,                                 -- composite FK added below
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint projects_id_owner_uniq unique (id, owner)        -- composite-FK target (S1)
);
create index projects_owner_updated_idx on public.projects (owner, updated_at desc);

create table public.pages (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null,
  owner          uuid not null,                        -- = parent project's owner (FK-enforced)
  position       integer not null,
  name           text not null default 'Page',
  background     text not null default '#ffffff',
  width          integer not null check (width  between 50 and 5000),
  height         integer not null check (height between 50 and 5000),
  doc            jsonb not null default '{}'::jsonb,   -- Fabric JSON, images -> asset refs
  thumb_asset_id uuid,                                 -- composite FK added below
  updated_at     timestamptz not null default now(),
  constraint pages_project_position_uniq
    unique (project_id, position) deferrable initially deferred   -- safe reorder
);
create index pages_project_idx on public.pages (project_id, position);
create index pages_owner_idx   on public.pages (owner);

create table public.components (
  id             uuid primary key default gen_random_uuid(),
  owner          uuid not null references auth.users(id) on delete cascade,
  name           text not null default 'Component',
  doc            jsonb not null default '[]'::jsonb,
  thumb_asset_id uuid,                                 -- composite FK added below
  created_at     timestamptz not null default now()
);
create index components_owner_idx on public.components (owner, created_at desc);

-- composite ownership FKs (added after all tables + unique(id,owner) targets exist).
-- column-list SET NULL (col) nulls only the ref column, never the NOT NULL owner.
alter table public.assets
  add constraint assets_project_fk
  foreign key (project_id, owner) references public.projects (id, owner)
  on delete set null (project_id);

alter table public.projects
  add constraint projects_cover_asset_fk
  foreign key (cover_asset_id, owner) references public.assets (id, owner)
  on delete set null (cover_asset_id);

alter table public.pages
  add constraint pages_project_fk
  foreign key (project_id, owner) references public.projects (id, owner)
  on delete cascade;                                   -- delete project -> delete its pages

alter table public.pages
  add constraint pages_thumb_asset_fk
  foreign key (thumb_asset_id, owner) references public.assets (id, owner)
  on delete set null (thumb_asset_id);

alter table public.components
  add constraint components_thumb_asset_fk
  foreign key (thumb_asset_id, owner) references public.assets (id, owner)
  on delete set null (thumb_asset_id);

-- DB-managed updated_at on the two tables that have the column
create trigger projects_set_updated_at before update on public.projects
  for each row execute function extensions.moddatetime('updated_at');
create trigger pages_set_updated_at before update on public.pages
  for each row execute function extensions.moddatetime('updated_at');

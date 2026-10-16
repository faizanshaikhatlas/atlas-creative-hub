# Supabase Architecture Proposal — ATLAS Creative Hub

> **Status: PROPOSAL / EVALUATION ONLY. Not implemented.**
> No SQL has been run; no tables, buckets, policies, or migrations exist yet.
> The connected project (`baswqkhufaoshsxbicct`) is **empty** and runs
> **PostgreSQL 17.11** (verified read-only).
>
> **Prime directive:** the editor stays **local-first on Dexie/IndexedDB**.
> Supabase is an *optional, additive* cloud layer for backup + cross-device
> sync. Dexie remains the source of truth and offline cache; **no existing
> local design is ever moved, rewritten, or deleted** by adopting this plan.

## Security-review changelog (second pass)

Verified against the live project and corrected:

- **S1 — Ownership-consistent references.** All asset/project references
  (`projects.cover_asset_id`, `pages.thumb_asset_id`, `components.thumb_asset_id`,
  `assets.project_id`) are now enforced with **composite foreign keys that
  include `owner`**, so a user physically cannot link another user's asset or
  project to their own row. Requires a denormalized `owner` on `pages` and
  `unique (id, owner)` targets. (§1, §2)
- **S2 — `anon`/`authenticated` privileges.** **Verified:** this project's
  `public`-schema default privileges grant **`anon` and `authenticated` ALL
  table privileges** (`arwdDxtm`) automatically. RLS alone would be the only
  guard. Added explicit **`REVOKE ALL FROM anon`** and a **narrowed `GRANT` to
  `authenticated`** as defense-in-depth. (§3a + access matrix)
- **S3 — Storage policy naming.** **Verified:** no policies currently exist on
  `storage.objects`, so there is no collision today. Policy names are namespaced
  (`designs_own_*`) to avoid future clashes and keep re-application controlled. (§4)
- **S4 — FK delete / orphans.** Switched to **column-list `ON DELETE SET NULL
  (col)`** (PG17) so nulling an asset reference never violates `owner NOT NULL`.
  Documented that **Storage objects are not deleted by DB cascades** and how to
  reclaim them. (§4, §8)
- **S5 — `moddatetime`.** **Verified:** the extension is available but **not yet
  installed** (the function does not exist). Migration installs it `with schema
  extensions` and triggers call `extensions.moddatetime('updated_at')`. Also
  **verified that `authenticated` holds `USAGE` on the `extensions` schema and
  `EXECUTE` on its functions**, so the trigger (which runs as the invoking user,
  not `SECURITY DEFINER`) executes successfully on an authenticated `UPDATE`. (§2, §8)
- **S6 — Ordering / atomicity.** Each migration is a single transaction (all DDL
  here is transactional); the composite-FK cycle is resolved by adding FKs after
  both tables exist. Explicit down scripts included. (§8)
- **S7 — Metadata cannot bypass Storage auth.** `storage.objects` RLS re-checks
  the real object-path prefix at read/sign time, and the `assets` insert policy
  pins `storage_path` to the caller's own prefix. Signing must use the
  user-scoped client, never `service_role`. (§4, §7)

---

## 0. What we are mapping from (current local architecture)

Confirmed by reading `lib/db/projects.js` and `lib/fabric/canvasController.js`:

- **Dexie database `design-studio`, schema v3.** Stores + indexes:
  - `projects` → `"id, name, type, updatedAt"` (PK = `id`)
  - `components` → `"id, name, createdAt"` (PK = `id`)
- **Record shapes (embedded document model):**
  ```
  project   = { id, name, type, width, height, thumbnail,
                activePageId, pages[], createdAt, updatedAt }
  page      = { id, name, json, thumbnail, background, width, height }  // embedded in project.pages[]
  component = { id, name, objects[], thumbnail, createdAt }
  ```
  - `page.json` = serialized Fabric document (`canvas.toJSON()`).
  - `component.objects[]` = array of serialized Fabric objects.
- **IDs are already client-generated UUIDs** (`crypto.randomUUID()`).
- **Images are embedded as base64 data URLs** inside `page.json` and component
  `objects[]`. Extracting these to Storage is the core cloud change.
- **Timestamps are epoch-ms integers** (`Date.now()`); the sync layer converts
  to `timestamptz`.
- **No auth, no network persistence today** — fully offline/local.

### Assumption A1 — single-tenant personal workspace (approved)
One account per person, multiple devices. RLS = "you may only touch your own
rows." Kept **flexible for future team sharing** (a `project_members` join
table + membership policies could be layered on later) but **no team features
are built now**.

---

## 1. PostgreSQL tables & relationships

```
auth.users (managed by Supabase Auth)
   │ 1
   ├──* projects      one row per design document   (owner)
   ├──* components     reusable components           (owner)
   └──* assets         Storage binary metadata        (owner)
            ▲
   projects │ 1
            └──* pages  ordered pages                 (owner, project_id)
```

Decisions (approved): **D1** reuse local UUID as PK; **D2** normalized `pages`;
**D3** private bucket + signed URLs; **D4** DB-managed `updated_at`; **D5**
page-level LWW + prompt.

**S1 ownership spine:** every table carries `owner uuid` (pages too — see §2),
and **all** cross-row references are composite `(ref_id, owner)` FKs, so a row
can only reference another row **owned by the same user**.

---

## 2. Columns, types, keys, timestamps, indexes

Illustrative DDL (NOT executed).

```sql
-- assets: metadata for binaries stored in the 'designs' bucket
public.assets (
  id           uuid pk default gen_random_uuid(),
  owner        uuid not null -> auth.users(id) on delete cascade,
  project_id   uuid,                      -- composite FK -> projects(id,owner), added in §2 cycle
  storage_path text not null,             -- '{owner}/...'  (pinned by RLS, §3a)
  mime text, width int, height int, bytes int,
  sha256 text not null,
  created_at   timestamptz not null default now(),
  unique (owner, sha256),                 -- per-user dedupe
  unique (id, owner)                      -- composite-FK target (S1)
);

-- projects
public.projects (
  id             uuid pk default gen_random_uuid(),   -- synced rows supply local UUID (D1)
  owner          uuid not null -> auth.users(id) on delete cascade,
  name           text not null default 'Untitled design',
  type           text not null,
  width  int not null check (width  between 50 and 5000),
  height int not null check (height between 50 and 5000),
  active_page_id uuid,                     -- soft ref (no FK: avoids insert cycle)
  cover_asset_id uuid,                     -- composite FK -> assets(id,owner)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner)                       -- composite-FK target (S1)
);

-- pages  (S1: denormalized owner enables direct RLS + composite FKs)
public.pages (
  id             uuid pk default gen_random_uuid(),
  project_id     uuid not null,
  owner          uuid not null,            -- = parent project's owner (enforced by composite FK)
  position       int  not null,
  name text not null default 'Page',
  background text not null default '#ffffff',
  width  int not null check (width  between 50 and 5000),
  height int not null check (height between 50 and 5000),
  doc            jsonb not null default '{}'::jsonb,  -- Fabric JSON, images -> asset refs
  thumb_asset_id uuid,                     -- composite FK -> assets(id,owner)
  updated_at timestamptz not null default now(),
  unique (project_id, position) deferrable initially deferred  -- safe reorder
);

-- components
public.components (
  id             uuid pk default gen_random_uuid(),
  owner          uuid not null -> auth.users(id) on delete cascade,
  name text not null default 'Component',
  doc            jsonb not null default '[]'::jsonb,
  thumb_asset_id uuid,                     -- composite FK -> assets(id,owner)
  created_at timestamptz not null default now()
);
```

Indexes: `projects(owner, updated_at desc)`, `pages(project_id, position)`,
`pages(owner)`, `components(owner, created_at desc)`, `assets(owner)`.

**Composite-FK cycle (S1 + S6):** `projects.cover_asset_id → assets` and
`assets.project_id → projects` form a cycle, so **both** composite FKs (and the
`pages`/`components` ones) are added by `ALTER TABLE` **after** all tables and
their `unique (id, owner)` targets exist. Full SQL in §8.

**`updated_at` (D4/S5):** `extensions.moddatetime` trigger on the two tables that
have the column (`projects`, `pages`); `components`/`assets` are insert-only
(`created_at`).

---

## 3. Access control

### 3a. Table privileges & the access matrix (S2 — verified)

**Finding:** `pg_default_acl` on `public` grants `anon=arwdDxtm` and
`authenticated=arwdDxtm` on every new table. So any new table is, at the
privilege level, fully open to the anon key; only RLS restricts rows. For a
private workspace that is too permissive — harden explicitly:

```sql
revoke all on public.projects, public.pages, public.components, public.assets from anon;
grant select, insert, update, delete
  on public.projects, public.pages, public.components, public.assets to authenticated;
-- service_role keeps default ALL (it also has BYPASSRLS) — server-side only.
```

| Role | Table privileges | Row visibility | Used by |
|------|------------------|----------------|---------|
| `anon` | **none** (revoked) | none | signed-out visitors — no cloud access |
| `authenticated` | SELECT/INSERT/UPDATE/DELETE | **own rows only** (RLS) | the signed-in app (anon key + user JWT) |
| `service_role` | ALL (default) | **all rows** (BYPASSRLS) | local/one-off scripts only, never in browser |

### 3b. Row Level Security — every user-facing table

```sql
alter table public.projects   enable row level security;
alter table public.pages      enable row level security;
alter table public.components enable row level security;
alter table public.assets     enable row level security;

-- policies scoped `to authenticated` so they never apply to anon (defense-in-depth
-- on top of the REVOKE above); service_role bypasses RLS regardless.
create policy "own projects" on public.projects
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own pages" on public.pages            -- direct owner check (S1 denormalized owner)
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

create policy "own components" on public.components
  for all to authenticated using (owner = auth.uid()) with check (owner = auth.uid());

-- assets: own rows AND storage_path pinned to the caller's prefix (S7)
create policy "own assets" on public.assets
  for all to authenticated using (owner = auth.uid())
  with check (owner = auth.uid()
              and storage_path like (auth.uid()::text || '/%'));
```

`with check` blocks forging `owner`; the composite FKs (§2) block referencing
another user's rows even if their UUID is known.

---

## 4. Private Storage bucket & object policies

- **One private bucket `designs`** (`public = false`). Keys namespaced by user:
  ```
  {user_id}/assets/{sha256}.{ext}    uploaded images (content-addressed → dedupe)
  {user_id}/thumbs/{page_id}.png     page thumbnails
  {user_id}/covers/{project_id}.png  home-grid covers
  ```
- Binaries in Storage; `assets` row holds metadata; `pages.doc`/`components.doc`
  store only `asset_id`, resolved to a **short-lived signed URL** at load time.
- **S3 — namespaced, non-colliding policy names** (verified none exist today):

  ```sql
  create policy "designs_own_select" on storage.objects for select to authenticated
    using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "designs_own_insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "designs_own_update" on storage.objects for update to authenticated
    using  (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
  create policy "designs_own_delete" on storage.objects for delete to authenticated
    using (bucket_id = 'designs' and (storage.foldername(name))[1] = auth.uid()::text);
  ```

**S4 — delete behavior & orphans (data-loss / leak review):**
- `pages (project_id, owner) → projects` is **ON DELETE CASCADE**: deleting a
  project deletes its pages (expected).
- Every asset reference uses **`ON DELETE SET NULL (col)`** (column-list, PG17)
  so deleting an asset nulls only the referencing column and never trips
  `owner NOT NULL`.
- **Storage objects are NOT removed by DB cascades.** Three cases to handle in
  the app/ops layer (not schema):
  1. Deleting an `assets` row → app must also delete its Storage object.
  2. Deleting a project → its assets survive (`project_id` set null); their
     Storage files remain (correct — may be shared via dedupe).
  3. **Account deletion** (`auth.users` cascade) wipes all DB rows but **leaves
     the user's Storage files**. Provide an Edge Function / admin script to
     purge the `{user_id}/` prefix on account deletion (privacy).
- **`pages.doc` asset references are inside JSON and are NOT FK-enforced.** The
  app must not delete an asset still referenced by any `doc` (would show a
  broken image). A reference-count check before asset deletion is recommended.

---

## 5. Authentication & ownership

- **Supabase Auth** (email magic-link or email/password; free-tier).
- `owner = auth.uid()` is the spine: stored on every row, enforced by RLS,
  mirrored in the Storage key prefix, and cross-checked by composite FKs.
- **Signed-out / local-only is first-class** — Dexie works with no auth. Auth is
  requested only to turn on cloud sync; signing out falls back to local and
  never wipes Dexie.
- Auth providers are **not** enabled by this proposal (no production change).

---

## 6. Safe optional sync (Dexie ⇄ Supabase)

(Unchanged by this review — summarized.)

- **Opt-in, additive, reversible.** Dexie authoritative locally; Supabase mirror.
- **Duplicate prevention:** client UUID == PK → every push is an upsert on `id`;
  assets dedupe on `(owner, sha256)`.
- **Retries:** durable Dexie `sync_queue` outbox; exponential backoff + jitter,
  bounded, then parked as "needs attention"; never blocks local editing. Uploads
  ordered assets → doc so a `doc` never points at a missing asset.
- **Conflicts (D5):** page-level, explicit detection via a stored base
  `updated_at`; **Keep mine / Keep theirs** prompt. **Never silently discards a
  conflicting local version.** Content-addressed assets never conflict.

---

## 7. Can metadata / page JSON bypass Storage authorization? (S7)

No — three independent gates:

1. **Storage RLS re-checks the real path.** A signed URL can only be minted for
   an object the caller passes `storage.objects` RLS for (prefix = `auth.uid()`).
   A forged `assets.storage_path` pointing at another user's prefix **cannot be
   signed or read**.
2. **`assets` insert policy pins `storage_path`** to `'{auth.uid()}/%'` (§3b),
   so a user cannot even record metadata pointing outside their prefix.
3. **`assets` RLS + composite FKs** stop a user reading or referencing another
   user's asset row, so the app can never resolve a foreign `asset_id` to a path.

**Hard rule:** URL signing and object reads use the **user-scoped client** (anon
key + session JWT). The `service_role` key is never used with user-supplied
paths (it bypasses both RLS and the pin above).

---

## 8. Migration ordering, rollback, verification

### 8.1 Ordering (dependency-correct, each file = one transaction)
1. `0001` extensions (`pgcrypto`, `moddatetime`) + `assets` (with `unique(id,owner)`).
2. `0002` `projects`, `pages`, `components` + **all composite FKs** (cycle
   resolved after tables exist) + `moddatetime` triggers.
3. `0003` privileges (REVOKE anon / GRANT authenticated) + RLS enable + policies.
4. `0004` private bucket `designs` + namespaced Storage policies.

### 8.2 Partial failure & rollback (S6)
- All statements here are transactional DDL, so a failure **inside** a migration
  rolls that migration back entirely (no half-applied schema). No `CONCURRENTLY`
  / non-transactional statements are used.
- Across migrations, if a later file fails after earlier ones committed, run the
  paired **down** scripts in reverse (drop policies → bucket → policies/RLS →
  triggers → FKs → tables → extensions).
- **Rollback is cloud-only.** Dexie/local designs are never in a migration, so a
  full teardown leaves the app working exactly as today.
- ⚠️ **The rollback scripts are UNTESTED.** Nothing in this plan has been
  executed. Before touching production, apply the up **and** down migrations on a
  **Supabase branch or a disposable project** and confirm a clean teardown
  (no leftover tables/policies/bucket). Only a rollback that has actually been
  run on a branch may be called "tested"; until then, treat it as unverified.

### 8.3 Verification tests (before wiring the UI)
- `list_tables` / `list_migrations` show 4 tables + applied migrations; FKs,
  composite `(id,owner)` uniques, and the deferrable page-position unique exist.
- `get_advisors(security)` and `(performance)` → no RLS-disabled / unindexed-FK
  lints.
- **Privilege matrix:** `anon` has no table privileges; `authenticated` has DML.
- **RLS cross-user:** user B cannot read/insert/forge user A's rows.
- **S1 composite FK:** inserting a project whose `cover_asset_id` is user B's
  asset **fails** (FK violation), as does a page whose `project_id` is B's.
- **Storage:** A can sign/read `A/...`; B cannot read `A/...`; inserting an
  `assets` row with `storage_path` outside `A/` **fails** the insert policy.
- **Idempotency:** double-push → one row per id; double asset upload → one row.
- **Round-trip:** push a design with an embedded image, pull into a clean Dexie,
  re-open → identical render (ids, layers, lock/hide, gradient/image fills, fonts).

---

## 9. Explicitly NOT doing in this phase

- No Dexie replacement, no automatic migration, no integration/sync code.
- No SQL executed; no tables, buckets, policies, migrations, or auth providers.
- No `service_role` key in browser code; no credentials written anywhere.
- No team/sharing/real-time features (A1).

---

## 10. Public configuration values needed (no secrets printed)

In `.env.local` (now git-ignored) at implementation time:

| Variable | Where to obtain (Dashboard → project `baswqkhufaoshsxbicct`) |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL (`https://baswqkhufaoshsxbicct.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → `service_role` key — server/script only |

A tracked `.env.example` with blank placeholders is recommended.

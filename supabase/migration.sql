-- Shoe photo cleaner schema
create extension if not exists pgcrypto;

create table if not exists logos (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text,
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  original_url text not null,
  model_number text,
  price numeric(10, 2),
  logo_id uuid references logos(id) on delete set null,
  batch_id uuid not null default gen_random_uuid(),
  status text not null default 'pending' check (status in ('pending', 'processed', 'approved')),
  created_at timestamptz not null default now()
);

create index if not exists photos_batch_id_idx on photos(batch_id);
create index if not exists photos_status_idx on photos(status);

alter table logos enable row level security;
alter table photos enable row level security;

-- Internal tool: service role (server-side only) does all writes.
-- Allow anon read access for logos (dropdown) and photos (gallery/export UI).
drop policy if exists "logos_read" on logos;
create policy "logos_read" on logos for select using (true);

drop policy if exists "photos_read" on photos;
create policy "photos_read" on photos for select using (true);

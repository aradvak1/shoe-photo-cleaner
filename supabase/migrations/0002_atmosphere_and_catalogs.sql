-- Atmosphere mode metadata + catalog builder
alter table photos add column if not exists size_min smallint;
alter table photos add column if not exists size_max smallint;
alter table photos add column if not exists custom_prompt text;
alter table photos add column if not exists mode text not null default 'studio'
  check (mode in ('studio', 'atmosphere'));

alter table photos drop constraint if exists photos_size_range_chk;
alter table photos add constraint photos_size_range_chk
  check (size_min is null or size_max is null or size_min <= size_max);

create table if not exists catalogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_id text not null,
  pdf_url text,
  created_at timestamptz not null default now()
);

create table if not exists catalog_photos (
  id uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references catalogs(id) on delete cascade,
  photo_id uuid not null references photos(id) on delete cascade,
  position int not null default 0,
  unique (catalog_id, photo_id)
);

create index if not exists catalog_photos_catalog_id_idx on catalog_photos(catalog_id);
create index if not exists catalog_photos_photo_id_idx on catalog_photos(photo_id);

alter table catalogs enable row level security;
alter table catalog_photos enable row level security;

drop policy if exists "catalogs_read" on catalogs;
create policy "catalogs_read" on catalogs for select using (true);

drop policy if exists "catalog_photos_read" on catalog_photos;
create policy "catalog_photos_read" on catalog_photos for select using (true);

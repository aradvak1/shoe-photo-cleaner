-- Saved style presets (prompt + default logo + burn-text), per mode
create table if not exists presets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mode text not null check (mode in ('studio', 'atmosphere')),
  prompt text,
  logo_id uuid references logos(id) on delete set null,
  burn_text boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists presets_mode_idx on presets(mode);

alter table presets enable row level security;

drop policy if exists "presets_read" on presets;
create policy "presets_read" on presets for select using (true);

-- Catalog wizard: style selection (drives AI generation) + designed cover page.
-- All columns nullable — existing catalogs and the existing /catalog/new
-- (pick-photos -> template -> PDF) flow are unaffected.

alter table catalogs add column if not exists style_category text
  check (style_category is null or style_category in ('atmosphere', 'studio_model', 'product'));
alter table catalogs add column if not exists look_id text;
alter table catalogs add column if not exists resolved_prompt text;
alter table catalogs add column if not exists cover_title text;
alter table catalogs add column if not exists cover_subtitle text;
alter table catalogs add column if not exists cover_extra_text text;
alter table catalogs add column if not exists cover_logo_id uuid references logos(id) on delete set null;

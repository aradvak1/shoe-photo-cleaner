-- Presets can now also carry the per-row metadata fields (model/SKU/price/
-- sizes/color), matching what a CreationRow already supports, so a preset
-- can pre-fill those as defaults too, not just prompt/logo/burn-text.
alter table presets add column if not exists model_number text;
alter table presets add column if not exists sku text;
alter table presets add column if not exists price numeric(10,2);
alter table presets add column if not exists size_min smallint;
alter table presets add column if not exists size_max smallint;
alter table presets add column if not exists color text;

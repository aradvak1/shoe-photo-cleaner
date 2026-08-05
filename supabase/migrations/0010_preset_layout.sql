-- Saved presets can now also bundle the design toolbar's product-size zoom
-- and drag/resize layout overrides, so applying a preset reproduces the
-- exact same look (not just which fields + template) in one click.
alter table presets add column if not exists zoom numeric;
alter table presets add column if not exists custom_layout jsonb;

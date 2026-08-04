-- Per-photo drag-positioned/resized overrides for the logo and each text
-- field, layered on top of a template's (or the generic default's) fixed
-- fractions. Null/absent fields fall back to the base layout.
alter table photos add column if not exists custom_layout jsonb;

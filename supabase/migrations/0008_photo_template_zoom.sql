-- Records which fixed template (if any) and zoom level a saved photo was
-- burned with, so it can be edited/reprocessed later with the same
-- settings as a starting point instead of losing that context once the
-- clean pre-burn image is overwritten.
alter table photos add column if not exists template_id text;
alter table photos add column if not exists zoom numeric;

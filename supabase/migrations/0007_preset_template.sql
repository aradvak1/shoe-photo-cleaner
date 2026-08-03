-- Fixed-layout template selection per preset (e.g. a Canva-designed brand
-- layout with logo/model-number/price/sizes always at the same spot),
-- as an alternative to the auto-placement burnProductText already does.
alter table presets add column if not exists template_id text;

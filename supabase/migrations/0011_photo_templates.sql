-- User-designed fixed-layout templates (built via the new template
-- builder page), stored alongside the hand-coded built-in ones in
-- src/lib/photoTemplate.ts. Each field is nullable -- a template can
-- define only some of logo/model/price/sizes/color, matching the
-- "add one thing at a time" design flow.
create table if not exists photo_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo jsonb,
  model_number jsonb,
  price jsonb,
  sizes jsonb,
  color jsonb,
  created_at timestamptz not null default now()
);

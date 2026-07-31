-- SKU, color, and text-burned-on-image tracking
alter table photos add column if not exists sku text;
alter table photos add column if not exists color text;
alter table photos add column if not exists burned_text boolean not null default false;

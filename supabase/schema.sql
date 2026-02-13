create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function generate_public_id()
returns text as $$
  select trim(trailing '=' from replace(replace(encode(gen_random_bytes(16), 'base64'), '+', '-'), '/', '_'));
$$ language sql stable;

create table if not exists requests (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default generate_public_id(),
  service_type text not null,
  title text not null,
  description text not null,
  urgency text,
  name text not null,
  email text not null,
  phone text,
  status text not null default 'NEW',
  admin_notes text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists request_assets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  asset_url text not null,
  asset_type text,
  file_name text,
  file_size integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists estimates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references requests(id) on delete cascade,
  currency text not null default 'usd',
  subtotal_cents integer not null default 0,
  total_cents integer not null default 0,
  stripe_session_id text,
  stripe_checkout_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references estimates(id) on delete cascade,
  title text not null,
  description text,
  quantity integer not null default 1,
  unit_cents integer not null,
  total_cents integer not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  event_type text not null,
  message text,
  actor_email text,
  created_at timestamptz not null default now()
);

create table if not exists previews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests(id) on delete cascade,
  provider text,
  preview_url text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requests_status_created on requests(status, created_at desc);
create index if not exists idx_requests_public_id on requests(public_id);
create index if not exists idx_request_assets_request_id on request_assets(request_id);
create index if not exists idx_estimates_request_id on estimates(request_id);
create index if not exists idx_estimates_stripe_session_id on estimates(stripe_session_id);
create index if not exists idx_estimate_items_estimate_id on estimate_items(estimate_id);
create index if not exists idx_activity_log_request_id on activity_log(request_id);
create index if not exists idx_previews_request_id on previews(request_id);

create trigger set_requests_updated_at
before update on requests
for each row execute function set_updated_at();

create trigger set_request_assets_updated_at
before update on request_assets
for each row execute function set_updated_at();

create trigger set_estimates_updated_at
before update on estimates
for each row execute function set_updated_at();

create trigger set_estimate_items_updated_at
before update on estimate_items
for each row execute function set_updated_at();

create trigger set_previews_updated_at
before update on previews
for each row execute function set_updated_at();

create or replace view v_requests_queue as
select
  r.id,
  r.public_id,
  r.title,
  r.service_type,
  r.urgency,
  r.name,
  r.email,
  r.phone,
  r.status,
  r.created_at,
  r.updated_at,
  e.total_cents,
  e.stripe_checkout_url
from requests r
left join estimates e on e.request_id = r.id;

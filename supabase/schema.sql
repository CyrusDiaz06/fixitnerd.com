-- supabase/schema.sql
-- FixItNerd: Requests → Estimates → Payments → Kanban Queue

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_public_id()
returns text
language sql
as $$
  select replace(encode(gen_random_bytes(16), 'base64'), '/', '_');
$$;

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null default public.generate_public_id(),

  service_type text not null check (service_type in ('3d_printing','it_support','tutoring','dev')),
  title text not null,
  description text not null,
  urgency text not null default 'normal' check (urgency in ('normal','rush')),

  name text not null,
  email text not null,
  phone text,
  contact_method text default 'email' check (contact_method in ('email','phone')),
  location text,
  budget text,

  status text not null default 'NEW' check (
    status in ('NEW','NEEDS_ESTIMATE','SENT_TO_CUSTOMER','APPROVED','PAID','IN_PROGRESS','COMPLETED','ARCHIVED')
  ),

  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_requests_status on public.requests(status);
create index if not exists idx_requests_service_type on public.requests(service_type);
create index if not exists idx_requests_created_at on public.requests(created_at desc);
create index if not exists idx_requests_public_id on public.requests(public_id);

create trigger trg_requests_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

create table if not exists public.request_assets (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,

  asset_type text not null check (asset_type in ('link','image','stl','other')),
  url text not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_assets_request_id on public.request_assets(request_id);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid unique not null references public.requests(id) on delete cascade,

  currency text not null default 'usd',
  subtotal_cents integer not null default 0 check (subtotal_cents >= 0),
  total_cents integer not null default 0 check (total_cents >= 0),

  stripe_checkout_url text,
  stripe_session_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_estimates_request_id on public.estimates(request_id);
create index if not exists idx_estimates_stripe_session_id on public.estimates(stripe_session_id);

create trigger trg_estimates_updated_at
before update on public.estimates
for each row execute function public.set_updated_at();

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,

  description text not null,
  qty numeric not null default 1 check (qty > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  line_total_cents integer not null default 0 check (line_total_cents >= 0)
);

create index if not exists idx_estimate_items_estimate_id on public.estimate_items(estimate_id);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,

  event_type text not null,
  message text not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_activity_request_id on public.activity_log(request_id);
create index if not exists idx_activity_created_at on public.activity_log(created_at desc);

create table if not exists public.previews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete cascade,

  option_label text not null check (option_label in ('A','B','C')),
  image_url text,
  prompt text,

  created_at timestamptz not null default now()
);

create index if not exists idx_previews_request_id on public.previews(request_id);

create or replace view public.v_requests_queue as
select
  r.id,
  r.public_id,
  r.service_type,
  r.title,
  r.urgency,
  r.name,
  r.email,
  r.status,
  r.created_at,
  r.updated_at
from public.requests r;

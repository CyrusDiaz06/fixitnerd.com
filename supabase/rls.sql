alter table requests enable row level security;
alter table request_assets enable row level security;
alter table estimates enable row level security;
alter table estimate_items enable row level security;
alter table activity_log enable row level security;
alter table previews enable row level security;

drop policy if exists "public" on requests;
drop policy if exists "public" on request_assets;
drop policy if exists "public" on estimates;
drop policy if exists "public" on estimate_items;
drop policy if exists "public" on activity_log;
drop policy if exists "public" on previews;

-- No policies are defined. All access should go through Netlify Functions with service role.

-- supabase/rls.sql
alter table public.requests enable row level security;
alter table public.request_assets enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;
alter table public.activity_log enable row level security;
alter table public.previews enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('requests','request_assets','estimates','estimate_items','activity_log','previews')
  loop
    execute format('drop policy if exists %I on public.%I;', pol.policyname, pol.tablename);
  end loop;
end
$$;

-- No policies created = no direct anon/auth access. All access via Netlify Functions using service role key.

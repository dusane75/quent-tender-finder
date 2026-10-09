-- Tender Finder database
-- Every business only sees its own data (row level security).

create extension if not exists pg_trgm;

-- Private settings (never readable from the browser)
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
-- no policies: only security-definer functions can read it

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from app_config
    where key = 'admin_emails'
      and lower(coalesce(auth.jwt()->>'email','')) = any (string_to_array(lower(replace(value,' ','')), ','))
  );
$$;

-- Business profile
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  business_name text not null,
  owner_name text,
  phone text,
  address text,
  districts text[] not null default '{Nashik}',
  keywords text[] not null default '{}',
  min_value numeric default 0,
  max_value numeric,
  language text not null default 'mr' check (language in ('mr','hi','en')),
  business_type text,
  years_experience int,
  annual_turnover numeric,
  past_works text,
  registrations text,
  documents_held text[] not null default '{}',
  gstin text,
  pan text,
  udyam text,
  email_alerts boolean not null default true,
  consent_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default now() + interval '30 days',
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile select" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile delete" on public.profiles;
create policy "own profile select" on public.profiles for select using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert with check (id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own profile delete" on public.profiles for delete using (id = auth.uid());

-- Tenders (public library + private uploads)
create table if not exists public.tenders (
  id uuid primary key default gen_random_uuid(),
  is_public boolean not null default false,
  source text not null default 'upload',
  created_by uuid references auth.users(id) on delete set null,
  title text not null,
  organisation text,
  location text,
  district text,
  tender_ref text,
  url text,
  value numeric,
  emd numeric,
  fee numeric,
  published_on date,
  closing_at timestamptz,
  work_description text,
  eligibility jsonb not null default '[]',
  documents jsonb not null default '[]',
  keywords text[] not null default '{}',
  raw_text text,
  file_path text,
  created_at timestamptz not null default now()
);
create index if not exists tenders_closing_idx on public.tenders (closing_at);
alter table public.tenders enable row level security;
drop policy if exists "see public or own tenders" on public.tenders;
drop policy if exists "add own tenders" on public.tenders;
drop policy if exists "edit own tenders" on public.tenders;
drop policy if exists "delete own tenders" on public.tenders;
create policy "see public or own tenders" on public.tenders for select
  using (is_public or created_by = auth.uid());
create policy "add own tenders" on public.tenders for insert
  with check (created_by = auth.uid() and (is_public = false or public.is_admin()));
create policy "edit own tenders" on public.tenders for update
  using (created_by = auth.uid() or (is_public and public.is_admin()));
create policy "delete own tenders" on public.tenders for delete
  using (created_by = auth.uid() or (is_public and public.is_admin()));

-- Cached AI summaries per language
create table if not exists public.tender_summaries (
  tender_id uuid references public.tenders(id) on delete cascade,
  language text not null,
  summary jsonb not null,
  created_at timestamptz not null default now(),
  primary key (tender_id, language)
);
alter table public.tender_summaries enable row level security;
drop policy if exists "see summaries of visible tenders" on public.tender_summaries;
drop policy if exists "add summaries of visible tenders" on public.tender_summaries;
create policy "see summaries of visible tenders" on public.tender_summaries for select
  using (exists (select 1 from public.tenders t where t.id = tender_id and (t.is_public or t.created_by = auth.uid())));
create policy "add summaries of visible tenders" on public.tender_summaries for insert
  with check (exists (select 1 from public.tenders t where t.id = tender_id and (t.is_public or t.created_by = auth.uid())));

-- Each business's relationship with a tender
create table if not exists public.user_tenders (
  user_id uuid references auth.users(id) on delete cascade,
  tender_id uuid references public.tenders(id) on delete cascade,
  status text not null default 'matched'
    check (status in ('matched','saved','applied','won','lost','dismissed')),
  match_reason text,
  eligibility jsonb,
  bid_pack jsonb,
  notes text,
  reminders_sent int[] not null default '{}',
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tender_id)
);
alter table public.user_tenders enable row level security;
drop policy if exists "own tracking" on public.user_tenders;
create policy "own tracking" on public.user_tenders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Matching: does a tender fit a business?
create or replace function public.tender_matches(p public.profiles, t public.tenders)
returns text language plpgsql stable as $$
declare k text; hit text := null;
begin
  if t.closing_at is not null and t.closing_at < now() then return null; end if;
  if t.district is not null and not ('Any' = any(p.districts))
     and not exists (select 1 from unnest(p.districts) d where lower(d) = lower(t.district)) then
    return null;
  end if;
  if t.value is not null then
    if p.min_value is not null and t.value < p.min_value then return null; end if;
    if p.max_value is not null and t.value > p.max_value then return null; end if;
  end if;
  foreach k in array p.keywords loop
    if length(trim(k)) > 1 and (
         t.title ilike '%' || trim(k) || '%'
      or coalesce(t.work_description,'') ilike '%' || trim(k) || '%'
      or exists (select 1 from unnest(t.keywords) tk where tk ilike '%' || trim(k) || '%' or trim(k) ilike '%' || tk || '%')
    ) then
      hit := trim(k); exit;
    end if;
  end loop;
  if hit is null then return null; end if;
  return 'Matches your work: ' || hit;
end $$;

-- When a public tender is added, match it to every business
create or replace function public.match_new_public_tender() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_public then
    insert into user_tenders (user_id, tender_id, match_reason)
    select p.id, new.id, public.tender_matches(p, new)
    from profiles p
    where public.tender_matches(p, new) is not null
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_match_public_tender on public.tenders;
create trigger trg_match_public_tender after insert on public.tenders
  for each row execute function public.match_new_public_tender();

-- When a business saves or edits its profile, match open public tenders
create or replace function public.match_profile_to_open_tenders() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into user_tenders (user_id, tender_id, match_reason)
  select new.id, t.id, public.tender_matches(new, t)
  from tenders t
  where t.is_public and (t.closing_at is null or t.closing_at > now())
    and public.tender_matches(new, t) is not null
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists trg_match_profile on public.profiles;
create trigger trg_match_profile after insert or update of keywords, districts, min_value, max_value on public.profiles
  for each row execute function public.match_profile_to_open_tenders();

-- Daily job helpers (protected by a secret stored in app_config)
create or replace function public.check_job_secret(p_secret text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from app_config where key = 'job_secret' and value = p_secret) then
    raise exception 'not allowed';
  end if;
end $$;

-- New matches not yet announced
create or replace function public.job_new_matches(p_secret text)
returns table (user_id uuid, email text, business_name text, language text,
               tender_id uuid, title text, organisation text, closing_at timestamptz, value numeric)
language plpgsql security definer set search_path = public as $$
begin
  perform check_job_secret(p_secret);
  return query
    select p.id, p.email, p.business_name, p.language, t.id, t.title, t.organisation, t.closing_at, t.value
    from user_tenders ut join profiles p on p.id = ut.user_id join tenders t on t.id = ut.tender_id
    where ut.notified_at is null and ut.status = 'matched' and p.email_alerts
      and (t.closing_at is null or t.closing_at > now());
end $$;

create or replace function public.job_mark_notified(p_secret text, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform check_job_secret(p_secret);
  update user_tenders set notified_at = now() where user_id = p_user and notified_at is null;
end $$;

-- Deadline reminders: 7, 3 and 1 day before closing, for saved/applied tenders
create or replace function public.job_due_reminders(p_secret text)
returns table (user_id uuid, email text, business_name text, language text,
               tender_id uuid, title text, closing_at timestamptz, days_left int, status text)
language plpgsql security definer set search_path = public as $$
begin
  perform check_job_secret(p_secret);
  return query
    select p.id, p.email, p.business_name, p.language, t.id, t.title, t.closing_at, d.days, ut.status
    from user_tenders ut
    join profiles p on p.id = ut.user_id
    join tenders t on t.id = ut.tender_id
    cross join (values (7),(3),(1)) as d(days)
    where ut.status in ('saved','applied') and p.email_alerts
      and t.closing_at is not null and t.closing_at > now()
      -- only the closest reminder step that applies today
      and d.days = (select min(x) from (values (7),(3),(1)) v(x)
                    where t.closing_at <= now() + make_interval(days => x))
      and not (d.days = any(ut.reminders_sent));
end $$;

create or replace function public.job_mark_reminded(p_secret text, p_user uuid, p_tender uuid, p_days int)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform check_job_secret(p_secret);
  update user_tenders set reminders_sent = array_append(reminders_sent, p_days)
  where user_id = p_user and tender_id = p_tender;
end $$;

-- Weekly report numbers
create or replace function public.job_weekly_report(p_secret text)
returns table (user_id uuid, email text, business_name text, language text,
               new_matches bigint, closing_soon bigint)
language plpgsql security definer set search_path = public as $$
begin
  perform check_job_secret(p_secret);
  return query
    select p.id, p.email, p.business_name, p.language,
      count(*) filter (where ut.created_at > now() - interval '7 days'),
      count(*) filter (where t.closing_at between now() and now() + interval '7 days' and ut.status <> 'dismissed')
    from profiles p
    left join user_tenders ut on ut.user_id = p.id
    left join tenders t on t.id = ut.tender_id
    where p.email_alerts
    group by p.id;
end $$;

revoke all on function public.job_new_matches(text), public.job_mark_notified(text, uuid),
  public.job_due_reminders(text), public.job_mark_reminded(text, uuid, uuid, int),
  public.job_weekly_report(text), public.check_job_secret(text) from public;
grant execute on function public.job_new_matches(text), public.job_mark_notified(text, uuid),
  public.job_due_reminders(text), public.job_mark_reminded(text, uuid, uuid, int),
  public.job_weekly_report(text) to anon, authenticated;
revoke all on function public.match_new_public_tender(), public.match_profile_to_open_tenders() from public, anon, authenticated;

-- Private file storage for uploaded tender PDFs (each user has own folder)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tender-docs', 'tender-docs', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "own tender files read" on storage.objects;
drop policy if exists "own tender files write" on storage.objects;
drop policy if exists "own tender files delete" on storage.objects;
create policy "own tender files read" on storage.objects for select
  using (bucket_id = 'tender-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own tender files write" on storage.objects for insert
  with check (bucket_id = 'tender-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own tender files delete" on storage.objects for delete
  using (bucket_id = 'tender-docs' and (storage.foldername(name))[1] = auth.uid()::text);

-- Let a business permanently delete its own login (DPDP: right to erasure)
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.tenders where created_by = auth.uid() and not is_public;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

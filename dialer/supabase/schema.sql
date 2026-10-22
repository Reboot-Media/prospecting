-- Reboot CRM schema. Every table carries a crm_ prefix so it can live in a shared
-- Supabase project without clashing. Only signed-in users (K and Ali) can read or
-- write; the edge functions use the service role. Turn OFF public sign-ups in
-- Authentication > Providers > Email so nobody else can create an account.

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  ghl_id text,
  first_name text not null default '',
  last_name text not null default '',
  company text not null,
  phone text not null default '',
  email text not null default '',
  city text not null default '',
  state text not null default '',
  website text not null default '',
  pain text not null default 'unknown' check (pain in ('never-ads','ads-stopped','ads-running','unknown')),
  segment text not null default 'growing' check (segment in ('growing','shark','commercial')),
  status text not null default 'new' check (status in ('new','attempting','callback','booked','confirmed','not_interested','bad_number','dnc')),
  stage text check (stage in ('booked','confirmed','showed','no_show','proposal','won','lost')),
  deal_value integer not null default 0,
  owner text,
  tags text[] not null default '{}',
  notes text not null default '',
  source text not null default '',
  attempts integer not null default 0,
  last_outcome text,
  last_called_at timestamptz,
  meeting_at timestamptz,
  why_now text not null default '',
  sequence_id uuid,
  sequence_step integer not null default 0,
  sequence_state text check (sequence_state in ('active','replied','finished','paused','bounced')),
  email_status text not null default 'ok' check (email_status in ('ok','bounced','unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Phone and email are unique when present (email-only and phone-only contacts are fine).
create unique index if not exists crm_leads_phone_key on public.crm_leads (phone) where phone <> '';
create unique index if not exists crm_leads_email_key on public.crm_leads (lower(email)) where email <> '';
create index if not exists crm_leads_status_idx on public.crm_leads (status);
create index if not exists crm_leads_seq_idx on public.crm_leads (sequence_id) where sequence_state = 'active';

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  user_name text not null,
  outcome text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_activities_lead_idx on public.crm_activities (lead_id, created_at desc);
create index if not exists crm_activities_time_idx on public.crm_activities (created_at desc);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete cascade,
  kind text not null default 'callback' check (kind in ('callback','follow_up','todo')),
  owner text not null,
  due_at timestamptz not null,
  reason text not null default '',
  done_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_tasks_open_idx on public.crm_tasks (due_at) where done_at is null;

create table if not exists public.crm_meetings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  owner text not null,
  starts_at timestamptz not null,
  minutes integer not null default 30,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','showed','no_show','canceled')),
  why_now text not null default '',
  source text not null default 'dialer',
  created_at timestamptz not null default now()
);
create index if not exists crm_meetings_time_idx on public.crm_meetings (starts_at);

create table if not exists public.crm_sequences (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  lane text not null,
  status text not null default 'paused' check (status in ('active','paused')),
  steps jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_lists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  filter jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  list_id uuid references public.crm_lists(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scheduled','sent')),
  variants jsonb not null default '[]',
  scheduled_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  direction text not null default 'out' check (direction in ('out','in')),
  from_addr text not null default '',
  to_addr text not null default '',
  cc text not null default '',
  subject text not null default '',
  body text not null default '',
  branded boolean not null default false,
  status text not null default 'draft' check (status in ('draft','approved','sent','bounced','failed','received')),
  sequence_id uuid references public.crm_sequences(id) on delete set null,
  step integer,
  campaign_id uuid references public.crm_campaigns(id) on delete set null,
  variant text,
  sent_at timestamptz,
  opens integer not null default 0,
  clicks integer not null default 0,
  first_open_at timestamptz,
  last_open_at timestamptz,
  replied_at timestamptz,
  provider_id text,          -- Resend's id, used to match tracking webhooks
  error text,
  created_by text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_emails_status_idx on public.crm_emails (status);
create index if not exists crm_emails_lead_idx on public.crm_emails (lead_id);
create unique index if not exists crm_emails_provider_idx on public.crm_emails (provider_id) where provider_id is not null;

create table if not exists public.crm_email_events (
  id uuid primary key default gen_random_uuid(),
  email_id uuid not null references public.crm_emails(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  type text not null check (type in ('sent','open','click','reply','bounce','unsubscribe')),
  url text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists crm_email_events_lead_idx on public.crm_email_events (lead_id, created_at desc);

create table if not exists public.crm_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'branded' check (kind in ('plain','branded','text')),
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_forms (
  id uuid primary key default gen_random_uuid(),
  form text not null,
  lead_id uuid references public.crm_leads(id) on delete set null,
  fields jsonb not null default '{}',
  page text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.crm_settings (
  id integer primary key default 1 check (id = 1),
  value jsonb not null default '{}'
);

-- Access: only emails on the team list (K and Ali) see and edit anything, even if
-- someone else manages to sign up to this shared project.
create table if not exists public.crm_team (
  email text primary key,
  name text not null
);
insert into public.crm_team (email, name) values
  ('k.reid@rebootmedia.us', 'K'),
  ('s.kazmi@rebootmedia.us', 'Ali')
on conflict (email) do nothing;
alter table public.crm_team enable row level security;

create or replace function public.crm_is_team() returns boolean
language sql stable security definer set search_path = public as $f$
  select exists (select 1 from public.crm_team where email = lower(auth.jwt() ->> 'email'))
$f$;
revoke all on function public.crm_is_team() from public;
grant execute on function public.crm_is_team() to authenticated;

drop policy if exists "team reads team" on public.crm_team;
create policy "team reads team" on public.crm_team for select to authenticated using (public.crm_is_team());

-- The team sees and edits everything.
do $$
declare t text;
begin
  foreach t in array array['crm_leads','crm_activities','crm_tasks','crm_meetings','crm_sequences','crm_lists','crm_campaigns','crm_emails','crm_email_events','crm_templates','crm_forms','crm_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format('create policy "team full access" on public.%I for all to authenticated using (public.crm_is_team()) with check (public.crm_is_team())', t);
  end loop;
end $$;

-- Live sync between K's and Ali's screens.
do $$
declare t text;
begin
  foreach t in array array['crm_leads','crm_activities','crm_tasks','crm_meetings','crm_sequences','crm_lists','crm_campaigns','crm_emails','crm_email_events','crm_templates','crm_forms'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Phone: calling lines and tracking numbers, and every call in or out.
create table if not exists public.crm_numbers (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  label text not null default '',
  kind text not null default 'tracking' check (kind in ('line','tracking')),
  source text not null default '',
  owner text not null default '',
  forward_to text not null default '',
  record boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_calls (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.crm_leads(id) on delete set null,
  direction text not null default 'out' check (direction in ('in','out')),
  user_name text not null default '',
  from_number text not null default '',
  to_number text not null default '',
  number_id uuid references public.crm_numbers(id) on delete set null,
  source text not null default '',
  status text not null default 'live' check (status in ('live','completed','no_answer','busy','voicemail','missed','failed')),
  started_at timestamptz not null default now(),
  duration_sec integer not null default 0,
  recording_url text not null default '',
  outcome text,
  via text not null default 'cell' check (via in ('browser','cell','forward')),
  provider_id text,
  created_at timestamptz not null default now()
);
create index if not exists crm_calls_started_idx on public.crm_calls (started_at desc);
create index if not exists crm_calls_lead_idx on public.crm_calls (lead_id);
create index if not exists crm_calls_number_idx on public.crm_calls (number_id);

do $$
declare t text;
begin
  foreach t in array array['crm_numbers','crm_calls'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format('create policy "team full access" on public.%I for all to authenticated using (public.crm_is_team()) with check (public.crm_is_team())', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Workflows: a trigger plus a tree of steps (built in the app), one run per
-- contact going through it, and the events that start or resume runs.
create table if not exists public.crm_workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'New workflow',
  description text not null default '',
  status text not null default 'draft' check (status in ('active','draft','paused')),
  trigger jsonb not null default '{"type":"manual","value":"","conditions":[]}',
  steps jsonb not null default '[]',
  reentry boolean not null default false,
  stop_on_reply boolean not null default true,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_flow_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.crm_workflows(id) on delete cascade,
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  status text not null default 'active' check (status in ('active','waiting','done','stopped','failed')),
  cursor text,
  wake_at timestamptz,
  waiting_for text,
  log jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_flow_runs_due_idx on public.crm_flow_runs (wake_at) where status in ('active','waiting');
create index if not exists crm_flow_runs_lead_idx on public.crm_flow_runs (lead_id, workflow_id);

-- Filled by the triggers below; only the crm-flow function reads it.
create table if not exists public.crm_flow_events (
  id bigserial primary key,
  type text not null,
  value text not null default '',
  lead_id uuid not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists crm_flow_events_todo_idx on public.crm_flow_events (id) where processed_at is null;
alter table public.crm_flow_events enable row level security;

create or replace function public.crm_flow_capture() returns trigger
language plpgsql security definer set search_path = public as $f$
begin
  if TG_TABLE_NAME = 'crm_activities' then
    if new.outcome in ('no_answer','voicemail','gatekeeper','callback','booked','confirmed','not_interested','bad_number','dnc') then
      insert into crm_flow_events (type, value, lead_id) values ('call_outcome', new.outcome, new.lead_id);
    end if;
  elsif TG_TABLE_NAME = 'crm_leads' then
    if TG_OP = 'INSERT' then
      insert into crm_flow_events (type, value, lead_id) values ('contact_created', new.source, new.id);
      insert into crm_flow_events (type, value, lead_id) select 'tag_added', x, new.id from unnest(new.tags) x;
    else
      insert into crm_flow_events (type, value, lead_id) select 'tag_added', x, new.id from unnest(new.tags) x where not (x = any(old.tags));
      insert into crm_flow_events (type, value, lead_id) select 'tag_removed', x, new.id from unnest(old.tags) x where not (x = any(new.tags));
      if new.stage is distinct from old.stage and new.stage is not null then
        insert into crm_flow_events (type, value, lead_id) values ('stage_changed', new.stage, new.id);
      end if;
    end if;
  elsif TG_TABLE_NAME = 'crm_meetings' then
    if TG_OP = 'INSERT' then
      insert into crm_flow_events (type, value, lead_id) values ('meeting_booked', new.source, new.lead_id);
    elsif new.status is distinct from old.status then
      insert into crm_flow_events (type, value, lead_id) values ('meeting_status', new.status, new.lead_id);
    end if;
  elsif TG_TABLE_NAME = 'crm_forms' then
    if new.lead_id is not null then
      insert into crm_flow_events (type, value, lead_id) values ('form_submitted', new.form, new.lead_id);
    end if;
  elsif TG_TABLE_NAME = 'crm_email_events' then
    if new.type in ('open','click','reply','bounce') then
      insert into crm_flow_events (type, value, lead_id)
      values (case new.type when 'open' then 'email_opened' when 'click' then 'email_clicked' when 'reply' then 'email_replied' else 'email_bounced' end, new.url, new.lead_id);
    end if;
  elsif TG_TABLE_NAME = 'crm_calls' then
    if new.lead_id is not null and new.direction = 'in' and new.status = 'missed' and (TG_OP = 'INSERT' or old.status is distinct from 'missed') then
      insert into crm_flow_events (type, value, lead_id) values ('missed_call', new.source, new.lead_id);
    end if;
  end if;
  return null;
end $f$;
revoke all on function public.crm_flow_capture() from public, anon, authenticated;

drop trigger if exists crm_flow_activities on public.crm_activities;
create trigger crm_flow_activities after insert on public.crm_activities for each row execute function public.crm_flow_capture();
drop trigger if exists crm_flow_leads on public.crm_leads;
create trigger crm_flow_leads after insert or update on public.crm_leads for each row execute function public.crm_flow_capture();
drop trigger if exists crm_flow_meetings on public.crm_meetings;
create trigger crm_flow_meetings after insert or update on public.crm_meetings for each row execute function public.crm_flow_capture();
drop trigger if exists crm_flow_forms on public.crm_forms;
create trigger crm_flow_forms after insert on public.crm_forms for each row execute function public.crm_flow_capture();
drop trigger if exists crm_flow_email_events on public.crm_email_events;
create trigger crm_flow_email_events after insert on public.crm_email_events for each row execute function public.crm_flow_capture();
drop trigger if exists crm_flow_calls on public.crm_calls;
create trigger crm_flow_calls after insert or update on public.crm_calls for each row execute function public.crm_flow_capture();

do $$
declare t text;
begin
  foreach t in array array['crm_workflows','crm_flow_runs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format('create policy "team full access" on public.%I for all to authenticated using (public.crm_is_team()) with check (public.crm_is_team())', t);
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Function secrets kept in the vault (crm_cron_secret, crm_form_secret). Only the
-- service role (the edge functions) can read them.
create or replace function public.crm_secret(n text) returns text
language sql stable security definer set search_path = public, vault as $f$
  select decrypted_secret from vault.decrypted_secrets where name = n and n like 'crm\_%'
$f$;
revoke all on function public.crm_secret(text) from public, anon, authenticated;
grant execute on function public.crm_secret(text) to service_role;

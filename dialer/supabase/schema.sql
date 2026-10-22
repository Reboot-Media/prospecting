-- Reboot Dialer schema. Run once in the Supabase SQL editor of the project the dialer uses.
-- Only signed-in users (K and Ali) can read or write. Turn OFF public sign-ups in
-- Authentication > Providers > Email so nobody else can create an account.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  ghl_id text,
  first_name text not null default '',
  last_name text not null default '',
  company text not null,
  phone text not null unique,
  email text not null default '',
  city text not null default '',
  state text not null default '',
  website text not null default '',
  pain text not null default 'unknown' check (pain in ('never-ads','ads-stopped','ads-running','unknown')),
  status text not null default 'new' check (status in ('new','attempting','callback','booked','confirmed','not_interested','bad_number','dnc')),
  owner text,
  tags text[] not null default '{}',
  notes text not null default '',
  attempts int not null default 0,
  last_outcome text,
  last_called_at timestamptz,
  meeting_at timestamptz,
  why_now text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_owner_idx on public.leads (owner);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_name text not null,
  outcome text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists activities_lead_idx on public.activities (lead_id);
create index if not exists activities_created_idx on public.activities (created_at);

create table if not exists public.callbacks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  owner text not null,
  due_at timestamptz not null,
  reason text not null,
  done_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists callbacks_open_idx on public.callbacks (owner, due_at) where done_at is null;

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  value jsonb not null default '{}'
);

alter table public.leads enable row level security;
alter table public.activities enable row level security;
alter table public.callbacks enable row level security;
alter table public.settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['leads','activities','callbacks','settings'] loop
    execute format('drop policy if exists "team full access" on public.%I', t);
    execute format('create policy "team full access" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- Live sync between K and Ali.
alter publication supabase_realtime add table public.leads, public.activities, public.callbacks;


-- WALLETS
create table public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  coins integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.wallets enable row level security;
create policy "own wallet select" on public.wallets for select using (auth.uid() = user_id);
create policy "own wallet update" on public.wallets for update using (auth.uid() = user_id);
create policy "own wallet insert" on public.wallets for insert with check (auth.uid() = user_id);

-- TRANSACTIONS
create type public.tx_status as enum ('pending','paid','expired','failed');
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  md5 text not null unique,
  qr_payload text not null,
  amount_usd numeric(10,2) not null,
  coins integer not null,
  status public.tx_status not null default 'pending',
  bakong_ref text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes')
);
alter table public.transactions enable row level security;
create policy "own tx select" on public.transactions for select using (auth.uid() = user_id);
create index on public.transactions (user_id, status);
create index on public.transactions (md5);

-- LIBRARY
create table public.library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  game_id text not null,
  acquired_at timestamptz not null default now(),
  unique (user_id, game_id)
);
alter table public.library enable row level security;
create policy "own lib select" on public.library for select using (auth.uid() = user_id);
create policy "own lib insert" on public.library for insert with check (auth.uid() = user_id);

-- Auto-create wallet for new users
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.wallets (user_id, coins) values (new.id, 0)
  on conflict (user_id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

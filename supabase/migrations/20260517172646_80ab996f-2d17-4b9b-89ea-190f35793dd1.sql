create table if not exists public.bakong_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text,
  md5 text,
  hash text unique,
  topup_request_id uuid,
  outcome text not null,
  status_code int not null,
  payload jsonb,
  received_at timestamptz not null default now()
);

create index if not exists idx_bakong_webhook_events_md5 on public.bakong_webhook_events(md5);
create index if not exists idx_bakong_webhook_events_topup on public.bakong_webhook_events(topup_request_id);
create index if not exists idx_bakong_webhook_events_received_at on public.bakong_webhook_events(received_at desc);

alter table public.bakong_webhook_events enable row level security;

create policy "admins read bakong_webhook_events"
on public.bakong_webhook_events for select to authenticated
using (public.has_role(auth.uid(), 'admin'));
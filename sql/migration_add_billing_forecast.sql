-- Proyección y ajustes mensuales de facturación por servicio
-- Migración aditiva: no elimina ni modifica operarios, servicios, asignaciones o datos existentes.

create extension if not exists pgcrypto;

create table if not exists public.service_billing_rules (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  rule_name text,
  days_of_week smallint[] not null,
  start_time time not null,
  end_time time not null,
  positions integer not null default 1 check (positions >= 1),
  valid_from date,
  valid_until date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_billing_rules_valid_shift check (end_time <> start_time),
  constraint service_billing_rules_valid_days check (
    cardinality(days_of_week) > 0
    and days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
  ),
  constraint service_billing_rules_valid_period check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  )
);

create table if not exists public.service_billing_adjustments (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  adjustment_date date not null,
  adjustment_type text not null default 'manual' check (adjustment_type in ('uncovered', 'client_closure', 'extra', 'manual')),
  hours_delta numeric(10,2) not null check (hours_delta <> 0),
  reason text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_billing_rules_service_idx on public.service_billing_rules(service_id);
create index if not exists service_billing_adjustments_service_date_idx on public.service_billing_adjustments(service_id, adjustment_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists service_billing_rules_set_updated_at on public.service_billing_rules;
create trigger service_billing_rules_set_updated_at
before update on public.service_billing_rules
for each row execute function public.set_updated_at();

drop trigger if exists service_billing_adjustments_set_updated_at on public.service_billing_adjustments;
create trigger service_billing_adjustments_set_updated_at
before update on public.service_billing_adjustments
for each row execute function public.set_updated_at();

alter table public.service_billing_rules enable row level security;
alter table public.service_billing_adjustments enable row level security;

drop policy if exists service_billing_rules_auth_all on public.service_billing_rules;
create policy service_billing_rules_auth_all on public.service_billing_rules
for all to authenticated using (true) with check (true);

drop policy if exists service_billing_adjustments_auth_all on public.service_billing_adjustments;
create policy service_billing_adjustments_auth_all on public.service_billing_adjustments
for all to authenticated using (true) with check (true);

do $$
begin
  begin
    alter publication supabase_realtime add table public.service_billing_rules;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.service_billing_adjustments;
  exception when duplicate_object then null;
  end;
end $$;

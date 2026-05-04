-- Extensiones
create extension if not exists pgcrypto;

-- Tabla de operarios
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  worker_type text not null check (worker_type in ('full_time', 'part_time', 'insurance')),
  target_hours numeric(6,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de servicios
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client_address text,
  zone text,
  frequency_type text not null default 'fixed' check (frequency_type in ('fixed', 'variable', 'replacement')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabla de asignaciones semanales recurrentes
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_shift check (end_time > start_time)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers de updated_at
DROP TRIGGER IF EXISTS workers_set_updated_at ON public.workers;
CREATE TRIGGER workers_set_updated_at
before update on public.workers
for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
CREATE TRIGGER services_set_updated_at
before update on public.services
for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS assignments_set_updated_at ON public.assignments;
CREATE TRIGGER assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

-- RLS
alter table public.workers enable row level security;
alter table public.services enable row level security;
alter table public.assignments enable row level security;

-- Políticas: usuarios autenticados pueden leer y escribir.
DROP POLICY IF EXISTS workers_auth_all ON public.workers;
CREATE POLICY workers_auth_all ON public.workers
for all to authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS services_auth_all ON public.services;
CREATE POLICY services_auth_all ON public.services
for all to authenticated
using (true)
with check (true);

DROP POLICY IF EXISTS assignments_auth_all ON public.assignments;
CREATE POLICY assignments_auth_all ON public.assignments
for all to authenticated
using (true)
with check (true);

-- Realtime
alter publication supabase_realtime add table public.workers;
alter publication supabase_realtime add table public.services;
alter publication supabase_realtime add table public.assignments;

-- Vista opcional de resumen por operario
create or replace view public.worker_weekly_summary as
select
  w.id,
  w.name,
  w.worker_type,
  coalesce(w.target_hours,
    case
      when w.worker_type = 'full_time' then 44
      when w.worker_type = 'part_time' then 24
      else null
    end
  ) as target_hours,
  round(coalesce(sum(extract(epoch from (a.end_time - a.start_time)) / 3600), 0)::numeric, 2) as assigned_hours
from public.workers w
left join public.assignments a on a.worker_id = w.id and a.is_active = true
group by w.id, w.name, w.worker_type, w.target_hours;

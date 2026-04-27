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
  supervisor_name text,
  frequency_type text not null default 'fixed' check (frequency_type in ('fixed', 'variable', 'replacement')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services add column if not exists supervisor_name text;

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

-- Tabla de ausencias operativas
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references public.workers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete set null,
  absence_date date not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  scheduled_start_time time,
  scheduled_end_time time,
  coverage_status text not null default 'uncovered' check (coverage_status in ('uncovered', 'covered', 'partial')),
  coverage_worker_id uuid references public.workers(id) on delete set null,
  coverage_date date,
  coverage_start_time time,
  coverage_end_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absences_planned_shift_valid check (
    scheduled_start_time is null
    or scheduled_end_time is null
    or scheduled_end_time > scheduled_start_time
  ),
  constraint absences_coverage_shift_valid check (
    coverage_start_time is null
    or coverage_end_time is null
    or coverage_end_time > coverage_start_time
  )
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

DROP TRIGGER IF EXISTS absences_set_updated_at ON public.absences;
CREATE TRIGGER absences_set_updated_at
before update on public.absences
for each row execute function public.set_updated_at();

-- RLS
alter table public.workers enable row level security;
alter table public.services enable row level security;
alter table public.assignments enable row level security;
alter table public.absences enable row level security;

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

DROP POLICY IF EXISTS absences_auth_all ON public.absences;
CREATE POLICY absences_auth_all ON public.absences
for all to authenticated
using (true)
with check (true);

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'workers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.workers;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'services'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'absences'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.absences;
  END IF;
END $$;

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

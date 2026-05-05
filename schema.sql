-- Extensiones
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Operarios
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  worker_type text not null check (worker_type in ('full_time', 'part_time', 'insurance')),
  target_hours numeric(6,2),
  hire_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workers add column if not exists hire_date date;

-- Servicios
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

-- Asignaciones
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

-- Ausencias
create table if not exists public.absences (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete set null,
  worker_id uuid not null references public.workers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  absence_date date not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  scheduled_start_time time,
  scheduled_end_time time,
  absence_type text check (absence_type in ('injustificada', 'justificada', 'suspension')),
  coverage_status text not null default 'uncovered' check (coverage_status in ('uncovered', 'covered', 'partial')),
  coverage_worker_id uuid references public.workers(id) on delete set null,
  coverage_date date,
  coverage_start_time time,
  coverage_end_time time,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint absences_planned_shift_valid check (
    scheduled_start_time is null or scheduled_end_time is null or scheduled_end_time > scheduled_start_time
  ),
  constraint absences_coverage_shift_valid check (
    coverage_start_time is null or coverage_end_time is null or coverage_end_time > coverage_start_time
  )
);

alter table public.absences add column if not exists assignment_id uuid references public.assignments(id) on delete set null;
alter table public.absences add column if not exists worker_id uuid references public.workers(id) on delete cascade;
alter table public.absences add column if not exists service_id uuid references public.services(id) on delete cascade;
alter table public.absences add column if not exists absence_date date;
alter table public.absences add column if not exists day_of_week int;
alter table public.absences add column if not exists scheduled_start_time time;
alter table public.absences add column if not exists scheduled_end_time time;
alter table public.absences add column if not exists absence_type text;
alter table public.absences add column if not exists coverage_status text;
alter table public.absences add column if not exists coverage_worker_id uuid references public.workers(id) on delete set null;
alter table public.absences add column if not exists coverage_date date;
alter table public.absences add column if not exists coverage_start_time time;
alter table public.absences add column if not exists coverage_end_time time;
alter table public.absences add column if not exists notes text;
alter table public.absences add column if not exists created_at timestamptz not null default now();
alter table public.absences add column if not exists updated_at timestamptz not null default now();

-- Tardanzas
create table if not exists public.tardinesses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.assignments(id) on delete set null,
  worker_id uuid not null references public.workers(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  tardiness_date date not null,
  day_of_week int not null check (day_of_week between 0 and 6),
  scheduled_start_time time not null,
  actual_arrival_time time not null,
  minutes_late int not null check (minutes_late > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tardiness_actual_after_scheduled check (actual_arrival_time > scheduled_start_time)
);

-- Materiales
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text,
  unit text not null default 'un',
  presentation text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_materials (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  current_stock numeric(12,2) not null default 0,
  minimum_stock numeric(12,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_materials_unique unique (service_id, material_id)
);

create table if not exists public.material_consumptions (
  id uuid primary key default gen_random_uuid(),
  service_material_id uuid not null references public.service_materials(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete restrict,
  consumption_date date not null,
  quantity numeric(12,2) not null check (quantity > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_worker_active on public.assignments (worker_id) where is_active = true;
create index if not exists idx_assignments_service_active on public.assignments (service_id) where is_active = true;
create index if not exists idx_absences_worker_date on public.absences (worker_id, absence_date desc);
create index if not exists idx_absences_service_date on public.absences (service_id, absence_date desc);
create index if not exists idx_tardinesses_worker_date on public.tardinesses (worker_id, tardiness_date desc);
create index if not exists idx_tardinesses_service_date on public.tardinesses (service_id, tardiness_date desc);
create index if not exists idx_material_consumptions_service_material_date on public.material_consumptions (service_material_id, consumption_date desc);

DROP TRIGGER IF EXISTS workers_set_updated_at ON public.workers;
CREATE TRIGGER workers_set_updated_at before update on public.workers for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS services_set_updated_at ON public.services;
CREATE TRIGGER services_set_updated_at before update on public.services for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS assignments_set_updated_at ON public.assignments;
CREATE TRIGGER assignments_set_updated_at before update on public.assignments for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS absences_set_updated_at ON public.absences;
CREATE TRIGGER absences_set_updated_at before update on public.absences for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS tardinesses_set_updated_at ON public.tardinesses;
CREATE TRIGGER tardinesses_set_updated_at before update on public.tardinesses for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS materials_set_updated_at ON public.materials;
CREATE TRIGGER materials_set_updated_at before update on public.materials for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS service_materials_set_updated_at ON public.service_materials;
CREATE TRIGGER service_materials_set_updated_at before update on public.service_materials for each row execute function public.set_updated_at();
DROP TRIGGER IF EXISTS material_consumptions_set_updated_at ON public.material_consumptions;
CREATE TRIGGER material_consumptions_set_updated_at before update on public.material_consumptions for each row execute function public.set_updated_at();

alter table public.workers enable row level security;
alter table public.services enable row level security;
alter table public.assignments enable row level security;
alter table public.absences enable row level security;
alter table public.tardinesses enable row level security;
alter table public.materials enable row level security;
alter table public.service_materials enable row level security;
alter table public.material_consumptions enable row level security;

DROP POLICY IF EXISTS workers_auth_all ON public.workers;
CREATE POLICY workers_auth_all ON public.workers for all to authenticated using (true) with check (true);
DROP POLICY IF EXISTS services_auth_all ON public.services;
CREATE POLICY services_auth_all ON public.services for all to authenticated using (true) with check (true);
DROP POLICY IF EXISTS assignments_auth_all ON public.assignments;
CREATE POLICY assignments_auth_all ON public.assignments for all to authenticated using (true) with check (true);
DROP POLICY IF EXISTS absences_auth_all ON public.absences;
CREATE POLICY absences_auth_all ON public.absences for all to authenticated using (true) with check (true);
DROP POLICY IF EXISTS tardinesses_auth_all ON public.tardinesses;
CREATE POLICY tardinesses_auth_all ON public.tardinesses for all to authenticated using (true) with check (true);
DROP POLICY IF EXISTS materials_auth_all ON public.materials;
CREATE POLICY materials_auth_all ON public.materials for all to authenticated using (true) with check (true);
DROP POLICY IF EXISTS service_materials_auth_all ON public.service_materials;
CREATE POLICY service_materials_auth_all ON public.service_materials for all to authenticated using (true) with check (true);
DROP POLICY IF EXISTS material_consumptions_auth_all ON public.material_consumptions;
CREATE POLICY material_consumptions_auth_all ON public.material_consumptions for all to authenticated using (true) with check (true);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workers; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.services; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.absences; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tardinesses; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.materials; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.service_materials; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.material_consumptions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

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

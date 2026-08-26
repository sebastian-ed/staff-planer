-- Extensiones
create extension if not exists pgcrypto;

-- Tabla de operarios
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  worker_type text not null check (worker_type in ('full_time', 'part_time', 'insurance')),
  target_hours numeric(6,2),
  hire_date date,
  home_address text,
  home_zone text,
  latitude numeric(9,6),
  longitude numeric(9,6),
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
  billed_weekly_hours numeric(8,2),
  billed_monthly_hours numeric(10,2),
  latitude numeric(9,6),
  longitude numeric(9,6),
  frequency_type text not null default 'fixed' check (frequency_type in ('fixed', 'variable', 'replacement')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services add column if not exists billed_weekly_hours numeric(8,2);
alter table public.services add column if not exists billed_monthly_hours numeric(10,2);
alter table public.workers add column if not exists hire_date date;
alter table public.workers add column if not exists home_address text;
alter table public.workers add column if not exists home_zone text;
alter table public.workers add column if not exists latitude numeric(9,6);
alter table public.workers add column if not exists longitude numeric(9,6);
alter table public.services add column if not exists latitude numeric(9,6);
alter table public.services add column if not exists longitude numeric(9,6);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_billed_weekly_hours_nonnegative'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_billed_weekly_hours_nonnegative
      CHECK (billed_weekly_hours IS NULL OR billed_weekly_hours >= 0);
  END IF;
END $$;


DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_billed_monthly_hours_nonnegative'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_billed_monthly_hours_nonnegative
      CHECK (billed_monthly_hours IS NULL OR billed_monthly_hours >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workers_location_coordinates_valid'
      AND conrelid = 'public.workers'::regclass
  ) THEN
    ALTER TABLE public.workers
      ADD CONSTRAINT workers_location_coordinates_valid
      CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (
          latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90
          AND longitude BETWEEN -180 AND 180
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_location_coordinates_valid'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_location_coordinates_valid
      CHECK (
        (latitude IS NULL AND longitude IS NULL)
        OR (
          latitude IS NOT NULL
          AND longitude IS NOT NULL
          AND latitude BETWEEN -90 AND 90
          AND longitude BETWEEN -180 AND 180
        )
      );
  END IF;
END $$;

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
  constraint valid_shift check (end_time <> start_time)
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


-- ============================================================
-- Recorridos de materiales
-- ============================================================
-- Recorridos de materiales y seguimiento compartido para fleteros.
-- Migración aditiva: no elimina ni modifica operarios, servicios, asignaciones o materiales existentes.

create extension if not exists pgcrypto;

create table if not exists public.material_delivery_routes (
  id uuid primary key default gen_random_uuid(),
  route_name text not null,
  route_date date not null,
  departure_time time not null default '08:00',
  origin_name text,
  origin_latitude numeric(9,6),
  origin_longitude numeric(9,6),
  average_speed_kmh numeric(6,2) not null default 25 check (average_speed_kmh > 0),
  stop_minutes integer not null default 15 check (stop_minutes >= 0),
  share_token uuid not null default gen_random_uuid() unique,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_delivery_routes_origin_valid check (
    (origin_latitude is null and origin_longitude is null)
    or (
      origin_latitude between -90 and 90
      and origin_longitude between -180 and 180
    )
  )
);

create table if not exists public.material_delivery_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.material_delivery_routes(id) on delete cascade,
  service_id uuid references public.services(id) on delete set null,
  service_name text not null,
  address text,
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  sequence_no integer not null check (sequence_no >= 1),
  window_start time,
  window_end time,
  estimated_arrival time,
  estimated_departure time,
  distance_from_previous_km numeric(10,2) not null default 0 check (distance_from_previous_km >= 0),
  materials_summary text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_delivery_route_stops_unique_sequence unique (route_id, sequence_no)
);

create index if not exists idx_material_delivery_routes_date
  on public.material_delivery_routes(route_date desc, created_at desc);
create index if not exists idx_material_delivery_route_stops_route
  on public.material_delivery_route_stops(route_id, sequence_no);

DROP TRIGGER IF EXISTS material_delivery_routes_set_updated_at ON public.material_delivery_routes;
CREATE TRIGGER material_delivery_routes_set_updated_at
before update on public.material_delivery_routes
for each row execute function public.set_updated_at();

DROP TRIGGER IF EXISTS material_delivery_route_stops_set_updated_at ON public.material_delivery_route_stops;
CREATE TRIGGER material_delivery_route_stops_set_updated_at
before update on public.material_delivery_route_stops
for each row execute function public.set_updated_at();

alter table public.material_delivery_routes enable row level security;
alter table public.material_delivery_route_stops enable row level security;

DROP POLICY IF EXISTS material_delivery_routes_auth_all ON public.material_delivery_routes;
CREATE POLICY material_delivery_routes_auth_all
ON public.material_delivery_routes
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS material_delivery_route_stops_auth_all ON public.material_delivery_route_stops;
CREATE POLICY material_delivery_route_stops_auth_all
ON public.material_delivery_route_stops
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- El fletero no accede directamente a las tablas. Solo puede leer el recorrido
-- asociado al token secreto del link y cambiar el estado de una parada de ese recorrido.
create or replace function public.get_shared_material_route(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'route', to_jsonb(r),
    'stops', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.sequence_no)
      from public.material_delivery_route_stops s
      where s.route_id = r.id
    ), '[]'::jsonb)
  )
  from public.material_delivery_routes r
  where r.share_token = p_token
  limit 1;
$$;

create or replace function public.update_shared_material_route_stop(
  p_token uuid,
  p_stop_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_route_id uuid;
  v_updated public.material_delivery_route_stops%rowtype;
  v_pending_count integer;
  v_completed_or_skipped_count integer;
begin
  if p_status not in ('pending', 'completed', 'skipped') then
    raise exception 'Estado de parada no válido';
  end if;

  select r.id into v_route_id
  from public.material_delivery_routes r
  where r.share_token = p_token
  limit 1;

  if v_route_id is null then
    raise exception 'Recorrido no encontrado';
  end if;

  update public.material_delivery_route_stops s
  set
    status = p_status,
    completed_at = case when p_status = 'completed' then now() else null end,
    updated_at = now()
  where s.id = p_stop_id
    and s.route_id = v_route_id
  returning s.* into v_updated;

  if v_updated.id is null then
    raise exception 'Parada no encontrada en este recorrido';
  end if;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status in ('completed', 'skipped'))
  into v_pending_count, v_completed_or_skipped_count
  from public.material_delivery_route_stops
  where route_id = v_route_id;

  update public.material_delivery_routes
  set status = case
    when v_pending_count = 0 then 'completed'
    when v_completed_or_skipped_count > 0 then 'in_progress'
    else 'planned'
  end
  where id = v_route_id;

  return to_jsonb(v_updated);
end;
$$;

revoke all on function public.get_shared_material_route(uuid) from public;
revoke all on function public.update_shared_material_route_stop(uuid, uuid, text) from public;
grant execute on function public.get_shared_material_route(uuid) to anon, authenticated;
grant execute on function public.update_shared_material_route_stop(uuid, uuid, text) to anon, authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.material_delivery_routes; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.material_delivery_route_stops; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;

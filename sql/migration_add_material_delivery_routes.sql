-- Recorridos de materiales y seguimiento compartido para fleteros.
-- Migración aditiva: no elimina ni modifica operarios, servicios, asignaciones o materiales existentes.

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

insert into public.workers (name, worker_type, target_hours, hire_date, notes) values
  ('Ramirez Melina', 'full_time', 44, current_date - 240, 'Operaria fija'),
  ('Human Romina', 'part_time', 24, current_date - 120, 'Media jornada'),
  ('Zerpa Sabrina', 'insurance', null, current_date - 45, 'Seguro por horas');

insert into public.services (name, client_address, zone, frequency_type, notes) values
  ('Cons. Thomas Le Bretón 5153', 'Villa Urquiza', 'CABA Norte', 'fixed', ''),
  ('Cons. Cachimayo 748', 'Parque Chacabuco', 'CABA Sur', 'fixed', ''),
  ('Cons. Cabildo 2737', 'Núñez', 'CABA Norte', 'variable', 'Cobertura de seguro');


-- Ejemplo opcional de ausencia
insert into public.absences (
  worker_id,
  service_id,
  absence_date,
  day_of_week,
  scheduled_start_time,
  scheduled_end_time,
  coverage_status,
  notes
)
select
  w.id,
  s.id,
  current_date,
  extract(dow from current_date)::int,
  '08:00',
  '12:00',
  'uncovered',
  'Ejemplo de ausencia cargada'
from public.workers w
cross join public.services s
where w.name = 'Ramirez Melina'
  and s.name = 'Cons. Thomas Le Bretón 5153'
limit 1;


-- Materiales base
insert into public.materials (name, normalized_name, unit, presentation, notes) values
  ('Bolsa negra 60x90', 'bolsa negra 60x90', 'un', 'Rollo', 'Uso general'),
  ('Lavandina', 'lavandina', 'lt', 'Bidón 5 lt', 'Uso general'),
  ('Detergente', 'detergente', 'lt', 'Bidón 5 lt', 'Uso general')
on conflict (normalized_name) do nothing;

-- Stock por servicio
insert into public.service_materials (service_id, material_id, current_stock, minimum_stock, notes)
select s.id, m.id,
  case m.normalized_name
    when 'bolsa negra 60x90' then 40
    when 'lavandina' then 8
    else 5
  end as current_stock,
  case m.normalized_name
    when 'bolsa negra 60x90' then 15
    else 3
  end as minimum_stock,
  'Carga inicial de ejemplo'
from public.services s
join public.materials m on m.normalized_name in ('bolsa negra 60x90', 'lavandina', 'detergente')
where s.name in ('Cons. Thomas Le Bretón 5153', 'Cons. Cachimayo 748')
on conflict (service_id, material_id) do nothing;

-- Consumos de ejemplo del mes actual
insert into public.material_consumptions (service_material_id, service_id, material_id, consumption_date, quantity, notes)
select
  sm.id,
  sm.service_id,
  sm.material_id,
  current_date - ((row_number() over())::int % 5),
  case m.normalized_name
    when 'bolsa negra 60x90' then 12
    when 'lavandina' then 2
    else 1.5
  end,
  'Consumo de ejemplo'
from public.service_materials sm
join public.materials m on m.id = sm.material_id
join public.services s on s.id = sm.service_id
where s.name = 'Cons. Thomas Le Bretón 5153'
  and m.normalized_name in ('bolsa negra 60x90', 'lavandina', 'detergente');

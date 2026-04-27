insert into public.workers (name, worker_type, target_hours, notes) values
  ('Ramirez Melina', 'full_time', 44, 'Operaria fija'),
  ('Human Romina', 'part_time', 24, 'Media jornada'),
  ('Zerpa Sabrina', 'insurance', null, 'Seguro por horas');

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

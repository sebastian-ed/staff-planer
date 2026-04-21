insert into public.workers (name, worker_type, target_hours, notes) values
  ('Ramirez Melina', 'full_time', 44, 'Operaria fija'),
  ('Human Romina', 'part_time', 24, 'Media jornada'),
  ('Zerpa Sabrina', 'insurance', null, 'Seguro por horas');

insert into public.services (name, client_address, zone, supervisor_name, frequency_type, notes) values
  ('Cons. Thomas Le Bretón 5153', 'Villa Urquiza', 'CABA Norte', 'Andrés', 'fixed', ''),
  ('Cons. Cachimayo 748', 'Parque Chacabuco', 'CABA Sur', 'Leo', 'fixed', ''),
  ('Cons. Cabildo 2737', 'Núñez', 'CABA Norte', 'Andrés', 'variable', 'Cobertura de seguro');

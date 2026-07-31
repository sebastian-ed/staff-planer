-- Habilita turnos que comienzan un día y finalizan al día siguiente.
-- Ejemplo: lunes 22:00 a martes 06:00.
-- No elimina ni modifica asignaciones existentes.

begin;

alter table public.assignments
  drop constraint if exists valid_shift;

alter table public.assignments
  add constraint valid_shift
  check (end_time <> start_time);

commit;

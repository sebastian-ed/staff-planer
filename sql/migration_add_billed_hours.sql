-- Migración segura: horas facturadas por servicio.
-- Solo agrega una columna y una validación. No elimina ni modifica filas existentes.

begin;

alter table public.services
  add column if not exists billed_weekly_hours numeric(8,2);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_billed_weekly_hours_nonnegative'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_billed_weekly_hours_nonnegative
      CHECK (billed_weekly_hours IS NULL OR billed_weekly_hours >= 0);
  END IF;
END $$;

comment on column public.services.billed_weekly_hours is
  'Cantidad de horas semanales facturadas al cliente para este servicio.';

commit;

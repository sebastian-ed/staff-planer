-- Migración segura: horas mensuales facturadas por servicio.
-- Es aditiva: no elimina, renombra ni modifica datos existentes.
-- La columna anterior billed_weekly_hours, si existe, se conserva sin cambios.

begin;

alter table public.services
  add column if not exists billed_monthly_hours numeric(10,2);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'services_billed_monthly_hours_nonnegative'
      AND conrelid = 'public.services'::regclass
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_billed_monthly_hours_nonnegative
      CHECK (billed_monthly_hours IS NULL OR billed_monthly_hours >= 0);
  END IF;
END $$;

comment on column public.services.billed_monthly_hours is
  'Cantidad total de horas mensuales facturadas al cliente para este servicio.';

commit;

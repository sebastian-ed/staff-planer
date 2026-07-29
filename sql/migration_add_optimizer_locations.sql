-- Migración aditiva para el Optimizador de asignaciones.
-- No elimina ni modifica operarios, servicios, horarios, frecuencias o asignaciones existentes.

alter table public.workers add column if not exists home_address text;
alter table public.workers add column if not exists home_zone text;
alter table public.workers add column if not exists latitude numeric(9,6);
alter table public.workers add column if not exists longitude numeric(9,6);

alter table public.services add column if not exists latitude numeric(9,6);
alter table public.services add column if not exists longitude numeric(9,6);

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

# Actualización del Staff Planner

## 1. Respaldo

La migración no borra datos, pero antes de cualquier cambio productivo conviene exportar un respaldo de Supabase.

## 2. Migraciones

Si todavía no cargaste las horas mensuales facturadas, ejecutá:

`sql/migration_add_billed_monthly_hours.sql`

Para activar el Optimizador, ejecutá:

`sql/migration_add_optimizer_locations.sql`

Esta segunda migración solo agrega campos opcionales de ubicación. No modifica operarios, servicios, horarios, frecuencias ni asignaciones existentes.

## 3. Publicación

Reemplazá los archivos del repositorio por los incluidos en este ZIP y publicá normalmente en GitHub Pages. Conservá tu `supabase-config.js` actual.

## 4. Puesta en marcha del Optimizador

1. Entrá en Operarios y cargá zona de residencia. Las coordenadas son recomendables, no obligatorias.
2. Entrá en Servicios y cargá zona y coordenadas.
3. Abrí Optimizador.
4. Seleccioná un servicio existente o simulá uno nuevo.
5. Indicá días, horario y margen de traslado.
6. Ejecutá el análisis.
7. Revisá el ranking, los motivos y los descartes antes de confirmar una asignación.

La herramienta no reemplaza la decisión operativa. No conoce tránsito en vivo, restricciones personales no registradas ni acuerdos laborales particulares.

## Corrección visual de selectores

Esta versión mejora el contraste de todos los menús desplegables, incluido el selector de margen de traslado del Optimizador. No requiere cambios en Supabase ni modifica datos existentes.

# Actualización: proyección mensual de facturación

1. En Supabase, abrir **SQL Editor**.
2. Ejecutar `sql/migration_add_billing_forecast.sql`.
3. Reemplazar los archivos de la aplicación en GitHub.
4. Mantener el archivo `supabase-config.js` propio si contiene las credenciales actuales.

La migración solo agrega dos tablas nuevas. No elimina ni modifica servicios, operarios, horarios, asignaciones, ausencias, materiales o ubicaciones existentes.

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

## 5. Puesta en marcha del Mapa

La sección **Mapa** usa los mismos campos de ubicación incorporados para el Optimizador. No requiere una migración adicional.

1. Cargá coordenadas en los servicios y en los operarios que quieras visualizar.
2. Abrí **Mapa** y usá los filtros por tipo, zona o búsqueda.
3. Seleccioná un punto para ver sus asignaciones y los vínculos geográficos con operarios o servicios relacionados.
4. Los registros sin coordenadas aparecen en **Ubicaciones pendientes** y se pueden editar desde esa lista.

El mapa base utiliza OpenStreetMap mediante Leaflet. Requiere conexión a internet para descargar las capas cartográficas, pero los datos operativos siguen almacenados únicamente en Supabase.


## Nueva sección: Optimizador de cercanía

Esta actualización no requiere ejecutar SQL. Reutiliza los campos de ubicación ya incorporados por `sql/migration_add_optimizer_locations.sql`. No borra ni modifica servicios, operarios, frecuencias, horarios o asignaciones existentes. La sección es analítica: no ejecuta cambios automáticamente.


## Habilitar turnos nocturnos

1. Abrí Supabase → **SQL Editor**.
2. Ejecutá `sql/migration_allow_overnight_shifts.sql`.
3. Publicá los archivos de esta carpeta en GitHub Pages.

La migración únicamente reemplaza la validación que exigía que la hora de fin fuera mayor a la de inicio. No borra ni modifica operarios, servicios, frecuencias, asignaciones ni horarios existentes.

Convención: el día seleccionado es el día en que comienza el turno. Por ejemplo, **lunes 22:00–06:00** termina el martes a las 06:00.


## Actualización: balance objetivo vs asignado vs facturable

Esta versión no requiere ejecutar una migración SQL adicional. Utiliza el campo existente `workers.target_hours` y las reglas de facturación ya incorporadas.

Cambios principales:

- objetivo mensual por operario calculado con el calendario real;
- comparación mensual entre objetivo y horas asignadas;
- total de horas objetivo de toda la dotación;
- comparación entre horas de nómina y horas facturables estimadas;
- ranking de operarios con horas faltantes o excedidas;
- exportaciones actualizadas.

No se eliminan ni modifican operarios, servicios, horarios, asignaciones o reglas de facturación existentes.

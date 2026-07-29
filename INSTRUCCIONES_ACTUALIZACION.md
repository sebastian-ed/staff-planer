# Actualización segura de Staff Planner

## Orden recomendado

1. Ingresar al proyecto actual de Supabase.
2. Abrir **SQL Editor**.
3. Ejecutar únicamente el contenido de `sql/migration_add_billed_monthly_hours.sql`.
4. Confirmar que el script finalice sin errores.
5. Reemplazar los archivos del frontend en GitHub con los de esta carpeta.
6. Esperar la publicación de GitHub Pages y actualizar la web con `Ctrl + F5`.

## Qué hace la migración

- Agrega `billed_monthly_hours` a la tabla `services`.
- Permite valores vacíos para que todos los servicios actuales continúen funcionando.
- Impide guardar valores negativos.
- Conserva sin cambios la columna anterior `billed_weekly_hours`, en caso de que ya exista.

## Qué no hace

- No elimina filas ni tablas.
- No modifica servicios, zonas, supervisores o frecuencias.
- No modifica operarios.
- No modifica horarios ni asignaciones.
- No transforma ni reemplaza los valores semanales cargados anteriormente.

## Carga posterior

En **Servicios > Editar**, completar **Horas totales facturadas por mes**.

En el Dashboard, seleccionar el **Mes de análisis**. La app calcula la carga operativa contando las apariciones reales de cada día de la semana dentro de ese mes. Por ejemplo, un turno de lunes se multiplica por cuatro o cinco según cuántos lunes tenga el calendario seleccionado.

El resultado muestra:

- total mensual facturado;
- total mensual operativo proyectado;
- diferencia general;
- desvío por servicio;
- horas mensuales proyectadas por operario.

Los servicios sin horas mensuales facturadas quedan marcados como pendientes y no participan de la diferencia comercial hasta completar el dato.

## Alcance del cálculo

La proyección utiliza las asignaciones activas actuales. Si se modifica un cronograma durante el mes, la app recalcula el mes completo con la nueva configuración; no reconstruye automáticamente versiones históricas anteriores del cronograma.

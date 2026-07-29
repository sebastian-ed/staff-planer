# Actualización segura de Staff Planner

## Orden recomendado

1. Ingresar al proyecto actual de Supabase.
2. Abrir **SQL Editor**.
3. Ejecutar únicamente el contenido de `sql/migration_add_billed_hours.sql`.
4. Confirmar que el script finalice sin errores.
5. Reemplazar los archivos del frontend en GitHub con los de esta carpeta.
6. Esperar la publicación de GitHub Pages y actualizar la web con `Ctrl + F5`.

## Qué hace la migración

- Agrega `billed_weekly_hours` a la tabla `services`.
- Permite valores vacíos para que los servicios existentes sigan funcionando sin completar el dato inmediatamente.
- Impide guardar horas negativas.

## Qué no hace

- No elimina filas.
- No modifica nombres de servicios.
- No modifica frecuencias.
- No modifica operarios.
- No modifica horarios ni asignaciones.
- No reemplaza datos existentes.

## Carga posterior

En **Servicios > Editar**, completar **Horas facturadas por semana**. El Dashboard mostrará el total facturado, el total operativo y la diferencia. Los servicios sin ese dato aparecerán como pendientes y no se incluirán en la diferencia comercial hasta que sean completados.

# Actualización — PWA + balance operativo porcentual

Esta versión agrega únicamente:

1. Instalación como PWA en navegadores compatibles.
2. Balance entre **horas operativas asignadas del mes** y **facturación estimada del mes**, incluyendo diferencia en horas y porcentaje.

## Actualización

1. Conservá tu `supabase-config.js` actual.
2. Reemplazá los archivos del repositorio por los de esta carpeta.
3. Subí también `manifest.webmanifest`, `service-worker.js` y los nuevos íconos de `assets/`.
4. No hay que ejecutar SQL.
5. Después del deploy, hacé una recarga forzada una vez (`Ctrl + F5`).

## Criterio del porcentaje

- Si horas operativas > horas facturables: **Pasados X%**.
- Si horas operativas < horas facturables: **Faltan X%**.
- Si coinciden: **Equilibrado · 100%**.

El porcentaje de desvío se calcula sobre las horas facturables estimadas del mes.

## Balance global de dotación (actualización)

Esta versión agrega al Dashboard una lectura global separando tres conceptos:

- **Horas objetivo de la dotación:** lo que deberían cumplir los operarios según su jornada y el calendario real del mes.
- **Horas efectivamente asignadas:** lo que el cronograma activo les está asignando realmente.
- **Facturación estimada:** las horas proyectadas para cobrar a los clientes.

También muestra de forma destacada:

- horas de jornada sin asignar;
- horas excedidas sobre la jornada objetivo;
- neto de dotación contra jornada;
- diferencia y porcentaje entre horas asignadas y facturación estimada.

Los déficits y excesos individuales se suman por separado para evitar que un operario excedido oculte a otro que todavía tiene horas de jornada sin utilizar.

### Facturación estimada

Para que la comparación comercial sea independiente de la asignación del personal, la proyección usa esta prioridad:

1. cobertura facturable configurada por días, horarios y puestos;
2. referencia mensual manual del servicio;
3. si no existe ninguna de las anteriores, horas operativas actuales como estimación provisional.

No requiere cambios en Supabase ni nuevas migraciones.


## Ayuda contextual del balance

Se agregaron botones **i** en los indicadores principales del Dashboard y el botón **“? Cómo leer este balance”**. Cada ayuda explica en lenguaje simple qué significa el indicador, cómo interpretarlo y, cuando corresponde, incluye un ejemplo.

Este cambio es exclusivamente de interfaz y documentación: **no requiere ejecutar SQL ni modifica datos existentes**.

## Actualización: balance facturación vs objetivo de dotación

No requiere SQL ni cambios de esquema.

Se agregó al Dashboard un KPI principal que compara la facturación estimada del mes con el objetivo mensual de la dotación. También se incorporó al balance mensual y a la ayuda contextual (`i` / `? Cómo leer este balance`).

Fórmula: `Facturación estimada - Objetivo mensual de dotación`.

Después de publicar los archivos, realizar una recarga forzada (`Ctrl + F5`). La versión del caché PWA fue incrementada para tomar esta actualización.

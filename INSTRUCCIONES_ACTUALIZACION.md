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

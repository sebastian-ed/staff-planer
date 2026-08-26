# Actualización · Recorridos de materiales

## 1. Ejecutar la migración en Supabase

Abrir **Supabase → SQL Editor** y ejecutar:

`sql/migration_add_material_delivery_routes.sql`

Esta migración crea exclusivamente la infraestructura de recorridos y seguimiento del fletero. No elimina ni modifica los datos existentes de operarios, servicios, asignaciones, materiales, facturación, ausencias o tardanzas.

## 2. Publicar los archivos

Reemplazar los archivos de la aplicación en el repositorio de GitHub Pages por los incluidos en este paquete.

Conservar el `supabase-config.js` que ya utiliza la instalación actual si contiene las credenciales correctas del proyecto.

## 3. Forzar la actualización de la PWA

Luego del deploy, abrir la aplicación y hacer una recarga forzada una vez (`Ctrl + F5`). Se cambió la versión de caché del service worker para tomar los archivos nuevos.

## 4. Uso

1. Entrar a **Recorridos de materiales**.
2. Elegir la fecha y hora de salida.
3. Seleccionar los servicios con materiales que se desean visitar.
4. Si no sabés qué día conviene, usar **Sugerir mejor día**: analiza las próximas dos semanas y busca la fecha con mejor compatibilidad horaria.
5. Tocar **Calcular ruta óptima**.
5. Revisar el mapa y la secuencia. Se pueden subir, bajar o quitar paradas.
6. Tocar **Guardar recorrido**.
7. Tocar **Copiar link** y enviarlo al fletero.
8. El fletero abre el enlace sin login, consulta el mapa y va marcando cada entrega como realizada.

## Criterio de optimización

La app usa las coordenadas y los horarios activos de cada servicio en la fecha seleccionada. Prioriza una secuencia cercana que pueda visitarse mientras haya personal en el servicio. La distancia interna es una estimación geográfica/urbana; para navegación vial se incluye **Abrir en Google Maps**.

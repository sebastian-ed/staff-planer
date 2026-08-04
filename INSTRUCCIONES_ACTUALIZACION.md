# Actualización: facturación automática según horas operativas

## Cambio aplicado

La **Proyección base** de cada servicio ahora se calcula automáticamente con las **horas operativas asignadas del mes seleccionado**.

Por defecto:

- Proyección base = horas operativas del mes.
- Facturación ajustada = horas operativas del mes, mientras no existan novedades o una edición final.
- Diferencia = 0 horas.

Ejemplo: si el cronograma activo proyecta 188 horas para agosto, la app mostrará automáticamente:

- Proyección base: 188 hs.
- Facturación ajustada: 188 hs.
- Operativas: 188 hs.
- Diferencia: 0 hs.

Las referencias manuales anteriores y las coberturas guardadas se conservan en la base como información histórica, pero ya no reemplazan la proyección automática.

## Ajustes de fin de mes

Se mantienen las funciones:

- **Agregar novedad**, para descontar horas no cubiertas o sumar adicionales.
- **Editar facturación final**, para ingresar directamente las horas efectivamente facturadas al cerrar el mes.

## Instalación

1. Reemplazá los archivos de la aplicación por los incluidos en esta carpeta.
2. Conservá tu archivo `supabase-config.js` actual.
3. Publicá los cambios en GitHub Pages.
4. Recargá la app con `Ctrl + F5`.

No requiere ejecutar SQL y no modifica servicios, operarios, horarios, asignaciones ni datos existentes.

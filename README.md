# Clean It · Planificador Operativo

Web app mobile-first para visualizar y editar asignaciones de operarios por servicio con Supabase en tiempo real.

## Qué resuelve

- Ver rápidamente qué operario está en cada servicio.
- Controlar horas asignadas vs. horas objetivo.
- Detectar operarios con horas libres o excedidos.
- Editar operarios, servicios y asignaciones desde cualquier dispositivo.
- Ver cambios en vivo entre varios usuarios.
- Crear usuarios nuevos desde el login para que ingresen con las mismas funcionalidades.
- Imprimir la vista filtrada actual y descargar cada panel en Excel o PDF.
- Cargar horas mensuales facturadas por servicio y compararlas con la proyección mensual del cronograma operativo activo.
- Buscar operarios, servicios, asignaciones, materiales, ausencias y tardanzas desde un único buscador global.
- Visualizar servicios y zonas de residencia de operarios en un mapa operativo con filtros y vínculos de asignación.

## Actualización: balance mensual de horas por servicio

Antes de publicar esta versión, ejecutá una sola vez en el SQL Editor de Supabase:

`sql/migration_add_billed_monthly_hours.sql`

La migración es aditiva: crea la columna `billed_monthly_hours` en `services` y una validación para impedir valores negativos. **No borra, reemplaza ni modifica los servicios, operarios, frecuencias, horarios o asignaciones existentes.** La columna semanal anterior, si ya existe, queda conservada y sin cambios.

Después de ejecutar la migración:

1. Entrá en **Servicios**.
2. Editá cada servicio.
3. Completá **Horas totales facturadas por mes**.
4. Seleccioná el mes en el Dashboard.
5. Revisá el total facturado, el total operativo mensual y los desvíos por servicio.

La carga operativa mensual se calcula con el calendario real: cada turno semanal se multiplica por la cantidad de veces que ese día aparece en el mes seleccionado. No se aplica un factor fijo de cuatro semanas.

En los estados semanales de operarios, el criterio visual queda así:

- Rojo: al operario le faltan horas y se muestra la cantidad exacta.
- Verde: al operario le sobran horas respecto de su objetivo y se muestra la cantidad exacta.
- Azul: está exactamente en objetivo.

Además, la vista de operarios muestra las horas mensuales proyectadas para el mes seleccionado.

**Alcance:** el cálculo usa el cronograma activo actual. No reconstruye automáticamente cambios históricos realizados dentro de un mes.

## Actualización: Optimizador de asignaciones

Antes de publicar esta versión, ejecutá una sola vez:

`sql/migration_add_optimizer_locations.sql`

La migración es aditiva. Solo agrega campos opcionales de domicilio, zona y coordenadas en `workers` y coordenadas en `services`. No borra ni modifica operarios, servicios, horarios, frecuencias, materiales o asignaciones existentes.

La nueva sección **Optimizador** permite:

- simular un servicio nuevo o analizar uno ya cargado;
- excluir superposiciones horarias;
- validar si el traslado desde el servicio anterior y hacia el siguiente entra en la ventana disponible;
- comparar la nueva carga con las horas objetivo del operario;
- ponderar cercanía desde el domicilio y continuidad de zona;
- mostrar un ranking explicado con motivos, riesgos y descartes;
- preparar la carga rápida en el Planner cuando el servicio ya existe.

Las distancias se calculan localmente con coordenadas y una estimación urbana. No representan tiempos de tránsito en vivo. Cuando faltan coordenadas, la app usa la zona como aproximación y lo informa.

### Datos geográficos

En cada operario podés cargar domicilio de referencia, zona y coordenadas. En cada servicio podés cargar coordenadas. El campo acepta `latitud, longitud` o enlaces de Google Maps que contengan las coordenadas. Para proteger privacidad, puede usarse una ubicación aproximada o el centro del barrio.

Google My Maps no se consulta directamente en esta versión. La estructura quedó preparada para una integración posterior mediante exportación KML o una API de mapas.

## Actualización: Mapa operativo

La sección **Mapa** reutiliza las coordenadas ya incorporadas por `sql/migration_add_optimizer_locations.sql`, por lo que no requiere una nueva modificación de base de datos.

Incluye:

- marcadores diferenciados para servicios y operarios;
- búsqueda por nombre, zona, dirección o asignaciones vinculadas;
- filtros por tipo de registro y zona;
- detalle de horas, agenda y cobertura al seleccionar un punto;
- líneas visuales entre un operario y sus servicios activos, o entre un servicio y sus operarios asignados;
- listado de registros sin coordenadas con acceso directo a edición;
- exportación a Excel de ubicaciones cargadas y pendientes.

El mapa base se carga con **Leaflet + OpenStreetMap**. No se sincroniza automáticamente con Google My Maps: la fuente de verdad sigue siendo Supabase, lo que evita mantener dos bases desalineadas. Google Maps se usa solo como enlace externo opcional para abrir una ubicación puntual.

Para domicilios de operarios, es recomendable guardar una coordenada aproximada del barrio o una esquina cercana en lugar de la ubicación exacta.

## Stack

- Frontend estático: HTML + CSS + JavaScript.
- Backend: Supabase (Auth + Postgres + Realtime).
- Deploy sugerido: GitHub Pages para frontend + Supabase para datos.

## Estructura

- `index.html`: interfaz principal.
- `styles.css`: estilos.
- `app.js`: lógica cliente.
- `supabase-config.js`: credenciales del proyecto.
- `sql/schema.sql`: tablas, políticas y realtime.

## Pasos de implementación

### 1) Crear proyecto en Supabase

Creá un proyecto nuevo en Supabase.

### 2) Ejecutar el SQL

En el SQL Editor de Supabase, pegá y ejecutá `sql/schema.sql`.

### 3) Crear el primer usuario

En Authentication > Users, creá un usuario con email y contraseña. Después vas a poder crear más usuarios desde el mismo login de la app.

**Importante:** si tenés activa la confirmación por email en Supabase, cada usuario nuevo va a tener que validar su correo antes de entrar. Si querés alta inmediata, desactivá esa confirmación en Authentication.

### 4) Configurar el frontend

Editá `supabase-config.js` con:

```js
window.SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
window.SUPABASE_ANON_KEY = 'TU-ANON-KEY';
```

### 5) Subir a GitHub Pages

Subí todos los archivos del proyecto a un repositorio y activá GitHub Pages.

## Carga inicial de tus datos

Tu Excel/Sheet actual tiene la información mezclada por fila. Para pasarla bien al sistema, conviene este criterio:

- **workers**: una fila por operario.
- **services**: una fila por cliente/servicio.
- **assignments**: una fila por cada bloque horario por día.

Ejemplo:

- Operario: `Ramirez Melina`
- Servicio: `Cons. Thomas Le Bretón 5153`
- Asignación 1: lunes 08:00 a 16:00
- Asignación 2: martes 08:00 a 16:00
- etc.

## Recomendación operativa

No sigas empujando toda la lógica en una sola grilla. Escala mal, se vuelve ilegible y después nadie quiere tocarla por miedo a romper algo. La arquitectura correcta es separar:

1. Operarios
2. Servicios
3. Asignaciones
4. Resumen calculado

## Siguiente mejora recomendada

La siguiente fase lógica es agregar:

- importador CSV desde tu Google Sheet actual,
- bloqueo por permisos,
- alertas de superposición horaria,
- panel de reemplazos.

Ese roadmap ya es más serio y reduce bastante el caos operativo.


## Seguimiento de ausentismo anualizado

La sección **Ausencias** calcula el acumulado anual por operario usando un criterio de 365 días y una tolerancia interna de 3% anual. Para medir bien, cada operario debe tener cargada su **fecha de ingreso** (`hire_date`). Si falta ese dato, la app lo marca y evita inventar un porcentaje engañoso.


## Tardanzas

La sección **Ausencias** ahora permite registrar **tardanzas** por operario, servicio y fecha, con hora prevista, hora real de llegada, minutos de demora, seguimiento anualizado y registro histórico desde el ingreso del operario.


## Optimizador de cercanía

La sección **Optimizador de cercanía** compara las coordenadas del domicilio de cada operario con las coordenadas de todos los servicios. Muestra:

- distancia promedio actual por operario;
- ranking de servicios cercanos;
- oportunidades de reubicación;
- intercambios entre dos operarios que reducen la distancia conjunta;
- registros sin coordenadas que limitan la precisión.

Esta primera etapa analiza únicamente distancia. No modifica asignaciones ni valida horarios, carga semanal, requisitos del cliente o continuidad. Para confirmar una propuesta, debe revisarse luego en el Optimizador de asignaciones. No requiere una migración SQL adicional.


## Turnos nocturnos

La app admite jornadas que cruzan la medianoche. Cuando la hora de finalización es anterior a la hora de inicio, se interpreta que el turno termina al día siguiente y se muestra la marca `(+1 día)`. Para bases ya creadas, ejecutar `sql/migration_allow_overnight_shifts.sql`.


## Proyección mensual de facturación

La sección **Facturación mensual** separa tres conceptos:

- **Proyección contractual:** horas esperadas según días, franjas y cantidad de puestos simultáneos vendidos.
- **Novedades:** descuentos por horas realmente no prestadas o adicionales aprobados.
- **Horas operativas:** horas proyectadas desde las asignaciones activas de los operarios.

Para habilitarla, ejecutar `sql/migration_add_billing_forecast.sql` en Supabase. La migración es aditiva y no borra ni modifica datos existentes.

Los servicios que todavía no tengan reglas continúan usando `billed_monthly_hours` como referencia manual de respaldo.

### Ejemplos para agosto de 2026

- Lunes a viernes de 08:00 a 12:00, 1 puesto: **84 horas proyectadas** (21 días hábiles × 4 horas).
- Lunes a domingo de 00:00 a 00:00 no es válido porque inicio y fin no pueden coincidir. Para una cobertura 24 horas se deben crear, por ejemplo, tres bloques: 00:00–08:00, 08:00–16:00 y 16:00–00:00.
- Cobertura 24/7 con 1 puesto: **744 horas** en agosto de 2026.
- Cobertura 24/7 con 3 puestos simultáneos: **2.232 horas** en agosto de 2026.

La cantidad de operarios contratados no define por sí sola las horas facturables. Lo que las define es la cantidad de puestos simultáneos vendidos y sus franjas de cobertura.


## Balance mensual de dotación

El Dashboard compara tres capas distintas para el mes seleccionado:

1. **Horas objetivo de la dotación:** se calculan desde la jornada semanal de cada operario y los días reales del calendario. No se usa un multiplicador fijo de cuatro semanas.
2. **Horas efectivamente asignadas:** se proyectan desde los horarios semanales activos de cada operario sobre el mes seleccionado.
3. **Horas facturables estimadas:** se obtienen desde las reglas de cobertura contractual y las novedades de facturación.

Para jornada completa se utiliza como patrón 8 horas de lunes a viernes y 4 horas el sábado. Para media jornada, 4 horas de lunes a sábado. Los objetivos semanales personalizados se distribuyen proporcionalmente sobre ese patrón. El personal sin objetivo fijo se incorpora a la referencia de nómina con sus horas efectivamente asignadas.

La vista muestra por separado las horas faltantes y las horas excedidas de los operarios, porque compensarlas en un único saldo ocultaría desvíos individuales.


## Actualización: facturación por defecto según horas operativas

- Si un servicio no tiene una cobertura comercial ni una referencia manual específica, la **Proyección base** se calcula automáticamente con sus horas operativas del mes.
- La **Facturación ajustada** coincide inicialmente con esa proyección.
- Al cierre del mes se puede usar **Editar facturación final** para cargar el total realmente facturado. La aplicación registra únicamente la diferencia necesaria, sin cambiar horarios, asignaciones ni datos históricos.
- También se mantiene **Registrar novedad** para descuentos o adicionales puntuales durante el mes.
- Esta actualización no requiere ejecutar SQL nuevo.

## Corrección: jornadas objetivo de operarios por hora

El objetivo mensual ahora se determina por la cantidad de horas objetivo semanales, aunque el operario figure como `Seguro / por hora`:

- 44 hs: patrón de 8 hs de lunes a viernes y 4 hs el sábado.
- 24 hs: patrón de 4 hs de lunes a sábado.
- Objetivos personalizados: ajuste proporcional sobre el patrón correspondiente.

Esto elimina resultados fraccionarios incorrectos generados por repartir una jornada de 44 hs en seis partes iguales. No requiere cambios en Supabase.

## Actualización: facturación alineada con operación

La proyección base mensual de cada servicio se toma automáticamente de las horas operativas asignadas para el mes. Las referencias manuales y coberturas comerciales existentes se conservan como referencia, mientras que las novedades y la edición de facturación final permiten ajustar el cierre real.

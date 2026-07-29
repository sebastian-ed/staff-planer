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

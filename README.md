# Clean It · Planificador Operativo

Web app mobile-first para visualizar y editar asignaciones de operarios por servicio con Supabase en tiempo real.

## Qué resuelve

- Ver rápidamente qué operario está en cada servicio.
- Controlar horas asignadas vs. horas objetivo.
- Detectar operarios con horas libres o excedidos.
- Editar operarios, servicios y asignaciones desde cualquier dispositivo.
- Ver cambios en vivo entre varios usuarios.

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

### 3) Crear un usuario administrador

En Authentication > Users, creá un usuario con email y contraseña.

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
- vista mensual,
- bloqueo por permisos,
- alertas de superposición horaria,
- panel de reemplazos.

Ese roadmap ya es más serio y reduce bastante el caos operativo.

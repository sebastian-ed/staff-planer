import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const DAYS = [
  { value: 1, label: 'Lun', fullLabel: 'Lunes' },
  { value: 2, label: 'Mar', fullLabel: 'Martes' },
  { value: 3, label: 'Mié', fullLabel: 'Miércoles' },
  { value: 4, label: 'Jue', fullLabel: 'Jueves' },
  { value: 5, label: 'Vie', fullLabel: 'Viernes' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
];

const TYPE_META = {
  full_time: { label: 'Jornada completa', defaultHours: 44 },
  part_time: { label: 'Media jornada', defaultHours: 24 },
  insurance: { label: 'Seguro / por hora', defaultHours: null },
};

const ABSENCE_TYPE_META = {
  injustificada: 'Injustificada',
  justificada: 'Justificada',
  suspension: 'Suspensión',
};

const FINAL_BILLING_OVERRIDE_MARKER = '[[FINAL_BILLING_OVERRIDE]]';
const FINAL_BILLING_OVERRIDE_REASON = 'Cierre mensual manual';


const DASHBOARD_HELP = {
  overview: {
    title: 'Cómo leer el balance mensual',
    html: `
      <p>El balance separa tres variables que pueden parecer similares, pero miden cosas distintas:</p>
      <ul>
        <li><strong>Horas objetivo de la dotación:</strong> lo que deberían trabajar los operarios según su jornada.</li>
        <li><strong>Horas efectivamente asignadas:</strong> lo que realmente tienen cargado en el cronograma.</li>
        <li><strong>Facturación estimada:</strong> lo que proyectás cobrar a los clientes.</li>
      </ul>
      <p>Además, los indicadores de desvío se leen así:</p>
      <ul>
        <li><strong>Horas faltantes vs jornada:</strong> suma todas las horas que los operarios deberían trabajar pero todavía no tienen asignadas.</li>
        <li><strong>Horas excedidas vs jornada:</strong> suma todas las horas que los operarios están trabajando por encima de su objetivo.</li>
        <li><strong>Neto de dotación:</strong> horas asignadas menos horas objetivo.</li>
        <li><strong>Asignadas vs facturación:</strong> diferencia en horas y porcentaje entre lo que trabaja la dotación y lo que se estima facturar.</li>
        <li><strong>Facturación vs objetivo de dotación:</strong> compara las horas que se estima cobrar con las horas que la empresa debería cubrir según la jornada objetivo de toda la dotación.</li>
      </ul>
      <div class="dashboard-help-example">
        <strong>Ejemplo simple</strong>
        <p>Si 10 operarios deberían trabajar 24 hs y a cada uno le faltan 5 hs, el sistema acumula <strong>50 hs de jornada sin asignar</strong>.</p>
        <p>Si al mismo tiempo otros operarios tienen 20 hs excedidas, la app sigue mostrando <strong>50 hs faltantes</strong> y <strong>20 hs excedidas</strong> por separado, además de un <strong>neto de -30 hs</strong>. Así un exceso no oculta capacidad ociosa de otros trabajadores.</p>
      </div>
    `,
  },
  headcount: {
    title: 'Estado de la dotación',
    html: `
      <p><strong>Qué muestra:</strong> cuántos operarios hay cargados y cómo están respecto de su jornada objetivo en el mes seleccionado.</p>
      <ul>
        <li><strong>Con jornada asignada:</strong> operarios que tienen un objetivo semanal definido, por ejemplo 24 hs o 44 hs.</li>
        <li><strong>Sin jornada asignada:</strong> operarios sin un objetivo fijo de horas. No pueden clasificarse como equilibrados, por debajo o por encima.</li>
        <li><strong>Equilibrados:</strong> sus horas asignadas del mes coinciden con su objetivo mensual.</li>
        <li><strong>Por debajo:</strong> tienen menos horas asignadas que las que deberían cumplir.</li>
        <li><strong>Por encima:</strong> tienen más horas asignadas que su jornada objetivo.</li>
      </ul>
      <p>Los porcentajes de <strong>con/sin jornada</strong> se calculan sobre el total de operarios. Los porcentajes de <strong>equilibrados, por debajo y por encima</strong> se calculan únicamente sobre los operarios que sí tienen una jornada objetivo.</p>
    `,
  },
  target: {
    title: 'Horas objetivo de la dotación',
    html: `
      <p><strong>Qué significa:</strong> lo que deberían trabajar los operarios según su jornada.</p>
      <p>La app toma las horas objetivo semanales de cada operario y las proyecta sobre los días reales del mes seleccionado. No supone que todos los meses tienen exactamente cuatro semanas.</p>
      <p><strong>Para qué sirve:</strong> representa la cantidad de horas de personal que la empresa tiene comprometidas como jornada objetivo.</p>
    `,
  },
  assigned: {
    title: 'Horas efectivamente asignadas',
    html: `
      <p><strong>Qué significa:</strong> lo que realmente tienen cargado los operarios en el cronograma.</p>
      <p>Se calcula a partir de los días y horarios de las asignaciones activas y se proyecta sobre el calendario real del mes seleccionado.</p>
      <p>Puede ser menor, igual o mayor que las horas objetivo de la dotación.</p>
    `,
  },
  billing: {
    title: 'Facturación estimada',
    html: `
      <p><strong>Qué significa:</strong> lo que proyectás cobrar a los clientes durante el mes.</p>
      <p>Es la referencia comercial contra la que conviene comparar las horas que efectivamente está utilizando la dotación.</p>
      <p>Al cierre del mes puede ajustarse si hubo horas no prestadas, descuentos, adicionales u otras novedades.</p>
    `,
  },
  missing: {
    title: 'Horas faltantes vs jornada',
    html: `
      <p><strong>Qué significa:</strong> suma todas las horas que los operarios deberían trabajar pero todavía no tienen asignadas.</p>
      <div class="dashboard-help-example">
        <strong>Ejemplo</strong>
        <p>Si 10 operarios deberían trabajar 24 hs y a cada uno le faltan 5 hs, el sistema muestra un déficit acumulado de <strong>50 hs</strong>.</p>
      </div>
      <p>Son horas de jornada objetivo que hoy no están siendo utilizadas en servicios.</p>
    `,
  },
  excess: {
    title: 'Horas excedidas vs jornada',
    html: `
      <p><strong>Qué significa:</strong> suma todas las horas que los operarios están trabajando por encima de su objetivo.</p>
      <p>Por ejemplo, si una persona tiene una jornada objetivo de 24 hs pero está asignada 30 hs, aporta <strong>6 hs excedidas</strong> al total.</p>
      <p>Las horas excedidas se muestran por separado de las faltantes para que un exceso no oculte capacidad ociosa en otros operarios.</p>
    `,
  },
  net: {
    title: 'Neto de dotación vs jornada',
    html: `
      <p><strong>Cómo se calcula:</strong> horas asignadas menos horas objetivo.</p>
      <p>Un resultado negativo indica que, en el total, hay horas objetivo de la dotación que todavía no están asignadas. Un resultado positivo indica que la dotación está trabajando por encima de su objetivo total.</p>
      <div class="dashboard-help-example">
        <strong>Importante</strong>
        <p>El neto no reemplaza a los indicadores de faltantes y excedidas. Si hay 50 hs faltantes y 20 hs excedidas, el neto es <strong>-30 hs</strong>, pero la app conserva ambos valores por separado.</p>
      </div>
    `,
  },
  assignedBilling: {
    title: 'Asignadas vs facturación',
    html: `
      <p><strong>Qué significa:</strong> diferencia en horas y porcentaje entre lo que trabaja la dotación y lo que se estima facturar.</p>
      <p>Si las horas asignadas superan a las facturables, la operación está utilizando más horas de personal que las que proyecta cobrar. Si están por debajo, faltan horas operativas para alcanzar la proyección comercial.</p>
      <p>El objetivo es que este indicador tienda a un equilibrio operativo, sin perder de vista los faltantes y excedentes individuales de jornada.</p>
    `,
  },
  billingTarget: {
    title: 'Facturación vs objetivo de dotación',
    html: `
      <p><strong>Qué significa:</strong> compara las horas que estimás facturar a los clientes con las horas que debería trabajar toda la dotación según sus jornadas objetivo.</p>
      <p><strong>Cómo se calcula:</strong> facturación estimada del mes menos objetivo mensual de dotación.</p>
      <p>Si el resultado es negativo, tenés más horas de jornada objetivo que horas estimadas para cobrar: existe capacidad laboral que comercialmente todavía no está respaldada por servicios. Si es positivo, las horas estimadas a facturar superan la capacidad objetivo de la dotación y probablemente debas cubrirlas con horas excedidas, reorganización o mayor dotación.</p>
      <div class="dashboard-help-example">
        <strong>Ejemplo</strong>
        <p>Si estimás facturar 2.500 hs y la dotación debería cumplir 2.800 hs, el balance es <strong>-300 hs</strong>: la dotación objetivo está <strong>10,7%</strong> por encima de las horas vendidas.</p>
      </div>
      <p>Este indicador es estructural: muestra si la cartera de servicios alcanza para absorber las horas que la empresa debería pagar según las jornadas objetivo, independientemente de cómo estén asignadas hoy.</p>
    `,
  },
};

const VIEW_IDS = {
  dashboard: 'dashboardView',
  workers: 'workersView',
  services: 'servicesView',
  billing: 'billingView',
  planner: 'plannerView',
  map: 'mapView',
  optimizer: 'optimizerView',
  proximity: 'proximityView',
  absences: 'absencesView',
  materials: 'materialsView',
};

const PAGINATION_DEFAULTS = {
  workers: 8,
  services: 9,
  absenceSchedule: 8,
  absenceHistory: 8,
  absenceTracker: 6,
  absenceEmployeeHistory: 8,
  absenceMonthly: 8,
  tardinessHistory: 8,
  tardinessTracker: 6,
  tardinessEmployeeHistory: 8,
};

function createEmptyDerivedState() {
  return {
    workerById: new Map(),
    serviceById: new Map(),
    assignmentById: new Map(),
    absenceById: new Map(),
    tardinessById: new Map(),
    materialById: new Map(),
    materialByNormalizedName: new Map(),
    serviceMaterialById: new Map(),
    materialConsumptionById: new Map(),
    assignmentsByWorkerId: new Map(),
    assignmentsByServiceId: new Map(),
    assignmentsByDay: new Map(),
    absencesByDateKey: new Map(),
    absencesByWorkerId: new Map(),
    tardinessesByDateKey: new Map(),
    tardinessesByWorkerId: new Map(),
    serviceMaterialsByServiceId: new Map(),
    serviceMaterialsByMaterialId: new Map(),
    materialConsumptionsByServiceMaterialId: new Map(),
    materialConsumptionsByMonthKey: new Map(),
    serviceSearchById: new Map(),
    assignmentSearchById: new Map(),
    absenceSearchById: new Map(),
    tardinessSearchById: new Map(),
    materialSearchById: new Map(),
    serviceMaterialSearchById: new Map(),
  };
}

const state = {
  user: null,
  workers: [],
  services: [],
  billingRules: [],
  billingAdjustments: [],
  billingSchemaReady: true,
  billingMonth: '',
  assignments: [],
  absences: [],
  tardinesses: [],
  materials: [],
  serviceMaterials: [],
  materialConsumptions: [],
  currentView: 'dashboard',
  dashboardMonth: '',
  optimizerResults: null,
  proximityResults: null,
  mapSelection: null,
  mapHasFitted: false,
  authMode: 'login',
  filters: {
    search: '',
    workerType: 'all',
    status: 'all',
  },
  pagination: {
    workers: { page: 1, pageSize: PAGINATION_DEFAULTS.workers },
    services: { page: 1, pageSize: PAGINATION_DEFAULTS.services },
    absenceSchedule: { page: 1, pageSize: PAGINATION_DEFAULTS.absenceSchedule },
    absenceHistory: { page: 1, pageSize: PAGINATION_DEFAULTS.absenceHistory },
    absenceTracker: { page: 1, pageSize: PAGINATION_DEFAULTS.absenceTracker },
    absenceEmployeeHistory: { page: 1, pageSize: PAGINATION_DEFAULTS.absenceEmployeeHistory },
    absenceMonthly: { page: 1, pageSize: PAGINATION_DEFAULTS.absenceMonthly },
    tardinessHistory: { page: 1, pageSize: PAGINATION_DEFAULTS.tardinessHistory },
    tardinessTracker: { page: 1, pageSize: PAGINATION_DEFAULTS.tardinessTracker },
    tardinessEmployeeHistory: { page: 1, pageSize: PAGINATION_DEFAULTS.tardinessEmployeeHistory },
  },
  realtimeChannel: null,
  dataReady: false,
  loadingData: false,
  hasLoadedOnce: false,
  activeLoadPromise: null,
  ignoreRealtimeUntil: 0,
  derived: createEmptyDerivedState(),
};

const el = {};
let supabase;
let operationsMap = null;
let mapMarkerLayer = null;
let mapConnectionLayer = null;
const mapMarkers = new Map();
const DEFAULT_MAP_CENTER = [-34.6037, -58.3816];
const DEFAULT_MAP_ZOOM = 11;

let deferredPwaPrompt = null;

function syncPwaInstallButton() {
  const button = document.getElementById('installPwaBtn');
  if (!button) return;
  const isStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  button.classList.toggle('hidden', isStandalone || !deferredPwaPrompt);
}

async function handlePwaInstall() {
  if (!deferredPwaPrompt) return;
  const promptEvent = deferredPwaPrompt;
  deferredPwaPrompt = null;
  syncPwaInstallButton();
  await promptEvent.prompt();
  try {
    await promptEvent.userChoice;
  } catch (error) {
    // El navegador puede cerrar el prompt sin devolver un resultado utilizable.
  }
}

function registerPwaSupport() {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPwaPrompt = event;
    syncPwaInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPwaPrompt = null;
    syncPwaInstallButton();
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch((error) => {
        console.warn('No se pudo registrar el service worker de la PWA.', error);
      });
    });
  }
}

registerPwaSupport();

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeSearchText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesSearchText(haystack, query) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const normalizedHaystack = normalizeSearchText(haystack);
  const tokens = normalizedQuery.split(' ').filter(Boolean);
  return tokens.every((token) => normalizedHaystack.includes(token));
}

function getSearchScore(primaryText, searchText, query) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedPrimary = normalizeSearchText(primaryText);
  const normalizedSearch = normalizeSearchText(searchText);

  if (!normalizedQuery || !matchesSearchText(normalizedSearch, normalizedQuery)) return -1;
  if (normalizedPrimary === normalizedQuery) return 100;
  if (normalizedPrimary.startsWith(normalizedQuery)) return 80;
  if (normalizedPrimary.includes(normalizedQuery)) return 65;
  if (normalizedSearch.includes(normalizedQuery)) return 50;
  return 35;
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const num = Number(value);
  return Number.isInteger(num)
    ? String(num)
    : num.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function getMonthKey(dateKey) {
  if (!dateKey) return '';
  return String(dateKey).slice(0, 7);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getSelectedDashboardMonth() {
  const fallback = /^\d{4}-\d{2}$/.test(state.dashboardMonth)
    ? state.dashboardMonth
    : getCurrentMonthKey();

  if (!el.dashboardMonthFilter) return fallback;

  if (!/^\d{4}-\d{2}$/.test(el.dashboardMonthFilter.value || '')) {
    el.dashboardMonthFilter.value = fallback;
  }

  state.dashboardMonth = el.dashboardMonthFilter.value || fallback;
  return state.dashboardMonth;
}

function initializeDashboardMonth() {
  let savedMonth = '';
  try {
    savedMonth = window.localStorage.getItem('staffPlannerDashboardMonth') || '';
  } catch (error) {
    savedMonth = '';
  }

  state.dashboardMonth = /^\d{4}-\d{2}$/.test(savedMonth)
    ? savedMonth
    : getCurrentMonthKey();

  if (el.dashboardMonthFilter) {
    el.dashboardMonthFilter.value = state.dashboardMonth;
  }
  if (el.workersMonthFilter) {
    el.workersMonthFilter.value = state.dashboardMonth;
  }
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '—';
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function formatAbsenceTypeLabel(value) {
  return ABSENCE_TYPE_META[value] || 'Sin clasificar';
}

function parseDateKeyToLocalDate(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getMonthStartDate(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function getMonthEndDate(monthKey) {
  const start = getMonthStartDate(monthKey);
  if (!start) return null;
  return new Date(start.getFullYear(), start.getMonth() + 1, 0);
}

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getScheduledHoursForWorkerTypeOnDate(workerType, date) {
  const weekday = date?.getDay?.();
  if (weekday == null) return 0;

  if (workerType === 'full_time') {
    if (weekday >= 1 && weekday <= 5) return 8;
    if (weekday === 6) return 4;
    return 0;
  }

  if (workerType === 'part_time' || workerType === 'insurance') {
    if (weekday >= 1 && weekday <= 6) return 4;
    return 0;
  }

  return 0;
}

function getWorkerTargetHoursForDate(worker, date) {
  if (!worker || !(date instanceof Date) || Number.isNaN(date.getTime())) return 0;

  const weeklyTarget = Number(getTargetHours(worker));
  if (!Number.isFinite(weeklyTarget)) return null;

  // La distribución mensual debe depender de la jornada objetivo, no solo de la
  // etiqueta contractual. Esto evita que un operario "Seguro / por hora" con
  // objetivo de 44 hs se reparta como 44/6 y genere valores como 190,67 hs.
  let scheduleType = worker.worker_type;

  if (Math.abs(weeklyTarget - 44) < 0.01) {
    scheduleType = 'full_time';
  } else if (Math.abs(weeklyTarget - 24) < 0.01) {
    scheduleType = 'part_time';
  } else if (scheduleType === 'insurance') {
    scheduleType = weeklyTarget > 24 ? 'full_time' : 'part_time';
  }

  const referenceWeeklyTarget = TYPE_META[scheduleType]?.defaultHours;
  const baseHours = getScheduledHoursForWorkerTypeOnDate(scheduleType, date);

  if (referenceWeeklyTarget && referenceWeeklyTarget > 0) {
    return baseHours * (weeklyTarget / Number(referenceWeeklyTarget));
  }

  return 0;
}

function calculateMonthlyTargetHours(worker, monthKey) {
  const monthStart = getMonthStartDate(monthKey);
  const monthEnd = getMonthEndDate(monthKey);
  if (!monthStart || !monthEnd || !worker) return null;

  const weeklyTarget = getTargetHours(worker);
  if (weeklyTarget == null) return null;

  const hireDate = parseDateKeyToLocalDate(worker.hire_date);
  if (hireDate && hireDate > monthEnd) return 0;

  const effectiveStart = hireDate && hireDate > monthStart
    ? hireDate
    : monthStart;

  let totalHours = 0;
  const cursor = new Date(effectiveStart);

  while (cursor <= monthEnd) {
    totalHours += Number(getWorkerTargetHoursForDate(worker, cursor) || 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  return Number(totalHours.toFixed(2));
}

function formatHours(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2).replace('.00', '');
}

const MINUTES_PER_DAY = 24 * 60;
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

function timeToMinutes(timeValue) {
  if (!timeValue) return null;
  const [hours, minutes] = String(timeValue).slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return (hours * 60) + minutes;
}

function calculateShiftMinutes(startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (startMinutes == null || endMinutes == null || startMinutes === endMinutes) return 0;
  return endMinutes > startMinutes
    ? endMinutes - startMinutes
    : (MINUTES_PER_DAY - startMinutes) + endMinutes;
}

function calculateHours(startTime, endTime) {
  return calculateShiftMinutes(startTime, endTime) / 60;
}

function isOvernightShift(startTime, endTime) {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  return startMinutes != null && endMinutes != null && endMinutes < startMinutes;
}

function formatShiftRange(startTime, endTime, separator = '–') {
  if (!startTime || !endTime) return 'Horario sin informar';
  const start = String(startTime).slice(0, 5);
  const end = String(endTime).slice(0, 5);
  return `${start}${separator}${end}${isOvernightShift(startTime, endTime) ? ' (+1 día)' : ''}`;
}

function getNextDayValue(dayValue) {
  return (Number(dayValue) + 1) % 7;
}

function getDayLabel(dayValue, full = false) {
  const day = DAYS.find((item) => Number(item.value) === Number(dayValue));
  return full ? (day?.fullLabel || '') : (day?.label || '');
}

function buildOvernightConfirmation(dayValues, startTime, endTime) {
  if (!isOvernightShift(startTime, endTime)) return '';
  const days = (Array.isArray(dayValues) ? dayValues : [dayValues])
    .map((dayValue) => `${getDayLabel(dayValue, true)} → ${getDayLabel(getNextDayValue(dayValue), true)}`)
    .filter(Boolean)
    .join(', ');
  return `Turno nocturno detectado: ${formatShiftRange(startTime, endTime)}.\n\nEl turno comenzará en el día seleccionado y finalizará al día siguiente${days ? ` (${days})` : ''}. Se computarán ${formatHours(calculateHours(startTime, endTime))} horas por jornada.\n\n¿Querés guardarlo?`;
}

function getWeeklyShiftInterval(dayOfWeek, startTime, endTime, weekOffset = 0) {
  const startMinutes = timeToMinutes(startTime);
  const durationMinutes = calculateShiftMinutes(startTime, endTime);
  if (startMinutes == null || durationMinutes <= 0) return null;
  const start = ((weekOffset * 7) + Number(dayOfWeek)) * MINUTES_PER_DAY + startMinutes;
  return { start, end: start + durationMinutes };
}

function weeklyIntervalsOverlap(dayA, startA, endA, dayB, startB, endB) {
  const intervalA = getWeeklyShiftInterval(dayA, startA, endA, 0);
  if (!intervalA) return false;
  return [-1, 0, 1].some((weekOffset) => {
    const intervalB = getWeeklyShiftInterval(dayB, startB, endB, weekOffset);
    return intervalB && intervalA.start < intervalB.end && intervalB.start < intervalA.end;
  });
}

function intervalsOverlap(startA, endA, startB, endB) {
  const aStart = timeToMinutes(startA);
  const bStart = timeToMinutes(startB);
  const aDuration = calculateShiftMinutes(startA, endA);
  const bDuration = calculateShiftMinutes(startB, endB);
  if (aStart == null || bStart == null || aDuration <= 0 || bDuration <= 0) return false;
  return aStart < (bStart + bDuration) && bStart < (aStart + aDuration);
}

function parseCoordinates(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch (error) {
    decoded = raw;
  }

  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d{1,2}(?:\.\d+)?)[,;\s]+(-?\d{1,3}(?:\.\d+)?)/,
    /(-?\d{1,2}(?:\.\d+)?)[,;\s]+(-?\d{1,3}(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (
      Number.isFinite(latitude)
      && Number.isFinite(longitude)
      && latitude >= -90
      && latitude <= 90
      && longitude >= -180
      && longitude <= 180
    ) {
      return { latitude, longitude };
    }
  }

  return null;
}

function getEntityCoordinates(entity) {
  if (!entity || entity.latitude == null || entity.longitude == null || entity.latitude === '' || entity.longitude === '') return null;
  const latitude = Number(entity.latitude);
  const longitude = Number(entity.longitude);
  if (
    !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) return null;
  return { latitude, longitude };
}

function formatCoordinates(entity) {
  const coordinates = getEntityCoordinates(entity);
  if (!coordinates) return '';
  return `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}`;
}

function haversineDistanceKm(origin, destination) {
  if (!origin || !destination) return null;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const latitudeA = toRadians(origin.latitude);
  const latitudeB = toRadians(destination.latitude);

  const haversine = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * (Math.sin(longitudeDelta / 2) ** 2)
  );
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return Number((earthRadiusKm * centralAngle).toFixed(2));
}

function estimateUrbanTravel(distanceKm) {
  if (distanceKm == null || !Number.isFinite(Number(distanceKm))) return null;
  const straightDistance = Math.max(0, Number(distanceKm));
  const estimatedRoadDistance = straightDistance * 1.25;
  const minutes = Math.ceil(((estimatedRoadDistance / 22) * 60) + 8);
  return {
    straightDistance: Number(straightDistance.toFixed(2)),
    estimatedRoadDistance: Number(estimatedRoadDistance.toFixed(2)),
    minutes: Math.max(8, minutes),
  };
}

function normalizedZone(value) {
  return normalizeSearchText(value || '');
}

function zonesMatch(zoneA, zoneB) {
  const a = normalizedZone(zoneA);
  const b = normalizedZone(zoneB);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function getLocationComparison(origin, destination, originZone = '', destinationZone = '') {
  const originCoordinates = getEntityCoordinates(origin);
  const destinationCoordinates = getEntityCoordinates(destination);

  if (originCoordinates && destinationCoordinates) {
    const distanceKm = haversineDistanceKm(originCoordinates, destinationCoordinates);
    const travel = estimateUrbanTravel(distanceKm);
    return {
      method: 'coordinates',
      distanceKm,
      estimatedMinutes: travel?.minutes ?? null,
      roadDistanceKm: travel?.estimatedRoadDistance ?? null,
      sameZone: zonesMatch(originZone, destinationZone),
    };
  }

  if (zonesMatch(originZone, destinationZone)) {
    return {
      method: 'zone',
      distanceKm: null,
      estimatedMinutes: 20,
      roadDistanceKm: null,
      sameZone: true,
    };
  }

  return {
    method: 'unknown',
    distanceKm: null,
    estimatedMinutes: null,
    roadDistanceKm: null,
    sameZone: false,
  };
}

function getWeekdayOccurrencesInMonth(monthKey) {
  const monthStart = getMonthStartDate(monthKey);
  const monthEnd = getMonthEndDate(monthKey);
  const occurrences = new Map(DAYS.map((day) => [day.value, 0]));
  if (!monthStart || !monthEnd) return occurrences;

  const cursor = new Date(monthStart);
  while (cursor <= monthEnd) {
    const weekday = cursor.getDay();
    occurrences.set(weekday, (occurrences.get(weekday) || 0) + 1);
    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences;
}

function calculateMonthlyRecurringShiftHours(dayValues, startTime, endTime, monthKey = getSelectedDashboardMonth()) {
  const monthStart = getMonthStartDate(monthKey);
  if (!monthStart) return 0;
  const monthEndExclusive = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const durationMinutes = calculateShiftMinutes(startTime, endTime);
  const selectedDays = new Set((dayValues || []).map(Number));
  if (!selectedDays.size || durationMinutes <= 0) return 0;

  let totalMilliseconds = 0;
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - 1); // Incluye la parte nocturna iniciada el último día del mes anterior.

  while (cursor < monthEndExclusive) {
    if (selectedDays.has(cursor.getDay())) {
      const shiftStart = new Date(cursor);
      const [startHour, startMinute] = String(startTime).slice(0, 5).split(':').map(Number);
      shiftStart.setHours(startHour, startMinute, 0, 0);
      const shiftEnd = new Date(shiftStart.getTime() + (durationMinutes * 60 * 1000));
      const clippedStart = shiftStart < monthStart ? monthStart : shiftStart;
      const clippedEnd = shiftEnd > monthEndExclusive ? monthEndExclusive : shiftEnd;
      if (clippedEnd > clippedStart) totalMilliseconds += clippedEnd - clippedStart;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Number((totalMilliseconds / (60 * 60 * 1000)).toFixed(2));
}

function calculateMonthlyAssignmentHours(assignments, monthKey = getSelectedDashboardMonth()) {
  const total = (assignments || []).reduce((sum, assignment) => (
    sum + calculateMonthlyRecurringShiftHours(
      [Number(assignment.day_of_week)],
      assignment.start_time,
      assignment.end_time,
      monthKey
    )
  ), 0);

  return Number(total.toFixed(2));
}


function getSelectedBillingMonth() {
  const fallback = state.billingMonth || getSelectedDashboardMonth() || getCurrentMonthKey();
  if (!el.billingMonthFilter) return fallback;
  if (!/^\d{4}-\d{2}$/.test(el.billingMonthFilter.value || '')) {
    el.billingMonthFilter.value = fallback;
  }
  state.billingMonth = el.billingMonthFilter.value || fallback;
  return state.billingMonth;
}

function getServiceBillingRules(serviceId) {
  return state.billingRules
    .filter((rule) => rule.service_id === serviceId && rule.is_active !== false)
    .sort((a, b) => String(a.start_time || '').localeCompare(String(b.start_time || '')));
}

function getServiceBillingAdjustments(serviceId, monthKey = getSelectedBillingMonth()) {
  return state.billingAdjustments
    .filter((item) => item.service_id === serviceId && getMonthKey(item.adjustment_date) === monthKey)
    .sort((a, b) => String(b.adjustment_date || '').localeCompare(String(a.adjustment_date || '')));
}

function isFinalBillingOverride(item) {
  return item?.adjustment_type === 'manual'
    && String(item?.notes || '').includes(FINAL_BILLING_OVERRIDE_MARKER);
}

function getBillingAdjustmentVisibleNotes(item) {
  return String(item?.notes || '')
    .replace(FINAL_BILLING_OVERRIDE_MARKER, '')
    .trim();
}

function getFinalBillingOverrides(serviceId, monthKey = getSelectedBillingMonth()) {
  return getServiceBillingAdjustments(serviceId, monthKey).filter(isFinalBillingOverride);
}

function getMonthLastDateKey(monthKey) {
  const monthStart = getMonthStartDate(monthKey);
  if (!monthStart) return `${monthKey}-01`;
  return toDateKey(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0));
}

function calculateBillingRuleHours(rule, monthKey) {
  const monthStart = getMonthStartDate(monthKey);
  if (!monthStart || !rule) return 0;
  const monthEndExclusive = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1);
  const durationMinutes = calculateShiftMinutes(rule.start_time, rule.end_time);
  const selectedDays = new Set((rule.days_of_week || []).map(Number));
  const positions = Math.max(1, Number(rule.positions || 1));
  if (!selectedDays.size || durationMinutes <= 0) return 0;

  const validFrom = parseDateKeyToLocalDate(rule.valid_from);
  const validUntil = parseDateKeyToLocalDate(rule.valid_until);
  let totalMilliseconds = 0;
  const cursor = new Date(monthStart);
  cursor.setDate(cursor.getDate() - 1);

  while (cursor < monthEndExclusive) {
    const shiftDateKey = toDateKey(cursor);
    const startsWithinValidity = (!validFrom || cursor >= validFrom) && (!validUntil || cursor <= validUntil);
    if (selectedDays.has(cursor.getDay()) && startsWithinValidity && shiftDateKey) {
      const shiftStart = new Date(cursor);
      const [startHour, startMinute] = String(rule.start_time).slice(0, 5).split(':').map(Number);
      shiftStart.setHours(startHour, startMinute, 0, 0);
      const shiftEnd = new Date(shiftStart.getTime() + (durationMinutes * 60 * 1000));
      const clippedStart = shiftStart < monthStart ? monthStart : shiftStart;
      const clippedEnd = shiftEnd > monthEndExclusive ? monthEndExclusive : shiftEnd;
      if (clippedEnd > clippedStart) totalMilliseconds += (clippedEnd - clippedStart) * positions;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return Number((totalMilliseconds / (60 * 60 * 1000)).toFixed(2));
}

function getServiceBillingForecast(service, monthKey = getSelectedDashboardMonth()) {
  if (!service) {
    return { projectedHours: null, adjustmentHours: 0, adjustedHours: null, source: 'pending', rules: [], adjustments: [] };
  }

  const rules = getServiceBillingRules(service.id);
  const adjustments = getServiceBillingAdjustments(service.id, monthKey);
  const adjustmentHours = Number(adjustments.reduce((sum, item) => sum + Number(item.hours_delta || 0), 0).toFixed(2));

  // La facturación estimada debe representar la demanda vendida al cliente, no la
  // cantidad de personal que hoy está asignada. Por eso la prioridad es:
  // 1) cobertura facturable por días/horarios/puestos; 2) referencia mensual manual;
  // 3) solo como respaldo provisional, las horas operativas actuales.
  let projectedHours = null;
  let source = 'pending';

  if (rules.length) {
    projectedHours = Number(rules.reduce(
      (sum, rule) => sum + calculateBillingRuleHours(rule, monthKey),
      0
    ).toFixed(2));
    source = 'rules';
  } else if (service.billed_monthly_hours != null && service.billed_monthly_hours !== '') {
    const manual = Number(service.billed_monthly_hours);
    if (Number.isFinite(manual)) {
      projectedHours = manual;
      source = 'manual';
    }
  } else {
    projectedHours = calculateMonthlyAssignmentHours(getServiceAssignments(service.id), monthKey);
    source = 'operational';
  }

  const adjustedHours = projectedHours == null
    ? null
    : Number(Math.max(0, projectedHours + adjustmentHours).toFixed(2));

  return { projectedHours, adjustmentHours, adjustedHours, source, rules, adjustments };
}

function formatBillingSource(source) {
  if (source === 'rules') return 'Calculado por cobertura';
  if (source === 'manual') return 'Referencia manual';
  if (source === 'operational') return 'Estimación operativa provisional';
  return 'Sin configuración';
}

function formatBillingDays(days) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (days || [])
    .map(Number)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((value) => getDayLabel(value))
    .filter(Boolean)
    .join(', ');
}

function calculateMinutesLate(scheduledStart, actualArrival) {
  if (!scheduledStart || !actualArrival) return null;
  const [sh, sm] = scheduledStart.split(':').map(Number);
  const [ah, am] = actualArrival.split(':').map(Number);
  const diff = (ah * 60 + am) - (sh * 60 + sm);
  return diff > 0 ? diff : 0;
}

function formatMinutes(value) {
  if (value == null || Number.isNaN(value)) return '—';
  const total = Number(value);
  if (total <= 0) return '0 min';
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts = [];
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  return parts.join(' y ') || '0 min';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debounce(fn, wait = 180) {
  let timeoutId = 0;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => fn(...args), wait);
  };
}

function pushToMapArray(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

function groupAssignmentsByDay(assignments) {
  const grouped = new Map();

  assignments.forEach((assignment) => {
    pushToMapArray(grouped, assignment.day_of_week, assignment);
  });

  return grouped;
}

function rebuildDerivedState() {
  const derived = createEmptyDerivedState();

  state.workers.forEach((worker) => {
    derived.workerById.set(worker.id, worker);
  });

  state.services.forEach((service) => {
    derived.serviceById.set(service.id, service);
    derived.serviceSearchById.set(
      service.id,
      normalizeSearchText([
        service.name,
        service.zone || '',
        service.client_address || '',
        service.supervisor_name || '',
        service.notes || '',
        service.billed_monthly_hours ?? '',
        service.latitude ?? '',
        service.longitude ?? '',
      ].join(' '))
    );
  });

  state.assignments.forEach((assignment) => {
    derived.assignmentById.set(assignment.id, assignment);
    pushToMapArray(derived.assignmentsByWorkerId, assignment.worker_id, assignment);
    pushToMapArray(derived.assignmentsByServiceId, assignment.service_id, assignment);
    pushToMapArray(derived.assignmentsByDay, assignment.day_of_week, assignment);
  });

  state.assignments.forEach((assignment) => {
    const worker = derived.workerById.get(assignment.worker_id);
    const service = derived.serviceById.get(assignment.service_id);

    derived.assignmentSearchById.set(
      assignment.id,
      normalizeSearchText([
        worker?.name || '',
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
        service?.supervisor_name || '',
      ].join(' '))
    );
  });

  state.materials.forEach((material) => {
    derived.materialById.set(material.id, material);
    derived.materialByNormalizedName.set(normalizeText(material.name), material);
    derived.materialSearchById.set(
      material.id,
      normalizeSearchText([material.name || '', material.unit || '', material.presentation || '', material.notes || ''].join(' '))
    );
  });

  state.serviceMaterials.forEach((serviceMaterial) => {
    derived.serviceMaterialById.set(serviceMaterial.id, serviceMaterial);
    pushToMapArray(derived.serviceMaterialsByServiceId, serviceMaterial.service_id, serviceMaterial);
    pushToMapArray(derived.serviceMaterialsByMaterialId, serviceMaterial.material_id, serviceMaterial);

    const service = derived.serviceById.get(serviceMaterial.service_id);
    const material = derived.materialById.get(serviceMaterial.material_id);

    derived.serviceMaterialSearchById.set(
      serviceMaterial.id,
      normalizeSearchText([
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
        service?.supervisor_name || '',
        material?.name || '',
        material?.unit || '',
        material?.presentation || '',
        serviceMaterial.notes || '',
      ].join(' '))
    );
  });

  state.materialConsumptions.forEach((consumption) => {
    derived.materialConsumptionById.set(consumption.id, consumption);
    pushToMapArray(derived.materialConsumptionsByServiceMaterialId, consumption.service_material_id, consumption);
    pushToMapArray(derived.materialConsumptionsByMonthKey, getMonthKey(consumption.consumption_date), consumption);
  });

  state.absences.forEach((absence) => {
    derived.absenceById.set(absence.id, absence);
    pushToMapArray(derived.absencesByDateKey, absence.absence_date, absence);
    pushToMapArray(derived.absencesByWorkerId, absence.worker_id, absence);

    const worker = derived.workerById.get(absence.worker_id);
    const service = derived.serviceById.get(absence.service_id);
    const coverageWorker = absence.coverage_worker_id
      ? derived.workerById.get(absence.coverage_worker_id)
      : null;

    derived.absenceSearchById.set(
      absence.id,
      normalizeSearchText([
        absence.absence_date || '',
        worker?.name || '',
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
        service?.supervisor_name || '',
        coverageWorker?.name || '',
        absence.notes || '',
        absence.coverage_status || '',
        absence.absence_type || '',
        formatAbsenceTypeLabel(absence.absence_type),
      ].join(' '))
    );
  });


  state.tardinesses.forEach((tardiness) => {
    derived.tardinessById.set(tardiness.id, tardiness);
    pushToMapArray(derived.tardinessesByDateKey, tardiness.tardiness_date, tardiness);
    pushToMapArray(derived.tardinessesByWorkerId, tardiness.worker_id, tardiness);

    const worker = derived.workerById.get(tardiness.worker_id);
    const service = derived.serviceById.get(tardiness.service_id);
    const minutesLate = tardiness.minutes_late ?? calculateMinutesLate(tardiness.scheduled_start_time, tardiness.actual_arrival_time);

    derived.tardinessSearchById.set(
      tardiness.id,
      normalizeSearchText([
        tardiness.tardiness_date || '',
        worker?.name || '',
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
        service?.supervisor_name || '',
        tardiness.notes || '',
        tardiness.scheduled_start_time || '',
        tardiness.actual_arrival_time || '',
        minutesLate == null ? '' : String(minutesLate),
      ].join(' '))
    );
  });

  state.derived = derived;
}

function getWorkerById(workerId) {
  return state.derived.workerById.get(workerId) || null;
}

function getServiceById(serviceId) {
  return state.derived.serviceById.get(serviceId) || null;
}

function getAssignmentById(assignmentId) {
  return state.derived.assignmentById.get(assignmentId) || null;
}

function getAbsenceById(absenceId) {
  return state.derived.absenceById.get(absenceId) || null;
}

function getTardinessById(tardinessId) {
  return state.derived.tardinessById.get(tardinessId) || null;
}

function getMaterialById(materialId) {
  return state.derived.materialById.get(materialId) || null;
}

function getMaterialByName(materialName) {
  return state.derived.materialByNormalizedName.get(normalizeText(materialName)) || null;
}

function getServiceMaterialById(serviceMaterialId) {
  return state.derived.serviceMaterialById.get(serviceMaterialId) || null;
}

function getMaterialConsumptionById(consumptionId) {
  return state.derived.materialConsumptionById.get(consumptionId) || null;
}

function getServiceMaterialsByServiceId(serviceId) {
  return state.derived.serviceMaterialsByServiceId.get(serviceId) || [];
}

function findServiceMaterial(serviceId, materialId) {
  return getServiceMaterialsByServiceId(serviceId).find((item) => item.material_id === materialId) || null;
}

function getMaterialConsumptionsByServiceMaterialId(serviceMaterialId) {
  return state.derived.materialConsumptionsByServiceMaterialId.get(serviceMaterialId) || [];
}

function getMaterialConsumptionsByMonth(monthKey) {
  return state.derived.materialConsumptionsByMonthKey.get(monthKey) || [];
}

function getAssignmentsByDay(dayOfWeek) {
  return state.derived.assignmentsByDay.get(dayOfWeek) || [];
}

function getAbsencesByDate(dateKey) {
  return state.derived.absencesByDateKey.get(dateKey) || [];
}

function getAbsencesByWorkerId(workerId) {
  return state.derived.absencesByWorkerId.get(workerId) || [];
}

function getTardinessesByDate(dateKey) {
  return state.derived.tardinessesByDateKey.get(dateKey) || [];
}

function getTardinessesByWorkerId(workerId) {
  return state.derived.tardinessesByWorkerId.get(workerId) || [];
}

function parseDateKey(dateKey) {
  if (!dateKey) return null;
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getDaysInYear(year) {
  const numericYear = Number(year);
  if (!numericYear) return 365;
  return new Date(numericYear, 11, 31).getDate() === 31
    ? Math.round((Date.UTC(numericYear + 1, 0, 1) - Date.UTC(numericYear, 0, 1)) / 86400000)
    : 365;
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Number(value).toFixed(2).replace(/\.00$/, '')}%`;
}


function toNoonDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function addMonthsClamped(date, monthsToAdd) {
  const safeDate = toNoonDate(date);
  if (!safeDate) return null;

  const year = safeDate.getFullYear();
  const month = safeDate.getMonth();
  const day = safeDate.getDate();
  const targetMonthIndex = month + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0, 12, 0, 0, 0).getDate();

  return new Date(targetYear, normalizedMonth, Math.min(day, lastDayOfTargetMonth), 12, 0, 0, 0);
}

function getDurationParts(startDate, endDate) {
  const start = toNoonDate(startDate);
  const end = toNoonDate(endDate);
  if (!start || !end || end < start) {
    return { years: 0, months: 0, days: 0 };
  }

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    const lastDayOfPreviousMonth = new Date(end.getFullYear(), end.getMonth(), 0, 12, 0, 0, 0).getDate();
    days += lastDayOfPreviousMonth;
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  };
}

function formatDurationParts(parts, emptyLabel = 'Hoy') {
  if (!parts) return '—';

  const segments = [];
  if (parts.years) segments.push(`${parts.years} ${parts.years === 1 ? 'año' : 'años'}`);
  if (parts.months) segments.push(`${parts.months} ${parts.months === 1 ? 'mes' : 'meses'}`);
  if (parts.days) segments.push(`${parts.days} ${parts.days === 1 ? 'día' : 'días'}`);

  if (!segments.length) return emptyLabel;
  if (segments.length === 1) return segments[0];
  if (segments.length === 2) return `${segments[0]} y ${segments[1]}`;
  return `${segments[0]}, ${segments[1]} y ${segments[2]}`;
}

function getTodayReferenceDate() {
  return toNoonDate(new Date());
}

function getWorkerLifecycleInfo(worker, referenceDate = getTodayReferenceDate()) {
  if (!worker) return null;

  const hireDate = parseDateKey(worker.hire_date);
  if (!hireDate) {
    return {
      hireDateMissing: true,
      startedYet: false,
      tenureText: 'Fecha de ingreso pendiente',
      tenureLongText: 'Fecha de ingreso pendiente',
      tenureParts: null,
      probationStatus: 'missing',
      probationBadgeText: 'Sin fecha de ingreso',
      probationDetailText: 'No se puede calcular período de prueba',
      probationDateLabel: '',
      probationEndDate: null,
      probationRemainingText: '',
      probationElapsedText: '',
      isInProbation: false,
      probationEndsToday: false,
      probationExceeded: false,
    };
  }

  const safeReference = toNoonDate(referenceDate) || getTodayReferenceDate();
  const startedYet = hireDate <= safeReference;
  const probationEndDate = addMonthsClamped(hireDate, 6);

  if (!startedYet) {
    const missingStartParts = getDurationParts(safeReference, hireDate);
    const startsInText = formatDurationParts(missingStartParts, 'Hoy');
    return {
      hireDateMissing: false,
      startedYet: false,
      tenureText: 'Aún no ingresó',
      tenureLongText: `Ingresa en ${startsInText}`,
      tenureParts: null,
      probationStatus: 'future',
      probationBadgeText: 'Ingreso pendiente',
      probationDetailText: `Ingresa en ${startsInText}`,
      probationDateLabel: probationEndDate ? formatDateLabel(toDateKey(probationEndDate)) : '',
      probationEndDate,
      probationRemainingText: '',
      probationElapsedText: '',
      isInProbation: false,
      probationEndsToday: false,
      probationExceeded: false,
    };
  }

  const tenureParts = getDurationParts(hireDate, safeReference);
  const tenureText = formatDurationParts(tenureParts, 'Hoy');
  const probationEndsToday = probationEndDate && toDateKey(safeReference) === toDateKey(probationEndDate);
  const isInProbation = probationEndDate && safeReference < probationEndDate;
  const probationExceeded = probationEndDate && safeReference > probationEndDate;

  let probationStatus = 'due';
  let probationBadgeText = 'Vence hoy';
  let probationDetailText = `Vence hoy (${formatDateLabel(toDateKey(probationEndDate))})`;
  let probationRemainingText = '';
  let probationElapsedText = '';

  if (isInProbation) {
    const remainingParts = getDurationParts(safeReference, probationEndDate);
    probationRemainingText = formatDurationParts(remainingParts, 'Hoy');
    probationStatus = 'trial';
    probationBadgeText = 'En período de prueba';
    probationDetailText = `Le faltan ${probationRemainingText} para vencer`;
  } else if (probationExceeded) {
    const elapsedParts = getDurationParts(probationEndDate, safeReference);
    probationElapsedText = formatDurationParts(elapsedParts, 'Hoy');
    probationStatus = 'passed';
    probationBadgeText = 'Período de prueba superado';
    probationDetailText = probationElapsedText === 'Hoy'
      ? 'Período de prueba vencido hoy'
      : `Superó el período de prueba hace ${probationElapsedText}`;
  }

  return {
    hireDateMissing: false,
    startedYet: true,
    tenureText,
    tenureLongText: `Está hace ${tenureText}`,
    tenureParts,
    probationStatus,
    probationBadgeText,
    probationDetailText,
    probationDateLabel: probationEndDate ? formatDateLabel(toDateKey(probationEndDate)) : '',
    probationEndDate,
    probationRemainingText,
    probationElapsedText,
    isInProbation,
    probationEndsToday,
    probationExceeded,
  };
}

function renderProbationBadge(lifecycleInfo) {
  if (!lifecycleInfo) return '';
  const statusClassMap = {
    missing: 'status-insurance',
    future: 'status-balanced',
    trial: 'status-trial',
    due: 'status-due',
    passed: 'status-passed',
  };
  const cssClass = statusClassMap[lifecycleInfo.probationStatus] || 'status-balanced';
  return `<span class="status-pill ${cssClass}">${escapeHtml(lifecycleInfo.probationBadgeText)}</span>`;
}

function diffDaysInclusive(startDate, endDate) {
  if (!(startDate instanceof Date) || Number.isNaN(startDate)) return 0;
  if (!(endDate instanceof Date) || Number.isNaN(endDate)) return 0;

  const utcStart = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const utcEnd = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if (utcEnd < utcStart) return 0;
  return Math.floor((utcEnd - utcStart) / 86400000) + 1;
}

function getDateKeyDayOfWeek(dateKey) {
  if (!dateKey) return null;
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day).getDay();
}

function formatDateLabel(dateKey) {
  if (!dateKey) return '—';
  const [year, month, day] = String(dateKey).split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function getSelectedAbsenceHistoryWorkerId() {
  return el.absenceWorkerHistoryFilter?.value || 'all';
}

function getAbsenceTrackingReferenceDateKey() {
  const period = getAbsenceActivePeriod();
  return period.endKey || getSelectedAbsenceDate() || new Date().toISOString().slice(0, 10);
}

function getWorkerAbsenceUniqueDateKeys(workerId, startKey = '', endKey = '') {
  const uniqueDates = new Set();

  getAbsencesByWorkerId(workerId).forEach((absence) => {
    const dateKey = absence.absence_date || '';
    if (!dateKey) return;
    if (startKey && dateKey < startKey) return;
    if (endKey && dateKey > endKey) return;
    uniqueDates.add(dateKey);
  });

  return [...uniqueDates].sort();
}

function getWorkerAbsenceStats(worker, referenceDateKey = getAbsenceTrackingReferenceDateKey()) {
  if (!worker) return null;

  const referenceDate = parseDateKey(referenceDateKey);
  if (!referenceDate) return null;

  const hireDate = parseDateKey(worker.hire_date);
  if (!hireDate) {
    return {
      worker,
      referenceDateKey,
      hireDateMissing: true,
      startedYet: true,
      year: referenceDate.getFullYear(),
      thresholdPercent: 3,
      thresholdAnnualAbsences: 365 * 0.03,
      daysInReferenceYear: getDaysInYear(referenceDate.getFullYear()),
      uniqueAbsenceDates: [],
      absenceCount: 0,
      elapsedDays: 0,
      actualPercent: null,
      annualizedPercent: null,
      calendarYearPercent: null,
      projectedAnnualAbsences: null,
      allowedAbsencesToDate: null,
      remainingAbsencesToThreshold: null,
      status: 'missing',
    };
  }

  const yearStart = new Date(referenceDate.getFullYear(), 0, 1, 12, 0, 0, 0);
  const periodStart = hireDate > yearStart ? hireDate : yearStart;
  const startedYet = periodStart.getTime() <= referenceDate.getTime();

  if (!startedYet) {
    return {
      worker,
      referenceDateKey,
      hireDateMissing: false,
      startedYet: false,
      year: referenceDate.getFullYear(),
      thresholdPercent: 3,
      thresholdAnnualAbsences: 365 * 0.03,
      daysInReferenceYear: getDaysInYear(referenceDate.getFullYear()),
      uniqueAbsenceDates: [],
      absenceCount: 0,
      elapsedDays: 0,
      actualPercent: 0,
      annualizedPercent: 0,
      calendarYearPercent: 0,
      projectedAnnualAbsences: 0,
      allowedAbsencesToDate: 0,
      remainingAbsencesToThreshold: 365 * 0.03,
      status: 'balanced',
      periodStartKey: periodStart.toISOString().slice(0, 10),
    };
  }

  const periodStartKey = periodStart.toISOString().slice(0, 10);
  const referenceKey = referenceDate.toISOString().slice(0, 10);
  const daysInReferenceYear = getDaysInYear(referenceDate.getFullYear());
  const uniqueAbsenceDates = getWorkerAbsenceUniqueDateKeys(worker.id, periodStartKey, referenceKey);
  const absenceCount = uniqueAbsenceDates.length;
  const elapsedDays = diffDaysInclusive(periodStart, referenceDate);
  const actualPercent = elapsedDays ? Number(((absenceCount / elapsedDays) * 100).toFixed(2)) : 0;
  const annualizedPercent = actualPercent;
  const calendarYearPercent = daysInReferenceYear ? Number(((absenceCount / daysInReferenceYear) * 100).toFixed(2)) : 0;
  const projectedAnnualAbsences = elapsedDays ? Number(((absenceCount / elapsedDays) * 365).toFixed(2)) : 0;
  const allowedAbsencesToDate = Number(((elapsedDays * 0.03)).toFixed(2));
  const remainingAbsencesToThreshold = Number(Math.max(0, (365 * 0.03) - projectedAnnualAbsences).toFixed(2));

  let status = 'available';
  if (annualizedPercent >= 3) status = 'over';
  else if (annualizedPercent >= 2) status = 'balanced';

  return {
    worker,
    referenceDateKey,
    hireDateMissing: false,
    startedYet: true,
    year: referenceDate.getFullYear(),
    thresholdPercent: 3,
    thresholdAnnualAbsences: 365 * 0.03,
    daysInReferenceYear,
    uniqueAbsenceDates,
    absenceCount,
    elapsedDays,
    actualPercent,
    annualizedPercent,
    calendarYearPercent,
    projectedAnnualAbsences,
    allowedAbsencesToDate,
    remainingAbsencesToThreshold,
    status,
    periodStartKey,
  };
}

function getFilteredWorkersForAbsenceTracking() {
  const term = state.filters.search;
  const workerTypeFilter = state.filters.workerType;

  return state.workers
    .filter((worker) => {
      if (workerTypeFilter !== 'all' && worker.worker_type !== workerTypeFilter) {
        return false;
      }

      if (!term) return true;

      const hay = normalizeSearchText([
        worker.name || '',
        worker.notes || '',
        worker.hire_date || '',
        worker.home_address || '',
        worker.home_zone || '',
        ...getWorkerAssignments(worker.id).map((assignment) => {
          const service = getServiceById(assignment.service_id);
          return `${service?.name || ''} ${service?.zone || ''} ${service?.client_address || ''}`;
        }),
      ].join(' '));

      return matchesSearchText(hay, term);
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
}

function getFilteredWorkerAbsenceStats(referenceDateKey = getAbsenceTrackingReferenceDateKey()) {
  return getFilteredWorkersForAbsenceTracking().map((worker) => getWorkerAbsenceStats(worker, referenceDateKey));
}

function summarizeCoverageStatus(absences) {
  if (absences.some((absence) => absence.coverage_status === 'uncovered')) return 'uncovered';
  if (absences.some((absence) => absence.coverage_status === 'partial')) return 'partial';
  return 'covered';
}

function buildAbsenceTimelineEntries(workerId = 'all') {
  const workers = workerId === 'all'
    ? getFilteredWorkersForAbsenceTracking()
    : [getWorkerById(workerId)].filter(Boolean);

  const entries = [];

  workers.forEach((worker) => {
    const grouped = new Map();

    getAbsencesByWorkerId(worker.id).forEach((absence) => {
      const dateKey = absence.absence_date || '';
      if (!dateKey) return;
      pushToMapArray(grouped, dateKey, absence);
    });

    [...grouped.entries()].forEach(([dateKey, absences]) => {
      const services = [];
      const coveredWorkers = new Set();
      let totalScheduledHours = 0;
      let totalCoveredHours = 0;

      absences.forEach((absence) => {
        const service = getServiceById(absence.service_id);
        if (service?.name) services.push(service.name);

        if (absence.coverage_worker_id) {
          const coverageWorker = getWorkerById(absence.coverage_worker_id);
          if (coverageWorker?.name) coveredWorkers.add(coverageWorker.name);
        }

        totalScheduledHours += calculateHours(absence.scheduled_start_time, absence.scheduled_end_time);
        totalCoveredHours += calculateHours(absence.coverage_start_time, absence.coverage_end_time);
      });

      const statsAtThatDate = getWorkerAbsenceStats(worker, dateKey);
      entries.push({
        worker,
        dateKey,
        absences,
        serviceNames: [...new Set(services)],
        coveredWorkerNames: [...coveredWorkers],
        coverageStatus: summarizeCoverageStatus(absences),
        absenceType: summarizeAbsenceType(absences),
        totalScheduledHours: Number(totalScheduledHours.toFixed(2)),
        totalCoveredHours: Number(totalCoveredHours.toFixed(2)),
        totalUncoveredHours: Number(Math.max(0, totalScheduledHours - totalCoveredHours).toFixed(2)),
        cumulativeAbsences: statsAtThatDate?.absenceCount || 0,
        cumulativePercent: statsAtThatDate?.annualizedPercent,
        projectedAnnualAbsences: statsAtThatDate?.projectedAnnualAbsences,
      });
    });
  });

  return entries.sort((a, b) => String(b.dateKey || '').localeCompare(String(a.dateKey || '')));
}

function renderAbsenteeismPill(stats) {
  if (!stats) return '';
  if (stats.hireDateMissing) {
    return '<span class="status-pill status-insurance">Falta fecha de ingreso</span>';
  }
  if (!stats.startedYet) {
    return '<span class="status-pill status-balanced">Ingreso pendiente</span>';
  }
  if (stats.status === 'over') {
    return `<span class="status-pill status-over">Superó 3%</span>`;
  }
  if (stats.status === 'balanced') {
    return `<span class="status-pill status-balanced">En seguimiento</span>`;
  }
  return `<span class="status-pill status-available">Dentro del criterio</span>`;
}

function findAbsenceForAssignmentOnDate(assignment, dateKey) {
  if (!assignment || !dateKey) return null;

  return getAbsencesByDate(dateKey).find((absence) => {
    if (absence.assignment_id && assignment.id) {
      return absence.assignment_id === assignment.id;
    }

    return absence.worker_id === assignment.worker_id && absence.service_id === assignment.service_id;
  }) || null;
}

function findTardinessForAssignmentOnDate(assignment, dateKey) {
  if (!assignment || !dateKey) return null;

  return getTardinessesByDate(dateKey).find((tardiness) => {
    if (tardiness.assignment_id && assignment.id) {
      return tardiness.assignment_id === assignment.id;
    }

    return tardiness.worker_id === assignment.worker_id && tardiness.service_id === assignment.service_id;
  }) || null;
}

function calculateCoverageHours(absence) {
  if (!absence?.coverage_start_time || !absence?.coverage_end_time) return null;
  return calculateHours(absence.coverage_start_time, absence.coverage_end_time);
}

function markLocalMutation() {
  state.ignoreRealtimeUntil = Date.now() + 1500;
}

function withTimeout(promise, ms = 12000, message = 'La operación tardó demasiado.') {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}

async function ensureWriteSession() {
  let { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  if (data?.session) return data.session;

  const refresh = await supabase.auth.refreshSession();
  if (refresh.error) throw refresh.error;
  if (!refresh.data?.session) {
    throw new Error('No hay sesión activa para guardar datos.');
  }

  return refresh.data.session;
}

function setCurrentView(viewName) {
  state.currentView = viewName;
  document.body.dataset.currentView = viewName;
}

function goToView(viewName) {
  setCurrentView(viewName);

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });

  document.querySelectorAll('.view').forEach((view) => view.classList.add('hidden'));
  const targetView = $(VIEW_IDS[viewName]);
  if (targetView) targetView.classList.remove('hidden');

  scheduleRenderCurrentView();
}

function flashElement(element) {
  if (!element) return;

  const previousTransition = element.style.transition;
  const previousBoxShadow = element.style.boxShadow;
  const previousBorderColor = element.style.borderColor;

  element.style.transition = 'box-shadow 0.25s ease, border-color 0.25s ease';
  element.style.boxShadow = '0 0 0 3px rgba(117, 240, 194, 0.28)';
  element.style.borderColor = 'rgba(117, 240, 194, 0.65)';

  window.setTimeout(() => {
    element.style.boxShadow = previousBoxShadow;
    element.style.borderColor = previousBorderColor;
    element.style.transition = previousTransition;
  }, 1600);
}

function goToWorkerPlanner(workerId) {
  if (!ensureDataReady('abrir el planner del operario')) return;

  const worker = getWorkerById(workerId);
  if (!worker) return;

  const workerName = String(worker.name || '').trim();
  if (!workerName) return;

  if (el.globalSearch) el.globalSearch.value = workerName;
  state.filters.search = normalizeSearchText(workerName);

  goToView('planner');

  window.requestAnimationFrame(() => {
    const firstCard = el.plannerBoard?.querySelector(`[data-planner-worker-id="${workerId}"]`);
    if (!firstCard) return;

    firstCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    flashElement(firstCard);
  });
}

function goToAbsenceWorkerHistory(workerId) {
  if (!ensureDataReady('abrir el historial de ausencias')) return;

  const worker = getWorkerById(workerId);
  if (!worker) return;

  if (el.absenceWorkerHistoryFilter) {
    el.absenceWorkerHistoryFilter.value = workerId;
  }

  if (el.globalSearch) {
    el.globalSearch.value = worker.name || '';
  }

  state.filters.search = normalizeSearchText(worker.name || '');
  resetPagination('absenceEmployeeHistory');
  goToView('absences');

  window.requestAnimationFrame(() => {
    const firstCard = el.absenceEmployeeHistoryBoard?.querySelector('.absence-card');
    if (!firstCard) return;
    firstCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    flashElement(firstCard);
  });
}

function getTargetHours(worker) {
  return worker.target_hours ?? TYPE_META[worker.worker_type]?.defaultHours ?? null;
}

function getWorkerAssignments(workerId) {
  return state.derived.assignmentsByWorkerId.get(workerId) || [];
}

function getServiceAssignments(serviceId) {
  return state.derived.assignmentsByServiceId.get(serviceId) || [];
}

function getServiceBilledHours(service, monthKey = getSelectedDashboardMonth()) {
  return getServiceBillingForecast(service, monthKey).adjustedHours;
}

function getServiceHoursSummary(service, monthKey = getSelectedDashboardMonth()) {
  const assignments = getServiceAssignments(service.id);
  const assignedHours = calculateMonthlyAssignmentHours(assignments, monthKey);
  const billingForecast = getServiceBillingForecast(service, monthKey);
  const billedHours = billingForecast.adjustedHours;
  const difference = billedHours == null
    ? null
    : Number((assignedHours - billedHours).toFixed(2));

  let status = 'pending';
  if (difference != null) {
    if (Math.abs(difference) < 0.01) status = 'balanced';
    else if (difference < 0) status = 'missing';
    else status = 'over';
  }

  return {
    ...service,
    monthKey,
    assignments,
    billingForecast,
    projectedBilledHours: billingForecast.projectedHours,
    billingAdjustmentsHours: billingForecast.adjustmentHours,
    billedHours,
    assignedHours,
    difference,
    status,
  };
}

function getAllServiceHoursSummaries(monthKey = getSelectedDashboardMonth()) {
  return state.services
    .map((service) => getServiceHoursSummary(service, monthKey))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
}

function getOverallServiceHoursBalance(monthKey = getSelectedDashboardMonth()) {
  const summaries = getAllServiceHoursSummaries(monthKey);
  const configured = summaries.filter((service) => service.billedHours != null);
  const pending = summaries.filter((service) => service.billedHours == null);
  const totalBilledHours = Number(configured.reduce((sum, service) => sum + service.billedHours, 0).toFixed(2));
  const totalAssignedHours = Number(summaries.reduce((sum, service) => sum + service.assignedHours, 0).toFixed(2));
  const assignedHoursOnConfiguredServices = Number(configured.reduce((sum, service) => sum + service.assignedHours, 0).toFixed(2));
  const difference = Number((assignedHoursOnConfiguredServices - totalBilledHours).toFixed(2));

  return {
    monthKey,
    summaries,
    configured,
    pending,
    totalBilledHours,
    totalAssignedHours,
    assignedHoursOnConfiguredServices,
    difference,
  };
}

function resetPagination(viewKey) {
  const pagination = state.pagination[viewKey];
  if (pagination) pagination.page = 1;
}

function setPaginationPage(viewKey, page) {
  const pagination = state.pagination[viewKey];
  if (!pagination) return;
  pagination.page = Math.max(1, Number(page) || 1);
}

function getPaginationMeta(items, viewKey) {
  const pagination = state.pagination[viewKey];
  const pageSize = pagination?.pageSize || items.length || 1;
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, pagination?.page || 1), totalPages);

  if (pagination) pagination.page = currentPage;

  const startIndex = total ? (currentPage - 1) * pageSize : 0;
  const endIndex = Math.min(startIndex + pageSize, total);

  return {
    items: items.slice(startIndex, endIndex),
    total,
    totalPages,
    currentPage,
    pageSize,
    startIndex: total ? startIndex + 1 : 0,
    endIndex,
  };
}

function buildPaginationPages(currentPage, totalPages) {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push('ellipsis-left');
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < totalPages - 1) pages.push('ellipsis-right');

  pages.push(totalPages);
  return pages;
}

function getPaginationContainer(viewKey) {
  const containers = {
    workers: el.workersPagination,
    services: el.servicesPagination,
    absenceSchedule: el.absenceSchedulePagination,
    absenceHistory: el.absenceHistoryPagination,
    absenceTracker: el.absenceWorkerTrackerPagination,
    absenceEmployeeHistory: el.absenceEmployeeHistoryPagination,
    absenceMonthly: el.absenceMonthlyPagination,
    tardinessHistory: el.tardinessHistoryPagination,
    tardinessTracker: el.tardinessWorkerTrackerPagination,
    tardinessEmployeeHistory: el.tardinessEmployeeHistoryPagination,
  };

  return containers[viewKey] || null;
}

function getPaginationLabel(viewKey) {
  const labels = {
    workers: 'operarios',
    services: 'servicios',
    absenceSchedule: 'servicios programados',
    absenceHistory: 'ausencias',
    absenceTracker: 'operarios analizados',
    absenceEmployeeHistory: 'registros históricos',
    absenceMonthly: 'ausencias del mes',
    tardinessHistory: 'tardanzas',
    tardinessTracker: 'operarios analizados por tardanza',
    tardinessEmployeeHistory: 'registros históricos de tardanza',
  };

  return labels[viewKey] || 'registros';
}

function renderPaginationControls(viewKey, meta) {
  const container = getPaginationContainer(viewKey);
  if (!container) return;

  if (!meta.total) {
    container.innerHTML = '';
    return;
  }

  const label = getPaginationLabel(viewKey);
  const pages = buildPaginationPages(meta.currentPage, meta.totalPages);

  container.innerHTML = `
    <div class="pagination-bar">
      <div class="pagination-summary muted">Mostrando ${meta.startIndex}-${meta.endIndex} de ${meta.total} ${label}</div>
      <div class="pagination-controls">
        <button class="btn btn-secondary btn-sm" type="button" data-pagination-view="${viewKey}" data-pagination-page="${Math.max(1, meta.currentPage - 1)}" ${meta.currentPage <= 1 ? 'disabled' : ''}>Anterior</button>
        ${pages.map((page) => page === 'ellipsis-left' || page === 'ellipsis-right'
          ? '<span class="pagination-ellipsis muted">…</span>'
          : `<button class="btn btn-secondary btn-sm pagination-page-btn ${page === meta.currentPage ? 'active' : ''}" type="button" data-pagination-view="${viewKey}" data-pagination-page="${page}">${page}</button>`).join('')}
        <button class="btn btn-secondary btn-sm" type="button" data-pagination-view="${viewKey}" data-pagination-page="${Math.min(meta.totalPages, meta.currentPage + 1)}" ${meta.currentPage >= meta.totalPages ? 'disabled' : ''}>Siguiente</button>
      </div>
    </div>
  `;
}

function setDataReady(isReady) {
  state.dataReady = isReady;

  const shouldDisable = !isReady && !state.hasLoadedOnce;
  const ids = [
    'refreshBtn',
    'printViewBtn',
    'exportExcelBtn',
    'exportPdfBtn',
    'addWorkerBtn',
    'addServiceBtn',
    'addAssignmentBtn',
    'bulkAssignmentBtn',
    'addAbsenceBtn',
    'addTardinessBtn',
    'absenceDateFilter',
    'absenceWorkerHistoryFilter',
    'addMaterialCatalogBtn',
    'addServiceMaterialBtn',
    'addMaterialConsumptionBtn',
    'materialsMonthFilter',
    'materialsServiceFilter',
    'workerTypeFilter',
    'statusFilter',
    'globalSearch',
  ];

  ids.forEach((id) => {
    const node = $(id);
    if (node) node.disabled = shouldDisable;
  });
}

function ensureDataReady(actionLabel = 'esta acción') {
  if (!state.dataReady && !state.hasLoadedOnce) {
    alert(`Todavía se están cargando los datos. Esperá unos segundos antes de ${actionLabel}.`);
    return false;
  }
  return true;
}

function getFilteredServices() {
  const term = state.filters.search;

  return state.services.filter((service) => {
    const hay = state.derived.serviceSearchById.get(service.id) || '';
    return !term || matchesSearchText(hay, term);
  });
}

function getSelectedMaterialsMonth() {
  if (!el.materialsMonthFilter) return getCurrentMonthKey();
  if (!el.materialsMonthFilter.value) {
    el.materialsMonthFilter.value = getCurrentMonthKey();
  }
  return el.materialsMonthFilter.value;
}

function getSelectedMaterialsServiceId() {
  return el.materialsServiceFilter?.value || 'all';
}

function getFilteredServiceMaterials() {
  const term = state.filters.search;
  const serviceId = getSelectedMaterialsServiceId();

  return state.serviceMaterials
    .filter((serviceMaterial) => {
      if (serviceId !== 'all' && serviceMaterial.service_id !== serviceId) return false;
      const hay = state.derived.serviceMaterialSearchById.get(serviceMaterial.id) || '';
      return !term || matchesSearchText(hay, term);
    })
    .sort((a, b) => {
      const serviceA = getServiceById(a.service_id);
      const serviceB = getServiceById(b.service_id);
      const materialA = getMaterialById(a.material_id);
      const materialB = getMaterialById(b.material_id);
      const serviceNameCompare = String(serviceA?.name || '').localeCompare(String(serviceB?.name || ''), 'es', { sensitivity: 'base' });
      if (serviceNameCompare !== 0) return serviceNameCompare;
      return String(materialA?.name || '').localeCompare(String(materialB?.name || ''), 'es', { sensitivity: 'base' });
    });
}

function getFilteredMaterialConsumptions(monthKey = getSelectedMaterialsMonth()) {
  const term = state.filters.search;
  const serviceId = getSelectedMaterialsServiceId();

  return state.materialConsumptions
    .filter((consumption) => {
      if (monthKey && getMonthKey(consumption.consumption_date) !== monthKey) return false;
      if (serviceId !== 'all' && consumption.service_id !== serviceId) return false;

      if (!term) return true;

      const serviceMaterial = getServiceMaterialById(consumption.service_material_id);
      const hay = serviceMaterial
        ? (state.derived.serviceMaterialSearchById.get(serviceMaterial.id) || '')
        : [
            getServiceById(consumption.service_id)?.name || '',
            getMaterialById(consumption.material_id)?.name || '',
            consumption.notes || '',
          ].join(' ');

      return matchesSearchText(hay, term);
    })
    .sort((a, b) => {
      const byDate = String(b.consumption_date || '').localeCompare(String(a.consumption_date || ''));
      if (byDate !== 0) return byDate;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
}

function calculateAverageMonthlyConsumption(serviceMaterialId) {
  const consumptions = getMaterialConsumptionsByServiceMaterialId(serviceMaterialId);
  if (!consumptions.length) return 0;

  const monthTotals = new Map();
  consumptions.forEach((consumption) => {
    const monthKey = getMonthKey(consumption.consumption_date);
    monthTotals.set(monthKey, (monthTotals.get(monthKey) || 0) + Number(consumption.quantity || 0));
  });

  const total = [...monthTotals.values()].reduce((sum, value) => sum + value, 0);
  return monthTotals.size ? Number((total / monthTotals.size).toFixed(2)) : 0;
}

function calculateMonthConsumptionForServiceMaterial(serviceMaterialId, monthKey = getSelectedMaterialsMonth()) {
  return getMaterialConsumptionsByServiceMaterialId(serviceMaterialId)
    .filter((consumption) => getMonthKey(consumption.consumption_date) === monthKey)
    .reduce((sum, consumption) => sum + Number(consumption.quantity || 0), 0);
}

function getWorkerSummaries({ applyFilters = true } = {}) {
  const monthKey = getSelectedDashboardMonth();

  return state.workers
    .map((worker) => {
      const assignments = getWorkerAssignments(worker.id);
      const totalHours = assignments.reduce(
        (sum, assignment) => sum + calculateHours(assignment.start_time, assignment.end_time),
        0
      );

      const targetHours = getTargetHours(worker);
      const monthlyHours = calculateMonthlyAssignmentHours(assignments, monthKey);
      const monthlyTargetHours = calculateMonthlyTargetHours(worker, monthKey);
      const weeklyDifference = targetHours == null
        ? null
        : Number((targetHours - totalHours).toFixed(2));
      const monthlyDifference = monthlyTargetHours == null
        ? null
        : Number((monthlyTargetHours - monthlyHours).toFixed(2));

      let status = 'balanced';
      if (monthlyDifference == null) status = 'insurance';
      else if (monthlyDifference > 0.01) status = 'available';
      else if (monthlyDifference < -0.01) status = 'over';

      const services = [...new Set(assignments.map((assignment) => assignment.service_id))]
        .map((serviceId) => getServiceById(serviceId))
        .filter(Boolean);

      const lifecycleInfo = getWorkerLifecycleInfo(worker);

      return {
        ...worker,
        assignments,
        totalHours: Number(totalHours.toFixed(2)),
        monthlyHours,
        targetHours,
        weeklyDifference,
        monthlyTargetHours,
        monthlyDifference,
        difference: monthlyDifference,
        services,
        status,
        lifecycleInfo,
      };
    })
    .filter((summary) => !applyFilters || matchesFilters(summary))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
}

function getWorkforceMonthlyBalance(monthKey = getSelectedDashboardMonth(), summaries = null) {
  const workers = summaries || getWorkerSummaries({ applyFilters: false });
  const fixedWorkers = workers.filter((worker) => worker.monthlyTargetHours != null);
  const hourlyWorkers = workers.filter((worker) => worker.monthlyTargetHours == null);
  const serviceBalance = getOverallServiceHoursBalance(monthKey);

  const totalTargetHours = Number(fixedWorkers.reduce(
    (sum, worker) => sum + Number(worker.monthlyTargetHours || 0),
    0
  ).toFixed(2));
  const totalAssignedFixedHours = Number(fixedWorkers.reduce(
    (sum, worker) => sum + Number(worker.monthlyHours || 0),
    0
  ).toFixed(2));
  const hourlyAssignedHours = Number(hourlyWorkers.reduce(
    (sum, worker) => sum + Number(worker.monthlyHours || 0),
    0
  ).toFixed(2));
  const totalAssignedHours = Number(workers.reduce(
    (sum, worker) => sum + Number(worker.monthlyHours || 0),
    0
  ).toFixed(2));
  const payrollReferenceHours = Number((totalTargetHours + hourlyAssignedHours).toFixed(2));
  const assignmentDifference = Number((totalAssignedFixedHours - totalTargetHours).toFixed(2));
  const commercialDifference = Number((serviceBalance.totalBilledHours - payrollReferenceHours).toFixed(2));

  // Balance estructural cartera vs dotación: compara las horas estimadas a facturar
  // con las horas que debería cumplir la dotación según su jornada objetivo.
  // Negativo = hay más horas objetivo de personal que horas vendidas/proyectadas.
  // Positivo = la demanda facturable supera la capacidad objetivo de la dotación.
  const billingTargetDifference = Number((serviceBalance.totalBilledHours - totalTargetHours).toFixed(2));
  const billingTargetDifferencePercent = totalTargetHours > 0
    ? Number(((Math.abs(billingTargetDifference) / totalTargetHours) * 100).toFixed(2))
    : null;
  const billingTargetCoveragePercent = totalTargetHours > 0
    ? Number(((serviceBalance.totalBilledHours / totalTargetHours) * 100).toFixed(2))
    : null;

  // Balance operativo: compara lo que efectivamente está programado para trabajar la dotación
  // contra lo que se estima facturar a los clientes en el mismo mes.
  const operationalDifference = Number((totalAssignedHours - serviceBalance.totalBilledHours).toFixed(2));
  const operationalDifferencePercent = serviceBalance.totalBilledHours > 0
    ? Number(((Math.abs(operationalDifference) / serviceBalance.totalBilledHours) * 100).toFixed(2))
    : null;
  const operationalCoveragePercent = serviceBalance.totalBilledHours > 0
    ? Number(((totalAssignedHours / serviceBalance.totalBilledHours) * 100).toFixed(2))
    : null;

  const totalMissingHours = Number(fixedWorkers.reduce(
    (sum, worker) => sum + Math.max(0, Number(worker.monthlyDifference || 0)),
    0
  ).toFixed(2));
  const totalExcessHours = Number(fixedWorkers.reduce(
    (sum, worker) => sum + Math.max(0, -Number(worker.monthlyDifference || 0)),
    0
  ).toFixed(2));

  // Neto de dotación: compara únicamente operarios que tienen una jornada objetivo.
  // Negativo = horas de jornada pagada que todavía no tienen asignación.
  // Positivo = horas asignadas por encima del objetivo contractual.
  const targetNetDifference = Number((totalAssignedFixedHours - totalTargetHours).toFixed(2));
  const targetNetDifferencePercent = totalTargetHours > 0
    ? Number(((Math.abs(targetNetDifference) / totalTargetHours) * 100).toFixed(2))
    : null;
  const targetCoveragePercent = totalTargetHours > 0
    ? Number(((totalAssignedFixedHours / totalTargetHours) * 100).toFixed(2))
    : null;
  const missingHoursPercent = totalTargetHours > 0
    ? Number(((totalMissingHours / totalTargetHours) * 100).toFixed(2))
    : null;
  const excessHoursPercent = totalTargetHours > 0
    ? Number(((totalExcessHours / totalTargetHours) * 100).toFixed(2))
    : null;

  // Conteo de dotación y distribución por estado mensual.
  // Con/sin jornada se mide sobre el total de operarios.
  // Equilibrados/déficit/exceso se mide sobre quienes sí tienen jornada objetivo.
  const totalWorkersCount = workers.length;
  const workersWithTargetCount = fixedWorkers.length;
  const workersWithoutTargetCount = hourlyWorkers.length;
  const missingWorkers = fixedWorkers.filter((worker) => Number(worker.monthlyDifference || 0) > 0.01);
  const excessWorkers = fixedWorkers.filter((worker) => Number(worker.monthlyDifference || 0) < -0.01);
  const balancedWorkers = fixedWorkers.filter((worker) => Math.abs(Number(worker.monthlyDifference || 0)) <= 0.01);
  const workersWithTargetPercent = totalWorkersCount > 0
    ? Number(((workersWithTargetCount / totalWorkersCount) * 100).toFixed(2))
    : 0;
  const workersWithoutTargetPercent = totalWorkersCount > 0
    ? Number(((workersWithoutTargetCount / totalWorkersCount) * 100).toFixed(2))
    : 0;
  const balancedWorkersPercent = workersWithTargetCount > 0
    ? Number(((balancedWorkers.length / workersWithTargetCount) * 100).toFixed(2))
    : 0;
  const missingWorkersPercent = workersWithTargetCount > 0
    ? Number(((missingWorkers.length / workersWithTargetCount) * 100).toFixed(2))
    : 0;
  const excessWorkersPercent = workersWithTargetCount > 0
    ? Number(((excessWorkers.length / workersWithTargetCount) * 100).toFixed(2))
    : 0;

  return {
    monthKey,
    workers,
    fixedWorkers,
    hourlyWorkers,
    serviceBalance,
    totalTargetHours,
    totalAssignedFixedHours,
    hourlyAssignedHours,
    totalAssignedHours,
    payrollReferenceHours,
    assignmentDifference,
    commercialDifference,
    billingTargetDifference,
    billingTargetDifferencePercent,
    billingTargetCoveragePercent,
    operationalDifference,
    operationalDifferencePercent,
    operationalCoveragePercent,
    totalMissingHours,
    totalExcessHours,
    targetNetDifference,
    targetNetDifferencePercent,
    targetCoveragePercent,
    missingHoursPercent,
    excessHoursPercent,
    totalWorkersCount,
    workersWithTargetCount,
    workersWithoutTargetCount,
    workersWithTargetPercent,
    workersWithoutTargetPercent,
    balancedWorkersPercent,
    missingWorkersPercent,
    excessWorkersPercent,
    missingWorkers,
    excessWorkers,
    balancedWorkers,
  };
}

function matchesFilters(summary) {
  const term = state.filters.search;

  const searchSource = normalizeSearchText([
    summary.name,
    summary.notes || '',
    summary.home_address || '',
    summary.home_zone || '',
    ...summary.services.map(
      (service) => `${service.name} ${service.zone || ''} ${service.client_address || ''}`
    ),
  ].join(' '));

  const searchOk = !term || matchesSearchText(searchSource, term);
  const typeOk =
    state.filters.workerType === 'all' || summary.worker_type === state.filters.workerType;
  const statusOk =
    state.filters.status === 'all' || summary.status === state.filters.status;

  return searchOk && typeOk && statusOk;
}

function renderStatusPill(status) {
  const labels = {
    balanced: 'Equilibrado',
    available: 'Le faltan horas',
    over: 'Supera el objetivo',
    insurance: 'Seguro',
  };

  const classes = {
    balanced: 'status-balanced',
    available: 'status-hours-missing',
    over: 'status-hours-over',
    insurance: 'status-insurance',
  };

  return `<span class="status-pill ${classes[status] || 'status-balanced'}">${labels[status] || status}</span>`;
}

function renderDifferencePill(worker) {
  if (worker.difference == null) {
    return `<span class="status-pill status-insurance">SEGURO</span>`;
  }

  if (worker.difference > 0) {
    return `<span class="status-pill status-hours-missing">Le faltan ${formatHours(worker.difference)} hs</span>`;
  }

  if (worker.difference < 0) {
    return `<span class="status-pill status-hours-over">Le sobran ${formatHours(Math.abs(worker.difference))} hs</span>`;
  }

  return `<span class="status-pill status-balanced">En objetivo</span>`;
}

function renderServiceHoursPill(serviceSummary) {
  if (serviceSummary.billedHours == null) {
    return '<span class="status-pill status-hours-pending">Falta configurar proyección</span>';
  }

  if (serviceSummary.difference < 0) {
    return `<span class="status-pill status-hours-missing">Faltan cubrir ${formatHours(Math.abs(serviceSummary.difference))} hs</span>`;
  }

  if (serviceSummary.difference > 0) {
    return `<span class="status-pill status-hours-over">Exceso operativo: ${formatHours(serviceSummary.difference)} hs</span>`;
  }

  return '<span class="status-pill status-balanced">Horas alineadas</span>';
}

function getUncoveredServices() {
  return getFilteredServices()
    .map((service) => ({
      ...service,
      assignments: getServiceAssignments(service.id),
    }))
    .filter((service) => service.assignments.length === 0);
}

function populateSelects() {
  const workerOptions = state.workers
    .map((worker) => `<option value="${worker.id}">${escapeHtml(worker.name)}</option>`)
    .join('');

  const serviceOptions = state.services
    .map((service) => `<option value="${service.id}">${escapeHtml(service.name)}</option>`)
    .join('');

  if (el.optimizerExistingService) {
    const previousValue = el.optimizerExistingService.value;
    el.optimizerExistingService.innerHTML = `<option value="">Simular servicio nuevo</option>${serviceOptions}`;
    if ([...el.optimizerExistingService.options].some((option) => option.value === previousValue)) {
      el.optimizerExistingService.value = previousValue;
    }
  }

  if (el.proximityWorkerFilter) {
    const previousValue = el.proximityWorkerFilter.value || 'all';
    el.proximityWorkerFilter.innerHTML = `<option value="all">Todos los operarios</option>${workerOptions}`;
    el.proximityWorkerFilter.value = state.workers.some((worker) => worker.id === previousValue) ? previousValue : 'all';
  }

  const assignmentWorker = $('assignmentWorker');
  const assignmentService = $('assignmentService');
  const bulkAssignmentWorker = $('bulkAssignmentWorker');
  const bulkAssignmentService = $('bulkAssignmentService');
  const absenceWorker = $('absenceWorker');
  const absenceService = $('absenceService');
  const absenceCoverageWorker = $('absenceCoverageWorker');
  const absenceWorkerHistoryFilter = $('absenceWorkerHistoryFilter');
  const tardinessWorker = $('tardinessWorker');
  const tardinessService = $('tardinessService');
  const tardinessWorkerHistoryFilter = $('tardinessWorkerHistoryFilter');
  const materialsServiceFilter = $('materialsServiceFilter');
  const serviceMaterialService = $('serviceMaterialService');
  const materialConsumptionService = $('materialConsumptionService');
  const materialCatalogOptionsList = $('materialCatalogOptionsList');

  const billingRuleService = $('billingRuleService');
  const billingAdjustmentService = $('billingAdjustmentService');
  if (billingRuleService) billingRuleService.innerHTML = `<option value="">Seleccionar servicio</option>${serviceOptions}`;
  if (billingAdjustmentService) billingAdjustmentService.innerHTML = `<option value="">Seleccionar servicio</option>${serviceOptions}`;

  if (assignmentWorker) assignmentWorker.innerHTML = workerOptions;
  if (assignmentService) assignmentService.innerHTML = serviceOptions;
  if (bulkAssignmentWorker) bulkAssignmentWorker.innerHTML = workerOptions;
  if (bulkAssignmentService) bulkAssignmentService.innerHTML = serviceOptions;

  if (absenceWorker) {
    absenceWorker.innerHTML = `<option value="">Seleccionar operario</option>${workerOptions}`;
  }

  if (absenceService) {
    absenceService.innerHTML = `<option value="">Seleccionar servicio</option>${serviceOptions}`;
  }

  if (absenceCoverageWorker) {
    absenceCoverageWorker.innerHTML = `<option value="">Seleccionar cobertura</option>${workerOptions}`;
  }

  if (absenceWorkerHistoryFilter) {
    const currentValue = absenceWorkerHistoryFilter.value || 'all';
    absenceWorkerHistoryFilter.innerHTML = `<option value="all">Todos</option>${workerOptions}`;
    absenceWorkerHistoryFilter.value = state.workers.some((worker) => worker.id === currentValue) ? currentValue : 'all';
  }

  if (tardinessWorker) {
    tardinessWorker.innerHTML = `<option value="">Seleccionar operario</option>${workerOptions}`;
  }

  if (tardinessService) {
    tardinessService.innerHTML = `<option value="">Seleccionar servicio</option>${serviceOptions}`;
  }

  if (tardinessWorkerHistoryFilter) {
    const currentValue = tardinessWorkerHistoryFilter.value || 'all';
    tardinessWorkerHistoryFilter.innerHTML = `<option value="all">Todos</option>${workerOptions}`;
    tardinessWorkerHistoryFilter.value = state.workers.some((worker) => worker.id === currentValue) ? currentValue : 'all';
  }

  if (materialsServiceFilter) {
    const currentValue = materialsServiceFilter.value || 'all';
    materialsServiceFilter.innerHTML = `<option value="all">Todos</option>${serviceOptions}`;
    materialsServiceFilter.value = state.services.some((service) => service.id === currentValue) ? currentValue : 'all';
  }

  if (serviceMaterialService) {
    serviceMaterialService.innerHTML = `<option value="">Seleccionar servicio</option>${serviceOptions}`;
  }

  if (materialConsumptionService) {
    materialConsumptionService.innerHTML = `<option value="">Seleccionar servicio</option>${serviceOptions}`;
  }

  if (materialCatalogOptionsList) {
    materialCatalogOptionsList.innerHTML = state.materials
      .map((material) => `<option value="${escapeHtml(material.name)}"></option>`)
      .join('');
  }

  updateMaterialConsumptionOptions();
}


function openDashboardHelp(helpKey = 'overview') {
  const content = DASHBOARD_HELP[helpKey] || DASHBOARD_HELP.overview;
  if (!el.dashboardHelpDialog || !content) return;
  if (el.dashboardHelpTitle) el.dashboardHelpTitle.textContent = content.title;
  if (el.dashboardHelpBody) el.dashboardHelpBody.innerHTML = content.html;
  el.dashboardHelpDialog.showModal();
}

function getWorkerDrilldownStatus(worker) {
  if (worker.monthlyTargetHours == null) {
    return { label: 'Sin jornada objetivo', className: 'status-insurance' };
  }
  const difference = Number(worker.monthlyDifference || 0);
  if (difference > 0.01) {
    return { label: `Faltan ${formatHours(difference)} hs`, className: 'status-hours-missing' };
  }
  if (difference < -0.01) {
    return { label: `Excede ${formatHours(Math.abs(difference))} hs`, className: 'status-hours-over' };
  }
  return { label: 'Equilibrado', className: 'status-balanced' };
}

function renderWorkerDrilldownList(workers = [], monthLabel = '') {
  if (!workers.length) {
    return '<div class="empty-state">No hay operarios dentro de este indicador.</div>';
  }

  return `
    <div class="dashboard-drilldown-list">
      ${workers.map((worker) => {
        const status = getWorkerDrilldownStatus(worker);
        const services = (worker.services || []).map((service) => service.name).filter(Boolean);
        return `
          <button class="dashboard-drilldown-row dashboard-drilldown-row-button" type="button" data-dashboard-drilldown="worker:${worker.id}" title="Ver detalle de ${escapeHtml(worker.name)}">
            <div class="dashboard-drilldown-row-main">
              <div class="dashboard-drilldown-row-title">
                <strong>${escapeHtml(worker.name)}</strong>
                <span class="status-pill ${status.className}">${escapeHtml(status.label)}</span>
              </div>
              <div class="dashboard-drilldown-meta">
                <span>Jornada semanal: <strong>${worker.targetHours == null ? 'Sin objetivo fijo' : `${formatHours(worker.targetHours)} hs`}</strong></span>
                <span>Objetivo ${escapeHtml(monthLabel)}: <strong>${worker.monthlyTargetHours == null ? '—' : `${formatHours(worker.monthlyTargetHours)} hs`}</strong></span>
                <span>Asignadas: <strong>${formatHours(worker.monthlyHours)} hs</strong></span>
              </div>
              <small>${services.length ? `Servicios: ${escapeHtml(services.join(', '))}` : 'Sin servicios asignados'}</small>
            </div>
            <span class="dashboard-drilldown-chevron">›</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderServiceDrilldownList(services = [], monthLabel = '') {
  if (!services.length) {
    return '<div class="empty-state">No hay servicios dentro de este indicador.</div>';
  }

  return `
    <div class="dashboard-drilldown-list">
      ${services.map((service) => {
        const diff = service.difference;
        let status = { label: 'Pendiente', className: 'status-hours-pending' };
        if (diff != null) {
          if (Math.abs(diff) <= 0.01) status = { label: 'Equilibrado', className: 'status-balanced' };
          else if (diff > 0) status = { label: `+${formatHours(diff)} hs operativas`, className: 'status-hours-over' };
          else status = { label: `${formatHours(Math.abs(diff))} hs por cubrir`, className: 'status-hours-missing' };
        }
        return `
          <button class="dashboard-drilldown-row dashboard-drilldown-row-button" type="button" data-dashboard-drilldown="service:${service.id}" title="Ver detalle de ${escapeHtml(service.name)}">
            <div class="dashboard-drilldown-row-main">
              <div class="dashboard-drilldown-row-title">
                <strong>${escapeHtml(service.name)}</strong>
                <span class="status-pill ${status.className}">${escapeHtml(status.label)}</span>
              </div>
              <div class="dashboard-drilldown-meta">
                <span>Proyección base: <strong>${service.projectedBilledHours == null ? 'Pendiente' : `${formatHours(service.projectedBilledHours)} hs`}</strong></span>
                <span>Facturación ajustada: <strong>${service.billedHours == null ? 'Pendiente' : `${formatHours(service.billedHours)} hs`}</strong></span>
                <span>Ajustes: <strong>${Number(service.billingAdjustmentsHours || 0) > 0 ? '+' : ''}${formatHours(service.billingAdjustmentsHours || 0)} hs</strong></span>
                <span>Operativas ${escapeHtml(monthLabel)}: <strong>${formatHours(service.assignedHours)} hs</strong></span>
              </div>
              <small>${escapeHtml(service.zone || 'Sin zona')} · ${escapeHtml(service.client_address || 'Sin dirección')}</small>
            </div>
            <span class="dashboard-drilldown-chevron">›</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderDrilldownSummary(items = []) {
  return `<div class="dashboard-drilldown-summary">${items.map((item) => `
    <div class="dashboard-drilldown-summary-item">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(String(item.value))}</strong>
      ${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}
    </div>
  `).join('')}</div>`;
}

function openDashboardDrilldown(key = '', source = 'dashboard') {
  if (!el.dashboardDrilldownDialog || !key) return;

  const monthKey = source === 'billing' ? getSelectedBillingMonth() : getSelectedDashboardMonth();
  const monthLabel = formatMonthLabel(monthKey);
  const serviceBalance = getOverallServiceHoursBalance(monthKey);
  const workforceBalance = source === 'dashboard'
    ? getWorkforceMonthlyBalance(monthKey)
    : null;

  let title = 'Detalle';
  let subtitle = monthLabel;
  let body = '';

  if (key.startsWith('worker:')) {
    const workerId = key.slice('worker:'.length);
    const worker = getWorkerSummaries({ applyFilters: false }).find((item) => item.id === workerId);
    if (!worker) return;
    const status = getWorkerDrilldownStatus(worker);
    title = worker.name || 'Operario';
    subtitle = `Detalle mensual · ${monthLabel}`;
    body = `${renderDrilldownSummary([
      { label: 'Jornada semanal', value: worker.targetHours == null ? 'Sin objetivo' : `${formatHours(worker.targetHours)} hs` },
      { label: 'Objetivo mensual', value: worker.monthlyTargetHours == null ? '—' : `${formatHours(worker.monthlyTargetHours)} hs` },
      { label: 'Horas asignadas', value: `${formatHours(worker.monthlyHours)} hs` },
      { label: 'Estado', value: status.label },
    ])}${renderWorkerDrilldownList([worker], monthLabel)}`;
  } else if (key.startsWith('service:')) {
    const serviceId = key.slice('service:'.length);
    const service = serviceBalance.summaries.find((item) => item.id === serviceId);
    if (!service) return;
    title = service.name || 'Servicio';
    subtitle = `Detalle mensual · ${monthLabel}`;
    body = `${renderDrilldownSummary([
      { label: 'Proyección base', value: service.projectedBilledHours == null ? 'Pendiente' : `${formatHours(service.projectedBilledHours)} hs` },
      { label: 'Facturación ajustada', value: service.billedHours == null ? 'Pendiente' : `${formatHours(service.billedHours)} hs` },
      { label: 'Horas operativas', value: `${formatHours(service.assignedHours)} hs` },
      { label: 'Diferencia', value: service.difference == null ? '—' : `${service.difference > 0 ? '+' : ''}${formatHours(service.difference)} hs` },
    ])}${renderServiceDrilldownList([service], monthLabel)}`;
  } else {
    const workers = workforceBalance?.workers || [];
    const fixedWorkers = workforceBalance?.fixedWorkers || [];
    const sortByAbsDifference = (items) => [...items].sort((a, b) => Math.abs(Number(b.monthlyDifference || 0)) - Math.abs(Number(a.monthlyDifference || 0)));
    const sortServicesByDifference = (items) => [...items].sort((a, b) => Math.abs(Number(b.difference || 0)) - Math.abs(Number(a.difference || 0)));

    switch (key) {
      case 'workers-all':
        title = 'Operarios totales';
        subtitle = `${workers.length} operario${workers.length === 1 ? '' : 's'} cargado${workers.length === 1 ? '' : 's'} · ${monthLabel}`;
        body = renderWorkerDrilldownList(workers, monthLabel);
        break;
      case 'workers-visible': {
        const visible = getWorkerSummaries({ applyFilters: true });
        title = 'Operarios visibles';
        subtitle = `${visible.length} resultado${visible.length === 1 ? '' : 's'} según los filtros actuales`;
        body = renderWorkerDrilldownList(visible, monthLabel);
        break;
      }
      case 'workers-with-target':
        title = 'Operarios con jornada asignada';
        subtitle = `${fixedWorkers.length} operario${fixedWorkers.length === 1 ? '' : 's'} con objetivo semanal definido`;
        body = renderWorkerDrilldownList(fixedWorkers, monthLabel);
        break;
      case 'workers-without-target':
        title = 'Operarios sin jornada asignada';
        subtitle = `${workforceBalance.hourlyWorkers.length} operario${workforceBalance.hourlyWorkers.length === 1 ? '' : 's'} sin objetivo fijo`;
        body = renderWorkerDrilldownList(workforceBalance.hourlyWorkers, monthLabel);
        break;
      case 'workers-balanced':
        title = 'Operarios con horas equilibradas';
        subtitle = `${workforceBalance.balancedWorkers.length} operario${workforceBalance.balancedWorkers.length === 1 ? '' : 's'} en objetivo para ${monthLabel}`;
        body = renderWorkerDrilldownList(workforceBalance.balancedWorkers, monthLabel);
        break;
      case 'workers-missing':
        title = 'Operarios por debajo de jornada';
        subtitle = `${workforceBalance.missingWorkers.length} operario${workforceBalance.missingWorkers.length === 1 ? '' : 's'} · ${formatHours(workforceBalance.totalMissingHours)} hs acumuladas sin asignar`;
        body = renderWorkerDrilldownList(sortByAbsDifference(workforceBalance.missingWorkers), monthLabel);
        break;
      case 'workers-excess':
        title = 'Operarios por encima de jornada';
        subtitle = `${workforceBalance.excessWorkers.length} operario${workforceBalance.excessWorkers.length === 1 ? '' : 's'} · ${formatHours(workforceBalance.totalExcessHours)} hs excedidas acumuladas`;
        body = renderWorkerDrilldownList(sortByAbsDifference(workforceBalance.excessWorkers), monthLabel);
        break;
      case 'workforce-target':
        title = 'Horas objetivo de la dotación';
        subtitle = `${formatHours(workforceBalance.totalTargetHours)} hs objetivo · ${monthLabel}`;
        body = `${renderDrilldownSummary([
          { label: 'Operarios con jornada', value: workforceBalance.fixedWorkers.length },
          { label: 'Objetivo total', value: `${formatHours(workforceBalance.totalTargetHours)} hs` },
        ])}${renderWorkerDrilldownList(fixedWorkers, monthLabel)}`;
        break;
      case 'workforce-assigned-fixed':
        title = 'Horas efectivamente asignadas';
        subtitle = `${formatHours(workforceBalance.totalAssignedFixedHours)} hs asignadas a operarios con jornada objetivo · ${monthLabel}`;
        body = renderWorkerDrilldownList(sortByAbsDifference(fixedWorkers), monthLabel);
        break;
      case 'workforce-assigned-all':
        title = 'Horas efectivamente asignadas';
        subtitle = `${formatHours(workforceBalance.totalAssignedHours)} hs asignadas a toda la dotación · ${monthLabel}`;
        body = renderWorkerDrilldownList([...workers].sort((a, b) => Number(b.monthlyHours || 0) - Number(a.monthlyHours || 0)), monthLabel);
        break;
      case 'workforce-net':
        title = 'Neto de dotación vs jornada';
        subtitle = `${workforceBalance.targetNetDifference > 0 ? '+' : ''}${formatHours(workforceBalance.targetNetDifference)} hs · asignadas menos objetivo`;
        body = `${renderDrilldownSummary([
          { label: 'Objetivo total', value: `${formatHours(workforceBalance.totalTargetHours)} hs` },
          { label: 'Asignadas', value: `${formatHours(workforceBalance.totalAssignedFixedHours)} hs` },
          { label: 'Neto', value: `${workforceBalance.targetNetDifference > 0 ? '+' : ''}${formatHours(workforceBalance.targetNetDifference)} hs` },
        ])}${renderWorkerDrilldownList(sortByAbsDifference(fixedWorkers), monthLabel)}`;
        break;
      case 'missing-hours':
        title = 'Horas de jornada sin asignar';
        subtitle = `${formatHours(workforceBalance.totalMissingHours)} hs acumuladas · ${workforceBalance.missingWorkers.length} operarios`;
        body = renderWorkerDrilldownList(sortByAbsDifference(workforceBalance.missingWorkers), monthLabel);
        break;
      case 'excess-hours':
        title = 'Horas excedidas sobre jornada';
        subtitle = `${formatHours(workforceBalance.totalExcessHours)} hs acumuladas · ${workforceBalance.excessWorkers.length} operarios`;
        body = renderWorkerDrilldownList(sortByAbsDifference(workforceBalance.excessWorkers), monthLabel);
        break;
      case 'hourly-assigned':
        title = 'Personal sin objetivo fijo';
        subtitle = `${formatHours(workforceBalance.hourlyAssignedHours)} hs asignadas · ${workforceBalance.hourlyWorkers.length} operarios`;
        body = renderWorkerDrilldownList(workforceBalance.hourlyWorkers, monthLabel);
        break;
      case 'billing-projected': {
        const projected = serviceBalance.summaries.filter((service) => service.projectedBilledHours != null);
        const projectedHours = Number(projected.reduce((sum, service) => sum + Number(service.projectedBilledHours || 0), 0).toFixed(2));
        title = 'Proyección base';
        subtitle = `${formatHours(projectedHours)} hs proyectadas antes de ajustes · ${monthLabel}`;
        body = `${renderDrilldownSummary([
          { label: 'Servicios con proyección', value: projected.length },
          { label: 'Horas proyectadas', value: `${formatHours(projectedHours)} hs` },
        ])}${renderServiceDrilldownList(projected, monthLabel)}`;
        break;
      }
      case 'billing-adjustments': {
        const adjustedServices = serviceBalance.summaries.filter((service) => Math.abs(Number(service.billingAdjustmentsHours || 0)) > 0.01);
        const adjustmentHours = Number(adjustedServices.reduce((sum, service) => sum + Number(service.billingAdjustmentsHours || 0), 0).toFixed(2));
        title = 'Ajustes registrados';
        subtitle = `${adjustmentHours > 0 ? '+' : ''}${formatHours(adjustmentHours)} hs en ${monthLabel}`;
        body = `${renderDrilldownSummary([
          { label: 'Servicios con ajustes', value: adjustedServices.length },
          { label: 'Ajuste neto', value: `${adjustmentHours > 0 ? '+' : ''}${formatHours(adjustmentHours)} hs` },
        ])}${renderServiceDrilldownList(adjustedServices, monthLabel)}`;
        break;
      }
      case 'billing-estimated':
      case 'services-billed':
        title = 'Facturación estimada del mes';
        subtitle = `${formatHours(serviceBalance.totalBilledHours)} hs proyectadas · ${monthLabel}`;
        body = `${renderDrilldownSummary([
          { label: 'Servicios con proyección', value: serviceBalance.configured.length },
          { label: 'Servicios pendientes', value: serviceBalance.pending.length },
          { label: 'Horas facturables', value: `${formatHours(serviceBalance.totalBilledHours)} hs` },
        ])}${renderServiceDrilldownList(serviceBalance.summaries, monthLabel)}`;
        break;
      case 'services-assigned-configured':
        title = 'Horas operativas en servicios con facturación';
        subtitle = `${formatHours(serviceBalance.assignedHoursOnConfiguredServices)} hs · ${monthLabel}`;
        body = renderServiceDrilldownList(sortServicesByDifference(serviceBalance.configured), monthLabel);
        break;
      case 'services-assigned-all':
        title = 'Total operativo general';
        subtitle = `${formatHours(serviceBalance.totalAssignedHours)} hs operativas · ${monthLabel}`;
        body = renderServiceDrilldownList([...serviceBalance.summaries].sort((a, b) => Number(b.assignedHours || 0) - Number(a.assignedHours || 0)), monthLabel);
        break;
      case 'service-balance':
        title = 'Balance operativo vs facturación';
        subtitle = `${serviceBalance.difference > 0 ? '+' : ''}${formatHours(serviceBalance.difference)} hs · ${monthLabel}`;
        body = renderServiceDrilldownList(sortServicesByDifference(serviceBalance.configured), monthLabel);
        break;
      case 'services-uncovered': {
        const uncovered = getUncoveredServices().map((service) => getServiceHoursSummary(service, monthKey));
        title = 'Servicios sin cobertura';
        subtitle = `${uncovered.length} servicio${uncovered.length === 1 ? '' : 's'} sin asignaciones activas`;
        body = renderServiceDrilldownList(uncovered, monthLabel);
        break;
      }
      case 'billing-target':
        title = 'Facturación vs objetivo de dotación';
        subtitle = `${monthLabel} · comparación estructural`;
        body = `${renderDrilldownSummary([
          { label: 'Facturación estimada', value: `${formatHours(serviceBalance.totalBilledHours)} hs` },
          { label: 'Objetivo dotación', value: `${formatHours(workforceBalance.totalTargetHours)} hs` },
          { label: 'Diferencia', value: `${workforceBalance.billingTargetDifference > 0 ? '+' : ''}${formatHours(workforceBalance.billingTargetDifference)} hs` },
        ])}<h4 class="dashboard-drilldown-section-title">Servicios que forman la facturación estimada</h4>${renderServiceDrilldownList(serviceBalance.summaries, monthLabel)}<h4 class="dashboard-drilldown-section-title">Operarios que forman el objetivo de dotación</h4>${renderWorkerDrilldownList(fixedWorkers, monthLabel)}`;
        break;
      case 'assigned-billing':
        title = 'Asignadas vs facturación estimada';
        subtitle = `${monthLabel} · comparación operativa`;
        body = `${renderDrilldownSummary([
          { label: 'Horas asignadas', value: `${formatHours(workforceBalance.totalAssignedHours)} hs` },
          { label: 'Facturación estimada', value: `${formatHours(serviceBalance.totalBilledHours)} hs` },
          { label: 'Diferencia', value: `${workforceBalance.operationalDifference > 0 ? '+' : ''}${formatHours(workforceBalance.operationalDifference)} hs` },
        ])}<h4 class="dashboard-drilldown-section-title">Diferencia por servicio</h4>${renderServiceDrilldownList(sortServicesByDifference(serviceBalance.summaries), monthLabel)}`;
        break;
      default:
        title = 'Detalle del indicador';
        body = '<div class="empty-state">No hay un detalle disponible para este indicador.</div>';
    }
  }

  if (el.dashboardDrilldownTitle) el.dashboardDrilldownTitle.textContent = title;
  if (el.dashboardDrilldownSubtitle) el.dashboardDrilldownSubtitle.textContent = subtitle;
  if (el.dashboardDrilldownBody) el.dashboardDrilldownBody.innerHTML = body;
  if (!el.dashboardDrilldownDialog.open) el.dashboardDrilldownDialog.showModal();
}

function renderKpis(summaries, allWorkerSummaries = summaries) {
  const balance = getOverallServiceHoursBalance();
  const workforceBalance = getWorkforceMonthlyBalance(balance.monthKey, allWorkerSummaries);
  const monthLabel = formatMonthLabel(balance.monthKey);
  const unassignedWorkers = summaries.filter((worker) => worker.services.length === 0).length;
  const uncoveredServices = getUncoveredServices().length;

  let commercialValue = 'Equilibrado · 100%';
  let commercialFoot = `${formatHours(workforceBalance.totalAssignedHours)} hs asignadas = ${formatHours(balance.totalBilledHours)} hs facturables`;
  let commercialClass = 'kpi-tone-balanced';
  if (workforceBalance.operationalDifference > 0.01) {
    commercialValue = `Pasados ${formatPercent(workforceBalance.operationalDifferencePercent)}`;
    commercialFoot = `+${formatHours(workforceBalance.operationalDifference)} hs asignadas por encima de lo estimado a facturar`;
    commercialClass = 'kpi-tone-missing';
  } else if (workforceBalance.operationalDifference < -0.01) {
    commercialValue = `Faltan ${formatPercent(workforceBalance.operationalDifferencePercent)}`;
    commercialFoot = `${formatHours(Math.abs(workforceBalance.operationalDifference))} hs asignadas por debajo de lo estimado a facturar`;
    commercialClass = 'kpi-tone-warning';
  }

  if (balance.pending.length) {
    commercialFoot = `Balance parcial · ${balance.pending.length} servicio${balance.pending.length === 1 ? '' : 's'} sin proyección`;
  }

  let billingTargetValue = 'Equilibrado · 100%';
  let billingTargetFoot = `${formatHours(balance.totalBilledHours)} hs facturables = ${formatHours(workforceBalance.totalTargetHours)} hs objetivo`;
  let billingTargetClass = 'kpi-tone-balanced';
  if (workforceBalance.billingTargetDifference < -0.01) {
    billingTargetValue = `Dotación +${formatPercent(workforceBalance.billingTargetDifferencePercent)}`;
    billingTargetFoot = `${formatHours(Math.abs(workforceBalance.billingTargetDifference))} hs de jornada objetivo por encima de lo estimado a facturar`;
    billingTargetClass = 'kpi-tone-missing';
  } else if (workforceBalance.billingTargetDifference > 0.01) {
    billingTargetValue = `Facturación +${formatPercent(workforceBalance.billingTargetDifferencePercent)}`;
    billingTargetFoot = `${formatHours(workforceBalance.billingTargetDifference)} hs facturables por encima de la capacidad objetivo de la dotación`;
    billingTargetClass = 'kpi-tone-warning';
  }

  if (balance.pending.length) {
    billingTargetFoot = `Balance parcial · ${balance.pending.length} servicio${balance.pending.length === 1 ? '' : 's'} sin proyección`;
  }

  let targetNetValue = 'Equilibrado';
  let targetNetFoot = `${formatHours(workforceBalance.totalAssignedFixedHours)} hs asignadas sobre ${formatHours(workforceBalance.totalTargetHours)} hs objetivo`;
  let targetNetClass = 'kpi-tone-balanced';
  if (workforceBalance.targetNetDifference < -0.01) {
    targetNetValue = `Déficit ${formatHours(Math.abs(workforceBalance.targetNetDifference))} hs`;
    targetNetFoot = `${formatPercent(workforceBalance.targetNetDifferencePercent)} por debajo del objetivo total de jornada`;
    targetNetClass = 'kpi-tone-missing';
  } else if (workforceBalance.targetNetDifference > 0.01) {
    targetNetValue = `Exceso ${formatHours(workforceBalance.targetNetDifference)} hs`;
    targetNetFoot = `${formatPercent(workforceBalance.targetNetDifferencePercent)} por encima del objetivo total de jornada`;
    targetNetClass = 'kpi-tone-over';
  }

  const cards = [
    {
      label: 'Facturación estimada del mes',
      value: `${formatHours(balance.totalBilledHours)} hs`,
      foot: balance.pending.length
        ? `${balance.configured.length} servicios con proyección · ${balance.pending.length} pendientes`
        : `${balance.configured.length} servicios · ${monthLabel}`,
      className: 'kpi-primary',
      helpKey: 'billing',
      drilldownKey: 'billing-estimated',
    },
    {
      label: 'Objetivo mensual de dotación',
      value: `${formatHours(workforceBalance.totalTargetHours)} hs`,
      foot: `${workforceBalance.fixedWorkers.length} operario${workforceBalance.fixedWorkers.length === 1 ? '' : 's'} con jornada objetivo · ${monthLabel}`,
      className: 'kpi-primary',
      helpKey: 'target',
      drilldownKey: 'workforce-target',
    },
    {
      label: 'Dotación total',
      value: `${workforceBalance.totalWorkersCount} operarios`,
      foot: `${workforceBalance.workersWithTargetCount} con jornada (${formatPercent(workforceBalance.workersWithTargetPercent)}) · ${workforceBalance.workersWithoutTargetCount} sin jornada (${formatPercent(workforceBalance.workersWithoutTargetPercent)})`,
      className: 'kpi-primary',
      helpKey: 'headcount',
      drilldownKey: 'workers-all',
    },
    {
      label: 'Facturación vs objetivo de dotación',
      value: billingTargetValue,
      foot: billingTargetFoot,
      className: `kpi-primary kpi-strategic ${billingTargetClass}`,
      helpKey: 'billingTarget',
      drilldownKey: 'billing-target',
    },
    {
      label: 'Horas efectivamente asignadas',
      value: `${formatHours(workforceBalance.totalAssignedHours)} hs`,
      foot: `Cronograma proyectado a los días reales de ${monthLabel}`,
      className: 'kpi-primary',
      helpKey: 'assigned',
      drilldownKey: 'workforce-assigned-all',
    },
    {
      label: 'Asignadas vs facturación',
      value: commercialValue,
      foot: commercialFoot,
      className: `kpi-primary ${commercialClass}`,
      helpKey: 'assignedBilling',
      drilldownKey: 'assigned-billing',
    },
    {
      label: 'Horas faltantes vs jornada',
      value: `${formatHours(workforceBalance.totalMissingHours)} hs`,
      foot: `${workforceBalance.missingWorkers.length} operario${workforceBalance.missingWorkers.length === 1 ? '' : 's'} por debajo · ${formatPercent(workforceBalance.missingHoursPercent)} del objetivo total`,
      className: 'kpi-primary kpi-tone-missing',
      helpKey: 'missing',
      drilldownKey: 'workers-missing',
    },
    {
      label: 'Horas excedidas vs jornada',
      value: `${formatHours(workforceBalance.totalExcessHours)} hs`,
      foot: `${workforceBalance.excessWorkers.length} operario${workforceBalance.excessWorkers.length === 1 ? '' : 's'} por encima · ${formatPercent(workforceBalance.excessHoursPercent)} del objetivo total`,
      className: 'kpi-primary kpi-tone-over',
      helpKey: 'excess',
      drilldownKey: 'workers-excess',
    },
    {
      label: 'Neto de dotación vs jornada',
      value: targetNetValue,
      foot: targetNetFoot,
      className: `kpi-primary ${targetNetClass}`,
      helpKey: 'net',
      drilldownKey: 'workforce-net',
    },
    {
      label: 'Servicios sin cobertura',
      value: uncoveredServices,
      foot: 'Sin ninguna asignación activa',
      drilldownKey: 'services-uncovered',
    },
    {
      label: 'Operarios visibles',
      value: summaries.length,
      foot: `${unassignedWorkers} sin servicio asignado`,
      drilldownKey: 'workers-visible',
    },
  ];

  el.kpiCards.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card card-lite ${card.className || ''} ${card.drilldownKey ? 'metric-drilldown-clickable' : ''}" ${card.drilldownKey ? `data-dashboard-drilldown="${card.drilldownKey}" role="button" tabindex="0" title="Ver detalle"` : ''}>
          <div class="kpi-label-row">
            <span class="kpi-label">${card.label}</span>
            ${card.helpKey ? `<button class="metric-info-btn" type="button" data-dashboard-help="${card.helpKey}" aria-label="Información sobre ${escapeHtml(card.label)}" title="¿Qué significa?">i</button>` : ''}
          </div>
          <strong class="kpi-value">${card.value}</strong>
          <small class="kpi-foot">${card.foot}</small>
        </article>
      `
    )
    .join('');
}

function renderWorkforceMonthlyBalance(summaries = null) {
  if (!el.workforceMonthlyBalance) return;

  const balance = getWorkforceMonthlyBalance(getSelectedDashboardMonth(), summaries);
  const monthLabel = formatMonthLabel(balance.monthKey);
  const deviations = [...balance.missingWorkers, ...balance.excessWorkers]
    .sort((a, b) => Math.abs(Number(b.monthlyDifference || 0)) - Math.abs(Number(a.monthlyDifference || 0)))
    .slice(0, 12);

  let assignmentLabel = 'Asignación equilibrada';
  let assignmentClass = 'status-balanced';
  if (balance.assignmentDifference < -0.01) {
    assignmentLabel = `Faltan asignar ${formatHours(Math.abs(balance.assignmentDifference))} hs`;
    assignmentClass = 'status-hours-missing';
  } else if (balance.assignmentDifference > 0.01) {
    assignmentLabel = `Exceso asignado: ${formatHours(balance.assignmentDifference)} hs`;
    assignmentClass = 'status-hours-over';
  }

  let capacityLabel = 'Cartera y dotación equilibradas · 100%';
  let capacityClass = 'status-balanced';
  if (balance.billingTargetDifference < -0.01) {
    capacityLabel = `Dotación +${formatPercent(balance.billingTargetDifferencePercent)} · ${formatHours(Math.abs(balance.billingTargetDifference))} hs sin respaldo comercial`;
    capacityClass = 'status-hours-missing';
  } else if (balance.billingTargetDifference > 0.01) {
    capacityLabel = `Facturación +${formatPercent(balance.billingTargetDifferencePercent)} · ${formatHours(balance.billingTargetDifference)} hs sobre capacidad objetivo`;
    capacityClass = 'status-hours-pending';
  }

  let commercialLabel = 'Operación y facturación alineadas · 100%';
  let commercialClass = 'status-balanced';
  if (balance.operationalDifference > 0.01) {
    commercialLabel = `Pasados ${formatPercent(balance.operationalDifferencePercent)} · +${formatHours(balance.operationalDifference)} hs operativas`;
    commercialClass = 'status-hours-missing';
  } else if (balance.operationalDifference < -0.01) {
    commercialLabel = `Faltan ${formatPercent(balance.operationalDifferencePercent)} · ${formatHours(Math.abs(balance.operationalDifference))} hs operativas`;
    commercialClass = 'status-hours-pending';
  }

  el.workforceMonthlyBalance.innerHTML = `
    <div class="workforce-balance-card">
      <div class="section-head workforce-balance-head">
        <div>
          <h3>Balance mensual de dotación · ${escapeHtml(monthLabel)}</h3>
          <span class="muted">Compara jornada objetivo, horas efectivamente asignadas y horas estimadas de facturación.</span>
        </div>
        <div class="workforce-balance-statuses">
          <button id="balanceOverviewHelpBtn" class="balance-help-btn" type="button" data-dashboard-help="overview">? Cómo leer este balance</button>
          <span class="status-pill ${capacityClass} metric-drilldown-clickable compact-drilldown" data-dashboard-drilldown="billing-target" role="button" tabindex="0" title="Ver detalle">${capacityLabel}</span>
          <span class="status-pill ${assignmentClass} metric-drilldown-clickable compact-drilldown" data-dashboard-drilldown="workforce-net" role="button" tabindex="0" title="Ver detalle">${assignmentLabel}</span>
          <span class="status-pill ${commercialClass} metric-drilldown-clickable compact-drilldown" data-dashboard-drilldown="assigned-billing" role="button" tabindex="0" title="Ver detalle">${commercialLabel}</span>
        </div>
      </div>

      <div class="workforce-headcount-section">
        <div class="section-head workforce-headcount-head">
          <div>
            <h4>Estado de la dotación</h4>
            <span class="muted">Cantidad de operarios y distribución según su jornada para ${escapeHtml(monthLabel)}.</span>
          </div>
          <button class="metric-info-btn" type="button" data-dashboard-help="headcount" aria-label="Información sobre Estado de la dotación" title="¿Qué significa?">i</button>
        </div>
        <div class="workforce-headcount-grid">
          <div class="workforce-headcount-metric headcount-total metric-drilldown-clickable" data-dashboard-drilldown="workers-all" role="button" tabindex="0" title="Ver operarios">
            <span>Operarios totales</span>
            <strong>${balance.totalWorkersCount}</strong>
            <small>100% de la dotación cargada</small>
          </div>
          <div class="workforce-headcount-metric metric-drilldown-clickable" data-dashboard-drilldown="workers-with-target" role="button" tabindex="0" title="Ver operarios">
            <span>Con jornada asignada</span>
            <strong>${balance.workersWithTargetCount}</strong>
            <small>${formatPercent(balance.workersWithTargetPercent)} del total</small>
          </div>
          <div class="workforce-headcount-metric headcount-neutral metric-drilldown-clickable" data-dashboard-drilldown="workers-without-target" role="button" tabindex="0" title="Ver operarios">
            <span>Sin jornada asignada</span>
            <strong>${balance.workersWithoutTargetCount}</strong>
            <small>${formatPercent(balance.workersWithoutTargetPercent)} del total</small>
          </div>
          <div class="workforce-headcount-metric headcount-balanced metric-drilldown-clickable" data-dashboard-drilldown="workers-balanced" role="button" tabindex="0" title="Ver operarios equilibrados">
            <span>Horas equilibradas</span>
            <strong>${balance.balancedWorkers.length}</strong>
            <small>${formatPercent(balance.balancedWorkersPercent)} de quienes tienen jornada</small>
          </div>
          <div class="workforce-headcount-metric headcount-missing metric-drilldown-clickable" data-dashboard-drilldown="workers-missing" role="button" tabindex="0" title="Ver operarios por debajo de jornada">
            <span>Por debajo de jornada</span>
            <strong>${balance.missingWorkers.length}</strong>
            <small>${formatPercent(balance.missingWorkersPercent)} de quienes tienen jornada</small>
          </div>
          <div class="workforce-headcount-metric headcount-over metric-drilldown-clickable" data-dashboard-drilldown="workers-excess" role="button" tabindex="0" title="Ver operarios por encima de jornada">
            <span>Por encima de jornada</span>
            <strong>${balance.excessWorkers.length}</strong>
            <small>${formatPercent(balance.excessWorkersPercent)} de quienes tienen jornada</small>
          </div>
        </div>
        ${balance.workersWithoutTargetCount ? `<div class="workforce-headcount-note"><strong>Importante:</strong> los ${balance.workersWithoutTargetCount} operario${balance.workersWithoutTargetCount === 1 ? '' : 's'} sin jornada objetivo no se incluyen en los porcentajes de equilibrados, por debajo o por encima.</div>` : ''}
      </div>

      <div class="workforce-balance-summary workforce-balance-summary-priority">
        <div class="hours-balance-metric balance-metric-main metric-drilldown-clickable" data-dashboard-drilldown="workforce-target" role="button" tabindex="0" title="Ver operarios que forman este total">
          <div class="metric-title-row">
            <span>Horas objetivo de la dotación</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="target" aria-label="Información sobre Horas objetivo de la dotación" title="¿Qué significa?">i</button>
          </div>
          <strong>${formatHours(balance.totalTargetHours)} hs</strong>
          <small>Lo que deberían cumplir en ${escapeHtml(monthLabel)} los operarios con jornada objetivo.</small>
        </div>
        <div class="hours-balance-metric balance-metric-main metric-drilldown-clickable" data-dashboard-drilldown="workforce-assigned-fixed" role="button" tabindex="0" title="Ver detalle de operarios">
          <div class="metric-title-row">
            <span>Horas efectivamente asignadas</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="assigned" aria-label="Información sobre Horas efectivamente asignadas" title="¿Qué significa?">i</button>
          </div>
          <strong>${formatHours(balance.totalAssignedFixedHours)} hs</strong>
          <small>Horas del cronograma de esos mismos operarios durante el mes.</small>
        </div>
        <div class="hours-balance-metric balance-metric-main metric-drilldown-clickable ${balance.targetNetDifference < -0.01 ? 'balance-metric-missing' : balance.targetNetDifference > 0.01 ? 'balance-metric-over' : 'balance-metric-balanced'}" data-dashboard-drilldown="workforce-net" role="button" tabindex="0" title="Ver detalle por operario">
          <div class="metric-title-row">
            <span>Neto contra jornada objetivo</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="net" aria-label="Información sobre Neto contra jornada objetivo" title="¿Qué significa?">i</button>
          </div>
          <strong>${Math.abs(balance.targetNetDifference) <= 0.01
            ? 'Equilibrado'
            : balance.targetNetDifference < 0
              ? `Déficit ${formatHours(Math.abs(balance.targetNetDifference))} hs`
              : `Exceso ${formatHours(balance.targetNetDifference)} hs`}</strong>
          <small>${Math.abs(balance.targetNetDifference) <= 0.01
            ? 'La suma asignada coincide con la suma de jornadas objetivo.'
            : `${formatPercent(balance.targetNetDifferencePercent)} ${balance.targetNetDifference < 0 ? 'por debajo' : 'por encima'} del objetivo total.`}</small>
        </div>
        <div class="hours-balance-metric balance-metric-main metric-drilldown-clickable" data-dashboard-drilldown="billing-estimated" role="button" tabindex="0" title="Ver servicios que forman este total">
          <div class="metric-title-row">
            <span>Facturación estimada</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="billing" aria-label="Información sobre Facturación estimada" title="¿Qué significa?">i</button>
          </div>
          <strong>${formatHours(balance.serviceBalance.totalBilledHours)} hs</strong>
          <small>Horas que se proyecta cobrar a los clientes durante el mes.</small>
        </div>
        <div class="hours-balance-metric balance-metric-main balance-metric-strategic metric-drilldown-clickable ${balance.billingTargetDifference < -0.01 ? 'balance-metric-missing' : balance.billingTargetDifference > 0.01 ? 'balance-metric-warning' : 'balance-metric-balanced'}" data-dashboard-drilldown="billing-target" role="button" tabindex="0" title="Ver qué forma este balance">
          <div class="metric-title-row">
            <span>Facturación vs objetivo de dotación</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="billingTarget" aria-label="Información sobre Facturación vs objetivo de dotación" title="¿Qué significa?">i</button>
          </div>
          <strong>${Math.abs(balance.billingTargetDifference) <= 0.01
            ? 'Equilibrado · 100%'
            : balance.billingTargetDifference < 0
              ? `Dotación +${formatPercent(balance.billingTargetDifferencePercent)}`
              : `Facturación +${formatPercent(balance.billingTargetDifferencePercent)}`}</strong>
          <small>${Math.abs(balance.billingTargetDifference) <= 0.01
            ? `${formatHours(balance.totalTargetHours)} hs objetivo respaldadas por ${formatHours(balance.serviceBalance.totalBilledHours)} hs facturables.`
            : balance.billingTargetDifference < 0
              ? `Hay ${formatHours(Math.abs(balance.billingTargetDifference))} hs de jornada objetivo por encima de lo que se estima cobrar.`
              : `Hay ${formatHours(balance.billingTargetDifference)} hs facturables por encima de la capacidad objetivo de la dotación.`}</small>
        </div>
        <div class="hours-balance-metric balance-metric-main metric-drilldown-clickable ${balance.operationalDifference > 0.01 ? 'balance-metric-missing' : balance.operationalDifference < -0.01 ? 'balance-metric-warning' : 'balance-metric-balanced'}" data-dashboard-drilldown="assigned-billing" role="button" tabindex="0" title="Ver diferencia por servicio">
          <div class="metric-title-row">
            <span>Asignadas vs facturación estimada</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="assignedBilling" aria-label="Información sobre Asignadas vs facturación estimada" title="¿Qué significa?">i</button>
          </div>
          <strong>${Math.abs(balance.operationalDifference) <= 0.01
            ? 'Equilibrado · 100%'
            : balance.operationalDifference > 0
              ? `Pasados ${formatPercent(balance.operationalDifferencePercent)}`
              : `Faltan ${formatPercent(balance.operationalDifferencePercent)}`}</strong>
          <small>${Math.abs(balance.operationalDifference) <= 0.01
            ? `${formatHours(balance.totalAssignedHours)} hs asignadas y facturables.`
            : balance.operationalDifference > 0
              ? `Hay ${formatHours(balance.operationalDifference)} hs de personal por encima de lo estimado a facturar.`
              : `Faltan ${formatHours(Math.abs(balance.operationalDifference))} hs asignadas para cubrir lo estimado a facturar.`}</small>
        </div>
        <div class="hours-balance-metric balance-metric-alert balance-metric-missing metric-drilldown-clickable" data-dashboard-drilldown="missing-hours" role="button" tabindex="0" title="Ver operarios con horas faltantes">
          <div class="metric-title-row">
            <span>Horas de jornada sin asignar</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="missing" aria-label="Información sobre Horas de jornada sin asignar" title="¿Qué significa?">i</button>
          </div>
          <strong>${formatHours(balance.totalMissingHours)} hs</strong>
          <small>${balance.missingWorkers.length} operario${balance.missingWorkers.length === 1 ? '' : 's'} por debajo de su objetivo · ${formatPercent(balance.missingHoursPercent)} del total objetivo.</small>
        </div>
        <div class="hours-balance-metric balance-metric-alert balance-metric-over metric-drilldown-clickable" data-dashboard-drilldown="excess-hours" role="button" tabindex="0" title="Ver operarios con horas excedidas">
          <div class="metric-title-row">
            <span>Horas excedidas sobre jornada</span>
            <button class="metric-info-btn" type="button" data-dashboard-help="excess" aria-label="Información sobre Horas excedidas sobre jornada" title="¿Qué significa?">i</button>
          </div>
          <strong>${formatHours(balance.totalExcessHours)} hs</strong>
          <small>${balance.excessWorkers.length} operario${balance.excessWorkers.length === 1 ? '' : 's'} por encima de su objetivo · ${formatPercent(balance.excessHoursPercent)} del total objetivo.</small>
        </div>
        ${balance.hourlyWorkers.length ? `<div class="hours-balance-metric metric-drilldown-clickable" data-dashboard-drilldown="hourly-assigned" role="button" tabindex="0" title="Ver personal sin objetivo fijo">
          <span>Personal sin objetivo fijo</span>
          <strong>${formatHours(balance.hourlyAssignedHours)} hs</strong>
          <small>${balance.hourlyWorkers.length} operario${balance.hourlyWorkers.length === 1 ? '' : 's'}; estas horas sí entran en asignadas vs facturación, pero no en déficit/exceso contra jornada.</small>
        </div>` : ''}
      </div>

      <div class="hours-balance-note">
        <strong>Lectura estructural:</strong> Facturación vs objetivo de dotación responde si las horas que estimás cobrar alcanzan para absorber las horas que debería cumplir la plantilla según sus jornadas. Si la dotación queda por encima, hay capacidad laboral objetivo sin respaldo comercial. Si la facturación queda por encima, la demanda supera la capacidad objetivo y deberá resolverse con reorganización, horas excedidas o mayor dotación.
      </div>
      <div class="hours-balance-note">
        <strong>Lectura operativa:</strong> si 10 operarios tienen 5 hs mensuales sin asignar cada uno, la app muestra 50 hs de jornada sin asignar. Si otros operarios se exceden, ese exceso se informa por separado y también se muestra el neto general. Así un exceso no oculta dónde existe capacidad pagada que todavía no está siendo utilizada. El objetivo mensual se calcula con los días reales de ${escapeHtml(monthLabel)}, no multiplicando siempre por cuatro.
      </div>

      ${balance.serviceBalance.pending.length
        ? `<div class="hours-balance-note">El saldo comercial es parcial: ${balance.serviceBalance.pending.length} servicio${balance.serviceBalance.pending.length === 1 ? '' : 's'} todavía no tiene proyección de facturación configurada.</div>`
        : ''}

      <div>
        <div class="section-head">
          <div>
            <h4>Operarios con desvíos mensuales</h4>
            <span class="muted">Rojo: horas por asignar. Verde: horas asignadas por encima de la jornada objetivo.</span>
          </div>
          <span class="muted">${balance.missingWorkers.length} con déficit · ${balance.excessWorkers.length} con exceso · ${balance.balancedWorkers.length} equilibrados</span>
        </div>
        <div class="hours-balance-list">
          ${deviations.length
            ? deviations.map((worker) => `
                <button class="hours-balance-row workforce-worker-row dashboard-drilldown-row-button" type="button" data-dashboard-drilldown="worker:${worker.id}" title="Ver detalle de ${escapeHtml(worker.name)}">
                  <div>
                    <strong>${escapeHtml(worker.name)}</strong>
                    <p>Objetivo mes: ${formatHours(worker.monthlyTargetHours)} hs · Asignadas: ${formatHours(worker.monthlyHours)} hs · Objetivo semanal: ${formatHours(worker.targetHours)} hs</p>
                  </div>
                  ${renderDifferencePill(worker)}
                </button>
              `).join('')
            : '<div class="empty-state">Todos los operarios con jornada fija están equilibrados para el mes seleccionado.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderServiceHoursBalance() {
  if (!el.serviceHoursBalance) return;

  const balance = getOverallServiceHoursBalance();
  const monthLabel = formatMonthLabel(balance.monthKey);
  const configuredDeviations = balance.configured
    .filter((service) => Math.abs(service.difference || 0) >= 0.01)
    .sort((a, b) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0));
  const rows = [...configuredDeviations, ...balance.pending].slice(0, 10);

  let differenceLabel = 'Horas equilibradas';
  let differenceClass = 'status-balanced';
  if (balance.difference < 0) {
    differenceLabel = `Faltan cubrir ${formatHours(Math.abs(balance.difference))} hs`;
    differenceClass = 'status-hours-missing';
  } else if (balance.difference > 0) {
    differenceLabel = `Exceso operativo: ${formatHours(balance.difference)} hs`;
    differenceClass = 'status-hours-over';
  }

  el.serviceHoursBalance.innerHTML = `
    <div class="hours-balance-card">
      <div class="section-head">
        <div>
          <h3>Balance mensual · ${escapeHtml(monthLabel)}</h3>
          <span class="muted">Facturación mensual proyectada y ajustada contra horas operativas asignadas</span>
        </div>
        <span class="status-pill ${differenceClass} metric-drilldown-clickable compact-drilldown" data-dashboard-drilldown="service-balance" role="button" tabindex="0" title="Ver detalle">${differenceLabel}</span>
      </div>

      <div class="hours-balance-summary">
        <div class="hours-balance-metric metric-drilldown-clickable" data-dashboard-drilldown="services-billed" role="button" tabindex="0" title="Ver servicios">
          <span>Horas facturadas cargadas</span>
          <strong>${formatHours(balance.totalBilledHours)} hs</strong>
        </div>
        <div class="hours-balance-metric metric-drilldown-clickable" data-dashboard-drilldown="services-assigned-configured" role="button" tabindex="0" title="Ver servicios">
          <span>Horas operativas en servicios cargados</span>
          <strong>${formatHours(balance.assignedHoursOnConfiguredServices)} hs</strong>
        </div>
        <div class="hours-balance-metric metric-drilldown-clickable" data-dashboard-drilldown="services-assigned-all" role="button" tabindex="0" title="Ver servicios">
          <span>Total operativo general</span>
          <strong>${formatHours(balance.totalAssignedHours)} hs</strong>
        </div>
      </div>

      <div class="hours-balance-note">
        El cálculo operativo cuenta cuántas veces aparece cada día asignado dentro de ${escapeHtml(monthLabel)}. No multiplica automáticamente por cuatro: un turno de lunes se computa cuatro o cinco veces según el calendario real del mes.
      </div>

      ${balance.pending.length
        ? `<div class="hours-balance-note">El balance es parcial: faltan cargar las horas mensuales facturadas de ${balance.pending.length} servicio${balance.pending.length === 1 ? '' : 's'}. Sus horas operativas están incluidas en el total general, pero no en la diferencia comercial.</div>`
        : ''}

      <div>
        <div class="section-head">
          <div>
            <h4>Principales diferencias por servicio</h4>
            <span class="muted">Rojo: falta cobertura frente a lo facturado. Verde: se asignaron más horas que las facturadas.</span>
          </div>
        </div>
        <div class="hours-balance-list">
          ${rows.length
            ? rows.map((service) => `
                <button class="hours-balance-row dashboard-drilldown-row-button" type="button" data-dashboard-drilldown="service:${service.id}" title="Ver detalle de ${escapeHtml(service.name)}">
                  <div>
                    <strong>${escapeHtml(service.name)}</strong>
                    <p>Facturadas mes: ${service.billedHours == null ? 'Pendiente' : `${formatHours(service.billedHours)} hs`} · Operativas mes: ${formatHours(service.assignedHours)} hs</p>
                  </div>
                  ${renderServiceHoursPill(service)}
                </button>
              `).join('')
            : '<div class="empty-state">No hay diferencias entre las horas mensuales facturadas y las operativas.</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderCriticalWorkers(summaries) {
  const critical = summaries
    .filter((worker) => worker.status === 'available' || worker.status === 'over')
    .sort((a, b) => Math.abs(b.monthlyDifference || 0) - Math.abs(a.monthlyDifference || 0))
    .slice(0, 8);

  el.criticalWorkers.innerHTML = critical.length
    ? `
      <div class="stack-list">
        ${critical
          .map(
            (worker) => `
              <article class="mini-card">
                <div>
                  <strong>${escapeHtml(worker.name)}</strong>
                  <div class="muted">${TYPE_META[worker.worker_type].label} · Objetivo ${formatHours(worker.monthlyTargetHours)} hs · Asignadas ${formatHours(worker.monthlyHours)} hs</div>
                </div>
                <div>${renderDifferencePill(worker)}</div>
              </article>
            `
          )
          .join('')}
      </div>
    `
    : `
      <div class="empty-state">
        Sin desvíos relevantes.
      </div>
    `;

}

function renderServiceGaps() {
  const gaps = getUncoveredServices().slice(0, 8);

  el.serviceGaps.innerHTML = gaps.length
    ? `
      <div class="stack-list">
        ${gaps
          .map(
            (service) => `
              <article class="mini-card">
                <div>
                  <strong>${escapeHtml(service.name)}</strong>
                  <div class="muted">${escapeHtml(service.zone || 'Sin zona')}</div>
                </div>
                <span class="status-pill status-over">Sin cobertura</span>
              </article>
            `
          )
          .join('')}
      </div>
    `
    : `
      <div class="empty-state">
        No se detectaron servicios visibles sin cobertura.
      </div>
    `;
}

function renderWorkersTable(summaries) {
  el.workersTableBody.innerHTML = summaries
    .map(
      (worker) => {
        const lifecycleInfo = worker.lifecycleInfo || getWorkerLifecycleInfo(worker);

        return `
        <tr data-worker-row-id="${worker.id}">
          <td>
            <button
              type="button"
              data-view-worker="${worker.id}"
              title="Ver planner del operario"
              style="background:none;border:0;padding:0;color:inherit;font:inherit;text-align:left;cursor:pointer;"
            >
              <strong>${escapeHtml(worker.name)}</strong>
            </button>
            <div class="muted">${escapeHtml(worker.notes || '')}</div>
            <div class="worker-secondary-meta">Ingreso: ${worker.hire_date ? formatDateLabel(worker.hire_date) : 'Pendiente'}</div>
          </td>
          <td>${TYPE_META[worker.worker_type].label}</td>
          <td>
            <div class="worker-tenure-cell">
              <strong>${escapeHtml(lifecycleInfo.tenureText)}</strong>
              <span class="muted">${escapeHtml(lifecycleInfo.tenureLongText)}</span>
            </div>
          </td>
          <td>
            <div class="worker-tenure-cell">
              ${renderProbationBadge(lifecycleInfo)}
              <span class="muted worker-probation-detail">${escapeHtml(lifecycleInfo.probationDetailText)}</span>
            </div>
          </td>
          <td>${worker.targetHours == null ? 'SEGURO' : formatHours(worker.targetHours)}</td>
          <td>
            <strong>${formatHours(worker.totalHours)} hs</strong>
            ${worker.weeklyDifference == null ? '' : `<div class="muted">${worker.weeklyDifference > 0 ? `Faltan ${formatHours(worker.weeklyDifference)}` : worker.weeklyDifference < 0 ? `Sobran ${formatHours(Math.abs(worker.weeklyDifference))}` : 'En objetivo'}</div>`}
          </td>
          <td>${worker.monthlyTargetHours == null ? 'POR HORA' : `<strong>${formatHours(worker.monthlyTargetHours)} hs</strong><div class="muted">${escapeHtml(formatMonthLabel(getSelectedDashboardMonth()))}</div>`}</td>
          <td>
            <strong>${formatHours(worker.monthlyHours)} hs</strong>
            <div class="muted">Cronograma proyectado</div>
          </td>
          <td>${worker.monthlyDifference == null ? 'POR HORA' : worker.monthlyDifference > 0.01 ? `Faltan ${formatHours(worker.monthlyDifference)} hs` : worker.monthlyDifference < -0.01 ? `Sobran ${formatHours(Math.abs(worker.monthlyDifference))} hs` : '0 hs'}</td>
          <td>${renderDifferencePill(worker)}</td>
          <td>
            ${
              worker.services.length
                ? worker.services
                    .map((service) => `<span class="chip">${escapeHtml(service.name)}</span>`)
                    .join(' ')
                : 'Sin servicio'
            }
          </td>
          <td>
            <div class="inline-actions">
              <button class="btn btn-secondary btn-sm" type="button" data-view-worker="${worker.id}">Ver planner</button>
              <button class="btn btn-secondary btn-sm" type="button" data-edit-worker="${worker.id}">Editar</button>
            </div>
          </td>
        </tr>
      `;
      }
    )
    .join('');
}

function renderWorkerAvailability(summaries) {
  el.workerAvailabilityBoard.innerHTML = summaries
    .map((worker) => {
      const assignmentsByDay = groupAssignmentsByDay(worker.assignments);
      const lifecycleInfo = worker.lifecycleInfo || getWorkerLifecycleInfo(worker);

      return `
        <article class="availability-card">
          <header class="availability-header">
            <div>
              <h3>${escapeHtml(worker.name)}</h3>
              <p>${TYPE_META[worker.worker_type].label} · ${escapeHtml(lifecycleInfo.tenureText)} · Objetivo mes: ${worker.monthlyTargetHours == null ? 'por hora' : `${formatHours(worker.monthlyTargetHours)} hs`} · Asignadas: ${formatHours(worker.monthlyHours)} hs</p>
              <div class="worker-availability-meta">
                ${renderProbationBadge(lifecycleInfo)}
                <span class="muted worker-probation-detail">${escapeHtml(lifecycleInfo.probationDetailText)}</span>
              </div>
            </div>
            <div>${renderDifferencePill(worker)}</div>
          </header>

          <div class="availability-grid">
            ${DAYS
              .map(
                (day) => {
                  const items = assignmentsByDay.get(day.value) || [];

                  return `
                    <section class="day-column">
                      <h4>${day.label}</h4>
                      ${
                        items.length
                          ? items
                              .map((item) => {
                                const service = getServiceById(item.service_id);
                                return `
                                  <div class="slot-card">
                                    <strong>${formatShiftRange(item.start_time, item.end_time)}</strong>
                                    <span>${escapeHtml(service?.name || 'Servicio')}</span>
                                  </div>
                                `;
                              })
                              .join('')
                          : `<div class="slot-empty">Libre</div>`
                      }
                    </section>
                  `;
                }
              )
              .join('')}
          </div>
        </article>
      `;
    })
    .join('');
}



function getBillingAdjustmentTypeLabel(type) {
  const labels = {
    uncovered: 'Horas sin cobertura',
    client_closure: 'Cierre o suspensión del cliente',
    extra: 'Horas adicionales',
    manual: 'Ajuste manual',
  };
  return labels[type] || 'Ajuste';
}

function renderBilling() {
  const monthKey = getSelectedBillingMonth();
  const monthLabel = formatMonthLabel(monthKey);

  if (el.billingSchemaNotice) {
    el.billingSchemaNotice.classList.toggle('hidden', state.billingSchemaReady);
    el.billingSchemaNotice.innerHTML = state.billingSchemaReady ? '' : `
      <strong>Falta habilitar la proyección automática</strong>
      <p>Ejecutá <code>sql/migration_add_billing_forecast.sql</code> en Supabase. La migración es aditiva y no modifica los servicios, operarios, horarios o asignaciones existentes.</p>
    `;
  }

  const summaries = state.services
    .map((service) => getServiceHoursSummary(service, monthKey))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));

  const configured = summaries.filter((item) => item.projectedBilledHours != null);
  const projectedTotal = Number(configured.reduce((sum, item) => sum + Number(item.projectedBilledHours || 0), 0).toFixed(2));
  const adjustmentsTotal = Number(configured.reduce((sum, item) => sum + Number(item.billingAdjustmentsHours || 0), 0).toFixed(2));
  const adjustedTotal = Number(configured.reduce((sum, item) => sum + Number(item.billedHours || 0), 0).toFixed(2));
  const operativeTotal = Number(summaries.reduce((sum, item) => sum + Number(item.assignedHours || 0), 0).toFixed(2));
  const comparableOperative = Number(configured.reduce((sum, item) => sum + Number(item.assignedHours || 0), 0).toFixed(2));
  const difference = Number((comparableOperative - adjustedTotal).toFixed(2));

  if (el.billingKpiCards) {
    const cards = [
      { label: 'Proyección base', value: `${formatHours(projectedTotal)} hs`, foot: monthLabel, drilldownKey: 'billing-projected' },
      { label: 'Ajustes registrados', value: `${adjustmentsTotal > 0 ? '+' : ''}${formatHours(adjustmentsTotal)} hs`, foot: 'Descuentos y adicionales del mes', drilldownKey: 'billing-adjustments' },
      { label: 'Facturación ajustada', value: `${formatHours(adjustedTotal)} hs`, foot: 'Proyección más novedades cargadas', drilldownKey: 'services-billed' },
      { label: 'Horas operativas', value: `${formatHours(operativeTotal)} hs`, foot: 'Cronograma activo proyectado al mes', drilldownKey: 'services-assigned-all' },
      { label: 'Balance comparable', value: `${difference > 0 ? '+' : ''}${formatHours(difference)} hs`, foot: difference > 0 ? 'Más horas operativas que facturables' : difference < 0 ? 'Cobertura operativa por debajo de lo facturable' : 'Horas alineadas', drilldownKey: 'service-balance' },
    ];
    el.billingKpiCards.innerHTML = cards.map((card) => `
      <article class="kpi-card card-lite metric-drilldown-clickable" data-dashboard-drilldown="${card.drilldownKey}" data-drilldown-source="billing" role="button" tabindex="0" title="Ver detalle">
        <span class="kpi-label">${escapeHtml(card.label)}</span>
        <strong class="kpi-value">${escapeHtml(card.value)}</strong>
        <small class="kpi-foot">${escapeHtml(card.foot)}</small>
      </article>
    `).join('');
  }

  if (!el.billingServicesBoard) return;
  if (!summaries.length) {
    el.billingServicesBoard.innerHTML = '<div class="empty-state">No hay servicios cargados.</div>';
    return;
  }

  el.billingServicesBoard.innerHTML = summaries.map((summary) => {
    const forecast = summary.billingForecast;
    const rulesHtml = forecast.rules.length
      ? `<div class="billing-empty">La proyección base se calcula con esta cobertura facturable, independientemente de qué operario esté asignado hoy.</div>${forecast.rules.map((rule) => {
          const validity = rule.valid_from || rule.valid_until
            ? `${rule.valid_from ? `desde ${formatDateLabel(rule.valid_from)}` : 'sin inicio'} · ${rule.valid_until ? `hasta ${formatDateLabel(rule.valid_until)}` : 'sin fin'}`
            : 'Vigencia permanente';
          return `
            <div class="billing-rule-row">
              <div>
                <strong>${escapeHtml(rule.rule_name || 'Bloque facturable')}</strong>
                <small>${escapeHtml(formatBillingDays(rule.days_of_week))} · ${escapeHtml(formatShiftRange(rule.start_time, rule.end_time))} · ${formatNumber(rule.positions)} puesto${Number(rule.positions) === 1 ? '' : 's'} · ${escapeHtml(validity)}</small>
              </div>
              <div class="inline-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-billing-rule="${rule.id}">Editar</button>
                <button class="btn btn-ghost btn-sm" type="button" data-delete-billing-rule="${rule.id}">Eliminar</button>
              </div>
            </div>
          `;
        }).join('')}`
      : `<div class="billing-empty">${forecast.source === 'operational'
          ? 'Sin cobertura comercial configurada: se usan provisionalmente las horas operativas actuales. Para un balance independiente, configurá la cobertura facturable del servicio.'
          : forecast.source === 'manual'
            ? 'Se utiliza la referencia manual cargada en el servicio.'
            : 'Sin cobertura facturable adicional configurada.'}</div>`;

    const adjustmentsHtml = forecast.adjustments.length
      ? forecast.adjustments.map((item) => `
          <div class="billing-adjustment-row">
            <div>
              <strong>${escapeHtml(item.reason || getBillingAdjustmentTypeLabel(item.adjustment_type))}</strong>
              <small>${escapeHtml(formatDateLabel(item.adjustment_date))} · ${escapeHtml(getBillingAdjustmentTypeLabel(item.adjustment_type))}${getBillingAdjustmentVisibleNotes(item) ? ` · ${escapeHtml(getBillingAdjustmentVisibleNotes(item))}` : ''}</small>
            </div>
            <div class="inline-actions">
              <strong class="billing-adjustment-value ${Number(item.hours_delta) < 0 ? 'negative' : 'positive'}">${Number(item.hours_delta) > 0 ? '+' : ''}${formatHours(item.hours_delta)} hs</strong>
              <button class="btn btn-ghost btn-sm" type="button" data-delete-billing-adjustment="${item.id}">Eliminar</button>
            </div>
          </div>
        `).join('')
      : '<div class="billing-empty">Sin novedades registradas para este mes.</div>';

    return `
      <article class="billing-service-card" data-billing-service-id="${summary.id}">
        <header class="billing-service-head">
          <div>
            <h3>${escapeHtml(summary.name)}</h3>
            <p>${escapeHtml(summary.zone || 'Sin zona')} · ${escapeHtml(summary.client_address || 'Sin dirección')}</p>
          </div>
          <div class="inline-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-add-billing-rule-service="${summary.id}">Agregar cobertura</button>
            <button class="btn btn-secondary btn-sm" type="button" data-edit-final-billing-service="${summary.id}">Editar facturación final</button>
            <button class="btn btn-primary btn-sm" type="button" data-add-billing-adjustment-service="${summary.id}">Agregar novedad</button>
          </div>
        </header>
        <div class="billing-metrics">
          <div class="billing-metric"><span>Fuente</span><strong>${escapeHtml(formatBillingSource(forecast.source))}</strong></div>
          <div class="billing-metric"><span>Proyección base</span><strong>${summary.projectedBilledHours == null ? 'Pendiente' : `${formatHours(summary.projectedBilledHours)} hs`}</strong></div>
          <div class="billing-metric"><span>Ajustes</span><strong>${summary.billingAdjustmentsHours > 0 ? '+' : ''}${formatHours(summary.billingAdjustmentsHours)} hs</strong></div>
          <div class="billing-metric"><span>Facturación ajustada</span><strong>${summary.billedHours == null ? 'Pendiente' : `${formatHours(summary.billedHours)} hs`}</strong></div>
          <div class="billing-metric"><span>Operativas / diferencia</span><strong>${formatHours(summary.assignedHours)} hs · ${summary.difference == null ? '—' : `${summary.difference > 0 ? '+' : ''}${formatHours(summary.difference)} hs`}</strong></div>
        </div>
        <div class="billing-detail-grid">
          <section class="billing-detail-panel">
            <h4>Cobertura facturable</h4>
            <div class="billing-rule-list">${rulesHtml}</div>
          </section>
          <section class="billing-detail-panel">
            <h4>Novedades de ${escapeHtml(monthLabel)}</h4>
            <div class="billing-adjustment-list">${adjustmentsHtml}</div>
          </section>
        </div>
      </article>
    `;
  }).join('');
}


function openFinalBillingDialog(serviceId = '') {
  if (!ensureDataReady('editar la facturación final')) return;
  if (!state.billingSchemaReady) {
    alert('Primero ejecutá sql/migration_add_billing_forecast.sql en Supabase.');
    return;
  }

  const service = getServiceById(serviceId);
  if (!service) return;
  const monthKey = getSelectedBillingMonth();
  const forecast = getServiceBillingForecast(service, monthKey);
  const overrides = getFinalBillingOverrides(serviceId, monthKey);
  const otherAdjustmentHours = Number(
    forecast.adjustments
      .filter((item) => !isFinalBillingOverride(item))
      .reduce((sum, item) => sum + Number(item.hours_delta || 0), 0)
      .toFixed(2)
  );
  const calculatedBeforeFinal = Number((Number(forecast.projectedHours || 0) + otherAdjustmentHours).toFixed(2));

  $('finalBillingServiceId').value = serviceId;
  $('finalBillingMonth').value = monthKey;
  $('finalBillingServiceName').textContent = service.name || 'Servicio';
  $('finalBillingMonthLabel').textContent = formatMonthLabel(monthKey);
  $('finalBillingBaseHours').textContent = `${formatHours(forecast.projectedHours || 0)} hs`;
  $('finalBillingOtherAdjustments').textContent = `${otherAdjustmentHours > 0 ? '+' : ''}${formatHours(otherAdjustmentHours)} hs`;
  $('finalBillingCalculatedHours').textContent = `${formatHours(calculatedBeforeFinal)} hs`;
  $('finalBillingHours').value = Number(forecast.adjustedHours || 0).toFixed(2).replace(/\.00$/, '');
  $('finalBillingNotes').value = String(overrides[0]?.notes || '')
    .replace(FINAL_BILLING_OVERRIDE_MARKER, '')
    .trim();
  el.finalBillingDialog?.showModal();
}

async function saveFinalBilling(event) {
  event.preventDefault();
  if (!state.billingSchemaReady) return;

  const serviceId = $('finalBillingServiceId').value;
  const monthKey = $('finalBillingMonth').value;
  const finalHours = Number($('finalBillingHours').value);
  const service = getServiceById(serviceId);
  if (!serviceId || !monthKey || !service || !Number.isFinite(finalHours) || finalHours < 0) {
    alert('Ingresá una cantidad de horas válida, igual o mayor a 0.');
    return;
  }

  const forecast = getServiceBillingForecast(service, monthKey);
  const overrides = getFinalBillingOverrides(serviceId, monthKey);
  const otherAdjustmentHours = Number(
    forecast.adjustments
      .filter((item) => !isFinalBillingOverride(item))
      .reduce((sum, item) => sum + Number(item.hours_delta || 0), 0)
      .toFixed(2)
  );
  const requiredDelta = Number((finalHours - Number(forecast.projectedHours || 0) - otherAdjustmentHours).toFixed(2));
  const notesText = $('finalBillingNotes').value.trim();
  const submitBtn = el.finalBillingForm?.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }

  try {
    await ensureWriteSession();
    markLocalMutation();

    if (Math.abs(requiredDelta) < 0.01) {
      if (overrides.length) {
        const { error } = await supabase
          .from('service_billing_adjustments')
          .delete()
          .in('id', overrides.map((item) => item.id));
        if (error) throw error;
      }
    } else {
      const payload = {
        service_id: serviceId,
        adjustment_date: getMonthLastDateKey(monthKey),
        adjustment_type: 'manual',
        hours_delta: requiredDelta,
        reason: FINAL_BILLING_OVERRIDE_REASON,
        notes: `${FINAL_BILLING_OVERRIDE_MARKER}${notesText ? `\n${notesText}` : ''}`,
      };

      if (overrides[0]) {
        const { error } = await supabase
          .from('service_billing_adjustments')
          .update(payload)
          .eq('id', overrides[0].id);
        if (error) throw error;
        if (overrides.length > 1) {
          const { error: cleanupError } = await supabase
            .from('service_billing_adjustments')
            .delete()
            .in('id', overrides.slice(1).map((item) => item.id));
          if (cleanupError) throw cleanupError;
        }
      } else {
        const { error } = await supabase.from('service_billing_adjustments').insert(payload);
        if (error) throw error;
      }
    }

    el.finalBillingDialog.close();
    await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la facturación final.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar facturación final'; }
  }
}

function openBillingRuleDialog(serviceId = '', ruleId = '') {
  if (!ensureDataReady('configurar la facturación')) return;
  if (!state.billingSchemaReady) {
    alert('Primero ejecutá sql/migration_add_billing_forecast.sql en Supabase.');
    return;
  }
  const rule = ruleId ? state.billingRules.find((item) => item.id === ruleId) : null;
  $('billingRuleId').value = rule?.id || '';
  $('billingRuleService').value = rule?.service_id || serviceId || '';
  $('billingRuleName').value = rule?.rule_name || '';
  $('billingRuleStart').value = rule?.start_time ? String(rule.start_time).slice(0, 5) : '08:00';
  $('billingRuleEnd').value = rule?.end_time ? String(rule.end_time).slice(0, 5) : '12:00';
  $('billingRulePositions').value = String(rule?.positions || 1);
  $('billingRuleValidFrom').value = rule?.valid_from || '';
  $('billingRuleValidUntil').value = rule?.valid_until || '';
  $('billingRuleNotes').value = rule?.notes || '';
  const selectedDays = new Set((rule?.days_of_week || [1,2,3,4,5]).map(Number));
  document.querySelectorAll('.billing-rule-day').forEach((input) => { input.checked = selectedDays.has(Number(input.value)); });
  const title = $('billingRuleDialogTitle');
  if (title) title.textContent = rule ? 'Editar cobertura facturable' : 'Configurar cobertura facturable';
  el.billingRuleDialog?.showModal();
}

function openBillingAdjustmentDialog(serviceId = '') {
  if (!ensureDataReady('registrar la novedad')) return;
  if (!state.billingSchemaReady) {
    alert('Primero ejecutá sql/migration_add_billing_forecast.sql en Supabase.');
    return;
  }
  const monthKey = getSelectedBillingMonth();
  const today = toDateKey(new Date());
  $('billingAdjustmentId').value = '';
  $('billingAdjustmentService').value = serviceId || '';
  $('billingAdjustmentDate').value = getMonthKey(today) === monthKey ? today : `${monthKey}-01`;
  $('billingAdjustmentType').value = 'uncovered';
  $('billingAdjustmentImpact').value = 'subtract';
  $('billingAdjustmentHours').value = '';
  $('billingAdjustmentReason').value = '';
  $('billingAdjustmentNotes').value = '';
  el.billingAdjustmentDialog?.showModal();
}

function syncBillingAdjustmentImpact() {
  const type = $('billingAdjustmentType')?.value;
  const impact = $('billingAdjustmentImpact');
  if (!impact) return;
  if (type === 'extra') impact.value = 'add';
  if (type === 'uncovered' || type === 'client_closure') impact.value = 'subtract';
}

async function saveBillingRule(event) {
  event.preventDefault();
  if (!state.billingSchemaReady) return;
  const serviceId = $('billingRuleService').value;
  const days = [...document.querySelectorAll('.billing-rule-day:checked')].map((input) => Number(input.value));
  const startTime = $('billingRuleStart').value;
  const endTime = $('billingRuleEnd').value;
  const positions = Number($('billingRulePositions').value || 1);
  const validFrom = $('billingRuleValidFrom').value || null;
  const validUntil = $('billingRuleValidUntil').value || null;

  if (!serviceId || !days.length || !startTime || !endTime) {
    alert('Seleccioná el servicio, al menos un día y un horario completo.');
    return;
  }
  if (startTime === endTime) {
    alert('La hora de inicio y finalización no pueden ser iguales.');
    return;
  }
  if (!Number.isInteger(positions) || positions < 1) {
    alert('La cantidad de puestos simultáneos debe ser un número entero igual o mayor a 1.');
    return;
  }
  if (validFrom && validUntil && validUntil < validFrom) {
    alert('La fecha de finalización no puede ser anterior a la fecha de inicio.');
    return;
  }
  const overnightMessage = buildOvernightConfirmation(days, startTime, endTime);
  if (overnightMessage && !confirm(overnightMessage)) return;

  const submitBtn = el.billingRuleForm?.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }
  try {
    await ensureWriteSession();
    markLocalMutation();
    const payload = {
      service_id: serviceId,
      rule_name: $('billingRuleName').value.trim() || null,
      days_of_week: days,
      start_time: startTime,
      end_time: endTime,
      positions,
      valid_from: validFrom,
      valid_until: validUntil,
      notes: $('billingRuleNotes').value.trim() || null,
      is_active: true,
    };
    const ruleId = $('billingRuleId').value.trim();
    const request = ruleId
      ? supabase.from('service_billing_rules').update(payload).eq('id', ruleId)
      : supabase.from('service_billing_rules').insert(payload);
    const { error } = await request;
    if (error) throw error;
    el.billingRuleDialog.close();
    await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la cobertura facturable.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar cobertura'; }
  }
}

async function saveBillingAdjustment(event) {
  event.preventDefault();
  if (!state.billingSchemaReady) return;
  const serviceId = $('billingAdjustmentService').value;
  const date = $('billingAdjustmentDate').value;
  const hours = Number($('billingAdjustmentHours').value || 0);
  const impact = $('billingAdjustmentImpact').value;
  if (!serviceId || !date || !Number.isFinite(hours) || hours <= 0) {
    alert('Completá el servicio, la fecha y una cantidad de horas mayor a 0.');
    return;
  }
  const submitBtn = el.billingAdjustmentForm?.querySelector('button[type="submit"]');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Guardando...'; }
  try {
    await ensureWriteSession();
    markLocalMutation();
    const { error } = await supabase.from('service_billing_adjustments').insert({
      service_id: serviceId,
      adjustment_date: date,
      adjustment_type: $('billingAdjustmentType').value || 'manual',
      hours_delta: impact === 'subtract' ? -hours : hours,
      reason: $('billingAdjustmentReason').value.trim(),
      notes: $('billingAdjustmentNotes').value.trim() || null,
    });
    if (error) throw error;
    el.billingAdjustmentDialog.close();
    await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la novedad de facturación.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Guardar novedad'; }
  }
}

async function deleteBillingRule(ruleId) {
  if (!confirm('¿Eliminar esta regla de cobertura facturable?')) return;
  markLocalMutation();
  const { error } = await supabase.from('service_billing_rules').delete().eq('id', ruleId);
  if (error) { alert(error.message); return; }
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

async function deleteBillingAdjustment(adjustmentId) {
  if (!confirm('¿Eliminar esta novedad de facturación?')) return;
  markLocalMutation();
  const { error } = await supabase.from('service_billing_adjustments').delete().eq('id', adjustmentId);
  if (error) { alert(error.message); return; }
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

function renderServices() {
  const services = getFilteredServices();
  const paginationMeta = getPaginationMeta(services, 'services');
  const monthLabel = formatMonthLabel(getSelectedDashboardMonth());

  el.servicesGrid.innerHTML = paginationMeta.items
    .map((service) => {
      const hoursSummary = getServiceHoursSummary(service);
      const assignmentsByDay = groupAssignmentsByDay(hoursSummary.assignments);

      return `
        <article class="service-card" data-service-id="${service.id}">
          <header class="service-card-header">
            <div>
              <h3>${escapeHtml(service.name)}</h3>
              <p>${escapeHtml(service.client_address || 'Sin dirección')}</p>
            </div>
            <div class="service-meta">
              <span class="chip">${escapeHtml(monthLabel)}</span>
              <span class="chip">${escapeHtml(service.frequency_type || 'fixed')}</span>
              <span class="chip">${escapeHtml(service.zone || 'Sin zona')}</span>
              ${service.supervisor_name ? `<span class="chip">Sup. ${escapeHtml(service.supervisor_name)}</span>` : ''}
              <span class="chip">${getEntityCoordinates(service) ? 'Ubicación precisa' : 'Ubicación aproximada'}</span>
            </div>
          </header>

          <div class="service-hours-strip">
            <div class="service-hours-metric">
              <span>Proyección base</span>
              <strong>${hoursSummary.projectedBilledHours == null ? 'Pendiente' : `${formatHours(hoursSummary.projectedBilledHours)} hs`}</strong>
            </div>
            <div class="service-hours-metric">
              <span>Ajustes del mes</span>
              <strong>${hoursSummary.billingAdjustmentsHours > 0 ? '+' : ''}${formatHours(hoursSummary.billingAdjustmentsHours)} hs</strong>
            </div>
            <div class="service-hours-metric">
              <span>Facturación ajustada</span>
              <strong>${hoursSummary.billedHours == null ? 'Pendiente' : `${formatHours(hoursSummary.billedHours)} hs`}</strong>
            </div>
            <div class="service-hours-metric">
              <span>Operativas mes</span>
              <strong>${formatHours(hoursSummary.assignedHours)} hs</strong>
            </div>
            <div class="service-hours-metric">
              <span>Balance mensual</span>
              <strong>${hoursSummary.difference == null ? '—' : `${hoursSummary.difference > 0 ? '+' : ''}${formatHours(hoursSummary.difference)} hs`}</strong>
            </div>
          </div>

          <div>${renderServiceHoursPill(hoursSummary)}</div>

          <div class="inline-actions service-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-edit-service="${service.id}">Editar</button>
          </div>

          <div class="service-days">
            ${DAYS
              .map(
                (day) => {
                  const items = assignmentsByDay.get(day.value) || [];

                  return `
                    <section class="service-day">
                      <h4>${day.label}</h4>
                      ${
                        items.length
                          ? items
                              .map((item) => {
                                const worker = getWorkerById(item.worker_id);

                                return `
                                  <div class="slot-card">
                                    <strong>${escapeHtml(worker?.name || 'Sin asignar')}</strong>
                                    <span>${formatShiftRange(item.start_time, item.end_time)}</span>
                                  </div>
                                `;
                              })
                              .join('')
                          : `<div class="slot-empty">Sin cobertura</div>`
                      }
                    </section>
                  `;
                }
              )
              .join('')}
          </div>
        </article>
      `;
    })
    .join('');

  renderPaginationControls('services', paginationMeta);
}

function renderPlanner() {
  const searchTerm = state.filters.search;

  el.plannerBoard.innerHTML = DAYS.map((day) => {
    const items = getAssignmentsByDay(day.value).filter((assignment) => {
      if (!searchTerm) return true;
      const hay = state.derived.assignmentSearchById.get(assignment.id) || '';
      return matchesSearchText(hay, searchTerm);
    });

    return `
      <section class="planner-column">
        <h3>${day.label}</h3>
        ${
          items.length
            ? items
                .map((item) => {
                  const worker = getWorkerById(item.worker_id);
                  const service = getServiceById(item.service_id);

                  return `
                    <article class="planner-card" data-planner-worker-id="${item.worker_id}" data-assignment-id="${item.id}">
                      <h4>${escapeHtml(service?.name || 'Servicio')}</h4>
                      <p>${escapeHtml(worker?.name || 'Operario')}</p>
                      <small>${formatShiftRange(item.start_time, item.end_time)}</small>
                      <div class="inline-actions planner-actions">
                        <button class="btn btn-secondary btn-sm" type="button" data-edit-assignment="${item.id}">Editar</button>
                      </div>
                    </article>
                  `;
                })
                .join('')
            : `<div class="slot-empty">Sin asignaciones</div>`
        }
      </section>
    `;
  }).join('');
}

function renderAbsenceStatusPill(status) {
  const labels = {
    uncovered: 'Descubierto',
    covered: 'Cubierto',
    partial: 'Parcial',
  };

  const classes = {
    uncovered: 'status-over',
    covered: 'status-available',
    partial: 'status-balanced',
  };

  return `<span class="status-pill ${classes[status] || 'status-balanced'}">${labels[status] || status}</span>`;
}

function getSelectedAbsenceDate() {
  if (!el.absenceDateFilter) return new Date().toISOString().slice(0, 10);
  if (!el.absenceDateFilter.value) {
    el.absenceDateFilter.value = new Date().toISOString().slice(0, 10);
  }
  return el.absenceDateFilter.value;
}

function getSelectedAbsenceMonthKey() {
  if (!el.absenceMonthFilter) return getMonthKey(getSelectedAbsenceDate()) || getCurrentMonthKey();
  if (!el.absenceMonthFilter.value) {
    el.absenceMonthFilter.value = getMonthKey(getSelectedAbsenceDate()) || getCurrentMonthKey();
  }
  return el.absenceMonthFilter.value;
}

function getSelectedAbsenceFilterMode() {
  if (!el.absenceFilterMode) return 'day';
  if (!el.absenceFilterMode.value) el.absenceFilterMode.value = 'day';
  return el.absenceFilterMode.value;
}

function getSelectedAbsenceRangeStart() {
  if (!el.absenceRangeStart) return getSelectedAbsenceDate();
  if (!el.absenceRangeStart.value) {
    const today = getSelectedAbsenceDate();
    const monthKey = getMonthKey(today) || getCurrentMonthKey();
    el.absenceRangeStart.value = `${monthKey}-01`;
  }
  return el.absenceRangeStart.value;
}

function getSelectedAbsenceRangeEnd() {
  if (!el.absenceRangeEnd) return getSelectedAbsenceDate();
  if (!el.absenceRangeEnd.value) {
    el.absenceRangeEnd.value = getSelectedAbsenceDate();
  }
  return el.absenceRangeEnd.value;
}

function formatDateRangeLabel(startKey, endKey) {
  if (!startKey && !endKey) return 'sin fechas';
  if (!startKey) return `hasta ${formatDateLabel(endKey)}`;
  if (!endKey) return `desde ${formatDateLabel(startKey)}`;
  if (startKey === endKey) return formatDateLabel(startKey);
  return `${formatDateLabel(startKey)} al ${formatDateLabel(endKey)}`;
}

function getAbsenceActivePeriod() {
  const mode = getSelectedAbsenceFilterMode();

  if (mode === 'month') {
    const monthKey = getSelectedAbsenceMonthKey();
    const monthStart = getMonthStartDate(monthKey);
    const monthEnd = getMonthEndDate(monthKey);
    const startKey = monthStart ? toDateKey(monthStart) : getSelectedAbsenceDate();
    const endKey = monthEnd ? toDateKey(monthEnd) : startKey;
    return {
      mode,
      startKey,
      endKey,
      monthKey,
      label: formatMonthLabel(monthKey),
    };
  }

  if (mode === 'range') {
    let startKey = getSelectedAbsenceRangeStart() || getSelectedAbsenceDate();
    let endKey = getSelectedAbsenceRangeEnd() || startKey;

    if (endKey < startKey) {
      [startKey, endKey] = [endKey, startKey];
      if (el.absenceRangeStart) el.absenceRangeStart.value = startKey;
      if (el.absenceRangeEnd) el.absenceRangeEnd.value = endKey;
    }

    return {
      mode,
      startKey,
      endKey,
      monthKey: getMonthKey(startKey),
      label: formatDateRangeLabel(startKey, endKey),
    };
  }

  const dateKey = getSelectedAbsenceDate();
  return {
    mode: 'day',
    startKey: dateKey,
    endKey: dateKey,
    monthKey: getMonthKey(dateKey),
    label: formatDateLabel(dateKey),
  };
}

function syncAbsencePeriodControls() {
  const mode = getSelectedAbsenceFilterMode();
  const selectedDate = getSelectedAbsenceDate();

  if (el.absenceMonthFilter && !el.absenceMonthFilter.value) {
    el.absenceMonthFilter.value = getMonthKey(selectedDate) || getCurrentMonthKey();
  }

  if (el.absenceRangeStart && !el.absenceRangeStart.value) {
    el.absenceRangeStart.value = `${getMonthKey(selectedDate) || getCurrentMonthKey()}-01`;
  }

  if (el.absenceRangeEnd && !el.absenceRangeEnd.value) {
    el.absenceRangeEnd.value = selectedDate;
  }

  $('absenceDateFilterField')?.classList.toggle('hidden', mode !== 'day');
  $('absenceMonthFilterField')?.classList.toggle('hidden', mode !== 'month');
  $('absenceRangeStartField')?.classList.toggle('hidden', mode !== 'range');
  $('absenceRangeEndField')?.classList.toggle('hidden', mode !== 'range');
}

function updateAbsenceViewHeadings(period) {
  const activePeriod = period || getAbsenceActivePeriod();
  const label = activePeriod.label || formatDateRangeLabel(activePeriod.startKey, activePeriod.endKey);

  if (el.absenceScheduleTitle) {
    el.absenceScheduleTitle.textContent = activePeriod.mode === 'day'
      ? 'Programación del día'
      : activePeriod.mode === 'month'
        ? 'Programación del mes'
        : 'Programación del rango';
  }

  if (el.absenceScheduleSubtitle) {
    el.absenceScheduleSubtitle.textContent = activePeriod.mode === 'day'
      ? 'Marcá ausencias desde la agenda prevista'
      : `Turnos comprendidos en ${label}`;
  }

  if (el.absenceHistoryTitle) {
    el.absenceHistoryTitle.textContent = activePeriod.mode === 'day'
      ? 'Ausencias registradas'
      : activePeriod.mode === 'month'
        ? 'Ausencias del mes'
        : 'Ausencias del rango';
  }

  if (el.absenceHistorySubtitle) {
    el.absenceHistorySubtitle.textContent = activePeriod.mode === 'day'
      ? 'Con cobertura, parcial o sin cubrir'
      : `Resultados registrados para ${label}`;
  }

  if (el.absenceSummaryTitle) {
    el.absenceSummaryTitle.textContent = activePeriod.mode === 'day'
      ? 'Resumen del día'
      : activePeriod.mode === 'month'
        ? 'Resumen mensual de ausencias'
        : 'Resumen del rango';
  }

  if (el.absenceSummarySubtitle) {
    el.absenceSummarySubtitle.textContent = activePeriod.mode === 'day'
      ? 'Cuántas hubo en la fecha, quiénes faltaron y qué servicios se vieron afectados'
      : activePeriod.mode === 'month'
        ? 'Cuántas hubo en el mes, quiénes faltaron y qué servicios se vieron afectados'
        : `Cuántas hubo entre ${label}, quiénes faltaron y qué servicios se vieron afectados`;
  }
}

function getFilteredAbsencesForDate(dateKey) {
  const searchTerm = state.filters.search;
  const workerTypeFilter = state.filters.workerType;

  return getAbsencesByDate(dateKey)
    .filter((absence) => {
      if (searchTerm) {
        const hay = state.derived.absenceSearchById.get(absence.id) || '';
        if (!matchesSearchText(hay, searchTerm)) return false;
      }

      if (workerTypeFilter !== 'all') {
        const worker = getWorkerById(absence.worker_id);
        if (worker?.worker_type !== workerTypeFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const aStart = a.scheduled_start_time || '';
      const bStart = b.scheduled_start_time || '';
      return aStart.localeCompare(bStart);
    });
}

function getFilteredAbsencesForPeriod(period = getAbsenceActivePeriod()) {
  if (!period?.startKey || !period?.endKey) return [];

  return state.absences
    .filter((absence) => {
      const dateKey = absence.absence_date || '';
      if (!dateKey) return false;
      return dateKey >= period.startKey && dateKey <= period.endKey;
    })
    .filter((absence) => {
      const searchTerm = state.filters.search;
      const workerTypeFilter = state.filters.workerType;

      if (searchTerm) {
        const hay = state.derived.absenceSearchById.get(absence.id) || '';
        if (!matchesSearchText(hay, searchTerm)) return false;
      }

      if (workerTypeFilter !== 'all') {
        const worker = getWorkerById(absence.worker_id);
        if (worker?.worker_type !== workerTypeFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const byDate = String(a.absence_date || '').localeCompare(String(b.absence_date || ''));
      if (byDate !== 0) return byDate;
      const byService = String(getServiceById(a.service_id)?.name || '').localeCompare(String(getServiceById(b.service_id)?.name || ''));
      if (byService !== 0) return byService;
      return String(a.scheduled_start_time || '').localeCompare(String(b.scheduled_start_time || ''));
    });
}

function getFilteredAbsencesForMonth(monthKey) {
  if (!monthKey) return [];
  const monthStart = getMonthStartDate(monthKey);
  const monthEnd = getMonthEndDate(monthKey);
  return getFilteredAbsencesForPeriod({
    mode: 'month',
    startKey: monthStart ? toDateKey(monthStart) : '',
    endKey: monthEnd ? toDateKey(monthEnd) : '',
    monthKey,
    label: formatMonthLabel(monthKey),
  });
}


function getFilteredTardinessesForPeriod(period = getAbsenceActivePeriod()) {
  if (!period?.startKey || !period?.endKey) return [];

  return state.tardinesses
    .filter((tardiness) => {
      const dateKey = tardiness.tardiness_date || '';
      if (!dateKey) return false;
      return dateKey >= period.startKey && dateKey <= period.endKey;
    })
    .filter((tardiness) => {
      const searchTerm = state.filters.search;
      const workerTypeFilter = state.filters.workerType;

      if (searchTerm) {
        const hay = state.derived.tardinessSearchById.get(tardiness.id) || '';
        if (!matchesSearchText(hay, searchTerm)) return false;
      }

      if (workerTypeFilter !== 'all') {
        const worker = getWorkerById(tardiness.worker_id);
        if (worker?.worker_type !== workerTypeFilter) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const byDate = String(a.tardiness_date || '').localeCompare(String(b.tardiness_date || ''));
      if (byDate !== 0) return byDate;
      const byService = String(getServiceById(a.service_id)?.name || '').localeCompare(String(getServiceById(b.service_id)?.name || ''));
      if (byService !== 0) return byService;
      return String(a.scheduled_start_time || '').localeCompare(String(b.scheduled_start_time || ''));
    });
}

function getWorkerTardinessStats(worker, referenceDateKey = getAbsenceTrackingReferenceDateKey()) {
  if (!worker) return null;

  const referenceDate = parseDateKey(referenceDateKey);
  if (!referenceDate) return null;

  const hireDate = parseDateKey(worker.hire_date);
  if (!hireDate) {
    return {
      worker,
      referenceDateKey,
      hireDateMissing: true,
      startedYet: true,
      year: referenceDate.getFullYear(),
      daysInReferenceYear: getDaysInYear(referenceDate.getFullYear()),
      tardinessRecords: [],
      tardinessCount: 0,
      elapsedDays: 0,
      annualizedPercent: null,
      calendarYearPercent: null,
      projectedAnnualTardinesses: null,
      status: 'missing',
    };
  }

  const yearStart = new Date(referenceDate.getFullYear(), 0, 1, 12, 0, 0, 0);
  const periodStart = hireDate > yearStart ? hireDate : yearStart;
  const startedYet = periodStart.getTime() <= referenceDate.getTime();

  if (!startedYet) {
    return {
      worker,
      referenceDateKey,
      hireDateMissing: false,
      startedYet: false,
      year: referenceDate.getFullYear(),
      daysInReferenceYear: getDaysInYear(referenceDate.getFullYear()),
      tardinessRecords: [],
      tardinessCount: 0,
      elapsedDays: 0,
      annualizedPercent: 0,
      calendarYearPercent: 0,
      projectedAnnualTardinesses: 0,
      status: 'low',
      periodStartKey: toDateKey(periodStart),
    };
  }

  const periodStartKey = toDateKey(periodStart);
  const referenceKey = toDateKey(referenceDate);
  const daysInReferenceYear = getDaysInYear(referenceDate.getFullYear());
  const tardinessRecords = getTardinessesByWorkerId(worker.id)
    .filter((item) => {
      const dateKey = item.tardiness_date || '';
      return dateKey && dateKey >= periodStartKey && dateKey <= referenceKey;
    });
  const tardinessCount = tardinessRecords.length;
  const elapsedDays = diffDaysInclusive(periodStart, referenceDate);
  const annualizedPercent = elapsedDays ? Number(((tardinessCount / elapsedDays) * 100).toFixed(2)) : 0;
  const calendarYearPercent = daysInReferenceYear ? Number(((tardinessCount / daysInReferenceYear) * 100).toFixed(2)) : 0;
  const projectedAnnualTardinesses = elapsedDays ? Number(((tardinessCount / elapsedDays) * 365).toFixed(2)) : 0;

  let status = 'low';
  if (annualizedPercent >= 3) status = 'high';
  else if (annualizedPercent >= 1) status = 'medium';

  return {
    worker,
    referenceDateKey,
    hireDateMissing: false,
    startedYet: true,
    year: referenceDate.getFullYear(),
    daysInReferenceYear,
    tardinessRecords,
    tardinessCount,
    elapsedDays,
    annualizedPercent,
    calendarYearPercent,
    projectedAnnualTardinesses,
    status,
    periodStartKey,
  };
}

function getFilteredWorkerTardinessStats(referenceDateKey = getAbsenceTrackingReferenceDateKey()) {
  return getFilteredWorkersForAbsenceTracking().map((worker) => getWorkerTardinessStats(worker, referenceDateKey));
}

function renderTardinessPill(stats) {
  if (!stats) return '';
  if (stats.hireDateMissing) return '<span class="status-pill status-insurance">Falta fecha de ingreso</span>';
  if (!stats.startedYet) return '<span class="status-pill status-balanced">Ingreso posterior</span>';
  if (stats.status === 'high') return '<span class="status-pill status-over">Tardanza alta</span>';
  if (stats.status === 'medium') return '<span class="status-pill status-balanced">En seguimiento</span>';
  return '<span class="status-pill status-available">Tardanza baja</span>';
}

function buildTardinessTimelineEntries(workerId = 'all', period = getAbsenceActivePeriod()) {
  const workerIds = workerId === 'all'
    ? new Set(getFilteredWorkersForAbsenceTracking().map((worker) => worker.id))
    : new Set([workerId]);

  return getFilteredTardinessesForPeriod(period)
    .filter((item) => workerIds.has(item.worker_id))
    .map((tardiness) => {
      const worker = getWorkerById(tardiness.worker_id);
      const service = getServiceById(tardiness.service_id);
      const statsAtThatDate = getWorkerTardinessStats(worker, tardiness.tardiness_date);
      const minutesLate = tardiness.minutes_late ?? calculateMinutesLate(tardiness.scheduled_start_time, tardiness.actual_arrival_time);

      return {
        tardiness,
        worker,
        service,
        minutesLate,
        cumulativeTardinesses: statsAtThatDate?.tardinessCount || 0,
        cumulativeAnnualizedPercent: statsAtThatDate?.annualizedPercent,
        cumulativeCalendarYearPercent: statsAtThatDate?.calendarYearPercent,
        projectedAnnualTardinesses: statsAtThatDate?.projectedAnnualTardinesses,
      };
    })
    .sort((a, b) => {
      const byDate = String(b.tardiness.tardiness_date || '').localeCompare(String(a.tardiness.tardiness_date || ''));
      if (byDate !== 0) return byDate;
      return String(b.tardiness.created_at || '').localeCompare(String(a.tardiness.created_at || ''));
    });
}

function getAssignmentOccurrencesForPeriod(period = getAbsenceActivePeriod()) {
  if (!period?.startKey || !period?.endKey) return [];

  const startDate = parseDateKey(period.startKey);
  const endDate = parseDateKey(period.endKey);
  if (!startDate || !endDate) return [];

  const searchTerm = state.filters.search;
  const workerTypeFilter = state.filters.workerType;
  const occurrences = [];
  const cursor = new Date(startDate);

  while (cursor <= endDate) {
    const dateKey = toDateKey(cursor);
    const dayOfWeek = cursor.getDay();
    const dayAssignments = getAssignmentsByDay(dayOfWeek);

    dayAssignments.forEach((assignment) => {
      const worker = getWorkerById(assignment.worker_id);

      if (workerTypeFilter !== 'all' && worker?.worker_type !== workerTypeFilter) {
        return;
      }

      if (searchTerm) {
        const hay = state.derived.assignmentSearchById.get(assignment.id) || '';
        if (!matchesSearchText(hay, searchTerm)) return;
      }

      occurrences.push({
        ...assignment,
        occurrence_date: dateKey,
      });
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return occurrences.sort((a, b) => {
    const byDate = String(a.occurrence_date || '').localeCompare(String(b.occurrence_date || ''));
    if (byDate !== 0) return byDate;
    const byService = String(getServiceById(a.service_id)?.name || '').localeCompare(String(getServiceById(b.service_id)?.name || ''));
    if (byService !== 0) return byService;
    return String(a.start_time || '').localeCompare(String(b.start_time || ''));
  });
}

function summarizeAbsenceType(absences) {
  const normalized = [...new Set(
    absences
      .map((absence) => absence.absence_type || '')
      .filter(Boolean)
  )];

  if (!normalized.length) return '';
  if (normalized.length === 1) return normalized[0];
  return normalized[0];
}

function buildMonthlyWorkerClosureRows(monthKey) {
  return getFilteredWorkersForAbsenceTracking().map((worker) => {
    const entries = buildAbsenceTimelineEntries(worker.id)
      .filter((entry) => getMonthKey(entry.dateKey) === monthKey);

    const totalAbsences = entries.length;
    const unjustified = entries.filter((entry) => entry.absenceType === 'injustificada').length;
    const justified = entries.filter((entry) => entry.absenceType === 'justificada').length;
    const suspensions = entries.filter((entry) => entry.absenceType === 'suspension').length;
    const monthlyHours = calculateMonthlyTargetHours(worker, monthKey);

    return [
      worker.name || '',
      totalAbsences,
      unjustified,
      justified,
      suspensions,
      monthlyHours,
    ];
  });
}

function renderAbsenceScheduleBoard(period = getAbsenceActivePeriod()) {
  if (!el.absenceScheduleBoard) return;

  const occurrences = getAssignmentOccurrencesForPeriod(period);
  const paginationMeta = getPaginationMeta(occurrences, 'absenceSchedule');

  el.absenceScheduleBoard.innerHTML = occurrences.length
    ? paginationMeta.items
        .map((occurrence) => {
          const worker = getWorkerById(occurrence.worker_id);
          const service = getServiceById(occurrence.service_id);
          const absence = findAbsenceForAssignmentOnDate(occurrence, occurrence.occurrence_date);
          const tardiness = findTardinessForAssignmentOnDate(occurrence, occurrence.occurrence_date);
          const tardinessMinutes = tardiness ? (tardiness.minutes_late ?? calculateMinutesLate(tardiness.scheduled_start_time, tardiness.actual_arrival_time)) : null;

          return `
            <article class="absence-card">
              <div class="absence-card-head">
                <div>
                  <h3>${escapeHtml(service?.name || 'Servicio')}</h3>
                  <p>${escapeHtml(worker?.name || 'Operario')}</p>
                </div>
                <div class="absence-card-meta">
                  <span class="chip">${formatDateLabel(occurrence.occurrence_date)}</span>
                  <span class="chip">${DAYS.find((day) => day.value === occurrence.day_of_week)?.fullLabel || ''}</span>
                  <span class="chip">${formatShiftRange(occurrence.start_time, occurrence.end_time)}</span>
                  ${service?.supervisor_name ? `<span class="chip">Sup. ${escapeHtml(service.supervisor_name)}</span>` : ''}
                  ${absence ? renderAbsenceStatusPill(absence.coverage_status) : ''}
                  ${tardiness ? `<span class="status-pill status-balanced">Tardanza ${escapeHtml(formatMinutes(tardinessMinutes))}</span>` : ''}
                </div>
              </div>
              <div class="absence-card-actions">
                <button class="btn btn-primary btn-sm" type="button" data-mark-absence="${occurrence.id}" data-absence-date="${occurrence.occurrence_date}">
                  ${absence ? 'Editar ausencia' : 'Marcar ausencia'}
                </button>
                <button class="btn btn-secondary btn-sm" type="button" data-mark-tardiness="${occurrence.id}" data-tardiness-date="${occurrence.occurrence_date}">
                  ${tardiness ? 'Editar tardanza' : 'Registrar tardanza'}
                </button>
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay turnos programados para ${period.label} con los filtros actuales.
      </div>
    `;

  renderPaginationControls('absenceSchedule', paginationMeta);
}

function renderAbsenceHistoryBoard(period = getAbsenceActivePeriod()) {
  if (!el.absenceHistoryBoard) return;

  const absences = getFilteredAbsencesForPeriod(period);
  const paginationMeta = getPaginationMeta(absences, 'absenceHistory');

  el.absenceHistoryBoard.innerHTML = absences.length
    ? paginationMeta.items
        .map((absence) => {
          const worker = getWorkerById(absence.worker_id);
          const service = getServiceById(absence.service_id);
          const coverageWorker = absence.coverage_worker_id
            ? getWorkerById(absence.coverage_worker_id)
            : null;
          const coveredHours = calculateCoverageHours(absence);

          return `
            <article class="absence-card">
              <div class="absence-card-head">
                <div>
                  <h3>${escapeHtml(worker?.name || 'Operario')}</h3>
                  <p>${escapeHtml(service?.name || 'Servicio')}</p>
                </div>
                <div class="absence-card-meta">
                  <span class="chip">${formatDateLabel(absence.absence_date)}</span>
                  ${absence.scheduled_start_time && absence.scheduled_end_time ? `<span class="chip">${formatShiftRange(absence.scheduled_start_time, absence.scheduled_end_time)}</span>` : ''}
                  ${renderAbsenceStatusPill(absence.coverage_status)}
                </div>
              </div>

              ${
                absence.coverage_status !== 'uncovered'
                  ? `
                    <div class="absence-coverage-box">
                      <strong>${escapeHtml(coverageWorker?.name || 'Cobertura informada')}</strong>
                      <p>
                        ${absence.coverage_date ? `Fecha: ${formatDateLabel(absence.coverage_date)} · ` : ''}
                        ${absence.coverage_start_time && absence.coverage_end_time ? `Horario: ${formatShiftRange(absence.coverage_start_time, absence.coverage_end_time)}` : 'Horario sin informar'}
                        ${coveredHours != null ? ` · ${formatHours(coveredHours)} hs` : ''}
                      </p>
                    </div>
                  `
                  : `
                    <div class="absence-coverage-box">
                      <strong>Servicio sin cobertura</strong>
                      <p>Quedó descubierto en la fecha indicada.</p>
                    </div>
                  `
              }

              ${absence.notes ? `<small>${escapeHtml(absence.notes)}</small>` : ''}

              <div class="absence-card-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-absence="${absence.id}">Editar</button>
                <button class="btn btn-ghost btn-sm" type="button" data-delete-absence="${absence.id}">Eliminar</button>
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay ausencias registradas para ${period.label}.
      </div>
    `;

  renderPaginationControls('absenceHistory', paginationMeta);
}

function renderAbsenceMonthlyKpis(period = getAbsenceActivePeriod()) {
  if (!el.absenceMonthKpiCards) return;

  const absences = getFilteredAbsencesForPeriod(period);
  const uniqueWorkers = new Set(absences.map((absence) => absence.worker_id).filter(Boolean));
  const uniqueServices = new Set(absences.map((absence) => absence.service_id).filter(Boolean));
  const uniqueDates = new Set(absences.map((absence) => absence.absence_date).filter(Boolean));
  const uncovered = absences.filter((absence) => absence.coverage_status === 'uncovered').length;

  const cards = [
    {
      label: 'Ausencias del mes',
      value: absences.length,
      foot: `Registros de ${period.label}`,
    },
    {
      label: 'Operarios que faltaron',
      value: uniqueWorkers.size,
      foot: 'Con al menos una ausencia en el mes',
    },
    {
      label: 'Servicios afectados',
      value: uniqueServices.size,
      foot: 'Servicios impactados por ausencias',
    },
    {
      label: 'Días con ausencias',
      value: uniqueDates.size,
      foot: uncovered ? `${uncovered} registros quedaron descubiertos` : 'Sin registros descubiertos',
    },
  ];

  el.absenceMonthKpiCards.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card card-lite">
          <span class="kpi-label">${card.label}</span>
          <strong class="kpi-value">${card.value}</strong>
          <small class="kpi-foot">${card.foot}</small>
        </article>
      `
    )
    .join('');
}

function renderAbsenceMonthlyBoard(period = getAbsenceActivePeriod()) {
  if (!el.absenceMonthlyBoard) return;

  const absences = getFilteredAbsencesForPeriod(period);
  const paginationMeta = getPaginationMeta(absences, 'absenceMonthly');

  el.absenceMonthlyBoard.innerHTML = absences.length
    ? paginationMeta.items
        .map((absence) => {
          const worker = getWorkerById(absence.worker_id);
          const service = getServiceById(absence.service_id);
          const coverageWorker = absence.coverage_worker_id
            ? getWorkerById(absence.coverage_worker_id)
            : null;
          const coveredHours = calculateCoverageHours(absence);

          return `
            <article class="absence-card">
              <div class="absence-card-head">
                <div>
                  <h3>${escapeHtml(worker?.name || 'Operario')}</h3>
                  <p>${escapeHtml(service?.name || 'Servicio')}</p>
                </div>
                <div class="absence-card-meta">
                  <span class="chip">${formatDateLabel(absence.absence_date)}</span>
                  ${absence.absence_type ? `<span class="chip">${escapeHtml(formatAbsenceTypeLabel(absence.absence_type))}</span>` : ''}
                  ${renderAbsenceStatusPill(absence.coverage_status)}
                </div>
              </div>

              <div class="absence-tracker-metrics">
                <div class="absence-metric-box">
                  <span class="muted">Operario</span>
                  <strong>${escapeHtml(worker?.name || 'Sin operario')}</strong>
                  <p>${TYPE_META[worker?.worker_type]?.label || 'Tipo no informado'}</p>
                </div>
                <div class="absence-metric-box">
                  <span class="muted">Servicio afectado</span>
                  <strong>${escapeHtml(service?.name || 'Sin servicio')}</strong>
                  <p>${escapeHtml(service?.zone || service?.client_address || 'Sin detalle')}</p>
                </div>
                <div class="absence-metric-box">
                  <span class="muted">Cobertura</span>
                  <strong>${escapeHtml(coverageWorker?.name || (absence.coverage_status === 'uncovered' ? 'Sin cobertura' : 'Cobertura informada'))}</strong>
                  <p>
                    ${absence.coverage_date ? `Fecha: ${formatDateLabel(absence.coverage_date)} · ` : ''}
                    ${absence.coverage_start_time && absence.coverage_end_time ? `Horario: ${formatShiftRange(absence.coverage_start_time, absence.coverage_end_time)}` : (absence.coverage_status === 'uncovered' ? 'Servicio descubierto' : 'Horario sin informar')}
                    ${coveredHours != null ? ` · ${formatHours(coveredHours)} hs` : ''}
                  </p>
                </div>
              </div>

              ${(absence.notes || service?.supervisor_name) ? `
                <small>
                  ${service?.supervisor_name ? `Supervisor: ${escapeHtml(service.supervisor_name)}` : ''}
                  ${service?.supervisor_name && absence.notes ? ' · ' : ''}
                  ${absence.notes ? escapeHtml(absence.notes) : ''}
                </small>
              ` : ''}

              <div class="absence-card-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-absence="${absence.id}">Editar</button>
                <button class="btn btn-ghost btn-sm" type="button" data-delete-absence="${absence.id}">Eliminar</button>
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay ausencias registradas para ${period.label} con los filtros actuales.
      </div>
    `;

  renderPaginationControls('absenceMonthly', paginationMeta);
}

function renderAbsenceKpis(referenceDateKey) {
  if (!el.absenceKpiCards) return;

  const stats = getFilteredWorkerAbsenceStats(referenceDateKey);
  const tracked = stats.filter((item) => !item.hireDateMissing && item.startedYet);
  const totalAbsenceDays = tracked.reduce((sum, item) => sum + item.absenceCount, 0);
  const aboveThreshold = tracked.filter((item) => (item.annualizedPercent || 0) >= 3).length;
  const averagePercent = tracked.length
    ? Number((tracked.reduce((sum, item) => sum + Number(item.annualizedPercent || 0), 0) / tracked.length).toFixed(2))
    : 0;
  const missingHireDate = stats.filter((item) => item.hireDateMissing).length;

  const cards = [
    {
      label: 'Faltas acumuladas del año',
      value: totalAbsenceDays,
      foot: `Días únicos al ${formatDateLabel(referenceDateKey)}`,
    },
    {
      label: 'Operarios sobre 3%',
      value: aboveThreshold,
      foot: 'Según criterio anual sobre 365 días',
    },
    {
      label: 'Ausentismo promedio',
      value: formatPercent(averagePercent),
      foot: 'Promedio anualizado de operarios con fecha de ingreso',
    },
    {
      label: 'Sin fecha de ingreso',
      value: missingHireDate,
      foot: 'Completalos para medir correctamente',
    },
  ];

  el.absenceKpiCards.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card card-lite">
          <span class="kpi-label">${card.label}</span>
          <strong class="kpi-value">${card.value}</strong>
          <small class="kpi-foot">${card.foot}</small>
        </article>
      `
    )
    .join('');
}

function renderAbsenceWorkerTrackerBoard(referenceDateKey) {
  if (!el.absenceWorkerTrackerBoard) return;

  const stats = getFilteredWorkerAbsenceStats(referenceDateKey);
  const paginationMeta = getPaginationMeta(stats, 'absenceTracker');

  el.absenceWorkerTrackerBoard.innerHTML = stats.length
    ? paginationMeta.items
        .map((item) => {
          const worker = item.worker;
          return `
            <article class="absence-tracker-card">
              <div class="absence-tracker-head">
                <div>
                  <h3>${escapeHtml(worker?.name || 'Operario')}</h3>
                  <p>
                    ${TYPE_META[worker?.worker_type]?.label || 'Operario'}
                    ${worker?.hire_date ? ` · Ingreso: ${formatDateLabel(worker.hire_date)}` : ' · Fecha de ingreso pendiente'}
                  </p>
                </div>
                <div class="absence-card-meta">
                  ${renderAbsenteeismPill(item)}
                  <button class="btn btn-secondary btn-sm" type="button" data-focus-absence-worker="${worker.id}">Ver historial</button>
                </div>
              </div>

              ${
                item.hireDateMissing
                  ? `
                    <div class="empty-state">
                      Cargá la fecha de ingreso para medir su ausentismo real. Sin eso, el porcentaje queda maquillado y no sirve para decidir.
                    </div>
                  `
                  : !item.startedYet
                    ? `
                      <div class="empty-state">
                        Su fecha de ingreso es posterior a la fecha analizada.
                      </div>
                    `
                    : `
                      <div class="absence-tracker-metrics">
                        <div class="absence-metric-box">
                          <span class="muted">Faltas acumuladas</span>
                          <strong>${item.absenceCount}</strong>
                          <p>1 falta por día, aunque afecte más de un servicio</p>
                        </div>
                        <div class="absence-metric-box">
                          <span class="muted">% anualizado</span>
                          <strong>${formatPercent(item.annualizedPercent)}</strong>
                          <p>Límite interno: 3%</p>
                        </div>
                        <div class="absence-metric-box">
                          <span class="muted">% sobre año calendario</span>
                          <strong>${formatPercent(item.calendarYearPercent)}</strong>
                          <p>${item.absenceCount} faltas sobre ${item.daysInReferenceYear || 365} días del año ${item.year}</p>
                        </div>
                        <div class="absence-metric-box">
                          <span class="muted">Proyección anual</span>
                          <strong>${formatNumber(item.projectedAnnualAbsences)}</strong>
                          <p>Sobre un año de 365 días</p>
                        </div>
                        <div class="absence-metric-box">
                          <span class="muted">Días computados</span>
                          <strong>${item.elapsedDays}</strong>
                          <p>Desde ${formatDateLabel(item.periodStartKey)} hasta ${formatDateLabel(referenceDateKey)}</p>
                        </div>
                      </div>
                    `
              }
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay operarios visibles con los filtros actuales.
      </div>
    `;

  renderPaginationControls('absenceTracker', paginationMeta);
}

function renderAbsenceEmployeeHistoryBoard(period = getAbsenceActivePeriod()) {
  if (!el.absenceEmployeeHistoryBoard) return;

  const workerId = getSelectedAbsenceHistoryWorkerId();
  const entries = buildAbsenceTimelineEntries(workerId)
    .filter((entry) => {
      if (!period?.startKey || !period?.endKey) return true;
      return entry.dateKey >= period.startKey && entry.dateKey <= period.endKey;
    });
  const paginationMeta = getPaginationMeta(entries, 'absenceEmployeeHistory');

  el.absenceEmployeeHistoryBoard.innerHTML = paginationMeta.total
    ? `
      <div class="absence-history-timeline">
        ${paginationMeta.items
          .map((entry) => `
            <article class="absence-card">
              <div class="absence-card-head">
                <div>
                  <h3>${escapeHtml(entry.worker?.name || 'Operario')}</h3>
                  <p>${entry.serviceNames.length ? escapeHtml(entry.serviceNames.join(' · ')) : 'Sin servicio asociado'}</p>
                </div>
                <div class="absence-card-meta">
                  <span class="chip">${formatDateLabel(entry.dateKey)}</span>
                  ${renderAbsenceStatusPill(entry.coverageStatus)}
                </div>
              </div>

              <div class="absence-tracker-metrics">
                <div class="absence-metric-box">
                  <span class="muted">Acumulado a esa fecha</span>
                  <strong>${entry.cumulativeAbsences}</strong>
                  <p>${formatPercent(entry.cumulativePercent)} anualizado</p>
                </div>
                <div class="absence-metric-box">
                  <span class="muted">Horas afectadas</span>
                  <strong>${formatHours(entry.totalScheduledHours)}</strong>
                  <p>${formatHours(entry.totalCoveredHours)} hs cubiertas · ${formatHours(entry.totalUncoveredHours)} hs descubiertas</p>
                </div>
                <div class="absence-metric-box">
                  <span class="muted">Cobertura</span>
                  <strong>${entry.coveredWorkerNames.length ? escapeHtml(entry.coveredWorkerNames.join(', ')) : 'Sin cobertura'}</strong>
                  <p>${entry.projectedAnnualAbsences != null ? `Proyección anual: ${formatNumber(entry.projectedAnnualAbsences)} faltas` : 'Sin proyección disponible'}</p>
                </div>
              </div>

              <div class="stack-list">
                ${entry.absences.map((absence) => {
                  const service = getServiceById(absence.service_id);
                  return `
                    <article class="card-lite">
                      <div class="section-head with-action">
                        <div>
                          <strong>${escapeHtml(service?.name || 'Servicio')}</strong>
                          <div class="muted small">
                            ${absence.scheduled_start_time && absence.scheduled_end_time ? `${formatShiftRange(absence.scheduled_start_time, absence.scheduled_end_time)}` : 'Horario sin informar'}
                            ${absence.absence_type ? ` · ${escapeHtml(formatAbsenceTypeLabel(absence.absence_type))}` : ''}
                          </div>
                        </div>
                        <div class="inline-actions">
                          <button class="btn btn-secondary btn-sm" type="button" data-edit-absence="${absence.id}">Editar</button>
                          <button class="btn btn-ghost btn-sm" type="button" data-delete-absence="${absence.id}">Eliminar</button>
                        </div>
                      </div>
                    </article>
                  `;
                }).join('')}
              </div>
            </article>
          `)
          .join('')}
      </div>
    `
    : `
      <div class="empty-state">
        ${
          workerId === 'all'
            ? 'No hay historial de ausencias para los filtros actuales.'
            : 'Ese operario todavía no tiene ausencias históricas registradas.'
        }
      </div>
    `;

  renderPaginationControls('absenceEmployeeHistory', paginationMeta);
}


function renderTardinessKpis(referenceDateKey = getAbsenceTrackingReferenceDateKey()) {
  if (!el.tardinessKpiCards) return;

  const stats = getFilteredWorkerTardinessStats(referenceDateKey);
  const tracked = stats.filter((item) => !item.hireDateMissing && item.startedYet);
  const totalTardinesses = tracked.reduce((sum, item) => sum + item.tardinessCount, 0);
  const workersWithTardiness = tracked.filter((item) => item.tardinessCount > 0).length;
  const averagePercent = tracked.length
    ? Number((tracked.reduce((sum, item) => sum + Number(item.annualizedPercent || 0), 0) / tracked.length).toFixed(2))
    : 0;
  const worst = tracked.reduce((max, item) => Math.max(max, Number(item.annualizedPercent || 0)), 0);

  const cards = [
    {
      label: 'Tardanzas acumuladas del año',
      value: totalTardinesses,
      foot: `Al ${formatDateLabel(referenceDateKey)}`,
    },
    {
      label: 'Operarios con tardanzas',
      value: workersWithTardiness,
      foot: 'Con al menos una llegada tarde en el período anual',
    },
    {
      label: 'Tardanza promedio anualizada',
      value: formatPercent(averagePercent),
      foot: 'Sobre días computados desde ingreso o 1 de enero',
    },
    {
      label: 'Mayor % anualizado',
      value: formatPercent(worst),
      foot: 'Para detectar casos críticos rápido',
    },
  ];

  el.tardinessKpiCards.innerHTML = cards
    .map((card) => `
      <article class="kpi-card card-lite">
        <span class="kpi-label">${card.label}</span>
        <strong class="kpi-value">${card.value}</strong>
        <small class="kpi-foot">${card.foot}</small>
      </article>
    `)
    .join('');
}

function renderTardinessHistoryBoard(period = getAbsenceActivePeriod()) {
  if (!el.tardinessHistoryBoard) return;

  const tardinesses = getFilteredTardinessesForPeriod(period);
  const paginationMeta = getPaginationMeta(tardinesses, 'tardinessHistory');

  el.tardinessHistoryBoard.innerHTML = tardinesses.length
    ? paginationMeta.items
        .map((tardiness) => {
          const worker = getWorkerById(tardiness.worker_id);
          const service = getServiceById(tardiness.service_id);
          const minutesLate = tardiness.minutes_late ?? calculateMinutesLate(tardiness.scheduled_start_time, tardiness.actual_arrival_time);

          return `
            <article class="absence-card">
              <div class="absence-card-head">
                <div>
                  <h3>${escapeHtml(worker?.name || 'Operario')}</h3>
                  <p>${escapeHtml(service?.name || 'Servicio')}</p>
                </div>
                <div class="absence-card-meta">
                  <span class="chip">${formatDateLabel(tardiness.tardiness_date)}</span>
                  <span class="status-pill status-balanced">${escapeHtml(formatMinutes(minutesLate))}</span>
                </div>
              </div>

              <div class="absence-tracker-metrics">
                <div class="absence-metric-box">
                  <span class="muted">Horario previsto</span>
                  <strong>${tardiness.scheduled_start_time ? tardiness.scheduled_start_time.slice(0, 5) : '—'}</strong>
                  <p>${escapeHtml(service?.supervisor_name || service?.zone || 'Sin detalle')}</p>
                </div>
                <div class="absence-metric-box">
                  <span class="muted">Llegó</span>
                  <strong>${tardiness.actual_arrival_time ? tardiness.actual_arrival_time.slice(0, 5) : '—'}</strong>
                  <p>${escapeHtml(formatMinutes(minutesLate))} de demora</p>
                </div>
              </div>

              ${tardiness.notes ? `<small>${escapeHtml(tardiness.notes)}</small>` : ''}

              <div class="absence-card-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-tardiness="${tardiness.id}">Editar</button>
                <button class="btn btn-ghost btn-sm" type="button" data-delete-tardiness="${tardiness.id}">Eliminar</button>
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay tardanzas registradas para ${period.label}.
      </div>
    `;

  renderPaginationControls('tardinessHistory', paginationMeta);
}

function renderTardinessWorkerTrackerBoard(referenceDateKey = getAbsenceTrackingReferenceDateKey()) {
  if (!el.tardinessWorkerTrackerBoard) return;

  const stats = getFilteredWorkerTardinessStats(referenceDateKey);
  const paginationMeta = getPaginationMeta(stats, 'tardinessTracker');

  el.tardinessWorkerTrackerBoard.innerHTML = stats.length
    ? paginationMeta.items
        .map((item) => {
          const worker = item.worker;
          return `
            <article class="absence-tracker-card">
              <div class="absence-tracker-head">
                <div>
                  <h3>${escapeHtml(worker?.name || 'Operario')}</h3>
                  <p>
                    ${TYPE_META[worker?.worker_type]?.label || 'Operario'}
                    ${worker?.hire_date ? ` · Ingreso: ${formatDateLabel(worker.hire_date)}` : ' · Fecha de ingreso pendiente'}
                  </p>
                </div>
                <div class="absence-card-meta">
                  ${renderTardinessPill(item)}
                  <button class="btn btn-secondary btn-sm" type="button" data-focus-tardiness-worker="${worker.id}">Ver historial</button>
                </div>
              </div>

              ${item.hireDateMissing
                ? `
                  <div class="empty-state">
                    Cargá la fecha de ingreso para medir las tardanzas con un criterio real.
                  </div>
                `
                : !item.startedYet
                  ? `
                    <div class="empty-state">
                      Su fecha de ingreso es posterior a la fecha analizada.
                    </div>
                  `
                  : `
                    <div class="absence-tracker-metrics">
                      <div class="absence-metric-box">
                        <span class="muted">Tardanzas acumuladas</span>
                        <strong>${item.tardinessCount}</strong>
                        <p>Registros del año en curso</p>
                      </div>
                      <div class="absence-metric-box">
                        <span class="muted">% anualizado</span>
                        <strong>${formatPercent(item.annualizedPercent)}</strong>
                        <p>Sobre ${item.elapsedDays} días computados</p>
                      </div>
                      <div class="absence-metric-box">
                        <span class="muted">% sobre año calendario</span>
                        <strong>${formatPercent(item.calendarYearPercent)}</strong>
                        <p>${item.tardinessCount} tardanzas sobre ${item.daysInReferenceYear || 365} días del año ${item.year}</p>
                      </div>
                      <div class="absence-metric-box">
                        <span class="muted">Proyección anual</span>
                        <strong>${formatNumber(item.projectedAnnualTardinesses)}</strong>
                        <p>Si mantiene este ritmo</p>
                      </div>
                    </div>
                  `}
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay operarios visibles con los filtros actuales.
      </div>
    `;

  renderPaginationControls('tardinessTracker', paginationMeta);
}

function getSelectedTardinessHistoryWorkerId() {
  return el.tardinessWorkerHistoryFilter?.value || 'all';
}

function renderTardinessEmployeeHistoryBoard(period = getAbsenceActivePeriod()) {
  if (!el.tardinessEmployeeHistoryBoard) return;

  const workerId = getSelectedTardinessHistoryWorkerId();
  const entries = buildTardinessTimelineEntries(workerId, period);
  const paginationMeta = getPaginationMeta(entries, 'tardinessEmployeeHistory');

  el.tardinessEmployeeHistoryBoard.innerHTML = entries.length
    ? paginationMeta.items
        .map((entry) => {
          const { tardiness, worker, service, minutesLate } = entry;
          return `
            <article class="absence-card">
              <div class="absence-card-head">
                <div>
                  <h3>${escapeHtml(worker?.name || 'Operario')}</h3>
                  <p>${escapeHtml(service?.name || 'Servicio')}</p>
                </div>
                <div class="absence-card-meta">
                  <span class="chip">${formatDateLabel(tardiness.tardiness_date)}</span>
                  <span class="status-pill status-balanced">${escapeHtml(formatMinutes(minutesLate))}</span>
                </div>
              </div>

              <div class="absence-tracker-metrics">
                <div class="absence-metric-box">
                  <span class="muted">Previsto / llegada</span>
                  <strong>${tardiness.scheduled_start_time ? tardiness.scheduled_start_time.slice(0, 5) : '—'} → ${tardiness.actual_arrival_time ? tardiness.actual_arrival_time.slice(0, 5) : '—'}</strong>
                  <p>${escapeHtml(service?.supervisor_name || service?.zone || 'Sin detalle')}</p>
                </div>
                <div class="absence-metric-box">
                  <span class="muted">Acumulado a esa fecha</span>
                  <strong>${entry.cumulativeTardinesses}</strong>
                  <p>${formatPercent(entry.cumulativeAnnualizedPercent)} anualizado · ${formatPercent(entry.cumulativeCalendarYearPercent)} año calendario</p>
                </div>
                <div class="absence-metric-box">
                  <span class="muted">Proyección anual</span>
                  <strong>${formatNumber(entry.projectedAnnualTardinesses)}</strong>
                  <p>Tardanzas estimadas a este ritmo</p>
                </div>
              </div>

              ${tardiness.notes ? `<small>${escapeHtml(tardiness.notes)}</small>` : ''}

              <div class="absence-card-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-tardiness="${tardiness.id}">Editar</button>
                <button class="btn btn-ghost btn-sm" type="button" data-delete-tardiness="${tardiness.id}">Eliminar</button>
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        ${workerId === 'all' ? 'No hay historial de tardanzas para los filtros actuales.' : 'Ese operario todavía no tiene tardanzas históricas registradas.'}
      </div>
    `;

  renderPaginationControls('tardinessEmployeeHistory', paginationMeta);
}

function renderMaterialsKpis() {
  if (!el.materialKpiCards) return;

  const monthKey = getSelectedMaterialsMonth();
  const serviceMaterials = getFilteredServiceMaterials();
  const consumptions = getFilteredMaterialConsumptions(monthKey);
  const servicesWithStock = new Set(serviceMaterials.map((item) => item.service_id)).size;
  const materialsWithMovement = new Set(consumptions.map((item) => item.material_id)).size;
  const totalConsumed = consumptions.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const lowStockCount = serviceMaterials.filter((item) => item.minimum_stock != null && Number(item.current_stock || 0) <= Number(item.minimum_stock || 0)).length;

  const cards = [
    {
      label: 'Materiales base',
      value: state.materials.length,
      foot: 'Catálogo reutilizable',
    },
    {
      label: 'Servicios con stock',
      value: servicesWithStock,
      foot: 'Con materiales cargados',
    },
    {
      label: 'Consumo del mes',
      value: formatNumber(totalConsumed),
      foot: `${materialsWithMovement} materiales con movimiento`,
    },
    {
      label: 'Stock bajo mínimo',
      value: lowStockCount,
      foot: 'Para anticipar pedidos',
    },
  ];

  el.materialKpiCards.innerHTML = cards
    .map((card) => `
      <article class="kpi-card card-lite">
        <span class="kpi-label">${card.label}</span>
        <strong class="kpi-value">${card.value}</strong>
        <small class="kpi-foot">${card.foot}</small>
      </article>
    `)
    .join('');
}

function renderServiceMaterialsBoard() {
  if (!el.serviceMaterialsBoard) return;

  const serviceMaterials = getFilteredServiceMaterials();
  const monthKey = getSelectedMaterialsMonth();

  if (!serviceMaterials.length) {
    el.serviceMaterialsBoard.innerHTML = `
      <div class="empty-state">
        No hay materiales cargados para los filtros actuales.
      </div>
    `;
    return;
  }

  const grouped = new Map();
  serviceMaterials.forEach((item) => {
    if (!grouped.has(item.service_id)) grouped.set(item.service_id, []);
    grouped.get(item.service_id).push(item);
  });

  el.serviceMaterialsBoard.innerHTML = [...grouped.entries()]
    .map(([serviceId, items]) => {
      const service = getServiceById(serviceId);

      return `
        <article class="service-material-card">
          <div class="service-material-card-head">
            <div>
              <h3>${escapeHtml(service?.name || 'Servicio')}</h3>
              <p>${escapeHtml(service?.client_address || 'Sin dirección')}</p>
            </div>
            <div class="service-meta">
              ${service?.supervisor_name ? `<span class="chip">Sup. ${escapeHtml(service.supervisor_name)}</span>` : ''}
              <span class="chip">${escapeHtml(service?.zone || 'Sin zona')}</span>
            </div>
          </div>

          <div class="service-material-list">
            ${items
              .map((item) => {
                const material = getMaterialById(item.material_id);
                const monthConsumption = calculateMonthConsumptionForServiceMaterial(item.id, monthKey);
                const averageMonthly = calculateAverageMonthlyConsumption(item.id);
                const lowStock = item.minimum_stock != null && Number(item.current_stock || 0) <= Number(item.minimum_stock || 0);

                return `
                  <div class="material-stock-row ${lowStock ? 'material-stock-row-warning' : ''}">
                    <div>
                      <strong>${escapeHtml(material?.name || 'Material')}</strong>
                      <p>
                        Stock actual: ${formatNumber(item.current_stock)} ${escapeHtml(material?.unit || '')}
                        ${item.minimum_stock != null ? ` · Mínimo: ${formatNumber(item.minimum_stock)} ${escapeHtml(material?.unit || '')}` : ''}
                        · Mes: ${formatNumber(monthConsumption)} ${escapeHtml(material?.unit || '')}
                        · Promedio: ${formatNumber(averageMonthly)} ${escapeHtml(material?.unit || '')}/mes
                      </p>
                      ${material?.presentation ? `<small>${escapeHtml(material.presentation)}</small>` : ''}
                    </div>
                    <div class="inline-actions">
                      <button class="btn btn-secondary btn-sm" type="button" data-edit-service-material="${item.id}">Editar</button>
                      <button class="btn btn-primary btn-sm" type="button" data-log-service-material="${item.id}">Consumo</button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
        </article>
      `;
    })
    .join('');
}

function buildMonthlyMaterialSummary(monthKey = getSelectedMaterialsMonth()) {
  const serviceFilterId = getSelectedMaterialsServiceId();
  const serviceMaterials = getFilteredServiceMaterials();
  const allowedServiceMaterialIds = new Set(serviceMaterials.map((item) => item.id));

  const summary = new Map();
  const historicalByMaterialMonth = new Map();

  state.materialConsumptions.forEach((consumption) => {
    if (!allowedServiceMaterialIds.has(consumption.service_material_id)) return;
    if (serviceFilterId !== 'all' && consumption.service_id !== serviceFilterId) return;

    const material = getMaterialById(consumption.material_id);
    if (!summary.has(consumption.material_id)) {
      summary.set(consumption.material_id, {
        materialId: consumption.material_id,
        name: material?.name || 'Material',
        unit: material?.unit || '',
        totalConsumed: 0,
        services: new Set(),
        currentStockTotal: 0,
        averageMonthly: 0,
      });
    }

    const historyKey = `${consumption.material_id}__${getMonthKey(consumption.consumption_date)}`;
    historicalByMaterialMonth.set(
      historyKey,
      (historicalByMaterialMonth.get(historyKey) || 0) + Number(consumption.quantity || 0)
    );

    if (getMonthKey(consumption.consumption_date) !== monthKey) return;

    const row = summary.get(consumption.material_id);
    row.totalConsumed += Number(consumption.quantity || 0);
    row.services.add(consumption.service_id);
  });

  serviceMaterials.forEach((serviceMaterial) => {
    const material = getMaterialById(serviceMaterial.material_id);
    if (!summary.has(serviceMaterial.material_id)) {
      summary.set(serviceMaterial.material_id, {
        materialId: serviceMaterial.material_id,
        name: material?.name || 'Material',
        unit: material?.unit || '',
        totalConsumed: 0,
        services: new Set(),
        currentStockTotal: 0,
        averageMonthly: 0,
      });
    }

    const row = summary.get(serviceMaterial.material_id);
    row.currentStockTotal += Number(serviceMaterial.current_stock || 0);
  });

  const historicalByMaterial = new Map();
  historicalByMaterialMonth.forEach((qty, key) => {
    const [materialId] = key.split('__');
    if (!historicalByMaterial.has(materialId)) historicalByMaterial.set(materialId, []);
    historicalByMaterial.get(materialId).push(qty);
  });

  return [...summary.values()]
    .map((row) => {
      const historical = historicalByMaterial.get(row.materialId) || [];
      const averageMonthly = historical.length
        ? historical.reduce((sum, value) => sum + value, 0) / historical.length
        : 0;

      return {
        ...row,
        servicesCount: row.services.size,
        averageMonthly: Number(averageMonthly.toFixed(2)),
        totalConsumed: Number(row.totalConsumed.toFixed(2)),
        currentStockTotal: Number(row.currentStockTotal.toFixed(2)),
      };
    })
    .sort((a, b) => b.totalConsumed - a.totalConsumed || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}

function renderMaterialsMonthlySummaryBoard() {
  if (!el.materialsMonthlySummaryBoard) return;

  const monthKey = getSelectedMaterialsMonth();
  const summary = buildMonthlyMaterialSummary(monthKey);

  el.materialsMonthlySummaryBoard.innerHTML = summary.length
    ? summary
        .map((item) => `
          <article class="mini-card">
            <div>
              <strong>${escapeHtml(item.name)}</strong>
              <div class="muted">
                Consumido: ${formatNumber(item.totalConsumed)} ${escapeHtml(item.unit)}
                · Servicios: ${item.servicesCount}
                · Promedio histórico: ${formatNumber(item.averageMonthly)} ${escapeHtml(item.unit)}/mes
              </div>
            </div>
            <div class="status-pill ${item.currentStockTotal <= item.averageMonthly && item.averageMonthly > 0 ? 'status-over' : 'status-available'}">
              Stock total ${formatNumber(item.currentStockTotal)} ${escapeHtml(item.unit)}
            </div>
          </article>
        `)
        .join('')
    : `
      <div class="empty-state">
        No hay consumo ni stock cargado para ${formatMonthLabel(monthKey)}.
      </div>
    `;
}

function renderMaterialsConsumptionHistoryBoard() {
  if (!el.materialsConsumptionHistoryBoard) return;

  const monthKey = getSelectedMaterialsMonth();
  const consumptions = getFilteredMaterialConsumptions(monthKey);

  el.materialsConsumptionHistoryBoard.innerHTML = consumptions.length
    ? consumptions
        .map((consumption) => {
          const service = getServiceById(consumption.service_id);
          const material = getMaterialById(consumption.material_id);

          return `
            <article class="material-consumption-row">
              <div>
                <strong>${escapeHtml(material?.name || 'Material')}</strong>
                <p>
                  ${formatDateLabel(consumption.consumption_date)} · ${escapeHtml(service?.name || 'Servicio')}
                  · ${formatNumber(consumption.quantity)} ${escapeHtml(material?.unit || '')}
                </p>
                ${consumption.notes ? `<small>${escapeHtml(consumption.notes)}</small>` : ''}
              </div>
              <div class="inline-actions">
                <button class="btn btn-secondary btn-sm" type="button" data-edit-material-consumption="${consumption.id}">Editar</button>
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay consumos registrados para ${formatMonthLabel(monthKey)}.
      </div>
    `;
}



function getOptimizerSelectedDays() {
  return [...document.querySelectorAll('.optimizer-day:checked')]
    .map((input) => Number(input.value))
    .sort((a, b) => {
      const order = [1, 2, 3, 4, 5, 6, 0];
      return order.indexOf(a) - order.indexOf(b);
    });
}

function getOptimizerRequest() {
  const selectedServiceId = el.optimizerExistingService?.value || '';
  const selectedService = selectedServiceId ? getServiceById(selectedServiceId) : null;
  const coordinateValue = el.optimizerCoordinates?.value || '';
  const parsedCoordinates = parseCoordinates(coordinateValue);
  const startTime = el.optimizerStart?.value || '';
  const endTime = el.optimizerEnd?.value || '';
  const days = getOptimizerSelectedDays();
  const weeklyHours = Number((calculateHours(startTime, endTime) * days.length).toFixed(2));
  const monthKey = el.optimizerMonth?.value || getSelectedDashboardMonth();
  const monthlyHours = calculateMonthlyRecurringShiftHours(days, startTime, endTime, monthKey);

  return {
    selectedServiceId,
    selectedService,
    name: el.optimizerServiceName?.value.trim() || selectedService?.name || 'Servicio simulado',
    billedMonthlyHours: el.optimizerBilledMonthlyHours?.value === ''
      ? (selectedService?.billed_monthly_hours == null ? null : Number(selectedService.billed_monthly_hours))
      : Number(el.optimizerBilledMonthlyHours?.value),
    client_address: el.optimizerAddress?.value.trim() || selectedService?.client_address || '',
    zone: el.optimizerZone?.value.trim() || selectedService?.zone || '',
    latitude: parsedCoordinates?.latitude ?? selectedService?.latitude ?? null,
    longitude: parsedCoordinates?.longitude ?? selectedService?.longitude ?? null,
    coordinatesRaw: coordinateValue,
    days,
    startTime,
    endTime,
    weeklyHours,
    monthlyHours,
    monthKey,
    travelBuffer: Number(el.optimizerTravelBuffer?.value || 15),
    allowOverTarget: Boolean(el.optimizerAllowOverTarget?.checked),
  };
}

function updateOptimizerWorkloadPreview() {
  if (!el.optimizerWorkloadPreview) return;
  const request = getOptimizerRequest();

  if (!request.days.length || !request.startTime || !request.endTime || request.weeklyHours <= 0) {
    el.optimizerWorkloadPreview.innerHTML = 'Seleccioná días y horarios para calcular la carga.';
    return;
  }

  const dayLabels = request.days
    .map((dayValue) => DAYS.find((day) => day.value === dayValue)?.label || '')
    .filter(Boolean)
    .join(', ');

  const billingComparison = request.billedMonthlyHours == null
    ? 'Sin horas facturadas cargadas para contrastar'
    : `${formatHours(request.billedMonthlyHours)} hs facturadas · ${request.monthlyHours > request.billedMonthlyHours ? 'el bloque supera' : request.monthlyHours < request.billedMonthlyHours ? 'el bloque queda por debajo' : 'el bloque coincide'} en ${formatHours(Math.abs(request.monthlyHours - request.billedMonthlyHours))} hs`;

  el.optimizerWorkloadPreview.innerHTML = `
    <strong>${formatHours(request.weeklyHours)} hs semanales</strong>
    <span>${formatHours(request.monthlyHours)} hs proyectadas en ${escapeHtml(formatMonthLabel(request.monthKey))}</span>
    <small>${escapeHtml(dayLabels)} · ${escapeHtml(formatShiftRange(request.startTime, request.endTime))} · ${escapeHtml(billingComparison)}</small>
  `;
}

function getWorkerHomeLocation(worker) {
  return {
    latitude: worker?.latitude ?? null,
    longitude: worker?.longitude ?? null,
    zone: worker?.home_zone || '',
    name: worker?.home_address || worker?.home_zone || 'Domicilio',
  };
}

function buildOptimizerDayAnalysis(worker, request, dayValue) {
  const dayMeta = DAYS.find((day) => day.value === Number(dayValue));
  const requestInterval = getWeeklyShiftInterval(dayValue, request.startTime, request.endTime, 0);
  const allAssignments = getWorkerAssignments(worker.id);

  const conflicts = allAssignments.filter((assignment) => weeklyIntervalsOverlap(
    dayValue,
    request.startTime,
    request.endTime,
    Number(assignment.day_of_week),
    assignment.start_time,
    assignment.end_time
  ));

  if (conflicts.length) {
    return {
      dayValue,
      dayLabel: dayMeta?.fullLabel || '',
      feasible: false,
      conflict: true,
      reasons: conflicts.map((assignment) => {
        const service = getServiceById(assignment.service_id);
        return `${dayMeta?.label || ''}: coincide con ${service?.name || 'otro servicio'} (${getDayLabel(assignment.day_of_week, true)} ${formatShiftRange(assignment.start_time, assignment.end_time)})`;
      }),
      warnings: [],
      routeScores: [],
      transitions: [],
    };
  }

  const expandedAssignments = allAssignments.flatMap((assignment) => [-1, 0, 1].map((weekOffset) => {
    const interval = getWeeklyShiftInterval(
      Number(assignment.day_of_week),
      assignment.start_time,
      assignment.end_time,
      weekOffset
    );
    return interval ? { assignment, ...interval } : null;
  }).filter(Boolean));

  const maxDirectTransitionGap = 8 * 60;
  const previousSlot = expandedAssignments
    .filter((slot) => slot.end <= requestInterval.start && (requestInterval.start - slot.end) <= maxDirectTransitionGap)
    .sort((a, b) => b.end - a.end)[0] || null;
  const nextSlot = expandedAssignments
    .filter((slot) => slot.start >= requestInterval.end && (slot.start - requestInterval.end) <= maxDirectTransitionGap)
    .sort((a, b) => a.start - b.start)[0] || null;
  const previousAssignment = previousSlot?.assignment || null;
  const nextAssignment = nextSlot?.assignment || null;

  const transitions = [];
  const reasons = [];
  const warnings = [];
  const routeScores = [];
  let feasible = true;

  const newLocation = {
    latitude: request.latitude,
    longitude: request.longitude,
    zone: request.zone,
    name: request.name,
  };

  const evaluateTransition = ({ origin, destination, originZone, destinationZone, gapMinutes, label, direction }) => {
    const comparison = getLocationComparison(origin, destination, originZone, destinationZone);
    const requiredMinutes = comparison.estimatedMinutes == null
      ? null
      : comparison.estimatedMinutes + request.travelBuffer;
    const transitionFeasible = requiredMinutes == null || gapMinutes >= requiredMinutes;

    if (!transitionFeasible) feasible = false;

    if (comparison.method === 'coordinates') {
      routeScores.push(Math.max(2, 25 - Math.min(23, comparison.distanceKm * 1.45)));
    } else if (comparison.sameZone) {
      routeScores.push(18);
    } else {
      routeScores.push(8);
      warnings.push(`${dayMeta?.label || ''}: no hay coordenadas suficientes para validar el traslado ${label.toLowerCase()}`);
    }

    transitions.push({
      direction,
      label,
      comparison,
      gapMinutes,
      requiredMinutes,
      feasible: transitionFeasible,
    });

    if (!transitionFeasible) {
      reasons.push(`${dayMeta?.label || ''}: el traslado ${label.toLowerCase()} requiere aproximadamente ${requiredMinutes} min y solo hay ${gapMinutes} min disponibles`);
    }
  };

  if (previousAssignment) {
    const previousService = getServiceById(previousAssignment.service_id);
    const gapMinutes = requestInterval.start - previousSlot.end;
    evaluateTransition({
      origin: previousService,
      destination: newLocation,
      originZone: previousService?.zone || '',
      destinationZone: request.zone,
      gapMinutes,
      label: `desde ${previousService?.name || 'el servicio anterior'}`,
      direction: 'before',
    });
  } else {
    const home = getWorkerHomeLocation(worker);
    const comparison = getLocationComparison(home, newLocation, home.zone, request.zone);
    if (comparison.method === 'coordinates') {
      routeScores.push(Math.max(2, 20 - Math.min(18, comparison.distanceKm * 1.1)));
    } else if (comparison.sameZone) {
      routeScores.push(16);
    } else {
      routeScores.push(7);
      warnings.push(`${dayMeta?.label || ''}: no se pudo medir con precisión el recorrido desde el domicilio`);
    }
    transitions.push({
      direction: 'home',
      label: 'desde el domicilio',
      comparison,
      gapMinutes: null,
      requiredMinutes: comparison.estimatedMinutes,
      feasible: true,
    });
  }

  if (nextAssignment) {
    const nextService = getServiceById(nextAssignment.service_id);
    const gapMinutes = nextSlot.start - requestInterval.end;
    evaluateTransition({
      origin: newLocation,
      destination: nextService,
      originZone: request.zone,
      destinationZone: nextService?.zone || '',
      gapMinutes,
      label: `hacia ${nextService?.name || 'el servicio siguiente'}`,
      direction: 'after',
    });
  }

  return {
    dayValue,
    dayLabel: dayMeta?.fullLabel || '',
    feasible,
    conflict: false,
    reasons,
    warnings: [...new Set(warnings)],
    routeScores,
    transitions,
    previousAssignment,
    nextAssignment,
  };
}

function scoreOptimizerCandidate(worker, request) {
  const assignments = getWorkerAssignments(worker.id);
  const currentWeeklyHours = Number(assignments.reduce((sum, assignment) => (
    sum + calculateHours(assignment.start_time, assignment.end_time)
  ), 0).toFixed(2));
  const targetHours = getTargetHours(worker);
  const projectedWeeklyHours = Number((currentWeeklyHours + request.weeklyHours).toFixed(2));
  const availableHours = targetHours == null ? null : Number((targetHours - currentWeeklyHours).toFixed(2));
  const overBy = targetHours == null ? 0 : Number(Math.max(0, projectedWeeklyHours - targetHours).toFixed(2));
  const dayAnalyses = request.days.map((dayValue) => buildOptimizerDayAnalysis(worker, request, dayValue));
  const scheduleReasons = dayAnalyses.flatMap((analysis) => analysis.reasons);
  const warnings = [...new Set(dayAnalyses.flatMap((analysis) => analysis.warnings))];
  const hasScheduleIssue = dayAnalyses.some((analysis) => !analysis.feasible);
  const exceedsTarget = targetHours != null && overBy > 0.01;
  const rejectedForHours = exceedsTarget && !request.allowOverTarget;

  let hoursScore = 18;
  if (targetHours != null) {
    if (!exceedsTarget) {
      const remainingAfter = Math.max(0, targetHours - projectedWeeklyHours);
      hoursScore = Math.max(14, 25 - ((remainingAfter / Math.max(targetHours, 1)) * 12));
    } else {
      hoursScore = Math.max(0, 12 - (overBy * 1.5));
    }
  }

  const allRouteScores = dayAnalyses.flatMap((analysis) => analysis.routeScores);
  const routeScore = allRouteScores.length
    ? Math.min(25, allRouteScores.reduce((sum, value) => sum + value, 0) / allRouteScores.length)
    : 7;

  const workerHome = getWorkerHomeLocation(worker);
  const newLocation = {
    latitude: request.latitude,
    longitude: request.longitude,
    zone: request.zone,
  };
  const homeComparison = getLocationComparison(workerHome, newLocation, worker.home_zone || '', request.zone);
  let homeScore = 4;
  if (homeComparison.method === 'coordinates') {
    if (homeComparison.distanceKm <= 5) homeScore = 10;
    else if (homeComparison.distanceKm <= 10) homeScore = 8;
    else if (homeComparison.distanceKm <= 20) homeScore = 5;
    else homeScore = 2;
  } else if (homeComparison.sameZone) {
    homeScore = 7;
  }

  const scheduleScore = hasScheduleIssue ? 0 : 40;
  const score = Number(Math.max(0, Math.min(100, scheduleScore + hoursScore + routeScore + homeScore)).toFixed(1));
  const rejected = hasScheduleIssue || rejectedForHours;
  const rejectionReasons = [...scheduleReasons];

  if (rejectedForHours) {
    rejectionReasons.push(`Quedaría ${formatHours(overBy)} hs por encima de su objetivo semanal`);
  }

  if (!getEntityCoordinates(worker)) {
    warnings.push('Domicilio sin coordenadas: la cercanía desde su casa se estimó por zona o quedó sin medir');
  }
  if (!getEntityCoordinates(request)) {
    warnings.push('Servicio sin coordenadas: las distancias se estimaron por zona');
  }

  let classification = 'Condicionado';
  if (!rejected && score >= 82) classification = 'Muy recomendado';
  else if (!rejected && score >= 68) classification = 'Recomendado';
  else if (!rejected && score >= 52) classification = 'Viable';
  else if (!rejected) classification = 'Alternativa débil';

  return {
    worker,
    request,
    currentWeeklyHours,
    targetHours,
    projectedWeeklyHours,
    availableHours,
    overBy,
    dayAnalyses,
    homeComparison,
    scheduleScore,
    hoursScore: Number(hoursScore.toFixed(1)),
    routeScore: Number(routeScore.toFixed(1)),
    homeScore: Number(homeScore.toFixed(1)),
    score,
    rejected,
    rejectionReasons: [...new Set(rejectionReasons)],
    warnings: [...new Set(warnings)],
    classification,
  };
}

function analyzeOptimizerRequest(request) {
  const scored = state.workers.map((worker) => scoreOptimizerCandidate(worker, request));
  const candidates = scored
    .filter((candidate) => !candidate.rejected)
    .sort((a, b) => b.score - a.score || a.overBy - b.overBy || String(a.worker.name || '').localeCompare(String(b.worker.name || ''), 'es'));
  const rejected = scored
    .filter((candidate) => candidate.rejected)
    .sort((a, b) => b.score - a.score || String(a.worker.name || '').localeCompare(String(b.worker.name || ''), 'es'));

  return {
    request,
    candidates,
    rejected,
    best: candidates[0] || null,
    analyzedAt: new Date().toISOString(),
  };
}

function formatOptimizerTransition(transition) {
  const comparison = transition.comparison || {};
  const parts = [transition.label];
  if (comparison.distanceKm != null) parts.push(`${formatNumber(comparison.distanceKm)} km directos`);
  if (comparison.estimatedMinutes != null) parts.push(`~${comparison.estimatedMinutes} min de viaje`);
  if (transition.gapMinutes != null) parts.push(`${transition.gapMinutes} min disponibles`);
  if (comparison.method === 'zone') parts.push('estimado por zona');
  if (comparison.method === 'unknown') parts.push('distancia no validada');
  return parts.join(' · ');
}

function renderOptimizerScoreBreakdown(candidate) {
  return `
    <div class="optimizer-score-breakdown">
      <span>Horario <strong>${formatNumber(candidate.scheduleScore)}/40</strong></span>
      <span>Carga <strong>${formatNumber(candidate.hoursScore)}/25</strong></span>
      <span>Recorrido <strong>${formatNumber(candidate.routeScore)}/25</strong></span>
      <span>Domicilio <strong>${formatNumber(candidate.homeScore)}/10</strong></span>
    </div>
  `;
}

function renderOptimizerCandidateCard(candidate, index) {
  const worker = candidate.worker;
  const targetLabel = candidate.targetHours == null ? 'Sin objetivo fijo' : `${formatHours(candidate.targetHours)} hs objetivo`;
  const projectedDifference = candidate.targetHours == null
    ? 'Seguro / por hora'
    : candidate.overBy > 0
      ? `${formatHours(candidate.overBy)} hs excedidas`
      : `${formatHours(Math.max(0, candidate.targetHours - candidate.projectedWeeklyHours))} hs libres después`;
  const canPrepareAssignment = Boolean(candidate.request.selectedServiceId);

  return `
    <article class="optimizer-candidate-card" data-optimizer-worker-id="${worker.id}">
      <header class="optimizer-candidate-head">
        <div class="optimizer-rank">${index + 1}</div>
        <div class="optimizer-candidate-title">
          <strong>${escapeHtml(worker.name)}</strong>
          <span>${escapeHtml(TYPE_META[worker.worker_type]?.label || 'Operario')} · ${escapeHtml(candidate.classification)}</span>
        </div>
        <div class="optimizer-score">${formatNumber(candidate.score)}<small>/100</small></div>
      </header>

      <div class="optimizer-candidate-metrics">
        <div><span>Actual</span><strong>${formatHours(candidate.currentWeeklyHours)} hs/sem</strong></div>
        <div><span>Con el servicio</span><strong>${formatHours(candidate.projectedWeeklyHours)} hs/sem</strong></div>
        <div><span>Objetivo</span><strong>${escapeHtml(targetLabel)}</strong></div>
        <div><span>Resultado</span><strong>${escapeHtml(projectedDifference)}</strong></div>
      </div>

      ${renderOptimizerScoreBreakdown(candidate)}

      <div class="optimizer-day-analysis">
        ${candidate.dayAnalyses.map((analysis) => `
          <div class="optimizer-day-row">
            <strong>${escapeHtml(analysis.dayLabel)}</strong>
            <div>
              ${analysis.transitions.length
                ? analysis.transitions.map((transition) => `<span>${escapeHtml(formatOptimizerTransition(transition))}</span>`).join('')
                : '<span>Sin asignaciones cercanas en el día.</span>'}
            </div>
          </div>
        `).join('')}
      </div>

      ${candidate.warnings.length ? `
        <div class="optimizer-warning-list">
          ${candidate.warnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join('')}
        </div>
      ` : ''}

      <div class="inline-actions optimizer-card-actions">
        <button class="btn btn-secondary btn-sm" type="button" data-edit-worker="${worker.id}">Ver operario</button>
        ${canPrepareAssignment
          ? `<button class="btn btn-primary btn-sm" type="button" data-optimizer-use-candidate="${worker.id}">Preparar asignación</button>`
          : '<span class="optimizer-action-hint">Guardá o seleccioná el servicio para preparar la asignación.</span>'}
      </div>
    </article>
  `;
}

function renderOptimizerRejectedCard(candidate) {
  return `
    <article class="optimizer-rejected-card">
      <div>
        <strong>${escapeHtml(candidate.worker.name)}</strong>
        <span>${escapeHtml(TYPE_META[candidate.worker.worker_type]?.label || 'Operario')}</span>
      </div>
      <ul>
        ${candidate.rejectionReasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}
      </ul>
      <button class="btn btn-secondary btn-sm" type="button" data-edit-worker="${candidate.worker.id}">Revisar operario</button>
    </article>
  `;
}

function renderOptimizerDataQuality() {
  if (!el.optimizerDataQuality) return;
  const workersMissingCoordinates = state.workers.filter((worker) => !getEntityCoordinates(worker));
  const servicesMissingCoordinates = state.services.filter((service) => !getEntityCoordinates(service));
  const workersMissingZone = state.workers.filter((worker) => !String(worker.home_zone || '').trim());
  const servicesMissingZone = state.services.filter((service) => !String(service.zone || '').trim());

  const workerCoverage = state.workers.length
    ? Math.round(((state.workers.length - workersMissingCoordinates.length) / state.workers.length) * 100)
    : 0;
  const serviceCoverage = state.services.length
    ? Math.round(((state.services.length - servicesMissingCoordinates.length) / state.services.length) * 100)
    : 0;

  el.optimizerDataQuality.innerHTML = `
    <div class="optimizer-data-quality-grid">
      <div class="optimizer-quality-metric">
        <span>Operarios geolocalizados</span>
        <strong>${workerCoverage}%</strong>
        <small>${state.workers.length - workersMissingCoordinates.length} de ${state.workers.length}</small>
      </div>
      <div class="optimizer-quality-metric">
        <span>Servicios geolocalizados</span>
        <strong>${serviceCoverage}%</strong>
        <small>${state.services.length - servicesMissingCoordinates.length} de ${state.services.length}</small>
      </div>
      <div class="optimizer-quality-metric">
        <span>Operarios sin zona</span>
        <strong>${workersMissingZone.length}</strong>
        <small>Sin fallback geográfico</small>
      </div>
      <div class="optimizer-quality-metric">
        <span>Servicios sin zona</span>
        <strong>${servicesMissingZone.length}</strong>
        <small>Sin fallback geográfico</small>
      </div>
    </div>

    ${(workersMissingCoordinates.length || servicesMissingCoordinates.length) ? `
      <div class="optimizer-missing-locations">
        <div>
          <h4>Registros prioritarios para completar</h4>
          <p class="muted">No hace falta cargar direcciones exactas. Una coordenada aproximada o el centro del barrio alcanza para mejorar el ranking.</p>
        </div>
        <div class="optimizer-location-items">
          ${workersMissingCoordinates.slice(0, 5).map((worker) => `
            <button type="button" class="optimizer-location-item" data-edit-worker="${worker.id}">
              <span>Operario</span><strong>${escapeHtml(worker.name)}</strong>
            </button>
          `).join('')}
          ${servicesMissingCoordinates.slice(0, 5).map((service) => `
            <button type="button" class="optimizer-location-item" data-edit-service="${service.id}">
              <span>Servicio</span><strong>${escapeHtml(service.name)}</strong>
            </button>
          `).join('')}
        </div>
      </div>
    ` : '<div class="empty-state">La cobertura geográfica está completa.</div>'}
  `;
}

function renderOptimizer() {
  updateOptimizerWorkloadPreview();
  renderOptimizerDataQuality();

  if (!state.optimizerResults) {
    if (el.optimizerKpiCards) el.optimizerKpiCards.innerHTML = '';
    if (el.optimizerRecommendation) {
      el.optimizerRecommendation.innerHTML = `
        <div class="empty-state">
          Cargá los días, el horario y la ubicación del servicio. El optimizador explicará por qué recomienda o descarta a cada operario.
        </div>
      `;
    }
    if (el.optimizerCandidates) el.optimizerCandidates.innerHTML = '<div class="empty-state">Todavía no se ejecutó un análisis.</div>';
    if (el.optimizerRejected) el.optimizerRejected.innerHTML = '<div class="empty-state">Todavía no se ejecutó un análisis.</div>';
    return;
  }

  const results = state.optimizerResults;
  const best = results.best;
  const missingLocationCandidates = results.candidates.filter((candidate) => candidate.warnings.length).length;

  el.optimizerKpiCards.innerHTML = `
    <article class="card"><span class="kpi-label">Candidatos viables</span><strong class="kpi-value">${results.candidates.length}</strong><span class="kpi-foot">Sin conflicto excluyente</span></article>
    <article class="card"><span class="kpi-label">Descartados</span><strong class="kpi-value">${results.rejected.length}</strong><span class="kpi-foot">Horario, traslado o carga</span></article>
    <article class="card"><span class="kpi-label">Carga del bloque</span><strong class="kpi-value">${formatHours(results.request.weeklyHours)} hs</strong><span class="kpi-foot">Por semana</span></article>
    <article class="card"><span class="kpi-label">Análisis con datos parciales</span><strong class="kpi-value">${missingLocationCandidates}</strong><span class="kpi-foot">Candidatos con alertas geográficas</span></article>
  `;

  el.optimizerRecommendation.innerHTML = best
    ? `
      <div class="optimizer-best-grid">
        <div>
          <span class="eyebrow">Recomendación principal</span>
          <h3>${escapeHtml(best.worker.name)}</h3>
          <p>${escapeHtml(best.classification)} con ${formatNumber(best.score)} puntos. Quedaría en ${formatHours(best.projectedWeeklyHours)} hs semanales${best.targetHours == null ? '' : ` sobre un objetivo de ${formatHours(best.targetHours)} hs`}.</p>
        </div>
        <div class="optimizer-best-score">${formatNumber(best.score)}<small>/100</small></div>
      </div>
      ${renderOptimizerScoreBreakdown(best)}
      <p class="optimizer-decision-note">La recomendación pondera eficiencia operativa. Antes de confirmar, validá condiciones laborales, transporte real y cualquier restricción personal no registrada en la app.</p>
    `
    : `
      <div class="optimizer-no-candidate">
        <h3>No hay un candidato compatible con los criterios actuales</h3>
        <p>Probá habilitar operarios excedidos, ajustar el margen de traslado o revisar la franja horaria. Forzar una asignación con conflicto solo trasladaría el problema al servicio siguiente.</p>
      </div>
    `;

  el.optimizerCandidates.innerHTML = results.candidates.length
    ? results.candidates.map(renderOptimizerCandidateCard).join('')
    : '<div class="empty-state">No hay candidatos viables.</div>';

  el.optimizerRejected.innerHTML = results.rejected.length
    ? results.rejected.slice(0, 20).map(renderOptimizerRejectedCard).join('')
    : '<div class="empty-state">Ningún operario fue descartado.</div>';
}

function validateOptimizerRequest(request) {
  if (!request.days.length) return 'Seleccioná al menos un día.';
  if (!request.startTime || !request.endTime) return 'Completá el horario de inicio y finalización.';
  if (calculateHours(request.startTime, request.endTime) <= 0) return 'La hora de inicio y la hora de finalización no pueden ser iguales.';
  if (!request.zone && request.latitude == null) return 'Cargá al menos una zona o coordenadas para poder evaluar cercanía.';
  if (request.billedMonthlyHours != null && (!Number.isFinite(request.billedMonthlyHours) || request.billedMonthlyHours < 0)) return 'Las horas facturadas mensuales deben ser un número igual o mayor a 0.';
  if (request.coordinatesRaw && !parseCoordinates(request.coordinatesRaw)) return 'No se pudieron interpretar las coordenadas o el enlace de Google Maps.';
  return '';
}

function handleOptimizerSubmit(event) {
  event.preventDefault();
  if (!ensureDataReady('analizar candidatos')) return;
  const request = getOptimizerRequest();
  const validationError = validateOptimizerRequest(request);
  if (validationError) {
    alert(validationError);
    return;
  }
  state.optimizerResults = analyzeOptimizerRequest(request);
  renderOptimizer();
  el.optimizerRecommendation?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function syncOptimizerFromService() {
  const serviceId = el.optimizerExistingService?.value || '';
  const service = serviceId ? getServiceById(serviceId) : null;

  if (!service) {
    if (el.optimizerServiceName) el.optimizerServiceName.value = '';
    if (el.optimizerBilledMonthlyHours) el.optimizerBilledMonthlyHours.value = '';
    if (el.optimizerAddress) el.optimizerAddress.value = '';
    if (el.optimizerZone) el.optimizerZone.value = '';
    if (el.optimizerCoordinates) el.optimizerCoordinates.value = '';
    state.optimizerResults = null;
    renderOptimizer();
    return;
  }

  if (el.optimizerServiceName) el.optimizerServiceName.value = service.name || '';
  if (el.optimizerBilledMonthlyHours) el.optimizerBilledMonthlyHours.value = service.billed_monthly_hours ?? '';
  if (el.optimizerAddress) el.optimizerAddress.value = service.client_address || '';
  if (el.optimizerZone) el.optimizerZone.value = service.zone || '';
  if (el.optimizerCoordinates) el.optimizerCoordinates.value = formatCoordinates(service);

  const assignments = getServiceAssignments(service.id);
  if (assignments.length) {
    const uniqueDays = new Set(assignments.map((assignment) => Number(assignment.day_of_week)));
    document.querySelectorAll('.optimizer-day').forEach((input) => {
      input.checked = uniqueDays.has(Number(input.value));
    });
    const firstAssignment = assignments[0];
    if (el.optimizerStart) el.optimizerStart.value = String(firstAssignment.start_time || '').slice(0, 5);
    if (el.optimizerEnd) el.optimizerEnd.value = String(firstAssignment.end_time || '').slice(0, 5);
  }

  state.optimizerResults = null;
  renderOptimizer();
}

function clearOptimizerForm() {
  el.optimizerForm?.reset();
  if (el.optimizerMonth) el.optimizerMonth.value = getSelectedDashboardMonth();
  if (el.optimizerTravelBuffer) el.optimizerTravelBuffer.value = '15';
  state.optimizerResults = null;
  renderOptimizer();
}

function prepareOptimizerServiceDialog() {
  openServiceDialog();
  const request = getOptimizerRequest();
  if ($('serviceName')) $('serviceName').value = request.name === 'Servicio simulado' ? '' : request.name;
  if ($('serviceBilledHours')) $('serviceBilledHours').value = request.billedMonthlyHours ?? '';
  if ($('serviceAddress')) $('serviceAddress').value = request.client_address || '';
  if ($('serviceZone')) $('serviceZone').value = request.zone || '';
  if ($('serviceCoordinates')) $('serviceCoordinates').value = request.latitude != null && request.longitude != null
    ? `${request.latitude}, ${request.longitude}`
    : request.coordinatesRaw || '';
}

function prepareOptimizerAssignment(workerId) {
  const results = state.optimizerResults;
  if (!results?.request?.selectedServiceId) {
    alert('Primero seleccioná o guardá el servicio.');
    return;
  }
  openBulkAssignmentDialog();
  if ($('bulkAssignmentWorker')) $('bulkAssignmentWorker').value = workerId;
  if ($('bulkAssignmentService')) $('bulkAssignmentService').value = results.request.selectedServiceId;
  if ($('bulkAssignmentStart')) $('bulkAssignmentStart').value = results.request.startTime;
  if ($('bulkAssignmentEnd')) $('bulkAssignmentEnd').value = results.request.endTime;
  document.querySelectorAll('.bulk-day').forEach((input) => {
    input.checked = results.request.days.includes(Number(input.value));
  });
  if ($('bulkAssignmentNotes')) $('bulkAssignmentNotes').value = `Sugerido por Optimizador · Puntaje ${results.candidates.find((candidate) => candidate.worker.id === workerId)?.score || ''}`;
}



function getUniqueWorkerServiceRelations() {
  const seen = new Set();
  return state.assignments.reduce((relations, assignment) => {
    const key = `${assignment.worker_id}:${assignment.service_id}`;
    if (seen.has(key)) return relations;
    seen.add(key);
    const worker = getWorkerById(assignment.worker_id);
    const service = getServiceById(assignment.service_id);
    if (!worker || !service) return relations;
    relations.push({ worker, service, workerId: worker.id, serviceId: service.id });
    return relations;
  }, []);
}

function getUniqueAssignedWorkerIds(serviceId) {
  return [...new Set(getServiceAssignments(serviceId).map((assignment) => assignment.worker_id).filter(Boolean))];
}

function getUniqueAssignedServiceIds(workerId) {
  return [...new Set(getWorkerAssignments(workerId).map((assignment) => assignment.service_id).filter(Boolean))];
}

function formatProximityDistance(distanceKm) {
  return distanceKm == null ? 'Sin coordenadas' : `${formatNumber(distanceKm)} km`;
}

function getProximitySettings() {
  return {
    workerId: el.proximityWorkerFilter?.value || 'all',
    minimumSaving: Math.max(0, Number(el.proximityMinimumSaving?.value || 2)),
    bothImprove: Boolean(el.proximityBothImprove?.checked),
  };
}

function buildWorkerProximityAnalysis(worker, servicesWithCoordinates) {
  const workerCoordinates = getEntityCoordinates(worker);
  if (!workerCoordinates) {
    return {
      worker,
      hasCoordinates: false,
      currentServices: [],
      nearestServices: [],
      averageCurrentDistance: null,
      farthestCurrentDistance: null,
      bestAlternativeSaving: null,
    };
  }

  const currentServiceIds = new Set(getUniqueAssignedServiceIds(worker.id));
  const serviceDistances = servicesWithCoordinates
    .map((service) => {
      const distanceKm = haversineDistanceKm(workerCoordinates, getEntityCoordinates(service));
      const assignedWorkerIds = getUniqueAssignedWorkerIds(service.id);
      return {
        service,
        distanceKm,
        isCurrent: currentServiceIds.has(service.id),
        assignedWorkerIds,
        assignedWorkersCount: assignedWorkerIds.length,
      };
    })
    .filter((item) => item.distanceKm != null)
    .sort((a, b) => a.distanceKm - b.distanceKm || String(a.service.name || '').localeCompare(String(b.service.name || ''), 'es'));

  const currentServices = serviceDistances.filter((item) => item.isCurrent);
  const nearestServices = serviceDistances.slice(0, 12);
  const averageCurrentDistance = currentServices.length
    ? Number((currentServices.reduce((sum, item) => sum + item.distanceKm, 0) / currentServices.length).toFixed(2))
    : null;
  const farthestCurrent = currentServices.reduce((max, item) => (!max || item.distanceKm > max.distanceKm ? item : max), null);
  const nearestAlternative = serviceDistances.find((item) => !item.isCurrent) || null;
  const bestAlternativeSaving = farthestCurrent && nearestAlternative
    ? Number((farthestCurrent.distanceKm - nearestAlternative.distanceKm).toFixed(2))
    : null;

  return {
    worker,
    hasCoordinates: true,
    currentServices,
    nearestServices,
    allServiceDistances: serviceDistances,
    averageCurrentDistance,
    farthestCurrentDistance: farthestCurrent?.distanceKm ?? null,
    bestAlternativeSaving,
    farthestCurrent,
    nearestAlternative,
  };
}

function buildProximityRelocations(workerAnalyses, settings) {
  const suggestions = [];

  workerAnalyses.forEach((analysis) => {
    if (!analysis.hasCoordinates || !analysis.currentServices.length) return;
    const currentIds = new Set(analysis.currentServices.map((item) => item.service.id));

    analysis.currentServices.forEach((current) => {
      const alternative = analysis.allServiceDistances.find((candidate) => (
        !currentIds.has(candidate.service.id)
        && current.distanceKm - candidate.distanceKm >= settings.minimumSaving
      ));
      if (!alternative) return;

      suggestions.push({
        worker: analysis.worker,
        currentService: current.service,
        suggestedService: alternative.service,
        currentDistance: current.distanceKm,
        suggestedDistance: alternative.distanceKm,
        savingKm: Number((current.distanceKm - alternative.distanceKm).toFixed(2)),
        suggestedAssignedWorkerIds: alternative.assignedWorkerIds,
        suggestedAssignedWorkersCount: alternative.assignedWorkersCount,
        directOpportunity: alternative.assignedWorkersCount === 0,
      });
    });
  });

  const seen = new Set();
  return suggestions
    .sort((a, b) => b.savingKm - a.savingKm)
    .filter((item) => {
      const key = `${item.worker.id}:${item.suggestedService.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

function buildProximitySwaps(settings) {
  const relations = getUniqueWorkerServiceRelations()
    .filter((relation) => getEntityCoordinates(relation.worker) && getEntityCoordinates(relation.service))
    .map((relation) => ({
      ...relation,
      distanceKm: haversineDistanceKm(getEntityCoordinates(relation.worker), getEntityCoordinates(relation.service)),
    }))
    .filter((relation) => relation.distanceKm != null);

  const currentServiceIdsByWorker = new Map();
  state.workers.forEach((worker) => currentServiceIdsByWorker.set(worker.id, new Set(getUniqueAssignedServiceIds(worker.id))));
  const suggestions = [];
  const seen = new Set();

  for (let indexA = 0; indexA < relations.length; indexA += 1) {
    const first = relations[indexA];
    for (let indexB = indexA + 1; indexB < relations.length; indexB += 1) {
      const second = relations[indexB];
      if (first.workerId === second.workerId || first.serviceId === second.serviceId) continue;
      if (currentServiceIdsByWorker.get(first.workerId)?.has(second.serviceId)) continue;
      if (currentServiceIdsByWorker.get(second.workerId)?.has(first.serviceId)) continue;

      const pairKey = [first.workerId, second.workerId].sort().join(':') + '|' + [first.serviceId, second.serviceId].sort().join(':');
      if (seen.has(pairKey)) continue;

      const firstNewDistance = haversineDistanceKm(getEntityCoordinates(first.worker), getEntityCoordinates(second.service));
      const secondNewDistance = haversineDistanceKm(getEntityCoordinates(second.worker), getEntityCoordinates(first.service));
      if (firstNewDistance == null || secondNewDistance == null) continue;

      const firstSaving = Number((first.distanceKm - firstNewDistance).toFixed(2));
      const secondSaving = Number((second.distanceKm - secondNewDistance).toFixed(2));
      const totalSaving = Number((firstSaving + secondSaving).toFixed(2));
      if (totalSaving < settings.minimumSaving) continue;
      if (settings.bothImprove && (firstSaving <= 0 || secondSaving <= 0)) continue;
      if (!settings.bothImprove && firstSaving <= -settings.minimumSaving) continue;
      if (!settings.bothImprove && secondSaving <= -settings.minimumSaving) continue;

      seen.add(pairKey);
      suggestions.push({
        first: {
          worker: first.worker,
          currentService: first.service,
          currentDistance: first.distanceKm,
          suggestedService: second.service,
          suggestedDistance: firstNewDistance,
          savingKm: firstSaving,
        },
        second: {
          worker: second.worker,
          currentService: second.service,
          currentDistance: second.distanceKm,
          suggestedService: first.service,
          suggestedDistance: secondNewDistance,
          savingKm: secondSaving,
        },
        totalSaving,
      });
    }
  }

  return suggestions.sort((a, b) => b.totalSaving - a.totalSaving).slice(0, 40);
}

function analyzeProximityOptimizer() {
  const settings = getProximitySettings();
  const servicesWithCoordinates = state.services.filter((service) => getEntityCoordinates(service));
  const workersWithCoordinates = state.workers.filter((worker) => getEntityCoordinates(worker));
  const workerAnalyses = state.workers.map((worker) => buildWorkerProximityAnalysis(worker, servicesWithCoordinates));
  const relocationSuggestions = buildProximityRelocations(workerAnalyses, settings);
  const swapSuggestions = buildProximitySwaps(settings);
  const currentRelations = getUniqueWorkerServiceRelations();
  const measurableRelations = currentRelations
    .map((relation) => {
      const workerCoordinates = getEntityCoordinates(relation.worker);
      const serviceCoordinates = getEntityCoordinates(relation.service);
      return workerCoordinates && serviceCoordinates
        ? haversineDistanceKm(workerCoordinates, serviceCoordinates)
        : null;
    })
    .filter((distance) => distance != null);
  const averageCurrentDistance = measurableRelations.length
    ? Number((measurableRelations.reduce((sum, distance) => sum + distance, 0) / measurableRelations.length).toFixed(2))
    : null;
  const workersWithPotential = new Set(relocationSuggestions.map((item) => item.worker.id)).size;

  return {
    settings,
    workerAnalyses,
    relocationSuggestions,
    swapSuggestions,
    stats: {
      mappedWorkers: workersWithCoordinates.length,
      mappedServices: servicesWithCoordinates.length,
      measurableRelations: measurableRelations.length,
      totalRelations: currentRelations.length,
      averageCurrentDistance,
      workersWithPotential,
    },
  };
}

function renderProximityKpis(results) {
  if (!el.proximityKpiCards) return;
  const stats = results.stats;
  el.proximityKpiCards.innerHTML = `
    <article class="card"><span class="kpi-label">Operarios ubicados</span><strong class="kpi-value">${stats.mappedWorkers}</strong><span class="kpi-foot">de ${state.workers.length}</span></article>
    <article class="card"><span class="kpi-label">Distancia actual promedio</span><strong class="kpi-value">${stats.averageCurrentDistance == null ? '—' : formatProximityDistance(stats.averageCurrentDistance)}</strong><span class="kpi-foot">Sobre ${stats.measurableRelations} vínculos medibles</span></article>
    <article class="card"><span class="kpi-label">Operarios con oportunidad</span><strong class="kpi-value">${stats.workersWithPotential}</strong><span class="kpi-foot">Ahorro mínimo: ${formatNumber(results.settings.minimumSaving)} km</span></article>
    <article class="card"><span class="kpi-label">Intercambios sugeridos</span><strong class="kpi-value">${results.swapSuggestions.length}</strong><span class="kpi-foot">Antes de validar horarios</span></article>
  `;
}

function renderProximitySummary(results) {
  if (!el.proximitySummary) return;
  const bestRelocation = results.relocationSuggestions[0];
  const bestSwap = results.swapSuggestions[0];

  if (!bestRelocation && !bestSwap) {
    el.proximitySummary.innerHTML = `
      <div class="optimizer-no-candidate">
        <h3>No se detectaron mejoras por encima del umbral actual</h3>
        <p>Esto puede indicar una distribución razonable o, más probablemente, falta de coordenadas. Revisá la calidad de datos antes de concluir que no hay desvíos.</p>
      </div>
    `;
    return;
  }

  el.proximitySummary.innerHTML = `
    <div class="proximity-summary-grid">
      <div>
        <span class="eyebrow">Lectura ejecutiva</span>
        <h3>${results.stats.workersWithPotential} operario${results.stats.workersWithPotential === 1 ? '' : 's'} con alternativas más cercanas</h3>
        <p class="muted">La app encontró ${results.relocationSuggestions.length} reubicaciones posibles y ${results.swapSuggestions.length} intercambios. Son hipótesis territoriales: todavía falta validar horarios, horas contratadas y continuidad del servicio.</p>
      </div>
      <div class="proximity-highlight-list">
        ${bestRelocation ? `<div><span>Mayor ahorro individual</span><strong>${escapeHtml(bestRelocation.worker.name)}</strong><small>${formatProximityDistance(bestRelocation.currentDistance)} → ${formatProximityDistance(bestRelocation.suggestedDistance)} · ahorra ${formatNumber(bestRelocation.savingKm)} km</small></div>` : ''}
        ${bestSwap ? `<div><span>Mejor intercambio</span><strong>${escapeHtml(bestSwap.first.worker.name)} ↔ ${escapeHtml(bestSwap.second.worker.name)}</strong><small>Ahorro conjunto estimado: ${formatNumber(bestSwap.totalSaving)} km directos</small></div>` : ''}
      </div>
    </div>
    <p class="optimizer-decision-note">No conviene ejecutar un cambio solo por kilómetros. Esta vista sirve para detectar candidatos y luego contrastarlos con el Optimizador de asignaciones, que sí revisa días, horarios y carga.</p>
  `;
}

function renderProximityWorkerCard(analysis) {
  if (!analysis.hasCoordinates) {
    return `
      <article class="proximity-worker-card proximity-worker-card-warning">
        <div><strong>${escapeHtml(analysis.worker.name)}</strong><span>Sin coordenadas de domicilio</span></div>
        <button class="btn btn-secondary btn-sm" type="button" data-edit-worker="${analysis.worker.id}">Completar ubicación</button>
      </article>
    `;
  }

  const alternative = analysis.nearestAlternative;
  return `
    <article class="proximity-worker-card">
      <div class="proximity-worker-card-head">
        <div>
          <strong>${escapeHtml(analysis.worker.name)}</strong>
          <span>${analysis.currentServices.length ? `${analysis.currentServices.length} servicio${analysis.currentServices.length === 1 ? '' : 's'} actual${analysis.currentServices.length === 1 ? '' : 'es'}` : 'Sin servicio asignado'}</span>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" data-proximity-show-worker="${analysis.worker.id}">Ver detalle</button>
      </div>
      <div class="proximity-mini-metrics">
        <div><span>Promedio actual</span><strong>${analysis.averageCurrentDistance == null ? '—' : formatProximityDistance(analysis.averageCurrentDistance)}</strong></div>
        <div><span>Servicio alternativo más cercano</span><strong>${alternative ? escapeHtml(alternative.service.name) : '—'}</strong><small>${alternative ? formatProximityDistance(alternative.distanceKm) : 'Sin alternativa medible'}</small></div>
        <div><span>Mejora potencial</span><strong>${analysis.bestAlternativeSaving != null && analysis.bestAlternativeSaving > 0 ? `${formatNumber(analysis.bestAlternativeSaving)} km` : 'Sin mejora clara'}</strong></div>
      </div>
    </article>
  `;
}

function renderProximityWorkerDetail(analysis) {
  const currentRows = analysis.currentServices.length
    ? analysis.currentServices
      .sort((a, b) => b.distanceKm - a.distanceKm)
      .map((item) => `
        <div class="proximity-distance-row">
          <div><strong>${escapeHtml(item.service.name)}</strong><span>${escapeHtml(item.service.zone || item.service.client_address || 'Sin zona')}</span></div>
          <div class="proximity-distance-value">${formatProximityDistance(item.distanceKm)}</div>
          <button class="btn btn-ghost btn-sm" type="button" data-proximity-map-service="${item.service.id}">Mapa</button>
        </div>
      `).join('')
    : '<div class="empty-state">Este operario no tiene servicios asignados actualmente.</div>';

  const nearestRows = analysis.nearestServices.length
    ? analysis.nearestServices.map((item, index) => {
      const status = item.isCurrent
        ? 'Asignación actual'
        : item.assignedWorkersCount === 0
          ? 'Sin operarios asignados'
          : `Asignado a ${item.assignedWorkersCount} operario${item.assignedWorkersCount === 1 ? '' : 's'}`;
      return `
        <div class="proximity-distance-row ${item.isCurrent ? 'is-current' : ''}">
          <div class="proximity-rank">${index + 1}</div>
          <div><strong>${escapeHtml(item.service.name)}</strong><span>${escapeHtml(status)} · ${escapeHtml(item.service.zone || 'Sin zona')}</span></div>
          <div class="proximity-distance-value">${formatProximityDistance(item.distanceKm)}</div>
          <button class="btn btn-ghost btn-sm" type="button" data-proximity-map-service="${item.service.id}">Mapa</button>
        </div>
      `;
    }).join('')
    : '<div class="empty-state">No hay servicios con coordenadas para comparar.</div>';

  return `
    <article class="proximity-detail-card">
      <div class="section-head with-action">
        <div>
          <h4>${escapeHtml(analysis.worker.name)}</h4>
          <span class="muted">${escapeHtml(analysis.worker.home_zone || analysis.worker.home_address || 'Domicilio sin descripción')}</span>
        </div>
        <button class="btn btn-secondary btn-sm" type="button" data-proximity-map-worker="${analysis.worker.id}">Ver domicilio en mapa</button>
      </div>
      <div class="proximity-detail-columns">
        <section>
          <h5>Servicios actuales</h5>
          <div class="proximity-distance-list">${currentRows}</div>
        </section>
        <section>
          <h5>Servicios más cercanos al domicilio</h5>
          <div class="proximity-distance-list">${nearestRows}</div>
        </section>
      </div>
    </article>
  `;
}

function renderProximityWorkerAnalysis(results) {
  if (!el.proximityWorkerAnalysis) return;
  const selectedWorkerId = results.settings.workerId;
  if (selectedWorkerId !== 'all') {
    const analysis = results.workerAnalyses.find((item) => item.worker.id === selectedWorkerId);
    el.proximityWorkerAnalysis.innerHTML = analysis
      ? renderProximityWorkerDetail(analysis)
      : '<div class="empty-state">No se encontró el operario seleccionado.</div>';
    return;
  }

  const ranked = [...results.workerAnalyses]
    .sort((a, b) => (b.bestAlternativeSaving ?? -Infinity) - (a.bestAlternativeSaving ?? -Infinity))
    .slice(0, 16);
  el.proximityWorkerAnalysis.innerHTML = ranked.length
    ? ranked.map(renderProximityWorkerCard).join('')
    : '<div class="empty-state">No hay operarios para analizar.</div>';
}

function renderProximityRelocations(results) {
  if (!el.proximityRelocations) return;
  const filtered = results.settings.workerId === 'all'
    ? results.relocationSuggestions
    : results.relocationSuggestions.filter((item) => item.worker.id === results.settings.workerId);

  el.proximityRelocations.innerHTML = filtered.length
    ? filtered.slice(0, 20).map((item) => `
      <article class="proximity-suggestion-card">
        <div class="proximity-suggestion-head">
          <div>
            <strong>${escapeHtml(item.worker.name)}</strong>
            <span>${item.directOpportunity ? 'Oportunidad directa: servicio sin operarios' : 'Requiere reorganización o intercambio'}</span>
          </div>
          <div class="proximity-saving-badge">-${formatNumber(item.savingKm)} km</div>
        </div>
        <div class="proximity-route-change">
          <div><span>Actual</span><strong>${escapeHtml(item.currentService.name)}</strong><small>${formatProximityDistance(item.currentDistance)}</small></div>
          <div class="proximity-arrow">→</div>
          <div><span>Alternativa</span><strong>${escapeHtml(item.suggestedService.name)}</strong><small>${formatProximityDistance(item.suggestedDistance)}</small></div>
        </div>
        <div class="inline-actions">
          <button class="btn btn-secondary btn-sm" type="button" data-proximity-show-worker="${item.worker.id}">Analizar operario</button>
          <button class="btn btn-ghost btn-sm" type="button" data-proximity-map-service="${item.suggestedService.id}">Ver servicio</button>
        </div>
      </article>
    `).join('')
    : '<div class="empty-state">No se detectaron reubicaciones por encima del ahorro mínimo seleccionado.</div>';
}

function renderProximitySwaps(results) {
  if (!el.proximitySwaps) return;
  const filtered = results.settings.workerId === 'all'
    ? results.swapSuggestions
    : results.swapSuggestions.filter((item) => item.first.worker.id === results.settings.workerId || item.second.worker.id === results.settings.workerId);

  el.proximitySwaps.innerHTML = filtered.length
    ? filtered.slice(0, 16).map((item, index) => `
      <article class="proximity-swap-card">
        <header>
          <div><span>Intercambio ${index + 1}</span><strong>Ahorro conjunto: ${formatNumber(item.totalSaving)} km directos</strong></div>
          <span class="status-pill status-hours-over">Mejora territorial</span>
        </header>
        <div class="proximity-swap-people">
          <div>
            <strong>${escapeHtml(item.first.worker.name)}</strong>
            <span>${escapeHtml(item.first.currentService.name)} → ${escapeHtml(item.first.suggestedService.name)}</span>
            <small>${formatProximityDistance(item.first.currentDistance)} → ${formatProximityDistance(item.first.suggestedDistance)} · ${item.first.savingKm >= 0 ? 'ahorra' : 'suma'} ${formatNumber(Math.abs(item.first.savingKm))} km</small>
          </div>
          <div>
            <strong>${escapeHtml(item.second.worker.name)}</strong>
            <span>${escapeHtml(item.second.currentService.name)} → ${escapeHtml(item.second.suggestedService.name)}</span>
            <small>${formatProximityDistance(item.second.currentDistance)} → ${formatProximityDistance(item.second.suggestedDistance)} · ${item.second.savingKm >= 0 ? 'ahorra' : 'suma'} ${formatNumber(Math.abs(item.second.savingKm))} km</small>
          </div>
        </div>
        <p class="proximity-swap-warning">Validar horarios, cantidad de horas, capacitación y condiciones específicas de ambos servicios antes de ejecutar el cambio.</p>
      </article>
    `).join('')
    : '<div class="empty-state">No se encontraron intercambios compatibles con el criterio seleccionado.</div>';
}

function renderProximityDataQuality(results) {
  if (!el.proximityDataQuality) return;
  const missingWorkers = state.workers.filter((worker) => !getEntityCoordinates(worker));
  const missingServices = state.services.filter((service) => !getEntityCoordinates(service));
  const coverage = state.workers.length + state.services.length
    ? Math.round(((results.stats.mappedWorkers + results.stats.mappedServices) / (state.workers.length + state.services.length)) * 100)
    : 0;

  el.proximityDataQuality.innerHTML = `
    <div class="optimizer-data-quality-grid proximity-quality-grid">
      <div class="optimizer-quality-metric"><span>Cobertura general</span><strong>${coverage}%</strong><small>Operarios y servicios ubicados</small></div>
      <div class="optimizer-quality-metric"><span>Operarios sin coordenadas</span><strong>${missingWorkers.length}</strong><small>No pueden compararse</small></div>
      <div class="optimizer-quality-metric"><span>Servicios sin coordenadas</span><strong>${missingServices.length}</strong><small>No entran en el ranking</small></div>
      <div class="optimizer-quality-metric"><span>Vínculos medibles</span><strong>${results.stats.measurableRelations}</strong><small>de ${results.stats.totalRelations} actuales</small></div>
    </div>
    ${(missingWorkers.length || missingServices.length) ? `
      <div class="optimizer-missing-locations">
        <div><h4>Completar para mejorar el análisis</h4><p class="muted">Con una coordenada aproximada del barrio alcanza; no hace falta registrar la puerta exacta del domicilio.</p></div>
        <div class="optimizer-location-items">
          ${missingWorkers.slice(0, 6).map((worker) => `<button type="button" class="optimizer-location-item" data-edit-worker="${worker.id}"><span>Operario</span><strong>${escapeHtml(worker.name)}</strong></button>`).join('')}
          ${missingServices.slice(0, 6).map((service) => `<button type="button" class="optimizer-location-item" data-edit-service="${service.id}"><span>Servicio</span><strong>${escapeHtml(service.name)}</strong></button>`).join('')}
        </div>
      </div>
    ` : '<div class="empty-state">La cobertura geográfica está completa.</div>'}
  `;
}

function renderProximityOptimizer() {
  if (!state.proximityResults) {
    if (el.proximityKpiCards) el.proximityKpiCards.innerHTML = '';
    if (el.proximitySummary) el.proximitySummary.innerHTML = '<div class="empty-state">Ejecutá el análisis para detectar reubicaciones e intercambios posibles.</div>';
    if (el.proximityWorkerAnalysis) el.proximityWorkerAnalysis.innerHTML = '<div class="empty-state">Todavía no se ejecutó un análisis.</div>';
    if (el.proximityRelocations) el.proximityRelocations.innerHTML = '<div class="empty-state">Todavía no se ejecutó un análisis.</div>';
    if (el.proximitySwaps) el.proximitySwaps.innerHTML = '<div class="empty-state">Todavía no se ejecutó un análisis.</div>';
    if (el.proximityDataQuality) {
      const preview = {
        stats: {
          mappedWorkers: state.workers.filter((worker) => getEntityCoordinates(worker)).length,
          mappedServices: state.services.filter((service) => getEntityCoordinates(service)).length,
          measurableRelations: 0,
          totalRelations: getUniqueWorkerServiceRelations().length,
        },
      };
      renderProximityDataQuality(preview);
    }
    return;
  }

  renderProximityKpis(state.proximityResults);
  renderProximitySummary(state.proximityResults);
  renderProximityWorkerAnalysis(state.proximityResults);
  renderProximityRelocations(state.proximityResults);
  renderProximitySwaps(state.proximityResults);
  renderProximityDataQuality(state.proximityResults);
}

function handleProximityAnalyze() {
  if (!ensureDataReady('analizar cercanía')) return;
  state.proximityResults = analyzeProximityOptimizer();
  renderProximityOptimizer();
}

function refreshProximityResults() {
  if (!state.proximityResults) return;
  state.proximityResults = analyzeProximityOptimizer();
  renderProximityOptimizer();
}

function showProximityWorker(workerId) {
  if (el.proximityWorkerFilter) el.proximityWorkerFilter.value = workerId;
  state.proximityResults = analyzeProximityOptimizer();
  renderProximityOptimizer();
  el.proximityWorkerAnalysis?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function openProximityMap(type, id) {
  goToView('map');
  window.setTimeout(() => {
    renderMap();
    revealMapEntity(type, id);
  }, 100);
}

function getMapEntityKey(type, id) {
  return `${type}:${id}`;
}

function getMapFilters() {
  return {
    search: normalizeSearchText(el.mapSearch?.value || ''),
    type: el.mapEntityFilter?.value || 'all',
    zone: el.mapZoneFilter?.value || 'all',
  };
}

function getMapEntityZone(type, entity) {
  return String(type === 'worker' ? entity.home_zone || '' : entity.zone || '').trim();
}

function getMapEntityAddress(type, entity) {
  return String(type === 'worker' ? entity.home_address || '' : entity.client_address || '').trim();
}

function getMapEntitySearchText(type, entity) {
  if (type === 'worker') {
    const assignments = getWorkerAssignments(entity.id);
    const serviceNames = assignments
      .map((assignment) => getServiceById(assignment.service_id)?.name || '')
      .filter(Boolean);
    return normalizeSearchText([
      entity.name,
      entity.home_zone || '',
      entity.home_address || '',
      entity.notes || '',
      ...serviceNames,
    ].join(' '));
  }

  const assignments = getServiceAssignments(entity.id);
  const workerNames = assignments
    .map((assignment) => getWorkerById(assignment.worker_id)?.name || '')
    .filter(Boolean);
  return normalizeSearchText([
    entity.name,
    entity.zone || '',
    entity.client_address || '',
    entity.supervisor_name || '',
    entity.notes || '',
    ...workerNames,
  ].join(' '));
}

function getAllMapEntities() {
  return [
    ...state.services.map((entity) => ({ type: 'service', entity, coordinates: getEntityCoordinates(entity) })),
    ...state.workers.map((entity) => ({ type: 'worker', entity, coordinates: getEntityCoordinates(entity) })),
  ];
}

function getFilteredMapEntities() {
  const filters = getMapFilters();
  return getAllMapEntities().filter((item) => {
    if (!item.coordinates) return false;
    if (filters.type === 'services' && item.type !== 'service') return false;
    if (filters.type === 'workers' && item.type !== 'worker') return false;
    const zone = normalizeSearchText(getMapEntityZone(item.type, item.entity));
    if (filters.zone !== 'all' && zone !== normalizeSearchText(filters.zone)) return false;
    if (filters.search && !matchesSearchText(getMapEntitySearchText(item.type, item.entity), filters.search)) return false;
    return true;
  });
}

function syncMapZoneFilter() {
  if (!el.mapZoneFilter) return;
  const previousValue = el.mapZoneFilter.value || 'all';
  const zones = [...new Set(getAllMapEntities()
    .map((item) => getMapEntityZone(item.type, item.entity))
    .filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

  el.mapZoneFilter.innerHTML = `
    <option value="all">Todas las zonas</option>
    ${zones.map((zone) => `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`).join('')}
  `;

  if ([...el.mapZoneFilter.options].some((option) => option.value === previousValue)) {
    el.mapZoneFilter.value = previousValue;
  }
}

function ensureOperationsMap() {
  if (operationsMap || !el.operationsMap) return operationsMap;
  if (!window.L) {
    el.operationsMap.innerHTML = '<div class="map-library-error">No se pudo cargar el mapa. Revisá la conexión a internet y volvé a actualizar.</div>';
    return null;
  }

  operationsMap = window.L.map(el.operationsMap, {
    zoomControl: true,
    preferCanvas: true,
  }).setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);

  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
    crossOrigin: true,
  }).addTo(operationsMap);

  mapMarkerLayer = window.L.layerGroup().addTo(operationsMap);
  mapConnectionLayer = window.L.layerGroup().addTo(operationsMap);
  return operationsMap;
}

function createMapMarkerIcon(type, isSelected = false) {
  const label = type === 'service' ? 'S' : 'O';
  const title = type === 'service' ? 'Servicio' : 'Operario';
  return window.L.divIcon({
    className: 'map-marker-wrapper',
    html: `<div class="map-marker map-marker-${type}${isSelected ? ' is-selected' : ''}" title="${title}"><span>${label}</span></div>`,
    iconSize: [36, 44],
    iconAnchor: [18, 42],
    popupAnchor: [0, -38],
  });
}

function formatAssignmentLine(assignment, counterpartName) {
  const day = DAYS.find((item) => item.value === Number(assignment.day_of_week));
  return `${day?.label || ''} ${formatShiftRange(assignment.start_time, assignment.end_time)} · ${counterpartName}`;
}

function buildMapPopupHtml(type, entity) {
  const zone = getMapEntityZone(type, entity) || 'Sin zona';
  const address = getMapEntityAddress(type, entity) || 'Sin dirección cargada';
  const coordinates = formatCoordinates(entity);

  if (type === 'worker') {
    const assignments = getWorkerAssignments(entity.id);
    const serviceCount = new Set(assignments.map((assignment) => assignment.service_id)).size;
    return `
      <div class="map-popup-card">
        <span class="map-popup-kind">Operario</span>
        <strong>${escapeHtml(entity.name)}</strong>
        <span>${escapeHtml(zone)}</span>
        <span>${escapeHtml(address)}</span>
        <small>${serviceCount} ${serviceCount === 1 ? 'servicio activo' : 'servicios activos'} · ${escapeHtml(coordinates)}</small>
        <button type="button" class="map-popup-action" data-edit-worker="${entity.id}">Editar ubicación</button>
      </div>
    `;
  }

  const assignments = getServiceAssignments(entity.id);
  const workerCount = new Set(assignments.map((assignment) => assignment.worker_id)).size;
  return `
    <div class="map-popup-card">
      <span class="map-popup-kind">Servicio</span>
      <strong>${escapeHtml(entity.name)}</strong>
      <span>${escapeHtml(zone)}</span>
      <span>${escapeHtml(address)}</span>
      <small>${workerCount} ${workerCount === 1 ? 'operario asignado' : 'operarios asignados'} · ${escapeHtml(coordinates)}</small>
      <button type="button" class="map-popup-action" data-edit-service="${entity.id}">Editar ubicación</button>
    </div>
  `;
}

function updateMapMarkerSelection() {
  mapMarkers.forEach((record, key) => {
    const isSelected = state.mapSelection && key === getMapEntityKey(state.mapSelection.type, state.mapSelection.id);
    record.marker.setIcon(createMapMarkerIcon(record.type, Boolean(isSelected)));
    if (isSelected) record.marker.setZIndexOffset(1000);
    else record.marker.setZIndexOffset(0);
  });
}

function renderMapConnections() {
  if (!mapConnectionLayer) return;
  mapConnectionLayer.clearLayers();
  if (!state.mapSelection) return;

  const { type, id } = state.mapSelection;
  const origin = type === 'worker' ? getWorkerById(id) : getServiceById(id);
  const originCoordinates = getEntityCoordinates(origin);
  if (!originCoordinates) return;

  const counterpartIds = new Set();
  if (type === 'worker') {
    getWorkerAssignments(id).forEach((assignment) => counterpartIds.add(assignment.service_id));
  } else {
    getServiceAssignments(id).forEach((assignment) => counterpartIds.add(assignment.worker_id));
  }

  counterpartIds.forEach((counterpartId) => {
    const counterpart = type === 'worker' ? getServiceById(counterpartId) : getWorkerById(counterpartId);
    const destination = getEntityCoordinates(counterpart);
    if (!destination) return;
    window.L.polyline(
      [
        [originCoordinates.latitude, originCoordinates.longitude],
        [destination.latitude, destination.longitude],
      ],
      {
        color: '#75f0c2',
        weight: 2,
        opacity: 0.7,
        dashArray: '7 7',
        interactive: false,
      }
    ).addTo(mapConnectionLayer);
  });
}

function renderMapSelectionPanel() {
  if (!el.mapSelectionPanel) return;
  if (!state.mapSelection) {
    el.mapSelectionPanel.innerHTML = '<div class="empty-state">Seleccioná un servicio o un operario para ver su detalle y sus vínculos.</div>';
    return;
  }

  const { type, id } = state.mapSelection;
  const entity = type === 'worker' ? getWorkerById(id) : getServiceById(id);
  if (!entity) {
    state.mapSelection = null;
    renderMapSelectionPanel();
    return;
  }

  const coordinates = getEntityCoordinates(entity);
  const zone = getMapEntityZone(type, entity) || 'Sin zona';
  const address = getMapEntityAddress(type, entity) || 'Sin dirección cargada';
  const mapsUrl = coordinates
    ? `https://www.google.com/maps/search/?api=1&query=${coordinates.latitude},${coordinates.longitude}`
    : '';

  if (type === 'worker') {
    const assignments = getWorkerAssignments(entity.id)
      .slice()
      .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time)));
    el.mapSelectionPanel.innerHTML = `
      <div class="map-selection-head">
        <div>
          <span class="map-selection-kind">Operario</span>
          <h4>${escapeHtml(entity.name)}</h4>
        </div>
        <span class="map-selection-badge map-selection-badge-worker">Residencia</span>
      </div>
      <div class="map-detail-grid">
        <div><span>Zona</span><strong>${escapeHtml(zone)}</strong></div>
        <div><span>Dirección</span><strong>${escapeHtml(address)}</strong></div>
        <div><span>Horas semanales</span><strong>${formatHours(assignments.reduce((sum, assignment) => sum + calculateHours(assignment.start_time, assignment.end_time), 0))} hs</strong></div>
        <div><span>Objetivo</span><strong>${getTargetHours(entity) == null ? 'Por hora' : `${formatHours(getTargetHours(entity))} hs`}</strong></div>
      </div>
      <div class="map-linked-list">
        <strong>Agenda vinculada</strong>
        ${assignments.length ? assignments.map((assignment) => {
          const service = getServiceById(assignment.service_id);
          return `<button type="button" class="map-linked-item" data-map-select-service="${assignment.service_id}">${escapeHtml(formatAssignmentLine(assignment, service?.name || 'Servicio'))}</button>`;
        }).join('') : '<span class="muted small">Sin asignaciones activas.</span>'}
      </div>
      <div class="inline-actions">
        <button type="button" class="btn btn-secondary btn-sm" data-edit-worker="${entity.id}">Editar operario</button>
        ${mapsUrl ? `<a class="btn btn-ghost btn-sm map-external-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>` : ''}
      </div>
    `;
    return;
  }

  const summary = getServiceHoursSummary(entity);
  const assignments = getServiceAssignments(entity.id)
    .slice()
    .sort((a, b) => Number(a.day_of_week) - Number(b.day_of_week) || String(a.start_time).localeCompare(String(b.start_time)));
  el.mapSelectionPanel.innerHTML = `
    <div class="map-selection-head">
      <div>
        <span class="map-selection-kind">Servicio</span>
        <h4>${escapeHtml(entity.name)}</h4>
      </div>
      <span class="map-selection-badge map-selection-badge-service">Cliente</span>
    </div>
    <div class="map-detail-grid">
      <div><span>Zona</span><strong>${escapeHtml(zone)}</strong></div>
      <div><span>Dirección</span><strong>${escapeHtml(address)}</strong></div>
      <div><span>Horas facturadas</span><strong>${summary.billedHours == null ? 'Pendiente' : `${formatHours(summary.billedHours)} hs`}</strong></div>
      <div><span>Horas operativas</span><strong>${formatHours(summary.assignedHours)} hs</strong></div>
    </div>
    <div class="map-linked-list">
      <strong>Cobertura vinculada</strong>
      ${assignments.length ? assignments.map((assignment) => {
        const worker = getWorkerById(assignment.worker_id);
        return `<button type="button" class="map-linked-item" data-map-select-worker="${assignment.worker_id}">${escapeHtml(formatAssignmentLine(assignment, worker?.name || 'Operario'))}</button>`;
      }).join('') : '<span class="muted small">Sin operarios asignados.</span>'}
    </div>
    <div class="inline-actions">
      <button type="button" class="btn btn-secondary btn-sm" data-edit-service="${entity.id}">Editar servicio</button>
      ${mapsUrl ? `<a class="btn btn-ghost btn-sm map-external-link" href="${mapsUrl}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>` : ''}
    </div>
  `;
}

function selectMapEntity(type, id, { center = false, openPopup = false } = {}) {
  const entity = type === 'worker' ? getWorkerById(id) : getServiceById(id);
  if (!entity) return;
  state.mapSelection = { type, id };
  updateMapMarkerSelection();
  renderMapConnections();
  renderMapSelectionPanel();

  const record = mapMarkers.get(getMapEntityKey(type, id));
  if (record && center && operationsMap) {
    operationsMap.setView(record.marker.getLatLng(), Math.max(operationsMap.getZoom(), 14), { animate: true });
  }
  if (record && openPopup) record.marker.openPopup();
}

function clearMapSelection() {
  state.mapSelection = null;
  updateMapMarkerSelection();
  renderMapConnections();
  renderMapSelectionPanel();
}

function renderMapKpis() {
  if (!el.mapKpiCards) return;
  const mappedServices = state.services.filter((service) => getEntityCoordinates(service)).length;
  const mappedWorkers = state.workers.filter((worker) => getEntityCoordinates(worker)).length;
  const missingServices = state.services.length - mappedServices;
  const missingWorkers = state.workers.length - mappedWorkers;
  el.mapKpiCards.innerHTML = `
    <article class="card"><span class="kpi-label">Servicios ubicados</span><strong class="kpi-value">${mappedServices}</strong><span class="kpi-foot">de ${state.services.length}</span></article>
    <article class="card"><span class="kpi-label">Operarios ubicados</span><strong class="kpi-value">${mappedWorkers}</strong><span class="kpi-foot">de ${state.workers.length}</span></article>
    <article class="card"><span class="kpi-label">Servicios pendientes</span><strong class="kpi-value">${missingServices}</strong><span class="kpi-foot">Sin coordenadas</span></article>
    <article class="card"><span class="kpi-label">Operarios pendientes</span><strong class="kpi-value">${missingWorkers}</strong><span class="kpi-foot">Sin coordenadas</span></article>
  `;
}

function renderMapMissingLocations() {
  if (!el.mapMissingLocations) return;
  const missingWorkers = state.workers.filter((worker) => !getEntityCoordinates(worker));
  const missingServices = state.services.filter((service) => !getEntityCoordinates(service));
  const items = [
    ...missingServices.map((entity) => ({ type: 'service', entity })),
    ...missingWorkers.map((entity) => ({ type: 'worker', entity })),
  ];

  if (!items.length) {
    el.mapMissingLocations.innerHTML = '<div class="empty-state">Todas las ubicaciones están completas.</div>';
    return;
  }

  el.mapMissingLocations.innerHTML = `
    <div class="map-missing-summary">${items.length} registros pendientes</div>
    ${items.slice(0, 12).map(({ type, entity }) => `
      <button type="button" class="map-missing-item" ${type === 'worker' ? `data-edit-worker="${entity.id}"` : `data-edit-service="${entity.id}"`}>
        <span>${type === 'worker' ? 'Operario' : 'Servicio'}</span>
        <strong>${escapeHtml(entity.name)}</strong>
        <small>${escapeHtml(getMapEntityZone(type, entity) || 'Sin zona')}</small>
      </button>
    `).join('')}
    ${items.length > 12 ? `<span class="muted small">Se muestran 12 de ${items.length}. Usá la búsqueda global para completar el resto.</span>` : ''}
  `;
}

function fitMapToVisibleMarkers() {
  if (!operationsMap) return;
  const latLngs = [...mapMarkers.values()].map((record) => record.marker.getLatLng());
  if (!latLngs.length) {
    operationsMap.setView(DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM);
    return;
  }
  if (latLngs.length === 1) {
    operationsMap.setView(latLngs[0], 15, { animate: true });
    return;
  }
  operationsMap.fitBounds(window.L.latLngBounds(latLngs).pad(0.15), { animate: true, maxZoom: 15 });
}

function renderMap({ fit = false } = {}) {
  renderMapKpis();
  renderMapMissingLocations();
  syncMapZoneFilter();
  const map = ensureOperationsMap();
  if (!map || !mapMarkerLayer) return;

  mapMarkerLayer.clearLayers();
  mapMarkers.clear();
  if (mapConnectionLayer) mapConnectionLayer.clearLayers();

  const visibleEntities = getFilteredMapEntities();
  visibleEntities.forEach(({ type, entity, coordinates }) => {
    const key = getMapEntityKey(type, entity.id);
    const isSelected = state.mapSelection && key === getMapEntityKey(state.mapSelection.type, state.mapSelection.id);
    const marker = window.L.marker([coordinates.latitude, coordinates.longitude], {
      icon: createMapMarkerIcon(type, Boolean(isSelected)),
      keyboard: true,
      title: entity.name || '',
      riseOnHover: true,
    }).addTo(mapMarkerLayer);
    marker.bindPopup(buildMapPopupHtml(type, entity), { maxWidth: 320 });
    marker.bindTooltip(escapeHtml(entity.name || ''), { direction: 'top', offset: [0, -34], opacity: 0.92 });
    marker.on('click', () => selectMapEntity(type, entity.id));
    mapMarkers.set(key, { marker, type, entity });
  });

  if (state.mapSelection && !mapMarkers.has(getMapEntityKey(state.mapSelection.type, state.mapSelection.id))) {
    state.mapSelection = null;
  }

  if (el.mapEmptyOverlay) el.mapEmptyOverlay.classList.toggle('hidden', visibleEntities.length > 0);
  renderMapSelectionPanel();
  renderMapConnections();

  window.setTimeout(() => {
    map.invalidateSize();
    if (fit || !state.mapHasFitted) {
      fitMapToVisibleMarkers();
      state.mapHasFitted = true;
    }
  }, 80);
}

function revealMapEntity(type, id) {
  const key = getMapEntityKey(type, id);
  if (!mapMarkers.has(key)) {
    if (el.mapSearch) el.mapSearch.value = '';
    if (el.mapEntityFilter) el.mapEntityFilter.value = 'all';
    if (el.mapZoneFilter) el.mapZoneFilter.value = 'all';
    renderMap();
  }
  selectMapEntity(type, id, { center: true, openPopup: true });
}

function handleMapPanelClick(event) {
  const workerButton = event.target.closest('[data-map-select-worker]');
  if (workerButton) {
    revealMapEntity('worker', workerButton.dataset.mapSelectWorker);
    return;
  }
  const serviceButton = event.target.closest('[data-map-select-service]');
  if (serviceButton) {
    revealMapEntity('service', serviceButton.dataset.mapSelectService);
    return;
  }
  handleDynamicClicks(event);
}

function renderMaterials() {
  renderMaterialsKpis();
  renderServiceMaterialsBoard();
  renderMaterialsMonthlySummaryBoard();
  renderMaterialsConsumptionHistoryBoard();
}

function renderAbsences() {
  syncAbsencePeriodControls();
  const period = getAbsenceActivePeriod();
  updateAbsenceViewHeadings(period);
  renderAbsenceKpis(period.endKey);
  renderAbsenceScheduleBoard(period);
  renderAbsenceHistoryBoard(period);
  renderAbsenceMonthlyKpis(period);
  renderAbsenceMonthlyBoard(period);
  renderAbsenceWorkerTrackerBoard(period.endKey);
  renderAbsenceEmployeeHistoryBoard(period);
  renderTardinessKpis(period.endKey);
  renderTardinessHistoryBoard(period);
  renderTardinessWorkerTrackerBoard(period.endKey);
  renderTardinessEmployeeHistoryBoard(period);
}

let renderFrameId = 0;
let realtimeRefreshTimer = 0;

function renderCurrentView() {
  switch (state.currentView) {
    case 'workers': {
      const summaries = getWorkerSummaries();
      const paginationMeta = getPaginationMeta(summaries, 'workers');
      renderWorkersTable(paginationMeta.items);
      renderWorkerAvailability(paginationMeta.items);
      renderPaginationControls('workers', paginationMeta);
      break;
    }
    case 'services': {
      renderServices();
      break;
    }
    case 'billing':
      renderBilling();
      break;
    case 'planner':
      renderPlanner();
      break;
    case 'map':
      renderMap();
      break;
    case 'optimizer':
      renderOptimizer();
      break;
    case 'proximity':
      renderProximityOptimizer();
      break;
    case 'absences':
      renderAbsences();
      break;
    case 'materials':
      renderMaterials();
      break;
    case 'dashboard':
    default: {
      const summaries = getWorkerSummaries();
      const allWorkerSummaries = getWorkerSummaries({ applyFilters: false });
      renderKpis(summaries, allWorkerSummaries);
      renderWorkforceMonthlyBalance(allWorkerSummaries);
      renderServiceHoursBalance();
      renderCriticalWorkers(allWorkerSummaries);
      renderServiceGaps();
      break;
    }
  }
}

function scheduleRenderCurrentView() {
  if (renderFrameId) {
    window.cancelAnimationFrame(renderFrameId);
  }

  renderFrameId = window.requestAnimationFrame(() => {
    renderFrameId = 0;
    renderCurrentView();
  });
}

function handleViewChange(event) {
  const button = event.target.closest('.nav-tab');
  if (!button) return;
  goToView(button.dataset.view);
}

function handleFilterChange() {
  if (!ensureDataReady('filtrar')) return;

  state.filters.search = normalizeSearchText(el.globalSearch.value);
  state.filters.workerType = el.workerTypeFilter.value;
  state.filters.status = el.statusFilter.value;
  resetPagination('workers');
  resetPagination('services');
  resetPagination('absenceSchedule');
  resetPagination('absenceHistory');
  resetPagination('absenceTracker');
  resetPagination('absenceEmployeeHistory');
  resetPagination('absenceMonthly');
  resetPagination('tardinessHistory');
  resetPagination('tardinessTracker');
  resetPagination('tardinessEmployeeHistory');
  scheduleRenderCurrentView();
}

function buildGlobalSearchGroups(query) {
  const term = normalizeSearchText(query);
  if (term.length < 2) return [];

  const rankAndLimit = (items, limit = 5) => items
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.title || '').localeCompare(String(b.title || ''), 'es', { sensitivity: 'base' }))
    .slice(0, limit);

  const workers = rankAndLimit(state.workers.map((worker) => {
    const assignments = getWorkerAssignments(worker.id);
    const serviceNames = assignments
      .map((assignment) => getServiceById(assignment.service_id)?.name || '')
      .filter(Boolean);
    const searchText = [
      worker.name,
      TYPE_META[worker.worker_type]?.label || '',
      worker.notes || '',
      worker.home_address || '',
      worker.home_zone || '',
      ...serviceNames,
    ].join(' ');

    return {
      kind: 'worker',
      id: worker.id,
      query: worker.name,
      title: worker.name,
      subtitle: `${TYPE_META[worker.worker_type]?.label || 'Operario'}${serviceNames.length ? ` · ${[...new Set(serviceNames)].slice(0, 2).join(' · ')}` : ' · Sin servicio'}`,
      score: getSearchScore(worker.name, searchText, term),
    };
  }));

  const services = rankAndLimit(state.services.map((service) => {
    const summary = getServiceHoursSummary(service);
    const searchText = state.derived.serviceSearchById.get(service.id) || '';
    return {
      kind: 'service',
      id: service.id,
      query: service.name,
      title: service.name,
      subtitle: `${service.zone || 'Sin zona'} · ${summary.billedHours == null ? 'Facturación mensual pendiente' : `${formatHours(summary.billedHours)} hs facturadas/mes`} · ${formatHours(summary.assignedHours)} hs operativas en ${formatMonthLabel(summary.monthKey)}`,
      score: getSearchScore(service.name, searchText, term),
    };
  }));

  const assignments = rankAndLimit(state.assignments.map((assignment) => {
    const worker = getWorkerById(assignment.worker_id);
    const service = getServiceById(assignment.service_id);
    const day = DAYS.find((item) => item.value === assignment.day_of_week);
    const searchText = state.derived.assignmentSearchById.get(assignment.id) || '';
    const title = `${service?.name || 'Servicio'} · ${worker?.name || 'Operario'}`;
    return {
      kind: 'assignment',
      id: assignment.id,
      query: `${service?.name || ''} ${worker?.name || ''}`.trim(),
      title,
      subtitle: `${day?.fullLabel || ''} · ${formatShiftRange(assignment.start_time, assignment.end_time)}`,
      score: getSearchScore(title, searchText, term),
    };
  }, 4));

  const materials = rankAndLimit(state.serviceMaterials.map((serviceMaterial) => {
    const service = getServiceById(serviceMaterial.service_id);
    const material = getMaterialById(serviceMaterial.material_id);
    const title = `${material?.name || 'Material'} · ${service?.name || 'Servicio'}`;
    const searchText = state.derived.serviceMaterialSearchById.get(serviceMaterial.id) || '';
    return {
      kind: 'serviceMaterial',
      id: serviceMaterial.id,
      query: `${material?.name || ''} ${service?.name || ''}`.trim(),
      title,
      subtitle: `Stock ${formatNumber(serviceMaterial.current_stock || 0)} ${material?.unit || ''}`,
      score: getSearchScore(title, searchText, term),
    };
  }, 4));

  const incidents = rankAndLimit([
    ...state.absences.map((absence) => {
      const worker = getWorkerById(absence.worker_id);
      const service = getServiceById(absence.service_id);
      const title = `Ausencia · ${worker?.name || 'Operario'}`;
      return {
        kind: 'absence',
        id: absence.id,
        query: worker?.name || service?.name || '',
        title,
        subtitle: `${formatDateLabel(absence.absence_date)} · ${service?.name || 'Servicio'}`,
        score: getSearchScore(title, state.derived.absenceSearchById.get(absence.id) || '', term),
      };
    }),
    ...state.tardinesses.map((tardiness) => {
      const worker = getWorkerById(tardiness.worker_id);
      const service = getServiceById(tardiness.service_id);
      const title = `Tardanza · ${worker?.name || 'Operario'}`;
      return {
        kind: 'tardiness',
        id: tardiness.id,
        query: worker?.name || service?.name || '',
        title,
        subtitle: `${formatDateLabel(tardiness.tardiness_date)} · ${service?.name || 'Servicio'} · ${tardiness.minutes_late || 0} min`,
        score: getSearchScore(title, state.derived.tardinessSearchById.get(tardiness.id) || '', term),
      };
    }),
  ], 4);

  return [
    { label: 'Operarios', items: workers },
    { label: 'Servicios', items: services },
    { label: 'Planner', items: assignments },
    { label: 'Materiales', items: materials },
    { label: 'Ausencias y tardanzas', items: incidents },
  ].filter((group) => group.items.length);
}

function closeGlobalSearchResults() {
  if (!el.globalSearchResults) return;
  el.globalSearchResults.classList.add('hidden');
  el.globalSearchResults.innerHTML = '';
}

function renderGlobalSearchResults() {
  if (!el.globalSearchResults || !el.globalSearch) return;

  const rawQuery = el.globalSearch.value.trim();
  if (!rawQuery) {
    closeGlobalSearchResults();
    return;
  }

  if (normalizeSearchText(rawQuery).length < 2) {
    el.globalSearchResults.innerHTML = '<div class="global-search-empty">Escribí al menos 2 caracteres.</div>';
    el.globalSearchResults.classList.remove('hidden');
    return;
  }

  const groups = buildGlobalSearchGroups(rawQuery);
  el.globalSearchResults.innerHTML = groups.length
    ? groups.map((group) => `
        <div class="global-search-group">
          <div class="global-search-group-title">${escapeHtml(group.label)}</div>
          ${group.items.map((item) => `
            <button
              type="button"
              class="global-search-result"
              data-global-result-kind="${escapeHtml(item.kind)}"
              data-global-result-id="${escapeHtml(item.id)}"
              data-global-result-query="${escapeHtml(item.query)}"
            >
              <strong>${escapeHtml(item.title)}</strong>
              <span>${escapeHtml(item.subtitle)}</span>
            </button>
          `).join('')}
        </div>
      `).join('')
    : '<div class="global-search-empty">No se encontraron coincidencias en la app.</div>';
  el.globalSearchResults.classList.remove('hidden');
}

function focusGlobalSearchTarget(kind, id) {
  const selectors = {
    worker: `[data-worker-row-id="${id}"]`,
    service: `[data-service-id="${id}"]`,
    assignment: `[data-assignment-id="${id}"]`,
  };
  const selector = selectors[kind];
  if (!selector) return;

  window.setTimeout(() => {
    const target = document.querySelector(selector);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    flashElement(target);
  }, 120);
}

function openGlobalSearchResult(button) {
  const kind = button.dataset.globalResultKind;
  const id = button.dataset.globalResultId;
  const query = button.dataset.globalResultQuery || '';

  if (el.globalSearch) el.globalSearch.value = query;
  state.filters.search = normalizeSearchText(query);

  let targetView = 'dashboard';
  if (kind === 'worker') {
    targetView = 'workers';
    state.filters.workerType = 'all';
    state.filters.status = 'all';
    if (el.workerTypeFilter) el.workerTypeFilter.value = 'all';
    if (el.statusFilter) el.statusFilter.value = 'all';
    resetPagination('workers');
  } else if (kind === 'service') {
    targetView = 'services';
    resetPagination('services');
  } else if (kind === 'assignment') {
    targetView = 'planner';
  } else if (kind === 'serviceMaterial' || kind === 'material') {
    targetView = 'materials';
  } else if (kind === 'absence' || kind === 'tardiness') {
    targetView = 'absences';
    const record = kind === 'absence' ? getAbsenceById(id) : getTardinessById(id);
    const dateKey = kind === 'absence' ? record?.absence_date : record?.tardiness_date;
    const workerId = record?.worker_id;
    if (el.absenceFilterMode) el.absenceFilterMode.value = 'day';
    if (el.absenceDateFilter && dateKey) el.absenceDateFilter.value = dateKey;
    if (el.absenceWorkerHistoryFilter && workerId) el.absenceWorkerHistoryFilter.value = workerId;
    syncAbsencePeriodControls();
  }

  closeGlobalSearchResults();
  goToView(targetView);
  focusGlobalSearchTarget(kind, id);
}

function handleGlobalSearchInput() {
  renderGlobalSearchResults();
  debouncedHandleFilterInput();
}

function handleGlobalSearchKeydown(event) {
  if (event.key === 'Escape') {
    closeGlobalSearchResults();
    return;
  }

  if (event.key === 'Enter') {
    const firstResult = el.globalSearchResults?.querySelector('[data-global-result-kind]');
    if (!firstResult) return;
    event.preventDefault();
    openGlobalSearchResult(firstResult);
  }
}

function handleGlobalSearchResultClick(event) {
  const button = event.target.closest('[data-global-result-kind]');
  if (!button) return;
  openGlobalSearchResult(button);
}

async function loadAllData() {
  const [
    workersRes,
    servicesRes,
    billingRulesRes,
    billingAdjustmentsRes,
    assignmentsRes,
    absencesRes,
    tardinessesRes,
    materialsRes,
    serviceMaterialsRes,
    materialConsumptionsRes,
  ] = await withTimeout(
    Promise.all([
      supabase.from('workers').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('service_billing_rules').select('*').order('created_at'),
      supabase.from('service_billing_adjustments').select('*').order('adjustment_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('assignments').select('*').eq('is_active', true).order('day_of_week').order('start_time'),
      supabase.from('absences').select('*').order('absence_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('tardinesses').select('*').order('tardiness_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('materials').select('*').order('name'),
      supabase.from('service_materials').select('*').order('created_at', { ascending: false }),
      supabase.from('material_consumptions').select('*').order('consumption_date', { ascending: false }).order('created_at', { ascending: false }),
    ]),
    12000,
    'La actualización de datos tardó demasiado.'
  );

  if (workersRes.error || servicesRes.error || assignmentsRes.error) {
    throw workersRes.error || servicesRes.error || assignmentsRes.error;
  }

  state.workers = workersRes.data || [];
  state.services = servicesRes.data || [];
  state.billingRules = billingRulesRes.error ? [] : (billingRulesRes.data || []);
  state.billingAdjustments = billingAdjustmentsRes.error ? [] : (billingAdjustmentsRes.data || []);
  state.billingSchemaReady = !billingRulesRes.error && !billingAdjustmentsRes.error;
  state.assignments = assignmentsRes.data || [];
  state.absences = absencesRes.error ? [] : (absencesRes.data || []);
  state.tardinesses = tardinessesRes.error ? [] : (tardinessesRes.data || []);
  state.materials = materialsRes.error ? [] : (materialsRes.data || []);
  state.serviceMaterials = serviceMaterialsRes.error ? [] : (serviceMaterialsRes.data || []);
  state.materialConsumptions = materialConsumptionsRes.error ? [] : (materialConsumptionsRes.data || []);
  state.optimizerResults = null;
  state.proximityResults = null;

  if (billingRulesRes.error || billingAdjustmentsRes.error) {
    console.warn('Las tablas de proyección de facturación todavía no están disponibles.', billingRulesRes.error || billingAdjustmentsRes.error);
  }
  if (absencesRes.error) {
    console.warn('La tabla de ausencias todavía no está disponible o devolvió error.', absencesRes.error);
  }
  if (tardinessesRes.error) {
    console.warn('La tabla de tardanzas todavía no está disponible o devolvió error.', tardinessesRes.error);
  }
  if (materialsRes.error) {
    console.warn('La tabla de materiales todavía no está disponible o devolvió error.', materialsRes.error);
  }
  if (serviceMaterialsRes.error) {
    console.warn('La tabla de stock por servicio todavía no está disponible o devolvió error.', serviceMaterialsRes.error);
  }
  if (materialConsumptionsRes.error) {
    console.warn('La tabla de consumos de materiales todavía no está disponible o devolvió error.', materialConsumptionsRes.error);
  }

  state.hasLoadedOnce = true;

  rebuildDerivedState();
  populateSelects();
  scheduleRenderCurrentView();
}

async function loadAllDataWithRetry(retries = 4, delayMs = 500, options = {}) {
  const {
    hardLock = !state.hasLoadedOnce,
    silent = false,
  } = options;

  if (state.activeLoadPromise) {
    return state.activeLoadPromise;
  }

  const hadUsableData = state.hasLoadedOnce;

  const loadPromise = (async () => {
    state.loadingData = true;

    if (hardLock || !hadUsableData) {
      setDataReady(false);
    }

    let lastError = null;

    try {
      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          await loadAllData();
          setDataReady(true);
          return true;
        } catch (error) {
          lastError = error;
          console.error(`Error cargando datos. Intento ${attempt}/${retries}`, error);
          if (attempt < retries) await sleep(delayMs);
        }
      }

      if (hadUsableData) {
        setDataReady(true);
        console.warn('Falló la actualización de fondo, pero se conserva la última data cargada.', lastError);
      } else {
        setDataReady(false);
        console.error('No se pudieron cargar los datos luego de varios intentos.', lastError);
        if (!silent) {
          alert('No se pudieron inicializar los datos. Tocá "Actualizar" en unos segundos.');
        }
      }

      return false;
    } finally {
      state.loadingData = false;
    }
  })();

  state.activeLoadPromise = loadPromise;

  try {
    return await loadPromise;
  } finally {
    if (state.activeLoadPromise === loadPromise) {
      state.activeLoadPromise = null;
    }
  }
}

function scheduleRealtimeRefresh() {
  if (Date.now() < state.ignoreRealtimeUntil) return;

  window.clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = window.setTimeout(() => {
    loadAllDataWithRetry(2, 250, { hardLock: false, silent: true });
  }, 250);
}

function subscribeRealtime() {
  if (state.realtimeChannel) {
    supabase.removeChannel(state.realtimeChannel);
  }

  let channel = supabase
    .channel('planner-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tardinesses' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_materials' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'material_consumptions' }, scheduleRealtimeRefresh);

  if (state.billingSchemaReady) {
    channel = channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_billing_rules' }, scheduleRealtimeRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_billing_adjustments' }, scheduleRealtimeRefresh);
  }

  state.realtimeChannel = channel.subscribe();
}

async function initializeAfterLogin(options = {}) {
  const { hardLock = !state.hasLoadedOnce } = options;

  showMain();
  goToView(state.currentView || 'dashboard');
  const ok = await loadAllDataWithRetry(4, 500, { hardLock, silent: false });
  if (ok && !state.realtimeChannel) subscribeRealtime();
}

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (session?.user) {
    state.user = session.user;
    await initializeAfterLogin();
  } else {
    showAuth();
    setDataReady(true);
  }

  supabase.auth.onAuthStateChange(async (event, sessionNow) => {
    const previousUserId = state.user?.id || null;
    state.user = sessionNow?.user || null;

    if (event === 'SIGNED_OUT' || !state.user) {
      showAuth();
      state.workers = [];
      state.services = [];
      state.billingRules = [];
      state.billingAdjustments = [];
      state.assignments = [];
      state.absences = [];
      state.tardinesses = [];
      state.hasLoadedOnce = false;
      state.derived = createEmptyDerivedState();
      if (state.realtimeChannel) {
        supabase.removeChannel(state.realtimeChannel);
        state.realtimeChannel = null;
      }
      setDataReady(true);
      return;
    }

    const mustReinitialize =
      !state.hasLoadedOnce ||
      event === 'SIGNED_IN' ||
      (event === 'USER_UPDATED' && previousUserId !== state.user.id);

    if (mustReinitialize) {
      await initializeAfterLogin({ hardLock: !state.hasLoadedOnce });
    }
  });
}

function setAuthMode(mode) {
  state.authMode = mode;

  document.querySelectorAll('.auth-mode-btn').forEach((button) => {
    button.classList.toggle('active', button.dataset.authMode === mode);
  });

  const isRegister = mode === 'register';
  el.confirmPasswordField?.classList.toggle('hidden', !isRegister);
  if (el.confirmPassword) el.confirmPassword.required = isRegister;
  if (el.authSubmitBtn) el.authSubmitBtn.textContent = isRegister ? 'Crear usuario' : 'Ingresar';
  if (el.authMessage) el.authMessage.textContent = '';
}

async function handleLogin(event) {
  event.preventDefault();

  el.authMessage.textContent = state.authMode === 'register' ? 'Creando usuario...' : 'Validando acceso...';

  const email = $('email')?.value.trim();
  const password = $('password')?.value;
  const confirmPassword = $('confirmPassword')?.value || '';

  if (!email || !password) {
    el.authMessage.textContent = 'Completá email y contraseña.';
    return;
  }

  if (state.authMode === 'register' && password !== confirmPassword) {
    el.authMessage.textContent = 'Las contraseñas no coinciden.';
    return;
  }

  const submitBtn = el.loginForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = state.authMode === 'register' ? 'Creando...' : 'Ingresando...';
  }

  try {
    if (state.authMode === 'register') {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({ email, password }),
        12000,
        'La creación del usuario tardó demasiado.'
      );

      if (error) {
        console.error('Error register:', error);
        el.authMessage.textContent = error.message;
        return;
      }

      if (data?.session) {
        el.authMessage.textContent = 'Usuario creado e ingresado correctamente.';
      } else {
        el.authMessage.textContent = 'Usuario creado. Revisá el email para confirmar el acceso si tu proyecto lo exige.';
        setAuthMode('login');
      }

      return;
    }

    const { error } = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      12000,
      'El login tardó demasiado.'
    );

    if (error) {
      console.error('Error login:', error);
      el.authMessage.textContent = error.message;
      return;
    }

    el.authMessage.textContent = 'Ingresando...';
  } catch (error) {
    console.error(error);
    el.authMessage.textContent = error.message || 'No se pudo completar la operación.';
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = state.authMode === 'register' ? 'Crear usuario' : 'Ingresar';
    }
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
}

function showMain() {
  el.authView.classList.add('hidden');
  el.mainView.classList.remove('hidden');
}

function showAuth() {
  el.mainView.classList.add('hidden');
  el.authView.classList.remove('hidden');
}

function openWorkerDialog(workerId = null) {
  if (!ensureDataReady('abrir el formulario de operarios')) return;

  el.workerForm.reset();
  $('workerId').value = '';
  $('workerDialogTitle').textContent = workerId ? 'Editar operario' : 'Nuevo operario';
  $('deleteWorkerBtn').classList.toggle('hidden', !workerId);

  if (workerId) {
    const worker = getWorkerById(workerId);
    if (!worker) return;

    $('workerId').value = worker.id;
    $('workerName').value = worker.name || '';
    $('workerType').value = worker.worker_type || 'full_time';
    $('workerTargetHours').value = worker.target_hours ?? '';
    $('workerHireDate').value = worker.hire_date || '';
    $('workerHomeAddress').value = worker.home_address || '';
    $('workerHomeZone').value = worker.home_zone || '';
    $('workerCoordinates').value = formatCoordinates(worker);
    $('workerNotes').value = worker.notes || '';
  }

  el.workerDialog.showModal();
}

function openServiceDialog(serviceId = null) {
  if (!ensureDataReady('abrir el formulario de servicios')) return;

  el.serviceForm.reset();
  $('serviceId').value = '';
  $('serviceDialogTitle').textContent = serviceId ? 'Editar servicio' : 'Nuevo servicio';
  $('deleteServiceBtn').classList.toggle('hidden', !serviceId);

  if (serviceId) {
    const service = getServiceById(serviceId);
    if (!service) return;

    $('serviceId').value = service.id;
    $('serviceName').value = service.name || '';
    $('serviceAddress').value = service.client_address || '';
    $('serviceZone').value = service.zone || '';
    $('serviceCoordinates').value = formatCoordinates(service);
    $('serviceSupervisor').value = service.supervisor_name || '';
    $('serviceBilledHours').value = service.billed_monthly_hours ?? '';
    $('serviceFrequency').value = service.frequency_type || 'fixed';
    $('serviceNotes').value = service.notes || '';
  }

  el.serviceDialog.showModal();
}

function openAssignmentDialog(assignmentId = null) {
  if (!ensureDataReady('abrir asignaciones')) return;

  el.assignmentForm.reset();
  populateSelects();
  $('assignmentId').value = '';
  $('assignmentDialogTitle').textContent = assignmentId ? 'Editar asignación' : 'Nueva asignación';
  $('deleteAssignmentBtn').classList.toggle('hidden', !assignmentId);

  if (assignmentId) {
    const assignment = getAssignmentById(assignmentId);
    if (!assignment) return;

    $('assignmentId').value = assignment.id;
    $('assignmentWorker').value = assignment.worker_id;
    $('assignmentService').value = assignment.service_id;
    $('assignmentDay').value = String(assignment.day_of_week);
    $('assignmentStart').value = assignment.start_time?.slice(0, 5) || '';
    $('assignmentEnd').value = assignment.end_time?.slice(0, 5) || '';
    $('assignmentNotes').value = assignment.notes || '';
  }

  el.assignmentDialog.showModal();
}

function openBulkAssignmentDialog() {
  if (!ensureDataReady('abrir carga rápida')) return;

  el.bulkAssignmentForm.reset();
  populateSelects();

  document.querySelectorAll('.bulk-day').forEach((checkbox) => {
    checkbox.checked = false;
  });

  el.bulkAssignmentDialog.showModal();
}


function updateAbsenceCoverageInfo() {
  if (!el.absenceCoverageHoursInfo) return;

  const start = $('absenceCoverageStart')?.value;
  const end = $('absenceCoverageEnd')?.value;
  const hours = start && end ? calculateHours(start, end) : null;

  el.absenceCoverageHoursInfo.value = hours == null || Number.isNaN(hours)
    ? ''
    : `${formatHours(hours)} hs`;
}

function toggleAbsenceCoverageFields() {
  const status = $('absenceCoverageStatus')?.value || 'uncovered';
  const shouldShow = status === 'covered' || status === 'partial';

  $('absenceCoverageFields')?.classList.toggle('hidden', !shouldShow);

  if (!shouldShow) {
    if ($('absenceCoverageWorker')) $('absenceCoverageWorker').value = '';
    if ($('absenceCoverageDate')) $('absenceCoverageDate').value = '';
    if ($('absenceCoverageStart')) $('absenceCoverageStart').value = '';
    if ($('absenceCoverageEnd')) $('absenceCoverageEnd').value = '';
    if (el.absenceCoverageHoursInfo) el.absenceCoverageHoursInfo.value = '';
  } else if ($('absenceCoverageDate') && !$('absenceCoverageDate').value) {
    $('absenceCoverageDate').value = $('absenceDate')?.value || getSelectedAbsenceDate();
  }

  updateAbsenceCoverageInfo();
}


function updateTardinessMinutesInfo() {
  const scheduledStart = $('tardinessScheduledStart')?.value;
  const actualArrival = $('tardinessActualArrival')?.value;
  const minutesLate = calculateMinutesLate(scheduledStart, actualArrival);
  if (el.tardinessMinutesInfo) {
    el.tardinessMinutesInfo.value = minutesLate == null ? '' : formatMinutes(minutesLate);
  }
}

function openTardinessDialog(options = {}) {
  if (!ensureDataReady('abrir tardanzas')) return;

  const { tardinessId = null, assignmentId = null, tardinessDate: forcedDate = '' } = typeof options === 'string'
    ? { tardinessId: options }
    : options;

  el.tardinessForm.reset();
  populateSelects();

  $('tardinessId').value = '';
  $('tardinessAssignmentId').value = '';
  $('tardinessDialogTitle').textContent = tardinessId ? 'Editar tardanza' : 'Registrar tardanza';
  $('deleteTardinessBtn').classList.toggle('hidden', !tardinessId);

  const defaultDate = forcedDate || getAbsenceActivePeriod().startKey || getSelectedAbsenceDate();
  if ($('tardinessDate')) $('tardinessDate').value = defaultDate;

  if (tardinessId) {
    const tardiness = getTardinessById(tardinessId);
    if (!tardiness) return;

    $('tardinessId').value = tardiness.id;
    $('tardinessAssignmentId').value = tardiness.assignment_id || '';
    $('tardinessDate').value = tardiness.tardiness_date || defaultDate;
    $('tardinessWorker').value = tardiness.worker_id || '';
    $('tardinessService').value = tardiness.service_id || '';
    $('tardinessScheduledStart').value = tardiness.scheduled_start_time?.slice(0, 5) || '';
    $('tardinessActualArrival').value = tardiness.actual_arrival_time?.slice(0, 5) || '';
    $('tardinessNotes').value = tardiness.notes || '';
  } else if (assignmentId) {
    const assignment = getAssignmentById(assignmentId);
    if (!assignment) return;

    const existingTardiness = findTardinessForAssignmentOnDate(assignment, defaultDate);
    if (existingTardiness) {
      openTardinessDialog({ tardinessId: existingTardiness.id });
      return;
    }

    $('tardinessAssignmentId').value = assignment.id;
    $('tardinessWorker').value = assignment.worker_id || '';
    $('tardinessService').value = assignment.service_id || '';
    $('tardinessScheduledStart').value = assignment.start_time?.slice(0, 5) || '';
  }

  updateTardinessMinutesInfo();
  el.tardinessDialog.showModal();
}

async function saveTardiness(event) {
  event.preventDefault();

  const tardinessId = $('tardinessId').value.trim();
  const assignmentId = $('tardinessAssignmentId').value.trim();
  const tardinessDate = $('tardinessDate')?.value;
  const workerId = $('tardinessWorker')?.value;
  const serviceId = $('tardinessService')?.value;
  const scheduledStart = $('tardinessScheduledStart')?.value || null;
  const actualArrival = $('tardinessActualArrival')?.value || null;
  const notes = $('tardinessNotes')?.value.trim() || null;

  if (!tardinessDate || !workerId || !serviceId || !scheduledStart || !actualArrival) {
    alert('Completá fecha, operario, servicio, horario previsto y hora de llegada.');
    return;
  }

  const minutesLate = calculateMinutesLate(scheduledStart, actualArrival);
  if (minutesLate == null || minutesLate <= 0) {
    alert('La llegada debe ser posterior al horario previsto para registrar una tardanza.');
    return;
  }

  const submitBtn = el.tardinessForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const payload = {
      assignment_id: assignmentId || null,
      worker_id: workerId,
      service_id: serviceId,
      tardiness_date: tardinessDate,
      day_of_week: getDateKeyDayOfWeek(tardinessDate),
      scheduled_start_time: scheduledStart,
      actual_arrival_time: actualArrival,
      minutes_late: minutesLate,
      notes,
    };

    const request = tardinessId
      ? supabase.from('tardinesses').update(payload).eq('id', tardinessId)
      : supabase.from('tardinesses').insert(payload);

    markLocalMutation();

    const { error } = await withTimeout(
      request,
      12000,
      'Guardar tardanza tardó demasiado.'
    );

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    el.tardinessDialog.close();
    if (el.absenceDateFilter) el.absenceDateFilter.value = tardinessDate;
    if (el.absenceMonthFilter) el.absenceMonthFilter.value = getMonthKey(tardinessDate);
    goToView('absences');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la tardanza.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar tardanza';
    }
  }
}

async function deleteTardinessById(tardinessId, options = {}) {
  if (!ensureDataReady('eliminar la tardanza')) return;

  const normalizedTardinessId = String(tardinessId || '').trim();
  if (!normalizedTardinessId) return;

  const shouldConfirm = options.confirm !== false;
  if (shouldConfirm && !confirm('¿Eliminar esta tardanza?')) return;

  markLocalMutation();

  const { error } = await supabase.from('tardinesses').delete().eq('id', normalizedTardinessId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  if (options.closeDialog !== false) {
    el.tardinessDialog?.close();
  }

  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

async function deleteTardiness() {
  const tardinessId = $('tardinessId').value.trim();
  if (!tardinessId) return;
  await deleteTardinessById(tardinessId, { closeDialog: true });
}

function openAbsenceDialog(options = {}) {
  if (!ensureDataReady('abrir ausencias')) return;

  const { absenceId = null, assignmentId = null, absenceDate: forcedAbsenceDate = '' } = typeof options === 'string'
    ? { absenceId: options }
    : options;

  el.absenceForm.reset();
  populateSelects();

  $('absenceId').value = '';
  $('absenceAssignmentId').value = '';
  $('absenceDialogTitle').textContent = absenceId ? 'Editar ausencia' : 'Registrar ausencia';
  $('deleteAbsenceBtn').classList.toggle('hidden', !absenceId);

  const defaultDate = forcedAbsenceDate || getAbsenceActivePeriod().startKey || getSelectedAbsenceDate();
  if ($('absenceDate')) $('absenceDate').value = defaultDate;
  if ($('absenceCoverageStatus')) $('absenceCoverageStatus').value = 'uncovered';
  if ($('absenceType')) $('absenceType').value = '';

  if (absenceId) {
    const absence = getAbsenceById(absenceId);
    if (!absence) return;

    $('absenceId').value = absence.id;
    $('absenceAssignmentId').value = absence.assignment_id || '';
    $('absenceDate').value = absence.absence_date || defaultDate;
    $('absenceWorker').value = absence.worker_id || '';
    $('absenceService').value = absence.service_id || '';
    $('absenceScheduledStart').value = absence.scheduled_start_time?.slice(0, 5) || '';
    $('absenceScheduledEnd').value = absence.scheduled_end_time?.slice(0, 5) || '';
    $('absenceType').value = absence.absence_type || '';
    $('absenceCoverageStatus').value = absence.coverage_status || 'uncovered';
    $('absenceCoverageWorker').value = absence.coverage_worker_id || '';
    $('absenceCoverageDate').value = absence.coverage_date || '';
    $('absenceCoverageStart').value = absence.coverage_start_time?.slice(0, 5) || '';
    $('absenceCoverageEnd').value = absence.coverage_end_time?.slice(0, 5) || '';
    $('absenceNotes').value = absence.notes || '';
  } else if (assignmentId) {
    const assignment = getAssignmentById(assignmentId);
    if (!assignment) return;

    const existingAbsence = findAbsenceForAssignmentOnDate(assignment, defaultDate);
    if (existingAbsence) {
      openAbsenceDialog({ absenceId: existingAbsence.id });
      return;
    }

    $('absenceAssignmentId').value = assignment.id;
    $('absenceWorker').value = assignment.worker_id || '';
    $('absenceService').value = assignment.service_id || '';
    $('absenceScheduledStart').value = assignment.start_time?.slice(0, 5) || '';
    $('absenceScheduledEnd').value = assignment.end_time?.slice(0, 5) || '';
    $('absenceCoverageDate').value = defaultDate;
  } else {
    $('absenceCoverageDate').value = defaultDate;
  }

  toggleAbsenceCoverageFields();
  el.absenceDialog.showModal();
}


function updateMaterialCatalogAutocomplete(inputId, unitId, presentationId) {
  const name = $(inputId)?.value || '';
  const material = getMaterialByName(name);

  if (!material) return;

  if ($(unitId) && !$(unitId).value) $(unitId).value = material.unit || '';
  if ($(presentationId) && !$(presentationId).value) $(presentationId).value = material.presentation || '';
}

function updateMaterialConsumptionOptions() {
  const datalist = $('serviceMaterialOptionsList');
  const serviceId = $('materialConsumptionService')?.value || '';

  if (!datalist) return;

  const materials = serviceId
    ? getServiceMaterialsByServiceId(serviceId)
        .map((item) => getMaterialById(item.material_id))
        .filter(Boolean)
    : state.materials;

  const deduped = new Map();
  materials.forEach((material) => {
    if (!deduped.has(material.id)) deduped.set(material.id, material);
  });

  datalist.innerHTML = [...deduped.values()]
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }))
    .map((material) => `<option value="${escapeHtml(material.name)}"></option>`)
    .join('');

  updateMaterialConsumptionMeta();
}

function updateMaterialConsumptionMeta() {
  const serviceId = $('materialConsumptionService')?.value || '';
  const materialName = $('materialConsumptionMaterial')?.value || '';
  const info = $('materialConsumptionStockInfo');

  if (!info) return;

  if (!serviceId || !materialName) {
    info.value = '';
    return;
  }

  const material = getMaterialByName(materialName);
  const serviceMaterial = material ? findServiceMaterial(serviceId, material.id) : null;

  if (!material) {
    info.value = 'Material no encontrado en el catálogo.';
    return;
  }

  if (!serviceMaterial) {
    info.value = 'Primero asigná este material al servicio.';
    return;
  }

  info.value = `Stock actual: ${formatNumber(serviceMaterial.current_stock)} ${material.unit || ''}${serviceMaterial.minimum_stock != null ? ` · Mínimo: ${formatNumber(serviceMaterial.minimum_stock)} ${material.unit || ''}` : ''}`;
}

function getSelectedMaterialFromServiceForm() {
  const materialName = $('serviceMaterialCatalog')?.value || '';
  const unit = $('serviceMaterialUnit')?.value.trim() || 'un';
  const presentation = $('serviceMaterialPresentation')?.value.trim() || null;
  return {
    name: materialName.trim(),
    unit,
    presentation,
  };
}

async function ensureMaterialRecord({ name, unit = 'un', presentation = null, notes = null }) {
  const normalized = normalizeText(name);
  if (!normalized) throw new Error('Ingresá un material.');

  const existing = getMaterialByName(name);
  if (existing) return existing;

  const payload = {
    name: name.trim(),
    normalized_name: normalized,
    unit: unit || 'un',
    presentation,
    notes,
  };

  markLocalMutation();

  const { data, error } = await withTimeout(
    supabase.from('materials').insert(payload).select().single(),
    12000,
    'Guardar material base tardó demasiado.'
  );

  if (error) throw error;
  return data;
}

function openMaterialCatalogDialog(materialId = null) {
  if (!ensureDataReady('abrir materiales base')) return;

  el.materialCatalogForm?.reset();
  $('materialCatalogId').value = '';
  $('materialCatalogDialogTitle').textContent = materialId ? 'Editar material base' : 'Nuevo material base';
  $('deleteMaterialCatalogBtn').classList.toggle('hidden', !materialId);

  if (materialId) {
    const material = getMaterialById(materialId);
    if (!material) return;

    $('materialCatalogId').value = material.id;
    $('materialCatalogName').value = material.name || '';
    $('materialCatalogUnit').value = material.unit || '';
    $('materialCatalogPresentation').value = material.presentation || '';
    $('materialCatalogNotes').value = material.notes || '';
  }

  el.materialCatalogDialog.showModal();
}

function openServiceMaterialDialog(options = {}) {
  if (!ensureDataReady('abrir stock de materiales')) return;

  const { serviceMaterialId = null, prefillServiceId = '' } = typeof options === 'string'
    ? { serviceMaterialId: options }
    : options;

  el.serviceMaterialForm?.reset();
  $('serviceMaterialId').value = '';
  $('serviceMaterialDialogTitle').textContent = serviceMaterialId ? 'Editar material del servicio' : 'Asignar material al servicio';
  $('deleteServiceMaterialBtn').classList.toggle('hidden', !serviceMaterialId);

  if (serviceMaterialId) {
    const item = getServiceMaterialById(serviceMaterialId);
    if (!item) return;
    const material = getMaterialById(item.material_id);

    $('serviceMaterialId').value = item.id;
    $('serviceMaterialService').value = item.service_id || '';
    $('serviceMaterialCatalog').value = material?.name || '';
    $('serviceMaterialUnit').value = material?.unit || '';
    $('serviceMaterialPresentation').value = material?.presentation || '';
    $('serviceMaterialCurrentStock').value = item.current_stock ?? '';
    $('serviceMaterialMinimumStock').value = item.minimum_stock ?? '';
    $('serviceMaterialNotes').value = item.notes || '';
  } else if (prefillServiceId) {
    $('serviceMaterialService').value = prefillServiceId;
  }

  el.serviceMaterialDialog.showModal();
}

function openMaterialConsumptionDialog(options = {}) {
  if (!ensureDataReady('abrir consumo de materiales')) return;

  const {
    consumptionId = null,
    prefillServiceId = '',
    prefillServiceMaterialId = '',
  } = typeof options === 'string'
    ? { consumptionId: options }
    : options;

  el.materialConsumptionForm?.reset();
  $('materialConsumptionId').value = '';
  $('materialConsumptionDialogTitle').textContent = consumptionId ? 'Editar consumo' : 'Registrar consumo';
  $('deleteMaterialConsumptionBtn').classList.toggle('hidden', !consumptionId);
  $('materialConsumptionDate').value = new Date().toISOString().slice(0, 10);

  if (consumptionId) {
    const consumption = getMaterialConsumptionById(consumptionId);
    if (!consumption) return;

    const material = getMaterialById(consumption.material_id);

    $('materialConsumptionId').value = consumption.id;
    $('materialConsumptionDate').value = consumption.consumption_date || new Date().toISOString().slice(0, 10);
    $('materialConsumptionService').value = consumption.service_id || '';
    updateMaterialConsumptionOptions();
    $('materialConsumptionMaterial').value = material?.name || '';
    $('materialConsumptionQuantity').value = consumption.quantity ?? '';
    $('materialConsumptionNotes').value = consumption.notes || '';
  } else if (prefillServiceMaterialId) {
    const serviceMaterial = getServiceMaterialById(prefillServiceMaterialId);
    const material = serviceMaterial ? getMaterialById(serviceMaterial.material_id) : null;
    $('materialConsumptionService').value = serviceMaterial?.service_id || '';
    updateMaterialConsumptionOptions();
    $('materialConsumptionMaterial').value = material?.name || '';
  } else if (prefillServiceId) {
    $('materialConsumptionService').value = prefillServiceId;
    updateMaterialConsumptionOptions();
  } else {
    updateMaterialConsumptionOptions();
  }

  updateMaterialConsumptionMeta();
  el.materialConsumptionDialog.showModal();
}

async function saveMaterialCatalog(event) {
  event.preventDefault();

  const materialId = $('materialCatalogId').value.trim();
  const name = $('materialCatalogName')?.value.trim();
  const unit = $('materialCatalogUnit')?.value.trim() || 'un';
  const presentation = $('materialCatalogPresentation')?.value.trim() || null;
  const notes = $('materialCatalogNotes')?.value.trim() || null;

  if (!name) {
    alert('Completá el nombre del material.');
    return;
  }

  const submitBtn = el.materialCatalogForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const payload = {
      name,
      normalized_name: normalizeText(name),
      unit,
      presentation,
      notes,
    };

    const request = materialId
      ? supabase.from('materials').update(payload).eq('id', materialId)
      : supabase.from('materials').insert(payload);

    markLocalMutation();

    const { error } = await withTimeout(request, 12000, 'Guardar material base tardó demasiado.');
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    el.materialCatalogDialog.close();
    goToView('materials');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar el material base.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  }
}

async function saveServiceMaterial(event) {
  event.preventDefault();

  const serviceMaterialId = $('serviceMaterialId').value.trim();
  const serviceId = $('serviceMaterialService')?.value;
  const currentStockValue = $('serviceMaterialCurrentStock')?.value;
  const minimumStockValue = $('serviceMaterialMinimumStock')?.value;
  const notes = $('serviceMaterialNotes')?.value.trim() || null;
  const materialPayload = getSelectedMaterialFromServiceForm();

  if (!serviceId || !materialPayload.name) {
    alert('Completá servicio y material.');
    return;
  }

  const submitBtn = el.serviceMaterialForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const material = await ensureMaterialRecord(materialPayload);
    const duplicated = findServiceMaterial(serviceId, material.id);
    const targetId = duplicated && duplicated.id !== serviceMaterialId ? duplicated.id : serviceMaterialId;

    const payload = {
      service_id: serviceId,
      material_id: material.id,
      current_stock: currentStockValue === '' ? 0 : Number(currentStockValue),
      minimum_stock: minimumStockValue === '' ? null : Number(minimumStockValue),
      notes,
    };

    const request = targetId
      ? supabase.from('service_materials').update(payload).eq('id', targetId)
      : supabase.from('service_materials').insert(payload);

    markLocalMutation();

    const { error } = await withTimeout(request, 12000, 'Guardar material del servicio tardó demasiado.');
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    el.serviceMaterialDialog.close();
    goToView('materials');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar el material del servicio.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  }
}

async function applyConsumptionStockImpact(previousConsumption, nextServiceMaterialId, nextQuantity) {
  const updates = [];

  if (previousConsumption?.service_material_id) {
    const previousServiceMaterial = getServiceMaterialById(previousConsumption.service_material_id);
    if (previousServiceMaterial) {
      updates.push({
        id: previousServiceMaterial.id,
        current_stock: Number(previousServiceMaterial.current_stock || 0) + Number(previousConsumption.quantity || 0),
      });
    }
  }

  const existingNextIndex = updates.findIndex((item) => item.id === nextServiceMaterialId);
  const nextServiceMaterial = getServiceMaterialById(nextServiceMaterialId);
  if (!nextServiceMaterial) throw new Error('No se encontró el stock del material seleccionado.');

  if (existingNextIndex >= 0) {
    updates[existingNextIndex].current_stock -= Number(nextQuantity || 0);
  } else {
    updates.push({
      id: nextServiceMaterial.id,
      current_stock: Number(nextServiceMaterial.current_stock || 0) - Number(nextQuantity || 0),
    });
  }

  for (const update of updates) {
    const { error } = await withTimeout(
      supabase.from('service_materials').update({ current_stock: update.current_stock }).eq('id', update.id),
      12000,
      'Actualizar stock tardó demasiado.'
    );
    if (error) throw error;
  }
}

async function saveMaterialConsumption(event) {
  event.preventDefault();

  const consumptionId = $('materialConsumptionId').value.trim();
  const consumptionDate = $('materialConsumptionDate')?.value;
  const serviceId = $('materialConsumptionService')?.value;
  const materialName = $('materialConsumptionMaterial')?.value.trim() || '';
  const quantityValue = $('materialConsumptionQuantity')?.value;
  const notes = $('materialConsumptionNotes')?.value.trim() || null;

  if (!consumptionDate || !serviceId || !materialName || !quantityValue) {
    alert('Completá fecha, servicio, material y cantidad.');
    return;
  }

  const material = getMaterialByName(materialName);
  if (!material) {
    alert('Ese material no existe en el catálogo. Cargalo primero o elegí uno existente.');
    return;
  }

  const serviceMaterial = findServiceMaterial(serviceId, material.id);
  if (!serviceMaterial) {
    alert('Primero asigná ese material al servicio.');
    return;
  }

  const quantity = Number(quantityValue);
  if (!(quantity > 0)) {
    alert('La cantidad consumida debe ser mayor a cero.');
    return;
  }

  const submitBtn = el.materialConsumptionForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const previousConsumption = consumptionId ? getMaterialConsumptionById(consumptionId) : null;
    markLocalMutation();

    await applyConsumptionStockImpact(previousConsumption, serviceMaterial.id, quantity);

    const payload = {
      service_material_id: serviceMaterial.id,
      service_id: serviceId,
      material_id: material.id,
      consumption_date: consumptionDate,
      quantity,
      notes,
    };

    const request = consumptionId
      ? supabase.from('material_consumptions').update(payload).eq('id', consumptionId)
      : supabase.from('material_consumptions').insert(payload);

    const { error } = await withTimeout(request, 12000, 'Guardar consumo tardó demasiado.');
    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    el.materialConsumptionDialog.close();
    if (el.materialsMonthFilter) el.materialsMonthFilter.value = getMonthKey(consumptionDate);
    goToView('materials');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar el consumo.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar consumo';
    }
  }
}

async function deleteMaterialCatalog() {
  if (!ensureDataReady('eliminar el material base')) return;

  const materialId = $('materialCatalogId').value.trim();
  if (!materialId) return;

  const hasServiceMaterials = state.serviceMaterials.some((item) => item.material_id === materialId);
  if (hasServiceMaterials) {
    alert('No podés eliminar este material porque ya está asignado a uno o más servicios.');
    return;
  }

  if (!confirm('¿Eliminar este material base?')) return;

  markLocalMutation();

  const { error } = await supabase.from('materials').delete().eq('id', materialId);
  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.materialCatalogDialog.close();
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

async function deleteServiceMaterial() {
  if (!ensureDataReady('eliminar el material del servicio')) return;

  const serviceMaterialId = $('serviceMaterialId').value.trim();
  if (!serviceMaterialId) return;

  const hasConsumptions = state.materialConsumptions.some((item) => item.service_material_id === serviceMaterialId);
  if (hasConsumptions) {
    alert('No podés eliminar este material del servicio porque ya tiene consumos históricos.');
    return;
  }

  if (!confirm('¿Eliminar este material del servicio?')) return;

  markLocalMutation();

  const { error } = await supabase.from('service_materials').delete().eq('id', serviceMaterialId);
  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.serviceMaterialDialog.close();
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

async function deleteMaterialConsumption() {
  if (!ensureDataReady('eliminar el consumo')) return;

  const consumptionId = $('materialConsumptionId').value.trim();
  if (!consumptionId) return;

  const consumption = getMaterialConsumptionById(consumptionId);
  if (!consumption) return;

  if (!confirm('¿Eliminar este consumo?')) return;

  try {
    await ensureWriteSession();
    markLocalMutation();

    const serviceMaterial = getServiceMaterialById(consumption.service_material_id);
    if (serviceMaterial) {
      const { error: stockError } = await withTimeout(
        supabase.from('service_materials').update({
          current_stock: Number(serviceMaterial.current_stock || 0) + Number(consumption.quantity || 0),
        }).eq('id', serviceMaterial.id),
        12000,
        'Revertir stock tardó demasiado.'
      );
      if (stockError) throw stockError;
    }

    const { error } = await supabase.from('material_consumptions').delete().eq('id', consumptionId);
    if (error) throw error;

    el.materialConsumptionDialog.close();
    await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo eliminar el consumo.');
  }
}

async function saveWorker(event) {
  event.preventDefault();

  const workerId = $('workerId').value.trim();
  const nameInput = $('workerName');
  const typeInput = $('workerType');
  const targetInput = $('workerTargetHours');
  const hireDateInput = $('workerHireDate');
  const homeAddressInput = $('workerHomeAddress');
  const homeZoneInput = $('workerHomeZone');
  const coordinatesInput = $('workerCoordinates');
  const notesInput = $('workerNotes');

  if (!nameInput || !typeInput) {
    alert('Faltan campos del formulario de operario.');
    return;
  }

  const submitBtn = el.workerForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const coordinatesRaw = coordinatesInput?.value.trim() || '';
    const coordinates = coordinatesRaw ? parseCoordinates(coordinatesRaw) : null;
    if (coordinatesRaw && !coordinates) {
      alert('No se pudieron interpretar las coordenadas o el enlace de Google Maps del operario.');
      return;
    }

    const payload = {
      name: nameInput.value.trim(),
      worker_type: typeInput.value,
      target_hours: targetInput?.value ? Number(targetInput.value) : null,
      hire_date: hireDateInput?.value || null,
      home_address: homeAddressInput?.value.trim() || null,
      home_zone: homeZoneInput?.value.trim() || null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      notes: notesInput?.value.trim() || null,
    };

    const request = workerId
      ? supabase.from('workers').update(payload).eq('id', workerId)
      : supabase.from('workers').insert(payload);

    markLocalMutation();

    const { error } = await withTimeout(
      request,
      12000,
      'Guardar operario tardó demasiado.'
    );

    if (error) {
      console.error(error);
      const errorMessage = String(error.message || '');
      const missingLocationColumn = errorMessage.includes('home_address') || errorMessage.includes('home_zone') || errorMessage.includes('latitude') || errorMessage.includes('longitude');
      alert(missingLocationColumn
        ? 'Falta ejecutar sql/migration_add_optimizer_locations.sql. La migración solo agrega campos de ubicación y no modifica los datos existentes.'
        : error.message);
      return;
    }

    el.workerDialog.close();
    goToView('workers');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar el operario.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  }
}

async function saveService(event) {
  event.preventDefault();

  const serviceId = $('serviceId').value.trim();
  const serviceName = $('serviceName');
  const serviceAddress = $('serviceAddress');
  const serviceZone = $('serviceZone');
  const serviceCoordinates = $('serviceCoordinates');
  const serviceSupervisor = $('serviceSupervisor');
  const serviceBilledHours = $('serviceBilledHours');
  const serviceFrequency = $('serviceFrequency');
  const serviceNotes = $('serviceNotes');

  if (!serviceName) {
    alert('Falta el campo serviceName en el HTML.');
    return;
  }

  const submitBtn = el.serviceForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const billedHoursRaw = serviceBilledHours?.value.trim() || '';
    const billedHours = billedHoursRaw === '' ? null : Number(billedHoursRaw);
    if (billedHours != null && (!Number.isFinite(billedHours) || billedHours < 0)) {
      alert('Las horas mensuales facturadas deben ser un número igual o mayor a 0.');
      return;
    }

    const coordinatesRaw = serviceCoordinates?.value.trim() || '';
    const coordinates = coordinatesRaw ? parseCoordinates(coordinatesRaw) : null;
    if (coordinatesRaw && !coordinates) {
      alert('No se pudieron interpretar las coordenadas o el enlace de Google Maps del servicio.');
      return;
    }

    const payload = {
      name: serviceName.value.trim(),
      client_address: serviceAddress ? serviceAddress.value.trim() || null : null,
      zone: serviceZone ? serviceZone.value.trim() || null : null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
      supervisor_name: serviceSupervisor ? serviceSupervisor.value.trim() || null : null,
      billed_monthly_hours: billedHours,
      frequency_type: serviceFrequency ? serviceFrequency.value : 'fixed',
      notes: serviceNotes ? serviceNotes.value.trim() || null : null,
    };

    const request = serviceId
      ? supabase.from('services').update(payload).eq('id', serviceId)
      : supabase.from('services').insert(payload);

    markLocalMutation();

    const { error } = await withTimeout(
      request,
      12000,
      'Guardar servicio tardó demasiado.'
    );

    if (error) {
      console.error(error);
      const errorMessage = String(error.message || '');
      const missingBilledHoursColumn = errorMessage.includes('billed_monthly_hours');
      const missingLocationColumn = errorMessage.includes('latitude') || errorMessage.includes('longitude');
      alert(missingLocationColumn
        ? 'Falta ejecutar sql/migration_add_optimizer_locations.sql. La migración solo agrega campos de ubicación y no modifica los datos existentes.'
        : missingBilledHoursColumn
          ? 'Falta ejecutar la migración de base de datos incluida en sql/migration_add_billed_monthly_hours.sql. La migración agrega una columna nueva y no borra ni modifica los datos existentes.'
          : error.message);
      return;
    }

    el.serviceDialog.close();
    goToView('services');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar el servicio.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  }
}

async function saveAssignment(event) {
  event.preventDefault();

  const assignmentId = $('assignmentId').value.trim();
  const workerInput = $('assignmentWorker');
  const serviceInput = $('assignmentService');
  const dayInput = $('assignmentDay');
  const startInput = $('assignmentStart');
  const endInput = $('assignmentEnd');
  const notesInput = $('assignmentNotes');

  if (!workerInput || !serviceInput || !dayInput || !startInput || !endInput) {
    alert('Faltan campos del formulario de asignación.');
    return;
  }

  if (!workerInput.value || !serviceInput.value || !startInput.value || !endInput.value) {
    alert('Completá operario, servicio, día y horario.');
    return;
  }

  if (calculateShiftMinutes(startInput.value, endInput.value) <= 0) {
    alert('La hora de inicio y la hora de finalización no pueden ser iguales.');
    return;
  }

  const overnightMessage = buildOvernightConfirmation(Number(dayInput.value), startInput.value, endInput.value);
  if (overnightMessage && !confirm(overnightMessage)) return;

  const submitBtn = el.assignmentForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const payload = {
      worker_id: workerInput.value,
      service_id: serviceInput.value,
      day_of_week: Number(dayInput.value),
      start_time: startInput.value,
      end_time: endInput.value,
      notes: notesInput?.value.trim() || null,
      is_active: true,
    };

    const request = assignmentId
      ? supabase.from('assignments').update(payload).eq('id', assignmentId)
      : supabase.from('assignments').insert(payload);

    markLocalMutation();

    const { error } = await withTimeout(
      request,
      12000,
      'Guardar asignación tardó demasiado.'
    );

    if (error) {
      console.error(error);
      const errorMessage = String(error.message || '');
      alert(errorMessage.includes('valid_shift')
        ? 'La base de datos todavía bloquea los turnos nocturnos. Ejecutá sql/migration_allow_overnight_shifts.sql en Supabase y volvé a intentar. La migración no borra ni modifica los horarios existentes.'
        : error.message);
      return;
    }

    el.assignmentDialog.close();
    goToView('planner');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la asignación.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar';
    }
  }
}

async function saveBulkAssignments(event) {
  event.preventDefault();

  const workerInput = $('bulkAssignmentWorker');
  const serviceInput = $('bulkAssignmentService');
  const startInput = $('bulkAssignmentStart');
  const endInput = $('bulkAssignmentEnd');
  const notesInput = $('bulkAssignmentNotes');

  if (!workerInput || !serviceInput || !startInput || !endInput) {
    alert('Faltan campos del formulario de carga rápida.');
    return;
  }

  const selectedDays = [...document.querySelectorAll('.bulk-day:checked')].map((input) =>
    Number(input.value)
  );

  if (!selectedDays.length) {
    alert('Seleccioná al menos un día.');
    return;
  }

  if (!startInput.value || !endInput.value) {
    alert('Completá horario de inicio y fin.');
    return;
  }

  if (calculateShiftMinutes(startInput.value, endInput.value) <= 0) {
    alert('La hora de inicio y la hora de finalización no pueden ser iguales.');
    return;
  }

  const overnightMessage = buildOvernightConfirmation(selectedDays, startInput.value, endInput.value);
  if (overnightMessage && !confirm(overnightMessage)) return;

  const submitBtn = el.bulkAssignmentForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const payload = selectedDays.map((day) => ({
      worker_id: workerInput.value,
      service_id: serviceInput.value,
      day_of_week: day,
      start_time: startInput.value,
      end_time: endInput.value,
      notes: notesInput?.value.trim() || null,
      is_active: true,
    }));

    markLocalMutation();

    const { error } = await withTimeout(
      supabase.from('assignments').insert(payload),
      12000,
      'Guardar carga rápida tardó demasiado.'
    );

    if (error) {
      console.error(error);
      const errorMessage = String(error.message || '');
      alert(errorMessage.includes('valid_shift')
        ? 'La base de datos todavía bloquea los turnos nocturnos. Ejecutá sql/migration_allow_overnight_shifts.sql en Supabase y volvé a intentar. La migración no borra ni modifica los horarios existentes.'
        : error.message);
      return;
    }

    el.bulkAssignmentDialog.close();
    goToView('planner');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la carga rápida.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Crear asignaciones';
    }
  }
}

async function saveAbsence(event) {
  event.preventDefault();

  const absenceId = $('absenceId').value.trim();
  const assignmentId = $('absenceAssignmentId').value.trim();
  const absenceDate = $('absenceDate')?.value;
  const workerId = $('absenceWorker')?.value;
  const serviceId = $('absenceService')?.value;
  const scheduledStart = $('absenceScheduledStart')?.value || null;
  const scheduledEnd = $('absenceScheduledEnd')?.value || null;
  const absenceType = $('absenceType')?.value || null;
  const coverageStatus = $('absenceCoverageStatus')?.value || 'uncovered';
  const coverageWorkerId = $('absenceCoverageWorker')?.value || null;
  const coverageDate = $('absenceCoverageDate')?.value || null;
  const coverageStart = $('absenceCoverageStart')?.value || null;
  const coverageEnd = $('absenceCoverageEnd')?.value || null;
  const notes = $('absenceNotes')?.value.trim() || null;

  if (!absenceDate || !workerId || !serviceId) {
    alert('Completá fecha, operario y servicio.');
    return;
  }

  const dayOfWeek = getDateKeyDayOfWeek(absenceDate);
  if (dayOfWeek == null) {
    alert('La fecha de ausencia no es válida.');
    return;
  }

  if ((coverageStatus === 'covered' || coverageStatus === 'partial') && (!coverageWorkerId || !coverageDate || !coverageStart || !coverageEnd)) {
    alert('Completá quién cubrió, fecha y horario de cobertura.');
    return;
  }

  if (coverageStart && coverageEnd && calculateHours(coverageStart, coverageEnd) <= 0) {
    alert('El horario de cobertura no es válido: inicio y fin no pueden ser iguales.');
    return;
  }

  if (scheduledStart && scheduledEnd && calculateHours(scheduledStart, scheduledEnd) <= 0) {
    alert('El horario asignado no es válido: inicio y fin no pueden ser iguales.');
    return;
  }

  const submitBtn = el.absenceForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
  }

  try {
    await ensureWriteSession();

    const payload = {
      assignment_id: assignmentId || null,
      worker_id: workerId,
      service_id: serviceId,
      absence_date: absenceDate,
      day_of_week: dayOfWeek,
      scheduled_start_time: scheduledStart || null,
      scheduled_end_time: scheduledEnd || null,
      absence_type: absenceType,
      coverage_status: coverageStatus,
      coverage_worker_id: coverageStatus === 'uncovered' ? null : coverageWorkerId,
      coverage_date: coverageStatus === 'uncovered' ? null : coverageDate,
      coverage_start_time: coverageStatus === 'uncovered' ? null : coverageStart,
      coverage_end_time: coverageStatus === 'uncovered' ? null : coverageEnd,
      notes,
    };

    const request = absenceId
      ? supabase.from('absences').update(payload).eq('id', absenceId)
      : supabase.from('absences').insert(payload);

    markLocalMutation();

    const { error } = await withTimeout(
      request,
      12000,
      'Guardar ausencia tardó demasiado.'
    );

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    el.absenceDialog.close();
    if (el.absenceDateFilter) el.absenceDateFilter.value = absenceDate;
    if (el.absenceMonthFilter) el.absenceMonthFilter.value = getMonthKey(absenceDate);
    goToView('absences');
    await loadAllDataWithRetry(3, 300, { hardLock: false, silent: false });
  } catch (error) {
    console.error(error);
    alert(error.message || 'No se pudo guardar la ausencia.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Guardar ausencia';
    }
  }
}

async function deleteAbsenceById(absenceId, options = {}) {
  if (!ensureDataReady('eliminar la ausencia')) return;

  const normalizedAbsenceId = String(absenceId || '').trim();
  if (!normalizedAbsenceId) return;

  const shouldConfirm = options.confirm !== false;
  if (shouldConfirm && !confirm('¿Eliminar esta ausencia?')) return;

  markLocalMutation();

  const { error } = await supabase.from('absences').delete().eq('id', normalizedAbsenceId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  if (options.closeDialog !== false) {
    el.absenceDialog?.close();
  }

  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

async function deleteAbsence() {
  const absenceId = $('absenceId').value.trim();
  if (!absenceId) return;
  await deleteAbsenceById(absenceId, { closeDialog: true });
}


async function deleteWorker() {
  if (!ensureDataReady('eliminar el operario')) return;

  const workerId = $('workerId').value.trim();
  if (!workerId) return;

  const hasAssignments = state.assignments.some((item) => item.worker_id === workerId);
  if (hasAssignments) {
    alert('No podés eliminar este operario porque todavía tiene asignaciones activas. Primero mové o eliminá esas asignaciones.');
    return;
  }

  if (!confirm('¿Eliminar este operario?')) return;

  markLocalMutation();

  const { error } = await supabase.from('workers').delete().eq('id', workerId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.workerDialog.close();
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

async function deleteService() {
  if (!ensureDataReady('eliminar el servicio')) return;

  const serviceId = $('serviceId').value.trim();
  if (!serviceId) return;

  const hasAssignments = state.assignments.some((item) => item.service_id === serviceId);
  if (hasAssignments) {
    alert('No podés eliminar este servicio porque todavía tiene asignaciones activas. Primero eliminá o mové esas asignaciones.');
    return;
  }

  if (!confirm('¿Eliminar este servicio?')) return;

  markLocalMutation();

  const { error } = await supabase.from('services').delete().eq('id', serviceId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.serviceDialog.close();
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

async function deleteAssignment() {
  if (!ensureDataReady('eliminar la asignación')) return;

  const assignmentId = $('assignmentId').value.trim();
  if (!assignmentId) return;

  if (!confirm('¿Eliminar esta asignación del planner?')) return;

  markLocalMutation();

  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.assignmentDialog.close();
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
}

function handleDynamicClicks(event) {
  const viewWorkerBtn = event.target.closest('[data-view-worker]');
  if (viewWorkerBtn) {
    goToWorkerPlanner(viewWorkerBtn.dataset.viewWorker);
    return;
  }

  const focusAbsenceWorkerBtn = event.target.closest('[data-focus-absence-worker]');
  if (focusAbsenceWorkerBtn) {
    goToAbsenceWorkerHistory(focusAbsenceWorkerBtn.dataset.focusAbsenceWorker);
    return;
  }

  const editServiceMaterialBtn = event.target.closest('[data-edit-service-material]');
  if (editServiceMaterialBtn) {
    openServiceMaterialDialog({ serviceMaterialId: editServiceMaterialBtn.dataset.editServiceMaterial });
    return;
  }

  const logServiceMaterialBtn = event.target.closest('[data-log-service-material]');
  if (logServiceMaterialBtn) {
    openMaterialConsumptionDialog({ prefillServiceMaterialId: logServiceMaterialBtn.dataset.logServiceMaterial });
    return;
  }

  const editMaterialConsumptionBtn = event.target.closest('[data-edit-material-consumption]');
  if (editMaterialConsumptionBtn) {
    openMaterialConsumptionDialog({ consumptionId: editMaterialConsumptionBtn.dataset.editMaterialConsumption });
    return;
  }

  const markAbsenceBtn = event.target.closest('[data-mark-absence]');
  if (markAbsenceBtn) {
    openAbsenceDialog({
      assignmentId: markAbsenceBtn.dataset.markAbsence,
      absenceDate: markAbsenceBtn.dataset.absenceDate || '',
    });
    return;
  }

  const markTardinessBtn = event.target.closest('[data-mark-tardiness]');
  if (markTardinessBtn) {
    openTardinessDialog({
      assignmentId: markTardinessBtn.dataset.markTardiness,
      tardinessDate: markTardinessBtn.dataset.tardinessDate || '',
    });
    return;
  }

  const editAbsenceBtn = event.target.closest('[data-edit-absence]');
  if (editAbsenceBtn) {
    openAbsenceDialog({ absenceId: editAbsenceBtn.dataset.editAbsence });
    return;
  }

  const deleteAbsenceBtn = event.target.closest('[data-delete-absence]');
  if (deleteAbsenceBtn) {
    deleteAbsenceById(deleteAbsenceBtn.dataset.deleteAbsence);
    return;
  }

  const editTardinessBtn = event.target.closest('[data-edit-tardiness]');
  if (editTardinessBtn) {
    openTardinessDialog({ tardinessId: editTardinessBtn.dataset.editTardiness });
    return;
  }

  const deleteTardinessBtn = event.target.closest('[data-delete-tardiness]');
  if (deleteTardinessBtn) {
    deleteTardinessById(deleteTardinessBtn.dataset.deleteTardiness);
    return;
  }

  const focusTardinessWorkerBtn = event.target.closest('[data-focus-tardiness-worker]');
  if (focusTardinessWorkerBtn) {
    if (el.tardinessWorkerHistoryFilter) {
      el.tardinessWorkerHistoryFilter.value = focusTardinessWorkerBtn.dataset.focusTardinessWorker;
    }
    resetPagination('tardinessEmployeeHistory');
    scheduleRenderCurrentView();
    return;
  }

  const workerBtn = event.target.closest('[data-edit-worker]');
  if (workerBtn) {
    openWorkerDialog(workerBtn.dataset.editWorker);
    return;
  }

  const serviceBtn = event.target.closest('[data-edit-service]');
  if (serviceBtn) {
    openServiceDialog(serviceBtn.dataset.editService);
    return;
  }

  const optimizerCandidateBtn = event.target.closest('[data-optimizer-use-candidate]');
  if (optimizerCandidateBtn) {
    prepareOptimizerAssignment(optimizerCandidateBtn.dataset.optimizerUseCandidate);
    return;
  }

  const proximityWorkerBtn = event.target.closest('[data-proximity-show-worker]');
  if (proximityWorkerBtn) {
    showProximityWorker(proximityWorkerBtn.dataset.proximityShowWorker);
    return;
  }

  const proximityMapWorkerBtn = event.target.closest('[data-proximity-map-worker]');
  if (proximityMapWorkerBtn) {
    openProximityMap('worker', proximityMapWorkerBtn.dataset.proximityMapWorker);
    return;
  }

  const proximityMapServiceBtn = event.target.closest('[data-proximity-map-service]');
  if (proximityMapServiceBtn) {
    openProximityMap('service', proximityMapServiceBtn.dataset.proximityMapService);
    return;
  }

  const addBillingRuleBtn = event.target.closest('[data-add-billing-rule-service]');
  if (addBillingRuleBtn) {
    openBillingRuleDialog(addBillingRuleBtn.dataset.addBillingRuleService);
    return;
  }

  const addBillingAdjustmentBtn = event.target.closest('[data-add-billing-adjustment-service]');
  if (addBillingAdjustmentBtn) {
    openBillingAdjustmentDialog(addBillingAdjustmentBtn.dataset.addBillingAdjustmentService);
    return;
  }

  const editFinalBillingBtn = event.target.closest('[data-edit-final-billing-service]');
  if (editFinalBillingBtn) {
    openFinalBillingDialog(editFinalBillingBtn.dataset.editFinalBillingService);
    return;
  }

  const editBillingRuleBtn = event.target.closest('[data-edit-billing-rule]');
  if (editBillingRuleBtn) {
    const rule = state.billingRules.find((item) => item.id === editBillingRuleBtn.dataset.editBillingRule);
    openBillingRuleDialog(rule?.service_id || '', rule?.id || '');
    return;
  }

  const deleteBillingRuleBtn = event.target.closest('[data-delete-billing-rule]');
  if (deleteBillingRuleBtn) {
    deleteBillingRule(deleteBillingRuleBtn.dataset.deleteBillingRule);
    return;
  }

  const deleteBillingAdjustmentBtn = event.target.closest('[data-delete-billing-adjustment]');
  if (deleteBillingAdjustmentBtn) {
    deleteBillingAdjustment(deleteBillingAdjustmentBtn.dataset.deleteBillingAdjustment);
    return;
  }

  const assignmentBtn = event.target.closest('[data-edit-assignment]');
  if (assignmentBtn) {
    openAssignmentDialog(assignmentBtn.dataset.editAssignment);
  }
}

function getCurrentViewTitle() {
  const titles = {
    dashboard: 'Dashboard',
    workers: 'Operarios',
    services: 'Servicios',
    billing: 'Facturación mensual',
    planner: 'Planner semanal',
    map: 'Mapa',
    optimizer: 'Optimizador',
    proximity: 'Optimizador de cercanía',
    absences: 'Ausencias',
    materials: 'Materiales',
  };
  return titles[state.currentView] || 'Vista';
}

function getCurrentViewElement() {
  return $(VIEW_IDS[state.currentView]);
}

function buildDashboardExportData() {
  const summaries = getWorkerSummaries({ applyFilters: false });
  const workforceBalance = getWorkforceMonthlyBalance(getSelectedDashboardMonth(), summaries);
  const availableWorkers = summaries.filter((worker) => worker.status === 'available').length;
  const overloadedWorkers = summaries.filter((worker) => worker.status === 'over').length;
  const uncoveredServices = getUncoveredServices();
  const hoursBalance = getOverallServiceHoursBalance();
  const monthLabel = formatMonthLabel(hoursBalance.monthKey);
  const criticalWorkers = summaries
    .filter((worker) => worker.status === 'available' || worker.status === 'over')
    .sort((a, b) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0));

  return {
    sheets: [
      {
        name: 'KPIs',
        rows: [
          ['Métrica', 'Valor'],
          ['Mes de análisis', monthLabel],
          ['Operarios visibles', summaries.length],
          ['Objetivo mensual de jornadas fijas', workforceBalance.totalTargetHours],
          ['Horas asignadas a personal por hora / seguro', workforceBalance.hourlyAssignedHours],
          ['Referencia total de horas a pagar', workforceBalance.payrollReferenceHours],
          ['Horas asignadas mensuales de toda la dotación', workforceBalance.totalAssignedHours],
          ['Desvío asignación vs objetivo fijo', workforceBalance.assignmentDifference],
          ['Facturación mensual ajustada', hoursBalance.totalBilledHours],
          ['Saldo facturación vs referencia de nómina', workforceBalance.commercialDifference],
          ['Horas operativas mensuales en servicios cargados', hoursBalance.assignedHoursOnConfiguredServices],
          ['Balance mensual: operativas - facturadas', hoursBalance.difference],
          ['Servicios con proyección pendiente', hoursBalance.pending.length],
          ['Operarios a los que les faltan horas', availableWorkers],
          ['Operarios por encima del objetivo', overloadedWorkers],
          ['Servicios sin cobertura', uncoveredServices.length],
        ],
      },
      {
        name: 'Balance servicios',
        rows: [
          ['Mes de análisis', 'Servicio', 'Zona', 'Facturación ajustada', 'Horas operativas mensuales', 'Diferencia', 'Estado'],
          ...hoursBalance.summaries.map((service) => [
            monthLabel,
            service.name,
            service.zone || '',
            service.billedHours == null ? 'Pendiente' : service.billedHours,
            service.assignedHours,
            service.difference == null ? '' : service.difference,
            service.status,
          ]),
        ],
      },
      {
        name: 'Operarios críticos',
        rows: [
          ['Operario', 'Tipo', 'Objetivo semanal', 'Asignadas semanales', 'Objetivo mensual', 'Asignadas mensuales', 'Diferencia mensual', 'Estado'],
          ...criticalWorkers.map((worker) => [
            worker.name,
            TYPE_META[worker.worker_type].label,
            worker.targetHours == null ? 'SEGURO' : worker.targetHours,
            worker.totalHours,
            worker.monthlyTargetHours == null ? 'POR HORA' : worker.monthlyTargetHours,
            worker.monthlyHours,
            worker.monthlyDifference == null ? 'POR HORA' : worker.monthlyDifference,
            worker.status,
          ]),
        ],
      },
      {
        name: 'Servicios sin cobertura',
        rows: [
          ['Servicio', 'Zona', 'Dirección', 'Supervisor', 'Frecuencia'],
          ...uncoveredServices.map((service) => [
            service.name,
            service.zone || '',
            service.client_address || '',
            service.supervisor_name || '',
            service.frequency_type || '',
          ]),
        ],
      },
    ],
  };
}

function buildWorkersExportData() {
  const summaries = getWorkerSummaries();

  return {
    sheets: [
      {
        name: 'Operarios',
        rows: [
          ['Operario', 'Tipo', 'Fecha de ingreso', 'Domicilio de referencia', 'Zona de residencia', 'Coordenadas', 'Mes de análisis', 'Horas objetivo semanales', 'Horas asignadas semanales', 'Diferencia semanal', 'Horas objetivo mensuales', 'Horas asignadas mensuales', 'Diferencia mensual', 'Estado mensual', 'Servicios'],
          ...summaries.map((worker) => [
            worker.name,
            TYPE_META[worker.worker_type].label,
            worker.hire_date ? formatDateLabel(worker.hire_date) : '',
            worker.home_address || '',
            worker.home_zone || '',
            formatCoordinates(worker),
            formatMonthLabel(getSelectedDashboardMonth()),
            worker.targetHours == null ? 'SEGURO' : worker.targetHours,
            worker.totalHours,
            worker.weeklyDifference == null ? 'SEGURO' : worker.weeklyDifference,
            worker.monthlyTargetHours == null ? 'POR HORA' : worker.monthlyTargetHours,
            worker.monthlyHours,
            worker.monthlyDifference == null ? 'POR HORA' : worker.monthlyDifference,
            worker.status,
            worker.services.map((service) => service.name).join(' | ') || 'Sin servicio',
          ]),
        ],
      },
      {
        name: 'Disponibilidad',
        rows: [
          ['Operario', 'Día', 'Horario', 'Servicio'],
          ...summaries.flatMap((worker) => {
            const rows = [];
            DAYS.forEach((day) => {
              const dayItems = worker.assignments.filter((item) => item.day_of_week === day.value);
              if (!dayItems.length) {
                rows.push([worker.name, day.fullLabel, 'Libre', '']);
                return;
              }
              dayItems.forEach((item) => {
                const service = getServiceById(item.service_id);
                rows.push([
                  worker.name,
                  day.fullLabel,
                  `${formatShiftRange(item.start_time, item.end_time)}`,
                  service?.name || '',
                ]);
              });
            });
            return rows;
          }),
        ],
      },
    ],
  };
}

function buildServicesExportData() {
  const services = getFilteredServices();
  const monthKey = getSelectedDashboardMonth();
  const monthLabel = formatMonthLabel(monthKey);

  return {
    sheets: [
      {
        name: 'Servicios',
        rows: [
          ['Mes de análisis', 'Servicio', 'Dirección', 'Zona', 'Coordenadas', 'Supervisor', 'Frecuencia', 'Facturación ajustada', 'Horas operativas mensuales', 'Diferencia', 'Estado horas', 'Notas', 'Cobertura activa'],
          ...services.map((service) => {
            const summary = getServiceHoursSummary(service, monthKey);
            return [
              monthLabel,
              service.name,
              service.client_address || '',
              service.zone || '',
              formatCoordinates(service),
              service.supervisor_name || '',
              service.frequency_type || '',
              summary.billedHours == null ? 'Pendiente' : summary.billedHours,
              summary.assignedHours,
              summary.difference == null ? '' : summary.difference,
              summary.status,
              service.notes || '',
              summary.assignments.length,
            ];
          }),
        ],
      },
      {
        name: 'Cobertura por día',
        rows: [
          ['Servicio', 'Día', 'Operario', 'Supervisor', 'Horario'],
          ...services.flatMap((service) => {
            const assignments = getServiceAssignments(service.id);
            const rows = [];
            DAYS.forEach((day) => {
              const dayItems = assignments.filter((item) => item.day_of_week === day.value);
              if (!dayItems.length) {
                rows.push([service.name, day.fullLabel, 'Sin cobertura', service.supervisor_name || '', '']);
                return;
              }
              dayItems.forEach((item) => {
                const worker = getWorkerById(item.worker_id);
                rows.push([
                  service.name,
                  day.fullLabel,
                  worker?.name || '',
                  service.supervisor_name || '',
                  `${formatShiftRange(item.start_time, item.end_time)}`,
                ]);
              });
            });
            return rows;
          }),
        ],
      },
    ],
  };
}



function buildBillingExportData() {
  const monthKey = getSelectedBillingMonth();
  const monthLabel = formatMonthLabel(monthKey);
  const summaries = state.services.map((service) => getServiceHoursSummary(service, monthKey));
  return {
    sheets: [
      {
        name: 'Resumen facturación',
        rows: [
          ['Mes', 'Servicio', 'Fuente', 'Proyección base', 'Ajustes', 'Facturación ajustada', 'Horas operativas', 'Diferencia operativa - facturable'],
          ...summaries.map((item) => [
            monthLabel,
            item.name,
            formatBillingSource(item.billingForecast.source),
            item.projectedBilledHours == null ? 'Pendiente' : item.projectedBilledHours,
            item.billingAdjustmentsHours,
            item.billedHours == null ? 'Pendiente' : item.billedHours,
            item.assignedHours,
            item.difference == null ? '' : item.difference,
          ]),
        ],
      },
      {
        name: 'Reglas de cobertura',
        rows: [
          ['Servicio', 'Bloque', 'Días', 'Horario', 'Puestos simultáneos', 'Vigente desde', 'Vigente hasta', 'Horas proyectadas en el mes', 'Notas'],
          ...state.billingRules.map((rule) => [
            getServiceById(rule.service_id)?.name || '',
            rule.rule_name || '',
            formatBillingDays(rule.days_of_week),
            formatShiftRange(rule.start_time, rule.end_time),
            rule.positions,
            rule.valid_from || '',
            rule.valid_until || '',
            calculateBillingRuleHours(rule, monthKey),
            rule.notes || '',
          ]),
        ],
      },
      {
        name: 'Novedades',
        rows: [
          ['Fecha', 'Servicio', 'Tipo', 'Horas', 'Motivo', 'Notas'],
          ...state.billingAdjustments
            .filter((item) => getMonthKey(item.adjustment_date) === monthKey)
            .map((item) => [
              item.adjustment_date,
              getServiceById(item.service_id)?.name || '',
              getBillingAdjustmentTypeLabel(item.adjustment_type),
              item.hours_delta,
              item.reason || '',
              getBillingAdjustmentVisibleNotes(item),
            ]),
        ],
      },
    ],
  };
}

function buildMapExportData() {
  const mapped = getAllMapEntities().filter((item) => item.coordinates);
  const missing = getAllMapEntities().filter((item) => !item.coordinates);
  return {
    sheets: [
      {
        name: 'Ubicaciones',
        rows: [
          ['Tipo', 'Nombre', 'Zona', 'Dirección', 'Latitud', 'Longitud', 'Vínculos activos'],
          ...mapped.map(({ type, entity, coordinates }) => {
            const links = type === 'worker'
              ? new Set(getWorkerAssignments(entity.id).map((assignment) => assignment.service_id)).size
              : new Set(getServiceAssignments(entity.id).map((assignment) => assignment.worker_id)).size;
            return [
              type === 'worker' ? 'Operario' : 'Servicio',
              entity.name,
              getMapEntityZone(type, entity),
              getMapEntityAddress(type, entity),
              coordinates.latitude,
              coordinates.longitude,
              links,
            ];
          }),
        ],
      },
      {
        name: 'Sin coordenadas',
        rows: [
          ['Tipo', 'Nombre', 'Zona', 'Dirección'],
          ...missing.map(({ type, entity }) => [
            type === 'worker' ? 'Operario' : 'Servicio',
            entity.name,
            getMapEntityZone(type, entity),
            getMapEntityAddress(type, entity),
          ]),
        ],
      },
    ],
  };
}

function buildPlannerExportData() {
  const searchTerm = state.filters.search;
  const filteredAssignments = state.assignments.filter((assignment) => {
    if (!searchTerm) return true;
    const hay = state.derived.assignmentSearchById.get(assignment.id) || '';
    return matchesSearchText(hay, searchTerm);
  });

  return {
    sheets: [
      {
        name: 'Planner',
        rows: [
          ['Día', 'Servicio', 'Operario', 'Supervisor', 'Horario', 'Notas'],
          ...filteredAssignments.map((item) => {
            const worker = getWorkerById(item.worker_id);
            const service = getServiceById(item.service_id);
            const day = DAYS.find((d) => d.value === item.day_of_week);
            return [
              day?.fullLabel || '',
              service?.name || '',
              worker?.name || '',
              service?.supervisor_name || '',
              `${formatShiftRange(item.start_time, item.end_time)}`,
              item.notes || '',
            ];
          }),
        ],
      },
    ],
  };
}

function buildAbsencesExportData() {
  const period = getAbsenceActivePeriod();
  const referenceDateKey = period.endKey || getSelectedAbsenceDate();
  const monthKey = period.monthKey || getMonthKey(referenceDateKey);
  const monthLabel = formatMonthLabel(monthKey);

  const scheduleRows = getAssignmentOccurrencesForPeriod(period).map((occurrence) => {
    const worker = getWorkerById(occurrence.worker_id);
    const service = getServiceById(occurrence.service_id);
    const absence = findAbsenceForAssignmentOnDate(occurrence, occurrence.occurrence_date);
    const tardiness = findTardinessForAssignmentOnDate(occurrence, occurrence.occurrence_date);
    const tardinessMinutes = tardiness ? (tardiness.minutes_late ?? calculateMinutesLate(tardiness.scheduled_start_time, tardiness.actual_arrival_time)) : '';

    return [
      formatDateLabel(occurrence.occurrence_date),
      DAYS.find((day) => day.value === occurrence.day_of_week)?.fullLabel || '',
      service?.name || '',
      worker?.name || '',
      worker?.hire_date ? formatDateLabel(worker.hire_date) : '',
      `${formatShiftRange(occurrence.start_time, occurrence.end_time)}`,
      absence ? 'Sí' : 'No',
      absence ? formatAbsenceTypeLabel(absence.absence_type) : '',
      absence ? absence.coverage_status : '',
      tardiness ? 'Sí' : 'No',
      tardinessMinutes === '' ? '' : tardinessMinutes,
    ];
  });

  const absencesForPeriod = getFilteredAbsencesForPeriod(period).map((absence) => {
    const worker = getWorkerById(absence.worker_id);
    const service = getServiceById(absence.service_id);
    const coverageWorker = absence.coverage_worker_id ? getWorkerById(absence.coverage_worker_id) : null;
    const coveredHours = calculateCoverageHours(absence);
    const stats = getWorkerAbsenceStats(worker, absence.absence_date);

    return [
      formatDateLabel(absence.absence_date),
      worker?.name || '',
      worker?.hire_date ? formatDateLabel(worker.hire_date) : '',
      formatAbsenceTypeLabel(absence.absence_type),
      service?.name || '',
      absence.scheduled_start_time && absence.scheduled_end_time
        ? `${formatShiftRange(absence.scheduled_start_time, absence.scheduled_end_time)}`
        : '',
      absence.coverage_status,
      coverageWorker?.name || '',
      absence.coverage_date ? formatDateLabel(absence.coverage_date) : '',
      absence.coverage_start_time && absence.coverage_end_time
        ? `${formatShiftRange(absence.coverage_start_time, absence.coverage_end_time)}`
        : '',
      coveredHours == null ? '' : coveredHours,
      stats?.absenceCount ?? '',
      stats?.annualizedPercent ?? '',
      stats?.calendarYearPercent ?? '',
      stats?.projectedAnnualAbsences ?? '',
      absence.notes || '',
    ];
  });

  const annualTracking = getFilteredWorkerAbsenceStats(referenceDateKey).map((item) => [
    item.worker?.name || '',
    TYPE_META[item.worker?.worker_type]?.label || '',
    item.worker?.hire_date ? formatDateLabel(item.worker.hire_date) : '',
    item.periodStartKey ? formatDateLabel(item.periodStartKey) : '',
    formatDateLabel(referenceDateKey),
    item.elapsedDays,
    item.absenceCount,
    item.actualPercent == null ? '' : item.actualPercent,
    item.calendarYearPercent == null ? '' : item.calendarYearPercent,
    item.projectedAnnualAbsences == null ? '' : item.projectedAnnualAbsences,
    item.remainingAbsencesToThreshold == null ? '' : item.remainingAbsencesToThreshold,
    item.hireDateMissing ? 'Falta fecha de ingreso' : item.startedYet ? (item.annualizedPercent >= 3 ? 'Superó 3%' : item.annualizedPercent >= 2 ? 'En seguimiento' : 'Dentro del criterio') : 'Ingreso posterior',
  ]);

  const historyWorkerId = getSelectedAbsenceHistoryWorkerId();
  const historyRows = buildAbsenceTimelineEntries(historyWorkerId)
    .filter((entry) => !period?.startKey || !period?.endKey || (entry.dateKey >= period.startKey && entry.dateKey <= period.endKey))
    .map((entry) => [
      entry.worker?.name || '',
      entry.worker?.hire_date ? formatDateLabel(entry.worker.hire_date) : '',
      formatDateLabel(entry.dateKey),
      formatAbsenceTypeLabel(entry.absenceType),
      entry.serviceNames.join(' | '),
      entry.coverageStatus,
      entry.coveredWorkerNames.join(' | '),
      entry.totalScheduledHours,
      entry.totalCoveredHours,
      entry.totalUncoveredHours,
      entry.cumulativeAbsences,
      entry.cumulativePercent == null ? '' : entry.cumulativePercent,
      entry.projectedAnnualAbsences == null ? '' : entry.projectedAnnualAbsences,
    ]);

  const monthlyServiceRows = getFilteredAbsencesForMonth(monthKey).map((absence) => {
    const service = getServiceById(absence.service_id);
    return [
      service?.name || '',
      'Sí',
      formatDateLabel(absence.absence_date),
      absence.coverage_status,
    ];
  });

  const monthlyWorkerRows = buildMonthlyWorkerClosureRows(monthKey);

  const tardinessRows = getFilteredTardinessesForPeriod(period).map((tardiness) => {
    const worker = getWorkerById(tardiness.worker_id);
    const service = getServiceById(tardiness.service_id);
    const stats = getWorkerTardinessStats(worker, tardiness.tardiness_date);
    const minutesLate = tardiness.minutes_late ?? calculateMinutesLate(tardiness.scheduled_start_time, tardiness.actual_arrival_time);

    return [
      formatDateLabel(tardiness.tardiness_date),
      worker?.name || '',
      worker?.hire_date ? formatDateLabel(worker.hire_date) : '',
      service?.name || '',
      tardiness.scheduled_start_time ? tardiness.scheduled_start_time.slice(0, 5) : '',
      tardiness.actual_arrival_time ? tardiness.actual_arrival_time.slice(0, 5) : '',
      minutesLate == null ? '' : minutesLate,
      stats?.tardinessCount ?? '',
      stats?.annualizedPercent ?? '',
      stats?.calendarYearPercent ?? '',
      stats?.projectedAnnualTardinesses ?? '',
      tardiness.notes || '',
    ];
  });

  const tardinessTrackingRows = getFilteredWorkerTardinessStats(referenceDateKey).map((item) => [
    item.worker?.name || '',
    TYPE_META[item.worker?.worker_type]?.label || '',
    item.worker?.hire_date ? formatDateLabel(item.worker.hire_date) : '',
    item.periodStartKey ? formatDateLabel(item.periodStartKey) : '',
    formatDateLabel(referenceDateKey),
    item.elapsedDays,
    item.tardinessCount,
    item.annualizedPercent == null ? '' : item.annualizedPercent,
    item.calendarYearPercent == null ? '' : item.calendarYearPercent,
    item.projectedAnnualTardinesses == null ? '' : item.projectedAnnualTardinesses,
    item.hireDateMissing ? 'Falta fecha de ingreso' : item.startedYet ? (item.status === 'high' ? 'Tardanza alta' : item.status === 'medium' ? 'En seguimiento' : 'Tardanza baja') : 'Ingreso posterior',
  ]);

  const tardinessHistoryWorkerId = getSelectedTardinessHistoryWorkerId();
  const tardinessHistoryRows = buildTardinessTimelineEntries(tardinessHistoryWorkerId, period).map((entry) => [
    entry.worker?.name || '',
    entry.worker?.hire_date ? formatDateLabel(entry.worker.hire_date) : '',
    formatDateLabel(entry.tardiness.tardiness_date),
    entry.service?.name || '',
    entry.tardiness.scheduled_start_time ? entry.tardiness.scheduled_start_time.slice(0, 5) : '',
    entry.tardiness.actual_arrival_time ? entry.tardiness.actual_arrival_time.slice(0, 5) : '',
    entry.minutesLate == null ? '' : entry.minutesLate,
    entry.cumulativeTardinesses,
    entry.cumulativeAnnualizedPercent == null ? '' : entry.cumulativeAnnualizedPercent,
    entry.cumulativeCalendarYearPercent == null ? '' : entry.cumulativeCalendarYearPercent,
    entry.projectedAnnualTardinesses == null ? '' : entry.projectedAnnualTardinesses,
    entry.tardiness.notes || '',
  ]);

  return {
    sheets: [
      {
        name: 'Programacion',
        rows: [
          ['Fecha', 'Día', 'Servicio', 'Operario', 'Fecha ingreso', 'Horario', 'Ausencia registrada', 'Tipo falta', 'Estado ausencia', 'Tardanza registrada', 'Minutos tarde'],
          ...scheduleRows,
        ],
      },
      {
        name: 'Ausencias',
        rows: [
          ['Fecha', 'Operario ausente', 'Fecha ingreso', 'Tipo falta', 'Servicio', 'Horario asignado', 'Resultado', 'Operario cobertura', 'Fecha cobertura', 'Horario cobertura', 'Horas cubiertas', 'Faltas acumuladas a esa fecha', '% anualizado a esa fecha', '% año calendario', 'Proyección anual', 'Notas'],
          ...absencesForPeriod,
        ],
      },
      {
        name: 'Seguimiento anual',
        rows: [
          ['Operario', 'Tipo', 'Fecha ingreso', 'Inicio de cálculo', 'Fecha analizada', 'Días computados', 'Faltas acumuladas', '% anualizado', '% año calendario', 'Proyección anual', 'Margen hasta 3%', 'Estado'],
          ...annualTracking,
        ],
      },
      {
        name: 'Historial operario',
        rows: [
          ['Operario', 'Fecha ingreso', 'Fecha falta', 'Tipo falta', 'Servicios afectados', 'Resultado', 'Cubrió', 'Horas afectadas', 'Horas cubiertas', 'Horas descubiertas', 'Acumulado a esa fecha', '% anualizado a esa fecha', 'Proyección anual'],
          ...historyRows,
        ],
      },
      {
        name: 'Tardanzas',
        rows: [
          ['Fecha', 'Operario', 'Fecha ingreso', 'Servicio', 'Hora prevista', 'Hora llegada', 'Minutos tarde', 'Tardanzas acumuladas a esa fecha', '% anualizado a esa fecha', '% año calendario', 'Proyección anual', 'Notas'],
          ...tardinessRows,
        ],
      },
      {
        name: 'Seguimiento tardanzas',
        rows: [
          ['Operario', 'Tipo', 'Fecha ingreso', 'Inicio de cálculo', 'Fecha analizada', 'Días computados', 'Tardanzas acumuladas', '% anualizado', '% año calendario', 'Proyección anual', 'Estado'],
          ...tardinessTrackingRows,
        ],
      },
      {
        name: 'Historial tardanzas',
        rows: [
          ['Operario', 'Fecha ingreso', 'Fecha', 'Servicio', 'Hora prevista', 'Hora llegada', 'Minutos tarde', 'Acumulado a esa fecha', '% anualizado a esa fecha', '% año calendario', 'Proyección anual', 'Notas'],
          ...tardinessHistoryRows,
        ],
      },
      {
        name: 'cierre servicios mes',
        rows: [
          ['Mes', 'Servicio', 'Ausencia registrada', 'Fecha falta', 'Resultado'],
          ...monthlyServiceRows.map((row) => [monthLabel, ...row]),
        ],
      },
      {
        name: 'cierre operarios mes',
        rows: [
          ['Mes', 'Operario', 'Ausencia registrada total', 'injustificada', 'justificada', 'suspensión', 'horas totales mensuales'],
          ...monthlyWorkerRows.map((row) => [monthLabel, ...row]),
        ],
      },
    ],
  };
}

function buildMaterialsExportData() {
  const monthKey = getSelectedMaterialsMonth();
  const serviceMaterials = getFilteredServiceMaterials();
  const consumptions = getFilteredMaterialConsumptions(monthKey);
  const summary = buildMonthlyMaterialSummary(monthKey);

  return {
    sheets: [
      {
        name: 'Stock por servicio',
        rows: [
          ['Servicio', 'Supervisor', 'Zona', 'Material', 'Unidad', 'Presentación', 'Stock actual', 'Stock mínimo', 'Consumo mes', 'Promedio histórico mensual', 'Notas'],
          ...serviceMaterials.map((item) => {
            const service = getServiceById(item.service_id);
            const material = getMaterialById(item.material_id);
            return [
              service?.name || '',
              service?.supervisor_name || '',
              service?.zone || '',
              material?.name || '',
              material?.unit || '',
              material?.presentation || '',
              item.current_stock ?? '',
              item.minimum_stock ?? '',
              calculateMonthConsumptionForServiceMaterial(item.id, monthKey),
              calculateAverageMonthlyConsumption(item.id),
              item.notes || '',
            ];
          }),
        ],
      },
      {
        name: 'Consumos',
        rows: [
          ['Fecha', 'Mes', 'Servicio', 'Supervisor', 'Material', 'Cantidad', 'Unidad', 'Notas'],
          ...consumptions.map((consumption) => {
            const service = getServiceById(consumption.service_id);
            const material = getMaterialById(consumption.material_id);
            return [
              formatDateLabel(consumption.consumption_date),
              formatMonthLabel(getMonthKey(consumption.consumption_date)),
              service?.name || '',
              service?.supervisor_name || '',
              material?.name || '',
              consumption.quantity,
              material?.unit || '',
              consumption.notes || '',
            ];
          }),
        ],
      },
      {
        name: 'Resumen mensual',
        rows: [
          ['Mes', 'Material', 'Unidad', 'Consumido', 'Servicios con movimiento', 'Promedio histórico mensual', 'Stock total actual'],
          ...summary.map((item) => [
            formatMonthLabel(monthKey),
            item.name,
            item.unit,
            item.totalConsumed,
            item.servicesCount,
            item.averageMonthly,
            item.currentStockTotal,
          ]),
        ],
      },
      {
        name: 'Catalogo',
        rows: [
          ['Material', 'Unidad', 'Presentación', 'Notas'],
          ...state.materials.map((material) => [
            material.name || '',
            material.unit || '',
            material.presentation || '',
            material.notes || '',
          ]),
        ],
      },
    ],
  };
}



function buildOptimizerExportData() {
  const results = state.optimizerResults;
  if (!results) {
    return {
      sheets: [{ name: 'Optimizador', rows: [['Estado'], ['No se ejecutó un análisis.']] }],
    };
  }

  const request = results.request;
  return {
    sheets: [
      {
        name: 'Necesidad',
        rows: [
          ['Campo', 'Valor'],
          ['Servicio', request.name],
          ['Dirección', request.client_address || ''],
          ['Zona', request.zone || ''],
          ['Mes', formatMonthLabel(request.monthKey)],
          ['Horas facturadas mensuales', request.billedMonthlyHours == null ? 'Sin cargar' : request.billedMonthlyHours],
          ['Días', request.days.map((dayValue) => DAYS.find((day) => day.value === dayValue)?.fullLabel || '').join(', ')],
          ['Horario', `${formatShiftRange(request.startTime, request.endTime)}`],
          ['Horas semanales', request.weeklyHours],
          ['Horas mensuales proyectadas', request.monthlyHours],
          ['Margen de traslado', `${request.travelBuffer} min`],
        ],
      },
      {
        name: 'Ranking',
        rows: [
          ['Posición', 'Operario', 'Clasificación', 'Puntaje', 'Horas actuales', 'Horas proyectadas', 'Objetivo', 'Exceso', 'Alertas'],
          ...results.candidates.map((candidate, index) => [
            index + 1,
            candidate.worker.name,
            candidate.classification,
            candidate.score,
            candidate.currentWeeklyHours,
            candidate.projectedWeeklyHours,
            candidate.targetHours == null ? 'Sin objetivo fijo' : candidate.targetHours,
            candidate.overBy,
            candidate.warnings.join(' | '),
          ]),
        ],
      },
      {
        name: 'Descartados',
        rows: [
          ['Operario', 'Motivos'],
          ...results.rejected.map((candidate) => [
            candidate.worker.name,
            candidate.rejectionReasons.join(' | '),
          ]),
        ],
      },
    ],
  };
}


function buildProximityExportData() {
  const results = state.proximityResults;
  if (!results) {
    return { sheets: [{ name: 'Cercania', rows: [['Estado'], ['No se ejecutó un análisis.']] }] };
  }

  return {
    sheets: [
      {
        name: 'Resumen',
        rows: [
          ['Métrica', 'Valor'],
          ['Ahorro mínimo considerado (km directos)', results.settings.minimumSaving],
          ['Exigir mejora para ambos en intercambios', results.settings.bothImprove ? 'Sí' : 'No'],
          ['Operarios ubicados', results.stats.mappedWorkers],
          ['Servicios ubicados', results.stats.mappedServices],
          ['Vínculos actuales medibles', results.stats.measurableRelations],
          ['Distancia actual promedio (km directos)', results.stats.averageCurrentDistance ?? 'Sin datos'],
          ['Operarios con oportunidades', results.stats.workersWithPotential],
          ['Reubicaciones sugeridas', results.relocationSuggestions.length],
          ['Intercambios sugeridos', results.swapSuggestions.length],
        ],
      },
      {
        name: 'Reubicaciones',
        rows: [
          ['Operario', 'Servicio actual', 'Distancia actual km', 'Servicio sugerido', 'Distancia sugerida km', 'Ahorro km', 'Tipo'],
          ...results.relocationSuggestions.map((item) => [
            item.worker.name,
            item.currentService.name,
            item.currentDistance,
            item.suggestedService.name,
            item.suggestedDistance,
            item.savingKm,
            item.directOpportunity ? 'Servicio sin operarios' : 'Requiere reorganización',
          ]),
        ],
      },
      {
        name: 'Intercambios',
        rows: [
          ['Operario A', 'Servicio actual A', 'Servicio sugerido A', 'Ahorro A km', 'Operario B', 'Servicio actual B', 'Servicio sugerido B', 'Ahorro B km', 'Ahorro conjunto km'],
          ...results.swapSuggestions.map((item) => [
            item.first.worker.name,
            item.first.currentService.name,
            item.first.suggestedService.name,
            item.first.savingKm,
            item.second.worker.name,
            item.second.currentService.name,
            item.second.suggestedService.name,
            item.second.savingKm,
            item.totalSaving,
          ]),
        ],
      },
      {
        name: 'Ranking por operario',
        rows: [
          ['Operario', 'Servicio', 'Distancia km', 'Asignación actual', 'Operarios asignados al servicio'],
          ...results.workerAnalyses.flatMap((analysis) => analysis.nearestServices.map((item) => [
            analysis.worker.name,
            item.service.name,
            item.distanceKm,
            item.isCurrent ? 'Sí' : 'No',
            item.assignedWorkersCount,
          ])),
        ],
      },
    ],
  };
}

function buildCurrentExportData() {
  switch (state.currentView) {
    case 'workers':
      return buildWorkersExportData();
    case 'services':
      return buildServicesExportData();
    case 'billing':
      return buildBillingExportData();
    case 'planner':
      return buildPlannerExportData();
    case 'map':
      return buildMapExportData();
    case 'optimizer':
      return buildOptimizerExportData();
    case 'proximity':
      return buildProximityExportData();
    case 'absences':
      return buildAbsencesExportData();
    case 'materials':
      return buildMaterialsExportData();
    case 'dashboard':
    default:
      return buildDashboardExportData();
  }
}

function exportCurrentViewToExcel() {
  if (!ensureDataReady('exportar a Excel')) return;
  if (!window.XLSX) {
    alert('No se cargó la librería de Excel.');
    return;
  }

  const exportData = buildCurrentExportData();
  const wb = window.XLSX.utils.book_new();

  exportData.sheets.forEach((sheet) => {
    const ws = window.XLSX.utils.aoa_to_sheet(sheet.rows);
    window.XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  });

  const filename = `cleanit-${state.currentView}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  window.XLSX.writeFile(wb, filename);
}

async function exportCurrentViewToPdf() {
  if (!ensureDataReady('exportar a PDF')) return;
  if (!window.html2canvas || !window.jspdf?.jsPDF) {
    alert('No se cargaron las librerías de PDF.');
    return;
  }

  const target = getCurrentViewElement();
  if (!target) {
    alert('No se encontró la vista activa para exportar.');
    return;
  }

  const button = el.exportPdfBtn;
  const originalLabel = button?.textContent;

  const originalPaginationState = [];

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Generando PDF...';
    }

    if (state.currentView === 'absences') {
      ['absenceSchedule', 'absenceHistory', 'absenceMonthly', 'absenceTracker', 'absenceEmployeeHistory', 'tardinessHistory', 'tardinessTracker', 'tardinessEmployeeHistory'].forEach((key) => {
        const pagination = state.pagination[key];
        if (!pagination) return;
        originalPaginationState.push([key, pagination.page, pagination.pageSize]);
        pagination.page = 1;
        pagination.pageSize = 5000;
      });
      scheduleRenderCurrentView();
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    }

    const canvas = await window.html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0b1020',
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, usableWidth, imgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    pdf.save(`cleanit-${state.currentView}-${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    console.error(error);
    alert('No se pudo generar el PDF de la vista actual.');
  } finally {
    if (originalPaginationState.length) {
      originalPaginationState.forEach(([key, page, pageSize]) => {
        const pagination = state.pagination[key];
        if (!pagination) return;
        pagination.page = page;
        pagination.pageSize = pageSize;
      });
      scheduleRenderCurrentView();
    }

    if (button) {
      button.disabled = false;
      button.textContent = originalLabel || 'Descargar PDF';
    }
  }
}

function printCurrentView() {
  if (!ensureDataReady('imprimir')) return;
  window.print();
}

function handlePaginationClick(event) {
  const button = event.target.closest('[data-pagination-view][data-pagination-page]');
  if (!button) return;

  const viewKey = button.dataset.paginationView;
  const page = Number(button.dataset.paginationPage);
  if (!viewKey || !page) return;

  setPaginationPage(viewKey, page);
  scheduleRenderCurrentView();
}

const debouncedHandleFilterInput = debounce(handleFilterChange, 180);

function bindEvents() {
  el.loginForm?.addEventListener('submit', handleLogin);
  el.logoutBtn?.addEventListener('click', handleLogout);
  el.installPwaBtn?.addEventListener('click', handlePwaInstall);
  el.refreshBtn?.addEventListener('click', () => loadAllDataWithRetry(4, 500, { hardLock: false, silent: false }));
  el.navTabs?.addEventListener('click', handleViewChange);
  el.globalSearch?.addEventListener('input', handleGlobalSearchInput);
  el.globalSearch?.addEventListener('focus', renderGlobalSearchResults);
  el.globalSearch?.addEventListener('keydown', handleGlobalSearchKeydown);
  el.globalSearchResults?.addEventListener('click', handleGlobalSearchResultClick);
  el.workerTypeFilter?.addEventListener('change', handleFilterChange);
  el.statusFilter?.addEventListener('change', handleFilterChange);
  el.billingMonthFilter?.addEventListener('change', () => {
    state.billingMonth = el.billingMonthFilter.value || getCurrentMonthKey();
    scheduleRenderCurrentView();
  });
  el.addBillingRuleBtn?.addEventListener('click', () => openBillingRuleDialog());
  el.addBillingAdjustmentBtn?.addEventListener('click', () => openBillingAdjustmentDialog());
  el.billingServicesBoard?.addEventListener('click', handleDynamicClicks);
  el.billingRuleForm?.addEventListener('submit', saveBillingRule);
  el.billingAdjustmentForm?.addEventListener('submit', saveBillingAdjustment);
  el.finalBillingForm?.addEventListener('submit', saveFinalBilling);
  $('billingAdjustmentType')?.addEventListener('change', syncBillingAdjustmentImpact);

  const updateAnalysisMonth = (monthValue) => {
    state.dashboardMonth = monthValue || getCurrentMonthKey();
    if (el.dashboardMonthFilter) el.dashboardMonthFilter.value = state.dashboardMonth;
    if (el.workersMonthFilter) el.workersMonthFilter.value = state.dashboardMonth;
    try {
      window.localStorage.setItem('staffPlannerDashboardMonth', state.dashboardMonth);
    } catch (error) {
      // La app sigue funcionando aunque el navegador bloquee el almacenamiento local.
    }
    resetPagination('workers');
    scheduleRenderCurrentView();
  };

  el.dashboardMonthFilter?.addEventListener('change', () => {
    updateAnalysisMonth(el.dashboardMonthFilter.value);
  });
  el.workersMonthFilter?.addEventListener('change', () => {
    updateAnalysisMonth(el.workersMonthFilter.value);
  });
  el.optimizerForm?.addEventListener('submit', handleOptimizerSubmit);
  el.optimizerExistingService?.addEventListener('change', syncOptimizerFromService);
  el.optimizerMonth?.addEventListener('change', updateOptimizerWorkloadPreview);
  el.optimizerStart?.addEventListener('input', updateOptimizerWorkloadPreview);
  el.optimizerEnd?.addEventListener('input', updateOptimizerWorkloadPreview);
  document.querySelectorAll('.optimizer-day').forEach((input) => input.addEventListener('change', updateOptimizerWorkloadPreview));
  el.optimizerClearBtn?.addEventListener('click', clearOptimizerForm);
  el.optimizerCreateServiceBtn?.addEventListener('click', prepareOptimizerServiceDialog);
  el.optimizerCandidates?.addEventListener('click', handleDynamicClicks);
  el.optimizerRejected?.addEventListener('click', handleDynamicClicks);
  el.optimizerDataQuality?.addEventListener('click', handleDynamicClicks);
  el.proximityAnalyzeBtn?.addEventListener('click', handleProximityAnalyze);
  el.proximityWorkerFilter?.addEventListener('change', refreshProximityResults);
  el.proximityMinimumSaving?.addEventListener('change', refreshProximityResults);
  el.proximityBothImprove?.addEventListener('change', refreshProximityResults);
  el.proximityWorkerAnalysis?.addEventListener('click', handleDynamicClicks);
  el.proximityRelocations?.addEventListener('click', handleDynamicClicks);
  el.proximitySwaps?.addEventListener('click', handleDynamicClicks);
  el.proximityDataQuality?.addEventListener('click', handleDynamicClicks);
  const debouncedMapRender = debounce(() => renderMap({ fit: true }), 180);
  el.mapSearch?.addEventListener('input', debouncedMapRender);
  el.mapEntityFilter?.addEventListener('change', () => renderMap({ fit: true }));
  el.mapZoneFilter?.addEventListener('change', () => renderMap({ fit: true }));
  el.mapFitBtn?.addEventListener('click', fitMapToVisibleMarkers);
  el.mapClearSelectionBtn?.addEventListener('click', clearMapSelection);
  el.operationsMap?.addEventListener('click', handleMapPanelClick);
  el.mapSelectionPanel?.addEventListener('click', handleMapPanelClick);
  el.mapMissingLocations?.addEventListener('click', handleMapPanelClick);
  el.printViewBtn?.addEventListener('click', printCurrentView);
  el.exportExcelBtn?.addEventListener('click', exportCurrentViewToExcel);
  el.exportPdfBtn?.addEventListener('click', exportCurrentViewToPdf);

  el.authModeSwitch?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-auth-mode]');
    if (!button) return;
    setAuthMode(button.dataset.authMode);
  });

  el.addWorkerBtn?.addEventListener('click', () => openWorkerDialog());
  el.addServiceBtn?.addEventListener('click', () => openServiceDialog());
  el.addAssignmentBtn?.addEventListener('click', () => openAssignmentDialog());
  el.bulkAssignmentBtn?.addEventListener('click', () => openBulkAssignmentDialog());
  el.addAbsenceBtn?.addEventListener('click', () => openAbsenceDialog());
  el.addTardinessBtn?.addEventListener('click', () => openTardinessDialog());
  el.addMaterialCatalogBtn?.addEventListener('click', () => openMaterialCatalogDialog());
  el.addServiceMaterialBtn?.addEventListener('click', () => openServiceMaterialDialog());
  el.addMaterialConsumptionBtn?.addEventListener('click', () => openMaterialConsumptionDialog());

  el.workerForm?.addEventListener('submit', saveWorker);
  el.serviceForm?.addEventListener('submit', saveService);
  el.assignmentForm?.addEventListener('submit', saveAssignment);
  el.bulkAssignmentForm?.addEventListener('submit', saveBulkAssignments);
  el.absenceForm?.addEventListener('submit', saveAbsence);
  el.tardinessForm?.addEventListener('submit', saveTardiness);
  el.materialCatalogForm?.addEventListener('submit', saveMaterialCatalog);
  el.serviceMaterialForm?.addEventListener('submit', saveServiceMaterial);
  el.materialConsumptionForm?.addEventListener('submit', saveMaterialConsumption);

  $('deleteWorkerBtn')?.addEventListener('click', deleteWorker);
  $('deleteServiceBtn')?.addEventListener('click', deleteService);
  $('deleteAssignmentBtn')?.addEventListener('click', deleteAssignment);
  $('deleteAbsenceBtn')?.addEventListener('click', deleteAbsence);
  $('deleteTardinessBtn')?.addEventListener('click', deleteTardiness);
  $('deleteMaterialCatalogBtn')?.addEventListener('click', deleteMaterialCatalog);
  $('deleteServiceMaterialBtn')?.addEventListener('click', deleteServiceMaterial);
  $('deleteMaterialConsumptionBtn')?.addEventListener('click', deleteMaterialConsumption);

  const handleAbsencePeriodChange = () => {
    resetPagination('absenceSchedule');
    resetPagination('absenceHistory');
    resetPagination('absenceMonthly');
    resetPagination('absenceEmployeeHistory');
    resetPagination('absenceTracker');
    resetPagination('tardinessHistory');
    resetPagination('tardinessTracker');
    resetPagination('tardinessEmployeeHistory');
    syncAbsencePeriodControls();
    scheduleRenderCurrentView();
  };

  el.absenceFilterMode?.addEventListener('change', handleAbsencePeriodChange);
  el.absenceDateFilter?.addEventListener('change', () => {
    if (el.absenceMonthFilter) el.absenceMonthFilter.value = getMonthKey(getSelectedAbsenceDate()) || getCurrentMonthKey();
    handleAbsencePeriodChange();
  });
  el.absenceMonthFilter?.addEventListener('change', () => {
    const monthStart = getMonthStartDate(getSelectedAbsenceMonthKey());
    const monthEnd = getMonthEndDate(getSelectedAbsenceMonthKey());
    if (el.absenceRangeStart && monthStart) el.absenceRangeStart.value = toDateKey(monthStart);
    if (el.absenceRangeEnd && monthEnd) el.absenceRangeEnd.value = toDateKey(monthEnd);
    handleAbsencePeriodChange();
  });
  el.absenceRangeStart?.addEventListener('change', handleAbsencePeriodChange);
  el.absenceRangeEnd?.addEventListener('change', handleAbsencePeriodChange);
  el.absenceApplyFilterBtn?.addEventListener('click', handleAbsencePeriodChange);
  el.absenceWorkerHistoryFilter?.addEventListener('change', () => {
    resetPagination('absenceEmployeeHistory');
    scheduleRenderCurrentView();
  });
  el.tardinessWorkerHistoryFilter?.addEventListener('change', () => {
    resetPagination('tardinessEmployeeHistory');
    scheduleRenderCurrentView();
  });
  el.materialsMonthFilter?.addEventListener('change', () => scheduleRenderCurrentView());
  el.materialsServiceFilter?.addEventListener('change', () => scheduleRenderCurrentView());
  $('absenceCoverageStatus')?.addEventListener('change', toggleAbsenceCoverageFields);
  $('absenceCoverageStart')?.addEventListener('input', updateAbsenceCoverageInfo);
  $('absenceCoverageEnd')?.addEventListener('input', updateAbsenceCoverageInfo);
  $('tardinessScheduledStart')?.addEventListener('input', updateTardinessMinutesInfo);
  $('tardinessActualArrival')?.addEventListener('input', updateTardinessMinutesInfo);
  $('serviceMaterialCatalog')?.addEventListener('input', () => updateMaterialCatalogAutocomplete('serviceMaterialCatalog', 'serviceMaterialUnit', 'serviceMaterialPresentation'));
  $('materialConsumptionService')?.addEventListener('change', updateMaterialConsumptionOptions);
  $('materialConsumptionMaterial')?.addEventListener('input', updateMaterialConsumptionMeta);

  el.workersTableBody?.addEventListener('click', handleDynamicClicks);
  el.servicesGrid?.addEventListener('click', handleDynamicClicks);
  el.plannerBoard?.addEventListener('click', handleDynamicClicks);
  el.workersPagination?.addEventListener('click', handlePaginationClick);
  el.servicesPagination?.addEventListener('click', handlePaginationClick);
  el.absenceSchedulePagination?.addEventListener('click', handlePaginationClick);
  el.absenceHistoryPagination?.addEventListener('click', handlePaginationClick);
  el.absenceWorkerTrackerPagination?.addEventListener('click', handlePaginationClick);
  el.absenceEmployeeHistoryPagination?.addEventListener('click', handlePaginationClick);
  el.absenceMonthlyPagination?.addEventListener('click', handlePaginationClick);
  el.tardinessHistoryPagination?.addEventListener('click', handlePaginationClick);
  el.tardinessWorkerTrackerPagination?.addEventListener('click', handlePaginationClick);
  el.tardinessEmployeeHistoryPagination?.addEventListener('click', handlePaginationClick);
  el.absenceScheduleBoard?.addEventListener('click', handleDynamicClicks);
  el.absenceHistoryBoard?.addEventListener('click', handleDynamicClicks);
  el.absenceWorkerTrackerBoard?.addEventListener('click', handleDynamicClicks);
  el.absenceEmployeeHistoryBoard?.addEventListener('click', handleDynamicClicks);
  el.tardinessHistoryBoard?.addEventListener('click', handleDynamicClicks);
  el.tardinessWorkerTrackerBoard?.addEventListener('click', handleDynamicClicks);
  el.tardinessEmployeeHistoryBoard?.addEventListener('click', handleDynamicClicks);
  el.serviceMaterialsBoard?.addEventListener('click', handleDynamicClicks);
  el.materialsConsumptionHistoryBoard?.addEventListener('click', handleDynamicClicks);

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = $(button.dataset.close);
      if (dialog) dialog.close();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const drilldownTarget = event.target.closest('[data-dashboard-drilldown]');
    if (!drilldownTarget || drilldownTarget.tagName === 'BUTTON') return;
    event.preventDefault();
    openDashboardDrilldown(
      drilldownTarget.dataset.dashboardDrilldown || '',
      drilldownTarget.dataset.drilldownSource || 'dashboard'
    );
  });

  document.addEventListener('click', (event) => {
    const helpButton = event.target.closest('[data-dashboard-help]');
    if (helpButton) {
      event.preventDefault();
      openDashboardHelp(helpButton.dataset.dashboardHelp || 'overview');
      return;
    }

    const drilldownTarget = event.target.closest('[data-dashboard-drilldown]');
    if (drilldownTarget) {
      event.preventDefault();
      openDashboardDrilldown(
        drilldownTarget.dataset.dashboardDrilldown || '',
        drilldownTarget.dataset.drilldownSource || 'dashboard'
      );
      return;
    }
    if (event.target.closest('.global-search-shell')) return;
    closeGlobalSearchResults();
  });
}

function boot() {
  try {
    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      alert('Falta configurar supabase-config.js');
      return;
    }

    supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

    Object.assign(el, {
      authView: $('authView'),
      mainView: $('mainView'),
      loginForm: $('loginForm'),
      authMessage: $('authMessage'),
      authSubmitBtn: $('authSubmitBtn'),
      authModeSwitch: $('authModeSwitch'),
      confirmPasswordField: $('confirmPasswordField'),
      confirmPassword: $('confirmPassword'),
      logoutBtn: $('logoutBtn'),
      installPwaBtn: $('installPwaBtn'),
      refreshBtn: $('refreshBtn'),
      printViewBtn: $('printViewBtn'),
      exportExcelBtn: $('exportExcelBtn'),
      exportPdfBtn: $('exportPdfBtn'),
      navTabs: $('navTabs'),
      globalSearch: $('globalSearch'),
      globalSearchResults: $('globalSearchResults'),
      workerTypeFilter: $('workerTypeFilter'),
      statusFilter: $('statusFilter'),
      dashboardMonthFilter: $('dashboardMonthFilter'),
      workersMonthFilter: $('workersMonthFilter'),
      kpiCards: $('kpiCards'),
      workforceMonthlyBalance: $('workforceMonthlyBalance'),
      dashboardHelpDialog: $('dashboardHelpDialog'),
      dashboardHelpTitle: $('dashboardHelpTitle'),
      dashboardHelpBody: $('dashboardHelpBody'),
      dashboardDrilldownDialog: $('dashboardDrilldownDialog'),
      dashboardDrilldownTitle: $('dashboardDrilldownTitle'),
      dashboardDrilldownSubtitle: $('dashboardDrilldownSubtitle'),
      dashboardDrilldownBody: $('dashboardDrilldownBody'),
      serviceHoursBalance: $('serviceHoursBalance'),
      criticalWorkers: $('criticalWorkers'),
      serviceGaps: $('serviceGaps'),
      workersTableBody: $('workersTableBody'),
      workerAvailabilityBoard: $('workerAvailabilityBoard'),
      workersPagination: $('workersPagination'),
      servicesGrid: $('servicesGrid'),
      servicesPagination: $('servicesPagination'),
      billingMonthFilter: $('billingMonthFilter'),
      billingKpiCards: $('billingKpiCards'),
      billingServicesBoard: $('billingServicesBoard'),
      billingSchemaNotice: $('billingSchemaNotice'),
      addBillingRuleBtn: $('addBillingRuleBtn'),
      addBillingAdjustmentBtn: $('addBillingAdjustmentBtn'),
      billingRuleDialog: $('billingRuleDialog'),
      billingAdjustmentDialog: $('billingAdjustmentDialog'),
      finalBillingDialog: $('finalBillingDialog'),
      billingRuleForm: $('billingRuleForm'),
      billingAdjustmentForm: $('billingAdjustmentForm'),
      finalBillingForm: $('finalBillingForm'),
      plannerBoard: $('plannerBoard'),
      mapSearch: $('mapSearch'),
      mapEntityFilter: $('mapEntityFilter'),
      mapZoneFilter: $('mapZoneFilter'),
      mapFitBtn: $('mapFitBtn'),
      mapClearSelectionBtn: $('mapClearSelectionBtn'),
      mapKpiCards: $('mapKpiCards'),
      operationsMap: $('operationsMap'),
      mapEmptyOverlay: $('mapEmptyOverlay'),
      mapSelectionPanel: $('mapSelectionPanel'),
      mapMissingLocations: $('mapMissingLocations'),
      optimizerForm: $('optimizerForm'),
      optimizerExistingService: $('optimizerExistingService'),
      optimizerMonth: $('optimizerMonth'),
      optimizerServiceName: $('optimizerServiceName'),
      optimizerBilledMonthlyHours: $('optimizerBilledMonthlyHours'),
      optimizerAddress: $('optimizerAddress'),
      optimizerZone: $('optimizerZone'),
      optimizerCoordinates: $('optimizerCoordinates'),
      optimizerStart: $('optimizerStart'),
      optimizerEnd: $('optimizerEnd'),
      optimizerTravelBuffer: $('optimizerTravelBuffer'),
      optimizerAllowOverTarget: $('optimizerAllowOverTarget'),
      optimizerWorkloadPreview: $('optimizerWorkloadPreview'),
      optimizerKpiCards: $('optimizerKpiCards'),
      optimizerRecommendation: $('optimizerRecommendation'),
      optimizerCandidates: $('optimizerCandidates'),
      optimizerRejected: $('optimizerRejected'),
      optimizerDataQuality: $('optimizerDataQuality'),
      optimizerClearBtn: $('optimizerClearBtn'),
      optimizerCreateServiceBtn: $('optimizerCreateServiceBtn'),
      proximityAnalyzeBtn: $('proximityAnalyzeBtn'),
      proximityWorkerFilter: $('proximityWorkerFilter'),
      proximityMinimumSaving: $('proximityMinimumSaving'),
      proximityBothImprove: $('proximityBothImprove'),
      proximityKpiCards: $('proximityKpiCards'),
      proximitySummary: $('proximitySummary'),
      proximityWorkerAnalysis: $('proximityWorkerAnalysis'),
      proximityRelocations: $('proximityRelocations'),
      proximitySwaps: $('proximitySwaps'),
      proximityDataQuality: $('proximityDataQuality'),
      absenceFilterMode: $('absenceFilterMode'),
      absenceApplyFilterBtn: $('absenceApplyFilterBtn'),
      absenceDateFilter: $('absenceDateFilter'),
      absenceMonthFilter: $('absenceMonthFilter'),
      absenceRangeStart: $('absenceRangeStart'),
      absenceRangeEnd: $('absenceRangeEnd'),
      absenceWorkerHistoryFilter: $('absenceWorkerHistoryFilter'),
      tardinessWorkerHistoryFilter: $('tardinessWorkerHistoryFilter'),
      absenceKpiCards: $('absenceKpiCards'),
      absenceScheduleTitle: $('absenceScheduleTitle'),
      absenceScheduleSubtitle: $('absenceScheduleSubtitle'),
      absenceHistoryTitle: $('absenceHistoryTitle'),
      absenceHistorySubtitle: $('absenceHistorySubtitle'),
      absenceSummaryTitle: $('absenceSummaryTitle'),
      absenceSummarySubtitle: $('absenceSummarySubtitle'),
      absenceMonthKpiCards: $('absenceMonthKpiCards'),
      absenceMonthlyBoard: $('absenceMonthlyBoard'),
      absenceMonthlyPagination: $('absenceMonthlyPagination'),
      absenceScheduleBoard: $('absenceScheduleBoard'),
      absenceSchedulePagination: $('absenceSchedulePagination'),
      absenceHistoryBoard: $('absenceHistoryBoard'),
      absenceHistoryPagination: $('absenceHistoryPagination'),
      absenceWorkerTrackerBoard: $('absenceWorkerTrackerBoard'),
      absenceWorkerTrackerPagination: $('absenceWorkerTrackerPagination'),
      absenceEmployeeHistoryBoard: $('absenceEmployeeHistoryBoard'),
      absenceEmployeeHistoryPagination: $('absenceEmployeeHistoryPagination'),
      tardinessKpiCards: $('tardinessKpiCards'),
      tardinessHistoryBoard: $('tardinessHistoryBoard'),
      tardinessHistoryPagination: $('tardinessHistoryPagination'),
      tardinessWorkerTrackerBoard: $('tardinessWorkerTrackerBoard'),
      tardinessWorkerTrackerPagination: $('tardinessWorkerTrackerPagination'),
      tardinessEmployeeHistoryBoard: $('tardinessEmployeeHistoryBoard'),
      tardinessEmployeeHistoryPagination: $('tardinessEmployeeHistoryPagination'),
      materialsMonthFilter: $('materialsMonthFilter'),
      materialsServiceFilter: $('materialsServiceFilter'),
      materialKpiCards: $('materialKpiCards'),
      serviceMaterialsBoard: $('serviceMaterialsBoard'),
      materialsMonthlySummaryBoard: $('materialsMonthlySummaryBoard'),
      materialsConsumptionHistoryBoard: $('materialsConsumptionHistoryBoard'),
      addWorkerBtn: $('addWorkerBtn'),
      addServiceBtn: $('addServiceBtn'),
      addAssignmentBtn: $('addAssignmentBtn'),
      bulkAssignmentBtn: $('bulkAssignmentBtn'),
      addAbsenceBtn: $('addAbsenceBtn'),
      addTardinessBtn: $('addTardinessBtn'),
      addMaterialCatalogBtn: $('addMaterialCatalogBtn'),
      addServiceMaterialBtn: $('addServiceMaterialBtn'),
      addMaterialConsumptionBtn: $('addMaterialConsumptionBtn'),
      workerDialog: $('workerDialog'),
      serviceDialog: $('serviceDialog'),
      assignmentDialog: $('assignmentDialog'),
      bulkAssignmentDialog: $('bulkAssignmentDialog'),
      absenceDialog: $('absenceDialog'),
      tardinessDialog: $('tardinessDialog'),
      materialCatalogDialog: $('materialCatalogDialog'),
      serviceMaterialDialog: $('serviceMaterialDialog'),
      materialConsumptionDialog: $('materialConsumptionDialog'),
      workerForm: $('workerForm'),
      serviceForm: $('serviceForm'),
      assignmentForm: $('assignmentForm'),
      bulkAssignmentForm: $('bulkAssignmentForm'),
      absenceForm: $('absenceForm'),
      tardinessForm: $('tardinessForm'),
      materialCatalogForm: $('materialCatalogForm'),
      serviceMaterialForm: $('serviceMaterialForm'),
      materialConsumptionForm: $('materialConsumptionForm'),
      absenceCoverageHoursInfo: $('absenceCoverageHoursInfo'),
      tardinessMinutesInfo: $('tardinessMinutesInfo'),
    });

    if (!el.loginForm) {
      throw new Error('No se encontró #loginForm');
    }

    initializeDashboardMonth();
    state.billingMonth = state.dashboardMonth;
    if (el.billingMonthFilter) el.billingMonthFilter.value = state.billingMonth;
    if (el.optimizerMonth) el.optimizerMonth.value = state.dashboardMonth;
    setCurrentView('dashboard');
    setAuthMode('login');
    setDataReady(false);
    bindEvents();
    syncPwaInstallButton();
    syncAbsencePeriodControls();
    initAuth();
  } catch (error) {
    console.error('Error en boot():', error);
    alert(`Error al iniciar la app: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', boot);

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

const VIEW_IDS = {
  dashboard: 'dashboardView',
  workers: 'workersView',
  services: 'servicesView',
  planner: 'plannerView',
  absences: 'absencesView',
  materials: 'materialsView',
};

function createEmptyDerivedState() {
  return {
    workerById: new Map(),
    serviceById: new Map(),
    assignmentById: new Map(),
    absenceById: new Map(),
    materialById: new Map(),
    materialByNormalizedName: new Map(),
    serviceMaterialById: new Map(),
    materialConsumptionById: new Map(),
    assignmentsByWorkerId: new Map(),
    assignmentsByServiceId: new Map(),
    assignmentsByDay: new Map(),
    absencesByDateKey: new Map(),
    absencesByWorkerId: new Map(),
    serviceMaterialsByServiceId: new Map(),
    serviceMaterialsByMaterialId: new Map(),
    materialConsumptionsByServiceMaterialId: new Map(),
    materialConsumptionsByMonthKey: new Map(),
    serviceSearchById: new Map(),
    assignmentSearchById: new Map(),
    absenceSearchById: new Map(),
    materialSearchById: new Map(),
    serviceMaterialSearchById: new Map(),
  };
}

const state = {
  user: null,
  workers: [],
  services: [],
  assignments: [],
  absences: [],
  materials: [],
  serviceMaterials: [],
  materialConsumptions: [],
  currentView: 'dashboard',
  authMode: 'login',
  filters: {
    search: '',
    workerType: 'all',
    status: 'all',
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
  return new Date().toISOString().slice(0, 7);
}

function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '—';
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function formatHours(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2).replace('.00', '');
}

function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
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
      [service.name, service.zone || '', service.client_address || '', service.supervisor_name || '', service.notes || '']
        .join(' ')
        .toLowerCase()
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
      [
        worker?.name || '',
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
        service?.supervisor_name || '',
      ]
        .join(' ')
        .toLowerCase()
    );
  });

  state.materials.forEach((material) => {
    derived.materialById.set(material.id, material);
    derived.materialByNormalizedName.set(normalizeText(material.name), material);
    derived.materialSearchById.set(
      material.id,
      [material.name || '', material.unit || '', material.presentation || '', material.notes || '']
        .join(' ')
        .toLowerCase()
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
      [
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
        service?.supervisor_name || '',
        material?.name || '',
        material?.unit || '',
        material?.presentation || '',
        serviceMaterial.notes || '',
      ]
        .join(' ')
        .toLowerCase()
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
      [
        absence.absence_date || '',
        worker?.name || '',
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
        service?.supervisor_name || '',
        coverageWorker?.name || '',
        absence.notes || '',
        absence.coverage_status || '',
      ]
        .join(' ')
        .toLowerCase()
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

function findAbsenceForAssignmentOnDate(assignment, dateKey) {
  if (!assignment || !dateKey) return null;

  return getAbsencesByDate(dateKey).find((absence) => {
    if (absence.assignment_id && assignment.id) {
      return absence.assignment_id === assignment.id;
    }

    return absence.worker_id === assignment.worker_id && absence.service_id === assignment.service_id;
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
  state.filters.search = workerName.toLowerCase();

  goToView('planner');

  window.requestAnimationFrame(() => {
    const firstCard = el.plannerBoard?.querySelector(`[data-planner-worker-id="${workerId}"]`);
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
    'absenceDateFilter',
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
    return !term || hay.includes(term);
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
      return !term || hay.includes(term);
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
          ].join(' ').toLowerCase();

      return hay.includes(term);
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

function getWorkerSummaries() {
  return state.workers
    .map((worker) => {
      const assignments = getWorkerAssignments(worker.id);
      const totalHours = assignments.reduce(
        (sum, assignment) => sum + calculateHours(assignment.start_time, assignment.end_time),
        0
      );

      const targetHours = getTargetHours(worker);
      const difference =
        targetHours == null ? null : Number((targetHours - totalHours).toFixed(2));

      let status = 'balanced';
      if (difference == null) status = 'insurance';
      else if (difference > 0) status = 'available';
      else if (difference < 0) status = 'over';

      const services = [...new Set(assignments.map((assignment) => assignment.service_id))]
        .map((serviceId) => getServiceById(serviceId))
        .filter(Boolean);

      return {
        ...worker,
        assignments,
        totalHours: Number(totalHours.toFixed(2)),
        targetHours,
        difference,
        services,
        status,
      };
    })
    .filter(matchesFilters)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity: 'base' }));
}

function matchesFilters(summary) {
  const term = state.filters.search;

  const searchSource = [
    summary.name,
    summary.notes || '',
    ...summary.services.map(
      (service) => `${service.name} ${service.zone || ''} ${service.client_address || ''}`
    ),
  ]
    .join(' ')
    .toLowerCase();

  const searchOk = !term || searchSource.includes(term);
  const typeOk =
    state.filters.workerType === 'all' || summary.worker_type === state.filters.workerType;
  const statusOk =
    state.filters.status === 'all' || summary.status === state.filters.status;

  return searchOk && typeOk && statusOk;
}

function renderStatusPill(status) {
  const labels = {
    balanced: 'Equilibrado',
    available: 'Con horas libres',
    over: 'Excedido',
    insurance: 'Seguro',
  };

  return `<span class="status-pill status-${status}">${labels[status] || status}</span>`;
}

function renderDifferencePill(worker) {
  if (worker.difference == null) {
    return `<span class="status-pill status-insurance">SEGURO</span>`;
  }

  if (worker.difference > 0) {
    return `<span class="status-pill status-available">Faltan ${formatHours(worker.difference)} hs</span>`;
  }

  if (worker.difference < 0) {
    return `<span class="status-pill status-over">Se pasó ${formatHours(Math.abs(worker.difference))} hs</span>`;
  }

  return `<span class="status-pill status-balanced">Exacto</span>`;
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

  const assignmentWorker = $('assignmentWorker');
  const assignmentService = $('assignmentService');
  const bulkAssignmentWorker = $('bulkAssignmentWorker');
  const bulkAssignmentService = $('bulkAssignmentService');
  const absenceWorker = $('absenceWorker');
  const absenceService = $('absenceService');
  const absenceCoverageWorker = $('absenceCoverageWorker');
  const materialsServiceFilter = $('materialsServiceFilter');
  const serviceMaterialService = $('serviceMaterialService');
  const materialConsumptionService = $('materialConsumptionService');
  const materialCatalogOptionsList = $('materialCatalogOptionsList');

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

function renderKpis(summaries) {
  const totalAssignedHours = summaries.reduce((sum, worker) => sum + worker.totalHours, 0);
  const availableWorkers = summaries.filter((worker) => worker.status === 'available').length;
  const overloadedWorkers = summaries.filter((worker) => worker.status === 'over').length;
  const unassignedWorkers = summaries.filter((worker) => worker.services.length === 0).length;
  const uncoveredServices = getUncoveredServices().length;

  const cards = [
    {
      label: 'Operarios visibles',
      value: summaries.length,
      foot: `${unassignedWorkers} sin servicio asignado`,
    },
    {
      label: 'Horas asignadas',
      value: formatHours(totalAssignedHours),
      foot: 'Suma semanal visible',
    },
    {
      label: 'Operarios con horas libres',
      value: availableWorkers,
      foot: overloadedWorkers
        ? `${overloadedWorkers} excedidos`
        : 'Sin excesos detectados',
    },
    {
      label: 'Servicios sin cobertura',
      value: uncoveredServices,
      foot: 'Sin ninguna asignación activa',
    },
  ];

  el.kpiCards.innerHTML = cards
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

function renderCriticalWorkers(summaries) {
  const critical = summaries
    .filter((worker) => worker.status === 'available' || worker.status === 'over')
    .sort((a, b) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0))
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
                  <div class="muted">${TYPE_META[worker.worker_type].label}</div>
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
      (worker) => `
        <tr>
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
          </td>
          <td>${TYPE_META[worker.worker_type].label}</td>
          <td>${worker.targetHours == null ? 'SEGURO' : formatHours(worker.targetHours)}</td>
          <td>${formatHours(worker.totalHours)}</td>
          <td>${worker.difference == null ? 'SEGURO' : formatHours(worker.difference)}</td>
          <td>${renderStatusPill(worker.status)}</td>
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
      `
    )
    .join('');
}

function renderWorkerAvailability(summaries) {
  el.workerAvailabilityBoard.innerHTML = summaries
    .map((worker) => {
      const assignmentsByDay = groupAssignmentsByDay(worker.assignments);

      return `
        <article class="availability-card">
          <header class="availability-header">
            <div>
              <h3>${escapeHtml(worker.name)}</h3>
              <p>${TYPE_META[worker.worker_type].label}</p>
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
                                    <strong>${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}</strong>
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

function renderServices() {
  const services = getFilteredServices();

  el.servicesGrid.innerHTML = services
    .map((service) => {
      const assignments = getServiceAssignments(service.id);
      const assignmentsByDay = groupAssignmentsByDay(assignments);

      return `
        <article class="service-card">
          <header class="service-card-header">
            <div>
              <h3>${escapeHtml(service.name)}</h3>
              <p>${escapeHtml(service.client_address || 'Sin dirección')}</p>
            </div>
            <div class="service-meta">
              <span class="chip">${escapeHtml(service.frequency_type || 'fixed')}</span>
              <span class="chip">${escapeHtml(service.zone || 'Sin zona')}</span>
              ${service.supervisor_name ? `<span class="chip">Sup. ${escapeHtml(service.supervisor_name)}</span>` : ''}
            </div>
          </header>

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
                                    <span>${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}</span>
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
}

function renderPlanner() {
  const searchTerm = state.filters.search;

  el.plannerBoard.innerHTML = DAYS.map((day) => {
    const items = getAssignmentsByDay(day.value).filter((assignment) => {
      if (!searchTerm) return true;
      const hay = state.derived.assignmentSearchById.get(assignment.id) || '';
      return hay.includes(searchTerm);
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
                    <article class="planner-card" data-planner-worker-id="${item.worker_id}">
                      <h4>${escapeHtml(service?.name || 'Servicio')}</h4>
                      <p>${escapeHtml(worker?.name || 'Operario')}</p>
                      <small>${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}</small>
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

function getFilteredAbsencesForDate(dateKey) {
  const searchTerm = state.filters.search;
  const workerTypeFilter = state.filters.workerType;

  return getAbsencesByDate(dateKey)
    .filter((absence) => {
      if (searchTerm) {
        const hay = state.derived.absenceSearchById.get(absence.id) || '';
        if (!hay.includes(searchTerm)) return false;
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

function renderAbsenceScheduleBoard(dateKey) {
  if (!el.absenceScheduleBoard) return;

  const dayOfWeek = getDateKeyDayOfWeek(dateKey);
  const searchTerm = state.filters.search;
  const workerTypeFilter = state.filters.workerType;

  const assignments = getAssignmentsByDay(dayOfWeek).filter((assignment) => {
    const worker = getWorkerById(assignment.worker_id);

    if (workerTypeFilter !== 'all' && worker?.worker_type !== workerTypeFilter) {
      return false;
    }

    if (!searchTerm) return true;

    const hay = state.derived.assignmentSearchById.get(assignment.id) || '';
    return hay.includes(searchTerm);
  });

  el.absenceScheduleBoard.innerHTML = assignments.length
    ? assignments
        .map((assignment) => {
          const worker = getWorkerById(assignment.worker_id);
          const service = getServiceById(assignment.service_id);
          const absence = findAbsenceForAssignmentOnDate(assignment, dateKey);

          return `
            <article class="absence-card">
              <div class="absence-card-head">
                <div>
                  <h3>${escapeHtml(service?.name || 'Servicio')}</h3>
                  <p>${escapeHtml(worker?.name || 'Operario')}</p>
                </div>
                <div class="absence-card-meta">
                  <span class="chip">${DAYS.find((day) => day.value === assignment.day_of_week)?.fullLabel || ''}</span>
                  <span class="chip">${assignment.start_time.slice(0, 5)}-${assignment.end_time.slice(0, 5)}</span>
                  ${service?.supervisor_name ? `<span class="chip">Sup. ${escapeHtml(service.supervisor_name)}</span>` : ''}
                  ${absence ? renderAbsenceStatusPill(absence.coverage_status) : ''}
                </div>
              </div>
              <div class="absence-card-actions">
                <button class="btn btn-primary btn-sm" type="button" data-mark-absence="${assignment.id}">
                  ${absence ? 'Editar ausencia' : 'Marcar ausencia'}
                </button>
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay servicios programados para ${formatDateLabel(dateKey)} con los filtros actuales.
      </div>
    `;
}

function renderAbsenceHistoryBoard(dateKey) {
  if (!el.absenceHistoryBoard) return;

  const absences = getFilteredAbsencesForDate(dateKey);

  el.absenceHistoryBoard.innerHTML = absences.length
    ? absences
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
                  ${absence.scheduled_start_time && absence.scheduled_end_time ? `<span class="chip">${absence.scheduled_start_time.slice(0, 5)}-${absence.scheduled_end_time.slice(0, 5)}</span>` : ''}
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
                        ${absence.coverage_start_time && absence.coverage_end_time ? `Horario: ${absence.coverage_start_time.slice(0, 5)}-${absence.coverage_end_time.slice(0, 5)}` : 'Horario sin informar'}
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
              </div>
            </article>
          `;
        })
        .join('')
    : `
      <div class="empty-state">
        No hay ausencias registradas para ${formatDateLabel(dateKey)}.
      </div>
    `;
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

function renderMaterials() {
  renderMaterialsKpis();
  renderServiceMaterialsBoard();
  renderMaterialsMonthlySummaryBoard();
  renderMaterialsConsumptionHistoryBoard();
}

function renderAbsences() {
  const dateKey = getSelectedAbsenceDate();
  renderAbsenceScheduleBoard(dateKey);
  renderAbsenceHistoryBoard(dateKey);
}

let renderFrameId = 0;
let realtimeRefreshTimer = 0;

function renderCurrentView() {
  switch (state.currentView) {
    case 'workers': {
      const summaries = getWorkerSummaries();
      renderWorkersTable(summaries);
      renderWorkerAvailability(summaries);
      break;
    }
    case 'services':
      renderServices();
      break;
    case 'planner':
      renderPlanner();
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
      renderKpis(summaries);
      renderCriticalWorkers(summaries);
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

  state.filters.search = el.globalSearch.value.trim().toLowerCase();
  state.filters.workerType = el.workerTypeFilter.value;
  state.filters.status = el.statusFilter.value;
  scheduleRenderCurrentView();
}

async function loadAllData() {
  const [
    workersRes,
    servicesRes,
    assignmentsRes,
    absencesRes,
    materialsRes,
    serviceMaterialsRes,
    materialConsumptionsRes,
  ] = await withTimeout(
    Promise.all([
      supabase.from('workers').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('assignments').select('*').eq('is_active', true).order('day_of_week').order('start_time'),
      supabase.from('absences').select('*').order('absence_date', { ascending: false }).order('created_at', { ascending: false }),
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
  state.assignments = assignmentsRes.data || [];
  state.absences = absencesRes.error ? [] : (absencesRes.data || []);
  state.materials = materialsRes.error ? [] : (materialsRes.data || []);
  state.serviceMaterials = serviceMaterialsRes.error ? [] : (serviceMaterialsRes.data || []);
  state.materialConsumptions = materialConsumptionsRes.error ? [] : (materialConsumptionsRes.data || []);

  if (absencesRes.error) {
    console.warn('La tabla de ausencias todavía no está disponible o devolvió error.', absencesRes.error);
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

  state.realtimeChannel = supabase
    .channel('planner-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'absences' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'materials' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'service_materials' }, scheduleRealtimeRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'material_consumptions' }, scheduleRealtimeRefresh)
    .subscribe();
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
      state.assignments = [];
      state.absences = [];
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
    $('serviceSupervisor').value = service.supervisor_name || '';
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

function openAbsenceDialog(options = {}) {
  if (!ensureDataReady('abrir ausencias')) return;

  const { absenceId = null, assignmentId = null } = typeof options === 'string'
    ? { absenceId: options }
    : options;

  el.absenceForm.reset();
  populateSelects();

  $('absenceId').value = '';
  $('absenceAssignmentId').value = '';
  $('absenceDialogTitle').textContent = absenceId ? 'Editar ausencia' : 'Registrar ausencia';
  $('deleteAbsenceBtn').classList.toggle('hidden', !absenceId);

  const defaultDate = getSelectedAbsenceDate();
  if ($('absenceDate')) $('absenceDate').value = defaultDate;
  if ($('absenceCoverageStatus')) $('absenceCoverageStatus').value = 'uncovered';

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

    const payload = {
      name: nameInput.value.trim(),
      worker_type: typeInput.value,
      target_hours: targetInput?.value ? Number(targetInput.value) : null,
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
      alert(error.message);
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
  const serviceSupervisor = $('serviceSupervisor');
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

    const payload = {
      name: serviceName.value.trim(),
      client_address: serviceAddress ? serviceAddress.value.trim() || null : null,
      zone: serviceZone ? serviceZone.value.trim() || null : null,
      supervisor_name: serviceSupervisor ? serviceSupervisor.value.trim() || null : null,
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
      alert(error.message);
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
      alert(error.message);
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
      alert(error.message);
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
    alert('El horario de cobertura no es válido.');
    return;
  }

  if (scheduledStart && scheduledEnd && calculateHours(scheduledStart, scheduledEnd) <= 0) {
    alert('El horario asignado no es válido.');
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

async function deleteAbsence() {
  if (!ensureDataReady('eliminar la ausencia')) return;

  const absenceId = $('absenceId').value.trim();
  if (!absenceId) return;

  if (!confirm('¿Eliminar esta ausencia?')) return;

  markLocalMutation();

  const { error } = await supabase.from('absences').delete().eq('id', absenceId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.absenceDialog.close();
  await loadAllDataWithRetry(2, 250, { hardLock: false, silent: false });
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
    openAbsenceDialog({ assignmentId: markAbsenceBtn.dataset.markAbsence });
    return;
  }

  const editAbsenceBtn = event.target.closest('[data-edit-absence]');
  if (editAbsenceBtn) {
    openAbsenceDialog({ absenceId: editAbsenceBtn.dataset.editAbsence });
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
    planner: 'Planner semanal',
    absences: 'Ausencias',
    materials: 'Materiales',
  };
  return titles[state.currentView] || 'Vista';
}

function getCurrentViewElement() {
  return $(VIEW_IDS[state.currentView]);
}

function buildDashboardExportData() {
  const summaries = getWorkerSummaries();
  const totalAssignedHours = summaries.reduce((sum, worker) => sum + worker.totalHours, 0);
  const availableWorkers = summaries.filter((worker) => worker.status === 'available').length;
  const overloadedWorkers = summaries.filter((worker) => worker.status === 'over').length;
  const uncoveredServices = getUncoveredServices();
  const criticalWorkers = summaries
    .filter((worker) => worker.status === 'available' || worker.status === 'over')
    .sort((a, b) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0));

  return {
    sheets: [
      {
        name: 'KPIs',
        rows: [
          ['Métrica', 'Valor'],
          ['Operarios visibles', summaries.length],
          ['Horas asignadas', totalAssignedHours],
          ['Operarios con horas libres', availableWorkers],
          ['Operarios excedidos', overloadedWorkers],
          ['Servicios sin cobertura', uncoveredServices.length],
        ],
      },
      {
        name: 'Operarios críticos',
        rows: [
          ['Operario', 'Tipo', 'Horas objetivo', 'Horas asignadas', 'Diferencia', 'Estado'],
          ...criticalWorkers.map((worker) => [
            worker.name,
            TYPE_META[worker.worker_type].label,
            worker.targetHours == null ? 'SEGURO' : worker.targetHours,
            worker.totalHours,
            worker.difference == null ? 'SEGURO' : worker.difference,
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
          ['Operario', 'Tipo', 'Horas objetivo', 'Horas asignadas', 'Diferencia', 'Estado', 'Servicios'],
          ...summaries.map((worker) => [
            worker.name,
            TYPE_META[worker.worker_type].label,
            worker.targetHours == null ? 'SEGURO' : worker.targetHours,
            worker.totalHours,
            worker.difference == null ? 'SEGURO' : worker.difference,
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
                  `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}`,
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

  return {
    sheets: [
      {
        name: 'Servicios',
        rows: [
          ['Servicio', 'Dirección', 'Zona', 'Supervisor', 'Frecuencia', 'Notas', 'Cobertura activa'],
          ...services.map((service) => {
            const assignments = getServiceAssignments(service.id);
            return [
              service.name,
              service.client_address || '',
              service.zone || '',
              service.supervisor_name || '',
              service.frequency_type || '',
              service.notes || '',
              assignments.length,
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
                  `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}`,
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

function buildPlannerExportData() {
  const searchTerm = state.filters.search;
  const filteredAssignments = state.assignments.filter((assignment) => {
    if (!searchTerm) return true;
    const hay = state.derived.assignmentSearchById.get(assignment.id) || '';
    return hay.includes(searchTerm);
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
              `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}`,
              item.notes || '',
            ];
          }),
        ],
      },
    ],
  };
}

function buildAbsencesExportData() {
  const dateKey = getSelectedAbsenceDate();
  const dayOfWeek = getDateKeyDayOfWeek(dateKey);
  const assignments = getAssignmentsByDay(dayOfWeek).map((assignment) => {
    const worker = getWorkerById(assignment.worker_id);
    const service = getServiceById(assignment.service_id);
    const absence = findAbsenceForAssignmentOnDate(assignment, dateKey);

    return [
      formatDateLabel(dateKey),
      DAYS.find((day) => day.value === assignment.day_of_week)?.fullLabel || '',
      service?.name || '',
      worker?.name || '',
      `${assignment.start_time.slice(0, 5)}-${assignment.end_time.slice(0, 5)}`,
      absence ? 'Sí' : 'No',
      absence ? absence.coverage_status : '',
    ];
  });

  const absences = getFilteredAbsencesForDate(dateKey).map((absence) => {
    const worker = getWorkerById(absence.worker_id);
    const service = getServiceById(absence.service_id);
    const coverageWorker = absence.coverage_worker_id ? getWorkerById(absence.coverage_worker_id) : null;
    const coveredHours = calculateCoverageHours(absence);

    return [
      formatDateLabel(absence.absence_date),
      worker?.name || '',
      service?.name || '',
      absence.scheduled_start_time && absence.scheduled_end_time
        ? `${absence.scheduled_start_time.slice(0, 5)}-${absence.scheduled_end_time.slice(0, 5)}`
        : '',
      absence.coverage_status,
      coverageWorker?.name || '',
      absence.coverage_date ? formatDateLabel(absence.coverage_date) : '',
      absence.coverage_start_time && absence.coverage_end_time
        ? `${absence.coverage_start_time.slice(0, 5)}-${absence.coverage_end_time.slice(0, 5)}`
        : '',
      coveredHours == null ? '' : coveredHours,
      absence.notes || '',
    ];
  });

  return {
    sheets: [
      {
        name: 'Programacion del dia',
        rows: [
          ['Fecha', 'Día', 'Servicio', 'Operario', 'Horario', 'Ausencia registrada', 'Estado'],
          ...assignments,
        ],
      },
      {
        name: 'Ausencias',
        rows: [
          ['Fecha', 'Operario ausente', 'Servicio', 'Horario asignado', 'Resultado', 'Operario cobertura', 'Fecha cobertura', 'Horario cobertura', 'Horas cubiertas', 'Notas'],
          ...absences,
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

function buildCurrentExportData() {
  switch (state.currentView) {
    case 'workers':
      return buildWorkersExportData();
    case 'services':
      return buildServicesExportData();
    case 'planner':
      return buildPlannerExportData();
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

  try {
    if (button) {
      button.disabled = true;
      button.textContent = 'Generando PDF...';
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

const debouncedHandleFilterInput = debounce(handleFilterChange, 180);

function bindEvents() {
  el.loginForm?.addEventListener('submit', handleLogin);
  el.logoutBtn?.addEventListener('click', handleLogout);
  el.refreshBtn?.addEventListener('click', () => loadAllDataWithRetry(4, 500, { hardLock: false, silent: false }));
  el.navTabs?.addEventListener('click', handleViewChange);
  el.globalSearch?.addEventListener('input', debouncedHandleFilterInput);
  el.workerTypeFilter?.addEventListener('change', handleFilterChange);
  el.statusFilter?.addEventListener('change', handleFilterChange);
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
  el.addMaterialCatalogBtn?.addEventListener('click', () => openMaterialCatalogDialog());
  el.addServiceMaterialBtn?.addEventListener('click', () => openServiceMaterialDialog());
  el.addMaterialConsumptionBtn?.addEventListener('click', () => openMaterialConsumptionDialog());

  el.workerForm?.addEventListener('submit', saveWorker);
  el.serviceForm?.addEventListener('submit', saveService);
  el.assignmentForm?.addEventListener('submit', saveAssignment);
  el.bulkAssignmentForm?.addEventListener('submit', saveBulkAssignments);
  el.absenceForm?.addEventListener('submit', saveAbsence);
  el.materialCatalogForm?.addEventListener('submit', saveMaterialCatalog);
  el.serviceMaterialForm?.addEventListener('submit', saveServiceMaterial);
  el.materialConsumptionForm?.addEventListener('submit', saveMaterialConsumption);

  $('deleteWorkerBtn')?.addEventListener('click', deleteWorker);
  $('deleteServiceBtn')?.addEventListener('click', deleteService);
  $('deleteAssignmentBtn')?.addEventListener('click', deleteAssignment);
  $('deleteAbsenceBtn')?.addEventListener('click', deleteAbsence);
  $('deleteMaterialCatalogBtn')?.addEventListener('click', deleteMaterialCatalog);
  $('deleteServiceMaterialBtn')?.addEventListener('click', deleteServiceMaterial);
  $('deleteMaterialConsumptionBtn')?.addEventListener('click', deleteMaterialConsumption);

  el.absenceDateFilter?.addEventListener('change', () => scheduleRenderCurrentView());
  el.materialsMonthFilter?.addEventListener('change', () => scheduleRenderCurrentView());
  el.materialsServiceFilter?.addEventListener('change', () => scheduleRenderCurrentView());
  $('absenceCoverageStatus')?.addEventListener('change', toggleAbsenceCoverageFields);
  $('absenceCoverageStart')?.addEventListener('input', updateAbsenceCoverageInfo);
  $('absenceCoverageEnd')?.addEventListener('input', updateAbsenceCoverageInfo);
  $('serviceMaterialCatalog')?.addEventListener('input', () => updateMaterialCatalogAutocomplete('serviceMaterialCatalog', 'serviceMaterialUnit', 'serviceMaterialPresentation'));
  $('materialConsumptionService')?.addEventListener('change', updateMaterialConsumptionOptions);
  $('materialConsumptionMaterial')?.addEventListener('input', updateMaterialConsumptionMeta);

  el.workersTableBody?.addEventListener('click', handleDynamicClicks);
  el.servicesGrid?.addEventListener('click', handleDynamicClicks);
  el.plannerBoard?.addEventListener('click', handleDynamicClicks);
  el.absenceScheduleBoard?.addEventListener('click', handleDynamicClicks);
  el.absenceHistoryBoard?.addEventListener('click', handleDynamicClicks);
  el.serviceMaterialsBoard?.addEventListener('click', handleDynamicClicks);
  el.materialsConsumptionHistoryBoard?.addEventListener('click', handleDynamicClicks);

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = $(button.dataset.close);
      if (dialog) dialog.close();
    });
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
      refreshBtn: $('refreshBtn'),
      printViewBtn: $('printViewBtn'),
      exportExcelBtn: $('exportExcelBtn'),
      exportPdfBtn: $('exportPdfBtn'),
      navTabs: $('navTabs'),
      globalSearch: $('globalSearch'),
      workerTypeFilter: $('workerTypeFilter'),
      statusFilter: $('statusFilter'),
      kpiCards: $('kpiCards'),
      criticalWorkers: $('criticalWorkers'),
      serviceGaps: $('serviceGaps'),
      workersTableBody: $('workersTableBody'),
      workerAvailabilityBoard: $('workerAvailabilityBoard'),
      servicesGrid: $('servicesGrid'),
      plannerBoard: $('plannerBoard'),
      absenceDateFilter: $('absenceDateFilter'),
      absenceScheduleBoard: $('absenceScheduleBoard'),
      absenceHistoryBoard: $('absenceHistoryBoard'),
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
      addMaterialCatalogBtn: $('addMaterialCatalogBtn'),
      addServiceMaterialBtn: $('addServiceMaterialBtn'),
      addMaterialConsumptionBtn: $('addMaterialConsumptionBtn'),
      workerDialog: $('workerDialog'),
      serviceDialog: $('serviceDialog'),
      assignmentDialog: $('assignmentDialog'),
      bulkAssignmentDialog: $('bulkAssignmentDialog'),
      absenceDialog: $('absenceDialog'),
      materialCatalogDialog: $('materialCatalogDialog'),
      serviceMaterialDialog: $('serviceMaterialDialog'),
      materialConsumptionDialog: $('materialConsumptionDialog'),
      workerForm: $('workerForm'),
      serviceForm: $('serviceForm'),
      assignmentForm: $('assignmentForm'),
      bulkAssignmentForm: $('bulkAssignmentForm'),
      absenceForm: $('absenceForm'),
      materialCatalogForm: $('materialCatalogForm'),
      serviceMaterialForm: $('serviceMaterialForm'),
      materialConsumptionForm: $('materialConsumptionForm'),
      absenceCoverageHoursInfo: $('absenceCoverageHoursInfo'),
    });

    if (!el.loginForm) {
      throw new Error('No se encontró #loginForm');
    }

    setCurrentView('dashboard');
    setAuthMode('login');
    setDataReady(false);
    bindEvents();
    initAuth();
  } catch (error) {
    console.error('Error en boot():', error);
    alert(`Error al iniciar la app: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', boot);

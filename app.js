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
};

function createEmptyDerivedState() {
  return {
    workerById: new Map(),
    serviceById: new Map(),
    assignmentById: new Map(),
    absenceById: new Map(),
    assignmentsByWorkerId: new Map(),
    assignmentsByServiceId: new Map(),
    assignmentsByDay: new Map(),
    absencesByDateKey: new Map(),
    absencesByWorkerId: new Map(),
    serviceSearchById: new Map(),
    assignmentSearchById: new Map(),
    absenceSearchById: new Map(),
  };
}

const state = {
  user: null,
  workers: [],
  services: [],
  assignments: [],
  absences: [],
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
  const [workersRes, servicesRes, assignmentsRes, absencesRes] = await withTimeout(
    Promise.all([
      supabase.from('workers').select('*').order('name'),
      supabase.from('services').select('*').order('name'),
      supabase.from('assignments').select('*').eq('is_active', true).order('day_of_week').order('start_time'),
      supabase.from('absences').select('*').order('absence_date', { ascending: false }).order('created_at', { ascending: false }),
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

  if (absencesRes.error) {
    console.warn('La tabla de ausencias todavía no está disponible o devolvió error.', absencesRes.error);
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

  const statusLabelMap = {
    uncovered: 'Descubierto',
    covered: 'Cubierto',
    partial: 'Parcial',
  };

  const getCoverageModeLabel = (absence, coveredHours, uncoveredHours) => {
    if (!absence) return '';
    if (absence.coverage_status === 'uncovered') return 'Sin cobertura';
    if (absence.coverage_status === 'covered') return 'Cobertura completa';
    if (absence.coverage_status === 'partial') {
      if (coveredHours != null && uncoveredHours != null) {
        return `Cobertura parcial (${formatHours(coveredHours)} hs cubiertas / ${formatHours(uncoveredHours)} hs descubiertas)`;
      }
      return 'Cobertura parcial';
    }
    return absence.coverage_status || '';
  };

  const assignments = getAssignmentsByDay(dayOfWeek).map((assignment) => {
    const worker = getWorkerById(assignment.worker_id);
    const service = getServiceById(assignment.service_id);
    const absence = findAbsenceForAssignmentOnDate(assignment, dateKey);
    const scheduledHours = calculateHours(assignment.start_time, assignment.end_time);
    const coveredHours = absence ? calculateCoverageHours(absence) : null;
    const uncoveredHours =
      absence && coveredHours != null
        ? Math.max(0, Number((scheduledHours - coveredHours).toFixed(2)))
        : absence?.coverage_status === 'uncovered'
          ? scheduledHours
          : '';

    return [
      formatDateLabel(dateKey),
      DAYS.find((day) => day.value === assignment.day_of_week)?.fullLabel || '',
      service?.name || '',
      service?.supervisor_name || '',
      worker?.name || '',
      TYPE_META[worker?.worker_type]?.label || '',
      `${assignment.start_time.slice(0, 5)}-${assignment.end_time.slice(0, 5)}`,
      scheduledHours,
      absence ? 'Sí' : 'No',
      absence ? (statusLabelMap[absence.coverage_status] || absence.coverage_status || '') : '',
      absence ? getCoverageModeLabel(absence, coveredHours, uncoveredHours) : '',
      absence?.coverage_worker_id ? (getWorkerById(absence.coverage_worker_id)?.name || '') : '',
      absence?.coverage_date ? formatDateLabel(absence.coverage_date) : '',
      absence?.coverage_start_time && absence?.coverage_end_time
        ? `${absence.coverage_start_time.slice(0, 5)}-${absence.coverage_end_time.slice(0, 5)}`
        : '',
      coveredHours == null ? '' : coveredHours,
      uncoveredHours === '' ? '' : uncoveredHours,
      absence?.notes || '',
    ];
  });

  const absences = getFilteredAbsencesForDate(dateKey).map((absence) => {
    const worker = getWorkerById(absence.worker_id);
    const service = getServiceById(absence.service_id);
    const coverageWorker = absence.coverage_worker_id ? getWorkerById(absence.coverage_worker_id) : null;
    const coveredHours = calculateCoverageHours(absence);
    const scheduledHours =
      absence.scheduled_start_time && absence.scheduled_end_time
        ? calculateHours(absence.scheduled_start_time, absence.scheduled_end_time)
        : null;
    const uncoveredHours =
      scheduledHours != null
        ? Math.max(0, Number((scheduledHours - (coveredHours || 0)).toFixed(2)))
        : null;

    return [
      formatDateLabel(absence.absence_date),
      DAYS.find((day) => day.value === getDateKeyDayOfWeek(absence.absence_date))?.fullLabel || '',
      worker?.name || '',
      TYPE_META[worker?.worker_type]?.label || '',
      service?.name || '',
      service?.supervisor_name || '',
      service?.zone || '',
      service?.client_address || '',
      absence.scheduled_start_time && absence.scheduled_end_time
        ? `${absence.scheduled_start_time.slice(0, 5)}-${absence.scheduled_end_time.slice(0, 5)}`
        : '',
      scheduledHours == null ? '' : scheduledHours,
      statusLabelMap[absence.coverage_status] || absence.coverage_status || '',
      getCoverageModeLabel(absence, coveredHours, uncoveredHours),
      absence.coverage_status === 'uncovered' ? 'No' : absence.coverage_status === 'partial' ? 'Parcial' : 'Sí',
      coverageWorker?.name || '',
      TYPE_META[coverageWorker?.worker_type]?.label || '',
      absence.coverage_date ? formatDateLabel(absence.coverage_date) : '',
      absence.coverage_start_time && absence.coverage_end_time
        ? `${absence.coverage_start_time.slice(0, 5)}-${absence.coverage_end_time.slice(0, 5)}`
        : '',
      coveredHours == null ? '' : coveredHours,
      uncoveredHours == null ? '' : uncoveredHours,
      absence.notes || '',
    ];
  });

  return {
    sheets: [
      {
        name: 'Programacion del dia',
        rows: [
          ['Fecha', 'Día', 'Servicio', 'Supervisor', 'Operario', 'Tipo operario', 'Horario asignado', 'Horas asignadas', 'Ausencia registrada', 'Resultado', 'Cómo se cubrió', 'Operario cobertura', 'Fecha cobertura', 'Horario cobertura', 'Horas cubiertas', 'Horas descubiertas', 'Notas'],
          ...assignments,
        ],
      },
      {
        name: 'Ausencias',
        rows: [
          ['Fecha', 'Día', 'Operario ausente', 'Tipo operario', 'Servicio afectado', 'Supervisor', 'Zona', 'Dirección', 'Horario asignado', 'Horas asignadas', 'Resultado', 'Cómo se cubrió', '¿Se cubrió?', 'Operario cobertura', 'Tipo cobertura', 'Fecha cobertura', 'Horario cobertura', 'Horas cubiertas', 'Horas descubiertas', 'Notas'],
          ...absences,
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

  el.workerForm?.addEventListener('submit', saveWorker);
  el.serviceForm?.addEventListener('submit', saveService);
  el.assignmentForm?.addEventListener('submit', saveAssignment);
  el.bulkAssignmentForm?.addEventListener('submit', saveBulkAssignments);
  el.absenceForm?.addEventListener('submit', saveAbsence);

  $('deleteWorkerBtn')?.addEventListener('click', deleteWorker);
  $('deleteServiceBtn')?.addEventListener('click', deleteService);
  $('deleteAssignmentBtn')?.addEventListener('click', deleteAssignment);
  $('deleteAbsenceBtn')?.addEventListener('click', deleteAbsence);

  el.absenceDateFilter?.addEventListener('change', () => scheduleRenderCurrentView());
  $('absenceCoverageStatus')?.addEventListener('change', toggleAbsenceCoverageFields);
  $('absenceCoverageStart')?.addEventListener('input', updateAbsenceCoverageInfo);
  $('absenceCoverageEnd')?.addEventListener('input', updateAbsenceCoverageInfo);

  el.workersTableBody?.addEventListener('click', handleDynamicClicks);
  el.servicesGrid?.addEventListener('click', handleDynamicClicks);
  el.plannerBoard?.addEventListener('click', handleDynamicClicks);
  el.absenceScheduleBoard?.addEventListener('click', handleDynamicClicks);
  el.absenceHistoryBoard?.addEventListener('click', handleDynamicClicks);

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
      addWorkerBtn: $('addWorkerBtn'),
      addServiceBtn: $('addServiceBtn'),
      addAssignmentBtn: $('addAssignmentBtn'),
      bulkAssignmentBtn: $('bulkAssignmentBtn'),
      addAbsenceBtn: $('addAbsenceBtn'),
      workerDialog: $('workerDialog'),
      serviceDialog: $('serviceDialog'),
      assignmentDialog: $('assignmentDialog'),
      bulkAssignmentDialog: $('bulkAssignmentDialog'),
      absenceDialog: $('absenceDialog'),
      workerForm: $('workerForm'),
      serviceForm: $('serviceForm'),
      assignmentForm: $('assignmentForm'),
      bulkAssignmentForm: $('bulkAssignmentForm'),
      absenceForm: $('absenceForm'),
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

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
};

const state = {
  user: null,
  workers: [],
  services: [],
  assignments: [],
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
}

function getTargetHours(worker) {
  return worker.target_hours ?? TYPE_META[worker.worker_type]?.defaultHours ?? null;
}

function getWorkerAssignments(workerId) {
  return state.assignments.filter((item) => item.worker_id === workerId);
}

function getServiceAssignments(serviceId) {
  return state.assignments.filter((item) => item.service_id === serviceId);
}

function setDataReady(isReady) {
  state.dataReady = isReady;

  const ids = [
    'refreshBtn',
    'printViewBtn',
    'exportExcelBtn',
    'exportPdfBtn',
    'addWorkerBtn',
    'addServiceBtn',
    'addAssignmentBtn',
    'bulkAssignmentBtn',
    'workerTypeFilter',
    'statusFilter',
    'globalSearch',
  ];

  ids.forEach((id) => {
    const node = $(id);
    if (node) node.disabled = !isReady;
  });
}

function ensureDataReady(actionLabel = 'esta acción') {
  if (!state.dataReady || state.loadingData) {
    alert(`Todavía se están cargando los datos. Esperá unos segundos antes de ${actionLabel}.`);
    return false;
  }
  return true;
}

function getFilteredServices() {
  const term = state.filters.search;

  return state.services.filter((service) => {
    const hay = [
      service.name,
      service.zone || '',
      service.client_address || '',
      service.notes || '',
    ]
      .join(' ')
      .toLowerCase();

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

      const services = [...new Set(assignments.map((a) => a.service_id))]
        .map((id) => state.services.find((service) => service.id === id))
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

  if (assignmentWorker) assignmentWorker.innerHTML = workerOptions;
  if (assignmentService) assignmentService.innerHTML = serviceOptions;
  if (bulkAssignmentWorker) bulkAssignmentWorker.innerHTML = workerOptions;
  if (bulkAssignmentService) bulkAssignmentService.innerHTML = serviceOptions;
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
            <strong>${escapeHtml(worker.name)}</strong>
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
      const assignmentsByDay = DAYS.map((day) => ({
        ...day,
        items: worker.assignments.filter((item) => item.day_of_week === day.value),
      }));

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
            ${assignmentsByDay
              .map(
                (day) => `
                  <section class="day-column">
                    <h4>${day.label}</h4>
                    ${
                      day.items.length
                        ? day.items
                            .map((item) => {
                              const service = state.services.find(
                                (service) => service.id === item.service_id
                              );
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
                `
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

      const serviceDays = DAYS.map((day) => ({
        ...day,
        items: assignments.filter((item) => item.day_of_week === day.value),
      }));

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
            </div>
          </header>

          <div class="inline-actions service-actions">
            <button class="btn btn-secondary btn-sm" type="button" data-edit-service="${service.id}">Editar</button>
          </div>

          <div class="service-days">
            ${serviceDays
              .map(
                (day) => `
                  <section class="service-day">
                    <h4>${day.label}</h4>
                    ${
                      day.items.length
                        ? day.items
                            .map((item) => {
                              const worker = state.workers.find(
                                (worker) => worker.id === item.worker_id
                              );

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
                `
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
    const items = state.assignments.filter((assignment) => {
      if (assignment.day_of_week !== day.value) return false;
      if (!searchTerm) return true;

      const worker = state.workers.find((row) => row.id === assignment.worker_id);
      const service = state.services.find((row) => row.id === assignment.service_id);

      const hay = [
        worker?.name || '',
        service?.name || '',
        service?.zone || '',
        service?.client_address || '',
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(searchTerm);
    });

    return `
      <section class="planner-column">
        <h3>${day.label}</h3>
        ${
          items.length
            ? items
                .map((item) => {
                  const worker = state.workers.find((row) => row.id === item.worker_id);
                  const service = state.services.find((row) => row.id === item.service_id);

                  return `
                    <article class="planner-card">
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

function renderAll() {
  const summaries = getWorkerSummaries();
  renderKpis(summaries);
  renderCriticalWorkers(summaries);
  renderServiceGaps();
  renderWorkersTable(summaries);
  renderWorkerAvailability(summaries);
  renderServices();
  renderPlanner();
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
  renderAll();
}

async function loadAllData() {
  const [workersRes, servicesRes, assignmentsRes] = await Promise.all([
    supabase.from('workers').select('*').order('name'),
    supabase.from('services').select('*').order('name'),
    supabase.from('assignments').select('*').eq('is_active', true).order('day_of_week').order('start_time'),
  ]);

  if (workersRes.error || servicesRes.error || assignmentsRes.error) {
    throw workersRes.error || servicesRes.error || assignmentsRes.error;
  }

  state.workers = workersRes.data || [];
  state.services = servicesRes.data || [];
  state.assignments = assignmentsRes.data || [];

  populateSelects();
  renderAll();
}

async function loadAllDataWithRetry(retries = 4, delayMs = 500) {
  state.loadingData = true;
  setDataReady(false);

  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await loadAllData();
      state.loadingData = false;
      setDataReady(true);
      return true;
    } catch (error) {
      lastError = error;
      console.error(`Error cargando datos. Intento ${attempt}/${retries}`, error);
      if (attempt < retries) await sleep(delayMs);
    }
  }

  state.loadingData = false;
  setDataReady(false);
  console.error('No se pudieron cargar los datos luego de varios intentos.', lastError);
  alert('No se pudieron inicializar los datos. Tocá "Actualizar" en unos segundos.');
  return false;
}

function subscribeRealtime() {
  if (state.realtimeChannel) {
    supabase.removeChannel(state.realtimeChannel);
  }

  state.realtimeChannel = supabase
    .channel('planner-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, () => loadAllDataWithRetry(2, 250))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => loadAllDataWithRetry(2, 250))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => loadAllDataWithRetry(2, 250))
    .subscribe();
}

async function initializeAfterLogin() {
  showMain();
  goToView(state.currentView || 'dashboard');
  const ok = await loadAllDataWithRetry(4, 500);
  if (ok) subscribeRealtime();
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

  supabase.auth.onAuthStateChange(async (_event, sessionNow) => {
    state.user = sessionNow?.user || null;

    if (state.user) {
      await initializeAfterLogin();
    } else {
      showAuth();
      state.workers = [];
      state.services = [];
      state.assignments = [];
      setDataReady(true);
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
    const worker = state.workers.find((item) => item.id === workerId);
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
    const service = state.services.find((item) => item.id === serviceId);
    if (!service) return;

    $('serviceId').value = service.id;
    $('serviceName').value = service.name || '';
    $('serviceAddress').value = service.client_address || '';
    $('serviceZone').value = service.zone || '';
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
    const assignment = state.assignments.find((item) => item.id === assignmentId);
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
    await loadAllDataWithRetry(3, 300);
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
      frequency_type: serviceFrequency ? serviceFrequency.value : 'fixed',
      notes: serviceNotes ? serviceNotes.value.trim() || null : null,
    };

    const request = serviceId
      ? supabase.from('services').update(payload).eq('id', serviceId)
      : supabase.from('services').insert(payload);

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
    await loadAllDataWithRetry(3, 300);
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
    await loadAllDataWithRetry(3, 300);
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
    await loadAllDataWithRetry(3, 300);
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

  const { error } = await supabase.from('workers').delete().eq('id', workerId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.workerDialog.close();
  await loadAllDataWithRetry(2, 250);
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

  const { error } = await supabase.from('services').delete().eq('id', serviceId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.serviceDialog.close();
  await loadAllDataWithRetry(2, 250);
}

async function deleteAssignment() {
  if (!ensureDataReady('eliminar la asignación')) return;

  const assignmentId = $('assignmentId').value.trim();
  if (!assignmentId) return;

  if (!confirm('¿Eliminar esta asignación del planner?')) return;

  const { error } = await supabase.from('assignments').delete().eq('id', assignmentId);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.assignmentDialog.close();
  await loadAllDataWithRetry(2, 250);
}

function handleDynamicClicks(event) {
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
          ['Servicio', 'Zona', 'Dirección', 'Frecuencia'],
          ...uncoveredServices.map((service) => [
            service.name,
            service.zone || '',
            service.client_address || '',
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
                const service = state.services.find((service) => service.id === item.service_id);
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
          ['Servicio', 'Dirección', 'Zona', 'Frecuencia', 'Notas', 'Cobertura activa'],
          ...services.map((service) => {
            const assignments = getServiceAssignments(service.id);
            return [
              service.name,
              service.client_address || '',
              service.zone || '',
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
          ['Servicio', 'Día', 'Operario', 'Horario'],
          ...services.flatMap((service) => {
            const assignments = getServiceAssignments(service.id);
            const rows = [];
            DAYS.forEach((day) => {
              const dayItems = assignments.filter((item) => item.day_of_week === day.value);
              if (!dayItems.length) {
                rows.push([service.name, day.fullLabel, 'Sin cobertura', '']);
                return;
              }
              dayItems.forEach((item) => {
                const worker = state.workers.find((worker) => worker.id === item.worker_id);
                rows.push([
                  service.name,
                  day.fullLabel,
                  worker?.name || '',
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
    const worker = state.workers.find((row) => row.id === assignment.worker_id);
    const service = state.services.find((row) => row.id === assignment.service_id);
    const hay = [worker?.name || '', service?.name || '', service?.zone || '', service?.client_address || '']
      .join(' ')
      .toLowerCase();
    return hay.includes(searchTerm);
  });

  return {
    sheets: [
      {
        name: 'Planner',
        rows: [
          ['Día', 'Servicio', 'Operario', 'Horario', 'Notas'],
          ...filteredAssignments.map((item) => {
            const worker = state.workers.find((row) => row.id === item.worker_id);
            const service = state.services.find((row) => row.id === item.service_id);
            const day = DAYS.find((d) => d.value === item.day_of_week);
            return [
              day?.fullLabel || '',
              service?.name || '',
              worker?.name || '',
              `${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}`,
              item.notes || '',
            ];
          }),
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

function bindEvents() {
  el.loginForm?.addEventListener('submit', handleLogin);
  el.logoutBtn?.addEventListener('click', handleLogout);
  el.refreshBtn?.addEventListener('click', () => loadAllDataWithRetry(4, 500));
  el.navTabs?.addEventListener('click', handleViewChange);
  el.globalSearch?.addEventListener('input', handleFilterChange);
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

  el.workerForm?.addEventListener('submit', saveWorker);
  el.serviceForm?.addEventListener('submit', saveService);
  el.assignmentForm?.addEventListener('submit', saveAssignment);
  el.bulkAssignmentForm?.addEventListener('submit', saveBulkAssignments);

  $('deleteWorkerBtn')?.addEventListener('click', deleteWorker);
  $('deleteServiceBtn')?.addEventListener('click', deleteService);
  $('deleteAssignmentBtn')?.addEventListener('click', deleteAssignment);

  el.workersTableBody?.addEventListener('click', handleDynamicClicks);
  el.servicesGrid?.addEventListener('click', handleDynamicClicks);
  el.plannerBoard?.addEventListener('click', handleDynamicClicks);

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
      addWorkerBtn: $('addWorkerBtn'),
      addServiceBtn: $('addServiceBtn'),
      addAssignmentBtn: $('addAssignmentBtn'),
      bulkAssignmentBtn: $('bulkAssignmentBtn'),
      workerDialog: $('workerDialog'),
      serviceDialog: $('serviceDialog'),
      assignmentDialog: $('assignmentDialog'),
      bulkAssignmentDialog: $('bulkAssignmentDialog'),
      workerForm: $('workerForm'),
      serviceForm: $('serviceForm'),
      assignmentForm: $('assignmentForm'),
      bulkAssignmentForm: $('bulkAssignmentForm'),
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

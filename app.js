import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const DAYS = [
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
  { value: 0, label: 'Dom' },
];

const TYPE_META = {
  full_time: { label: 'Jornada completa', defaultHours: 44 },
  part_time: { label: 'Media jornada', defaultHours: 24 },
  insurance: { label: 'Seguro / por hora', defaultHours: null },
};

const state = {
  user: null,
  workers: [],
  services: [],
  assignments: [],
  filters: {
    search: '',
    workerType: 'all',
    status: 'all',
  },
  realtimeChannel: null,
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

function getTargetHours(worker) {
  return worker.target_hours ?? TYPE_META[worker.worker_type]?.defaultHours ?? null;
}

function getWorkerAssignments(workerId) {
  return state.assignments.filter((item) => item.worker_id === workerId);
}

function getServiceAssignments(serviceId) {
  return state.assignments.filter((item) => item.service_id === serviceId);
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
    .filter(matchesFilters);
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

function getServicesWithGaps() {
  return state.services
    .map((service) => {
      const assignments = getServiceAssignments(service.id);
      const coveredDays = [...new Set(assignments.map((item) => item.day_of_week))];
      const hasGap = coveredDays.length === 0 || coveredDays.length < 3;

      return {
        ...service,
        assignments,
        coveredDays,
        hasGap,
      };
    })
    .filter((service) => service.hasGap);
}

function populateSelects() {
  const workerOptions = state.workers
    .map(
      (worker) => `<option value="${worker.id}">${escapeHtml(worker.name)}</option>`
    )
    .join('');

  const serviceOptions = state.services
    .map(
      (service) => `<option value="${service.id}">${escapeHtml(service.name)}</option>`
    )
    .join('');

  $('assignmentWorker').innerHTML = workerOptions;
  $('assignmentService').innerHTML = serviceOptions;
}

function renderKpis(summaries) {
  const totalAssignedHours = summaries.reduce((sum, worker) => sum + worker.totalHours, 0);
  const availableWorkers = summaries.filter((worker) => worker.status === 'available').length;
  const overloadedWorkers = summaries.filter((worker) => worker.status === 'over').length;
  const uncoveredServices = getServicesWithGaps().length;

  const cards = [
    {
      label: 'Operarios activos',
      value: summaries.length,
      foot: `${state.services.length} servicios cargados`,
    },
    {
      label: 'Horas asignadas',
      value: formatHours(totalAssignedHours),
      foot: 'Suma semanal actual',
    },
    {
      label: 'Operarios con horas libres',
      value: availableWorkers,
      foot: 'Capacidad para reubicar',
    },
    {
      label: 'Servicios con gaps',
      value: uncoveredServices,
      foot: overloadedWorkers
        ? `${overloadedWorkers} operarios excedidos`
        : 'Sin excesos detectados',
    },
  ];

  el.kpiCards.innerHTML = cards
    .map(
      (card) => `
        <article class="kpi-card">
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
        Sin desvíos relevantes. Un milagro operativo, poco frecuente pero real.
      </div>
    `;
}

function renderServiceGaps() {
  const gaps = getServicesWithGaps().slice(0, 8);

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
                <span class="status-pill status-over">Cobertura parcial</span>
              </article>
            `
          )
          .join('')}
      </div>
    `
    : `
      <div class="empty-state">
        No se detectaron servicios sin cobertura mínima según la carga actual.
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
  const term = state.filters.search;

  const services = state.services.filter((service) => {
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
  el.plannerBoard.innerHTML = DAYS.map((day) => {
    const items = state.assignments.filter((assignment) => assignment.day_of_week === day.value);

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

  document.querySelectorAll('.nav-tab').forEach((tab) => tab.classList.remove('active'));
  button.classList.add('active');

  const target = button.dataset.view;
  document.querySelectorAll('.view').forEach((view) => view.classList.add('hidden'));
  $(`${target}View`).classList.remove('hidden');
}

function handleFilterChange() {
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
    console.error(workersRes.error || servicesRes.error || assignmentsRes.error);
    alert('No se pudieron cargar los datos. Revisá la configuración de Supabase y las policies.');
    return;
  }

  state.workers = workersRes.data || [];
  state.services = servicesRes.data || [];
  state.assignments = assignmentsRes.data || [];

  populateSelects();
  renderAll();
}

function subscribeRealtime() {
  if (state.realtimeChannel) {
    supabase.removeChannel(state.realtimeChannel);
  }

  state.realtimeChannel = supabase
    .channel('planner-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, () => loadAllData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => loadAllData())
    .subscribe();
}

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (session?.user) {
    state.user = session.user;
    showMain();
    await loadAllData();
    subscribeRealtime();
  } else {
    showAuth();
  }

  supabase.auth.onAuthStateChange(async (_event, sessionNow) => {
    state.user = sessionNow?.user || null;

    if (state.user) {
      showMain();
      await loadAllData();
      subscribeRealtime();
    } else {
      showAuth();
    }
  });
}

async function handleLogin(event) {
  event.preventDefault();
  console.log('Submit login capturado');

  el.authMessage.textContent = 'Validando acceso...';

  const email = $('email').value.trim();
  const password = $('password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Error login:', error);
    el.authMessage.textContent = error.message;
    return;
  }

  el.authMessage.textContent = '';
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

function openWorkerDialog() {
  el.workerForm.reset();
  el.workerDialog.showModal();
}

function openServiceDialog() {
  el.serviceForm.reset();
  el.serviceDialog.showModal();
}

function openAssignmentDialog() {
  el.assignmentForm.reset();
  populateSelects();
  el.assignmentDialog.showModal();
}

async function saveWorker(event) {
  event.preventDefault();

  const payload = {
    name: $('workerName').value.trim(),
    worker_type: $('workerType').value,
    target_hours: $('workerTargetHours').value ? Number($('workerTargetHours').value) : null,
    notes: $('workerNotes').value.trim() || null,
  };

  const { error } = await supabase.from('workers').insert(payload);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.workerDialog.close();
  await loadAllData();
}

async function saveService(event) {
  event.preventDefault();

  const payload = {
    name: $('serviceName').value.trim(),
    client_address: $('serviceAddress').value.trim() || null,
    zone: $('serviceZone').value.trim() || null,
    frequency_type: $('serviceFrequency').value,
    notes: $('serviceNotes').value.trim() || null,
  };

  const { error } = await supabase.from('services').insert(payload);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.serviceDialog.close();
  await loadAllData();
}

async function saveAssignment(event) {
  event.preventDefault();

  const payload = {
    worker_id: $('assignmentWorker').value,
    service_id: $('assignmentService').value,
    day_of_week: Number($('assignmentDay').value),
    start_time: $('assignmentStart').value,
    end_time: $('assignmentEnd').value,
    notes: $('assignmentNotes').value.trim() || null,
    is_active: true,
  };

  const { error } = await supabase.from('assignments').insert(payload);

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  el.assignmentDialog.close();
  await loadAllData();
}

function bindEvents() {
  el.loginForm.addEventListener('submit', handleLogin);
  el.logoutBtn.addEventListener('click', handleLogout);
  el.refreshBtn.addEventListener('click', loadAllData);
  el.navTabs.addEventListener('click', handleViewChange);
  el.globalSearch.addEventListener('input', handleFilterChange);
  el.workerTypeFilter.addEventListener('change', handleFilterChange);
  el.statusFilter.addEventListener('change', handleFilterChange);

  el.addWorkerBtn.addEventListener('click', openWorkerDialog);
  el.addServiceBtn.addEventListener('click', openServiceDialog);
  el.addAssignmentBtn.addEventListener('click', openAssignmentDialog);

  el.workerForm.addEventListener('submit', saveWorker);
  el.serviceForm.addEventListener('submit', saveService);
  el.assignmentForm.addEventListener('submit', saveAssignment);

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => $(button.dataset.close).close());
  });
}

function boot() {
  try {
    console.log('Boot iniciando...');

    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      console.error('Falta configurar supabase-config.js');
      alert('Falta configurar supabase-config.js');
      return;
    }

    supabase = createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    console.log('Supabase client OK');

    Object.assign(el, {
      authView: $('authView'),
      mainView: $('mainView'),
      loginForm: $('loginForm'),
      authMessage: $('authMessage'),
      logoutBtn: $('logoutBtn'),
      refreshBtn: $('refreshBtn'),
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
      workerDialog: $('workerDialog'),
      serviceDialog: $('serviceDialog'),
      assignmentDialog: $('assignmentDialog'),
      workerForm: $('workerForm'),
      serviceForm: $('serviceForm'),
      assignmentForm: $('assignmentForm'),
    });

    if (!el.loginForm) {
      throw new Error('No se encontró #loginForm');
    }

    bindEvents();
    initAuth();
  } catch (error) {
    console.error('Error en boot():', error);
    alert(`Error al iniciar la app: ${error.message}`);
  }
}

document.addEventListener('DOMContentLoaded', boot);

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
};

const el = {};
let supabase;

function $(id) {
  return document.getElementById(id);
}

function boot() {
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    alert('Falta configurar supabase-config.js');
    return;
  }

  supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

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

  bindEvents();
  initAuth();
}

function bindEvents() {
  el.loginForm.addEventListener('submit', handleLogin);
  el.logoutBtn.addEventListener('click', handleLogout);
  el.refreshBtn.addEventListener('click', loadAllData);
  el.navTabs.addEventListener('click', handleViewChange);
  el.globalSearch.addEventListener('input', handleFilterChange);
  el.workerTypeFilter.addEventListener('change', handleFilterChange);
  el.statusFilter.addEventListener('change', handleFilterChange);

  el.addWorkerBtn.addEventListener('click', () => openWorkerDialog());
  el.addServiceBtn.addEventListener('click', () => openServiceDialog());
  el.addAssignmentBtn.addEventListener('click', () => openAssignmentDialog());

  el.workerForm.addEventListener('submit', saveWorker);
  el.serviceForm.addEventListener('submit', saveService);
  el.assignmentForm.addEventListener('submit', saveAssignment);

  document.querySelectorAll('[data-close]').forEach((button) => {
    button.addEventListener('click', () => $(button.dataset.close).close());
  });
}

async function initAuth() {
  const { data } = await supabase.auth.getSession();
  const session = data.session;

  if (session?.user) {
    state.user = session.user;
    showMain();
    await loadAllData();
    subscribeRealtime();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    state.user = session?.user || null;
    if (state.user) {
      showMain();
      await loadAllData();
    } else {
      showAuth();
    }
  });
}

async function handleLogin(event) {
  event.preventDefault();
  el.authMessage.textContent = 'Validando acceso...';

  const email = $('email').value.trim();
  const password = $('password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  el.authMessage.textContent = error ? error.message : '';
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
    alert('No se pudieron cargar los datos. Revisá la configuración de Supabase y las políticas.');
    return;
  }

  state.workers = workersRes.data || [];
  state.services = servicesRes.data || [];
  state.assignments = assignmentsRes.data || [];
  populateSelects();
  renderAll();
}

function subscribeRealtime() {
  supabase.channel('planner-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, loadAllData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, loadAllData)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, loadAllData)
    .subscribe();
}

function populateSelects() {
  $('assignmentWorker').innerHTML = state.workers.map((worker) => `<option value="${worker.id}">${escapeHtml(worker.name)}</option>`).join('');
  $('assignmentService').innerHTML = state.services.map((service) => `<option value="${service.id}">${escapeHtml(service.name)}</option>`).join('');
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

function getWorkerAssignments(workerId) {
  return state.assignments.filter((item) => item.worker_id === workerId);
}

function getServiceAssignments(serviceId) {
  return state.assignments.filter((item) => item.service_id === serviceId);
}

function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  return ((eh * 60 + em) - (sh * 60 + sm)) / 60;
}

function getWorkerSummaries() {
  return state.workers.map((worker) => {
    const assignments = getWorkerAssignments(worker.id);
    const totalHours = assignments.reduce((sum, assignment) => sum + calculateHours(assignment.start_time, assignment.end_time), 0);
    const targetHours = worker.target_hours ?? TYPE_META[worker.worker_type]?.defaultHours ?? null;
    const difference = targetHours == null ? null : Number((targetHours - totalHours).toFixed(2));
    const serviceIds = [...new Set(assignments.map((assignment) => assignment.service_id))];
    const services = serviceIds.map((id) => state.services.find((service) => service.id === id)).filter(Boolean);

    let status = 'balanced';
    if (difference == null) status = 'insurance';
    else if (difference > 0) status = 'available';
    else if (difference < 0) status = 'over';

    return {
      ...worker,
      assignments,
      totalHours: Number(totalHours.toFixed(2)),
      targetHours,
      difference,
      services,
      status,
    };
  }).filter(matchesFilters);
}

function matchesFilters(summary) {
  const term = state.filters.search;
  const searchOk = !term || [summary.name, summary.notes || '', ...summary.services.map((service) => `${service.name} ${service.zone || ''} ${service.client_address || ''}`)]
    .join(' ')
    .toLowerCase()
    .includes(term);

  const typeOk = state.filters.workerType === 'all' || summary.worker_type === state.filters.workerType;
  const statusOk = state.filters.status === 'all' || summary.status === state.filters.status;
  return searchOk && typeOk && statusOk;
}

function renderKpis(summaries) {
  const totalAssignedHours = summaries.reduce((sum, worker) => sum + worker.totalHours, 0);
  const availableWorkers = summaries.filter((worker) => worker.status === 'available').length;
  const overloadedWorkers = summaries.filter((worker) => worker.status === 'over').length;
  const uncoveredServices = getServicesWithGaps().length;

  const cards = [
    { label: 'Operarios activos', value: summaries.length, foot: `${state.services.length} servicios cargados` },
    { label: 'Horas asignadas', value: totalAssignedHours, foot: 'Suma semanal actual' },
    { label: 'Operarios con horas libres', value: availableWorkers, foot: 'Capacidad para reubicar' },
    { label: 'Servicios con gaps', value: uncoveredServices, foot: overloadedWorkers ? `${overloadedWorkers} operarios excedidos` : 'Sin excesos detectados' },
  ];

  el.kpiCards.innerHTML = cards.map((card) => `
    <article class="kpi-card card">
      <div class="muted small">${card.label}</div>
      <div class="kpi-value">${card.value}</div>
      <div class="kpi-foot">${card.foot}</div>
    </article>
  `).join('');
}

function renderCriticalWorkers(summaries) {
  const critical = summaries
    .filter((worker) => worker.status === 'available' || worker.status === 'over')
    .sort((a, b) => Math.abs(b.difference || 0) - Math.abs(a.difference || 0))
    .slice(0, 8);

  el.criticalWorkers.innerHTML = critical.length ? `
    <div class="critical-list">
      ${critical.map((worker) => `
        <div class="list-card">
          <div>
            <strong>${escapeHtml(worker.name)}</strong>
            <div class="muted small">${TYPE_META[worker.worker_type].label}</div>
          </div>
          ${renderDifferencePill(worker)}
        </div>
      `).join('')}
    </div>
  ` : `<p class="muted">Sin desvíos relevantes. Un milagro operativo, poco frecuente pero real.</p>`;
}

function getServicesWithGaps() {
  return state.services.map((service) => {
    const assignments = getServiceAssignments(service.id);
    const coveredDays = [...new Set(assignments.map((item) => item.day_of_week))];
    const hasGap = coveredDays.length === 0 || coveredDays.length < 3;
    return { ...service, assignments, coveredDays, hasGap };
  }).filter((service) => service.hasGap);
}

function renderServiceGaps() {
  const gaps = getServicesWithGaps().slice(0, 8);
  el.serviceGaps.innerHTML = gaps.length ? `
    <div class="gap-list">
      ${gaps.map((service) => `
        <div class="list-card">
          <div>
            <strong>${escapeHtml(service.name)}</strong>
            <div class="muted small">${escapeHtml(service.zone || 'Sin zona')}</div>
          </div>
          <span class="pill warning">Cobertura parcial</span>
        </div>
      `).join('')}
    </div>
  ` : `<p class="muted">No se detectaron servicios sin cobertura mínima según la carga actual.</p>`;
}

function renderWorkersTable(summaries) {
  el.workersTableBody.innerHTML = summaries.map((worker) => `
    <tr>
      <td>
        <strong>${escapeHtml(worker.name)}</strong>
        <div class="muted small">${escapeHtml(worker.notes || '')}</div>
      </td>
      <td>${TYPE_META[worker.worker_type].label}</td>
      <td>${worker.targetHours == null ? 'SEGURO' : worker.targetHours}</td>
      <td>${worker.totalHours}</td>
      <td>${worker.difference == null ? 'SEGURO' : worker.difference}</td>
      <td>${renderStatusPill(worker.status)}</td>
      <td>
        <div class="tag-list">
          ${worker.services.length ? worker.services.map((service) => `<span class="pill info">${escapeHtml(service.name)}</span>`).join('') : '<span class="muted small">Sin servicio</span>'}
        </div>
      </td>
      <td>
        <div class="action-row">
          <button class="text-link" type="button" onclick="window.editWorker('${worker.id}')">Editar</button>
          <button class="text-link" type="button" onclick="window.openAssignmentForWorker('${worker.id}')">Asignar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderWorkerAvailability(summaries) {
  el.workerAvailabilityBoard.innerHTML = summaries.map((worker) => {
    const assignmentsByDay = DAYS.map((day) => {
      const dayAssignments = worker.assignments.filter((item) => item.day_of_week === day.value);
      return { ...day, items: dayAssignments };
    });

    return `
      <article class="availability-card">
        <div class="availability-card-header">
          <div>
            <h3>${escapeHtml(worker.name)}</h3>
            <div class="muted small">${TYPE_META[worker.worker_type].label}</div>
          </div>
          ${renderDifferencePill(worker)}
        </div>
        <div class="day-bars">
          ${assignmentsByDay.map((day) => `
            <div class="day-bar">
              <h4>${day.label}</h4>
              ${day.items.length
                ? day.items.map((item) => {
                    const service = state.services.find((service) => service.id === item.service_id);
                    return `<span class="slot">${item.start_time.slice(0,5)}-${item.end_time.slice(0,5)} · ${escapeHtml(service?.name || 'Servicio')}</span>`;
                  }).join('')
                : '<span class="free">Libre</span>'}
            </div>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function renderServices() {
  const term = state.filters.search;
  const services = state.services.filter((service) => {
    const hay = [service.name, service.zone || '', service.client_address || '', service.notes || ''].join(' ').toLowerCase();
    return !term || hay.includes(term);
  });

  el.servicesGrid.innerHTML = services.map((service) => {
    const assignments = getServiceAssignments(service.id);
    const serviceDays = DAYS.map((day) => ({
      ...day,
      items: assignments.filter((item) => item.day_of_week === day.value),
    }));

    return `
      <article class="service-card">
        <div class="service-card-header">
          <div>
            <h3>${escapeHtml(service.name)}</h3>
            <div class="muted small">${escapeHtml(service.client_address || 'Sin dirección')}</div>
          </div>
          <span class="pill info">${escapeHtml(service.frequency_type || 'fixed')}</span>
        </div>
        <div class="tag-list">
          <span class="pill success">${escapeHtml(service.zone || 'Sin zona')}</span>
          ${service.notes ? `<span class="pill warning">Con notas</span>` : ''}
        </div>
        <div class="service-week">
          ${serviceDays.map((day) => `
            <div class="service-day">
              <strong>${day.label}</strong>
              ${day.items.length ? day.items.map((item) => {
                const worker = state.workers.find((worker) => worker.id === item.worker_id);
                return `<div class="small">${escapeHtml(worker?.name || 'Sin asignar')}<br>${item.start_time.slice(0,5)}-${item.end_time.slice(0,5)}</div>`;
              }).join('') : '<div class="small muted">Sin cobertura</div>'}
            </div>
          `).join('')}
        </div>
        <div class="action-row" style="margin-top:14px">
          <button class="text-link" type="button" onclick="window.editService('${service.id}')">Editar</button>
          <button class="text-link" type="button" onclick="window.openAssignmentForService('${service.id}')">Asignar</button>
        </div>
      </article>
    `;
  }).join('');
}

function renderPlanner() {
  el.plannerBoard.innerHTML = DAYS.map((day) => {
    const items = state.assignments.filter((assignment) => assignment.day_of_week === day.value);
    return `
      <div class="planner-column">
        <h4>${day.label}</h4>
        ${items.length ? items.map((item) => {
          const worker = state.workers.find((row) => row.id === item.worker_id);
          const service = state.services.find((row) => row.id === item.service_id);
          return `
            <div class="assignment-chip">
              <h5>${escapeHtml(service?.name || 'Servicio')}</h5>
              <p>${escapeHtml(worker?.name || 'Operario')} · ${item.start_time.slice(0,5)}-${item.end_time.slice(0,5)}</p>
              <div class="action-row">
                <button class="text-link" type="button" onclick="window.editAssignment('${item.id}')">Editar</button>
                <button class="text-link" type="button" onclick="window.deleteAssignment('${item.id}')">Eliminar</button>
              </div>
            </div>
          `;
        }).join('') : '<div class="assignment-chip"><p>Sin asignaciones</p></div>'}
      </div>
    `;
  }).join('');
}

function renderStatusPill(status) {
  switch (status) {
    case 'available':
      return '<span class="pill warning">Horas libres</span>';
    case 'over':
      return '<span class="pill danger">Excedido</span>';
    case 'insurance':
      return '<span class="pill info">Seguro</span>';
    default:
      return '<span class="pill success">En objetivo</span>';
  }
}

function renderDifferencePill(worker) {
  if (worker.difference == null) return '<span class="pill info">SEGURO</span>';
  if (worker.difference > 0) return `<span class="pill warning">Faltan ${worker.difference} hs</span>`;
  if (worker.difference < 0) return `<span class="pill danger">Exceso ${Math.abs(worker.difference)} hs</span>`;
  return '<span class="pill success">Objetivo cumplido</span>';
}

function openWorkerDialog(worker = null) {
  $('workerDialogTitle').textContent = worker ? 'Editar operario' : 'Nuevo operario';
  $('workerId').value = worker?.id || '';
  $('workerName').value = worker?.name || '';
  $('workerType').value = worker?.worker_type || 'full_time';
  $('workerTargetHours').value = worker?.target_hours ?? '';
  $('workerNotes').value = worker?.notes || '';
  el.workerDialog.showModal();
}

function openServiceDialog(service = null) {
  $('serviceDialogTitle').textContent = service ? 'Editar servicio' : 'Nuevo servicio';
  $('serviceId').value = service?.id || '';
  $('serviceName').value = service?.name || '';
  $('serviceClientAddress').value = service?.client_address || '';
  $('serviceZone').value = service?.zone || '';
  $('serviceFrequency').value = service?.frequency_type || 'fixed';
  $('serviceNotes').value = service?.notes || '';
  el.serviceDialog.showModal();
}

function openAssignmentDialog(assignment = null, preset = {}) {
  $('assignmentDialogTitle').textContent = assignment ? 'Editar asignación' : 'Nueva asignación';
  $('assignmentId').value = assignment?.id || '';
  $('assignmentWorker').value = assignment?.worker_id || preset.workerId || state.workers[0]?.id || '';
  $('assignmentService').value = assignment?.service_id || preset.serviceId || state.services[0]?.id || '';
  $('assignmentDay').value = String(assignment?.day_of_week ?? 1);
  $('assignmentStart').value = assignment?.start_time || '08:00';
  $('assignmentEnd').value = assignment?.end_time || '12:00';
  $('assignmentNotes').value = assignment?.notes || '';
  el.assignmentDialog.showModal();
}

async function saveWorker(event) {
  event.preventDefault();
  const id = $('workerId').value;
  const workerType = $('workerType').value;
  const targetHoursRaw = $('workerTargetHours').value;

  const payload = {
    name: $('workerName').value.trim(),
    worker_type: workerType,
    target_hours: targetHoursRaw ? Number(targetHoursRaw) : TYPE_META[workerType].defaultHours,
    notes: $('workerNotes').value.trim(),
  };

  const query = id ? supabase.from('workers').update(payload).eq('id', id) : supabase.from('workers').insert(payload);
  const { error } = await query;
  if (error) return alert(error.message);
  el.workerDialog.close();
}

async function saveService(event) {
  event.preventDefault();
  const id = $('serviceId').value;
  const payload = {
    name: $('serviceName').value.trim(),
    client_address: $('serviceClientAddress').value.trim(),
    zone: $('serviceZone').value.trim(),
    frequency_type: $('serviceFrequency').value,
    notes: $('serviceNotes').value.trim(),
  };

  const query = id ? supabase.from('services').update(payload).eq('id', id) : supabase.from('services').insert(payload);
  const { error } = await query;
  if (error) return alert(error.message);
  el.serviceDialog.close();
}

async function saveAssignment(event) {
  event.preventDefault();
  const id = $('assignmentId').value;
  const payload = {
    worker_id: $('assignmentWorker').value,
    service_id: $('assignmentService').value,
    day_of_week: Number($('assignmentDay').value),
    start_time: $('assignmentStart').value,
    end_time: $('assignmentEnd').value,
    notes: $('assignmentNotes').value.trim(),
    is_active: true,
  };

  if (calculateHours(payload.start_time, payload.end_time) <= 0) {
    alert('El horario de fin debe ser mayor al de inicio. Parece obvio, pero la planilla original venía bastante creativa.');
    return;
  }

  const query = id ? supabase.from('assignments').update(payload).eq('id', id) : supabase.from('assignments').insert(payload);
  const { error } = await query;
  if (error) return alert(error.message);
  el.assignmentDialog.close();
}

async function deleteAssignment(id) {
  if (!confirm('¿Eliminar esta asignación?')) return;
  const { error } = await supabase.from('assignments').update({ is_active: false }).eq('id', id);
  if (error) alert(error.message);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

window.editWorker = (id) => openWorkerDialog(state.workers.find((item) => item.id === id));
window.editService = (id) => openServiceDialog(state.services.find((item) => item.id === id));
window.editAssignment = (id) => openAssignmentDialog(state.assignments.find((item) => item.id === id));
window.deleteAssignment = deleteAssignment;
window.openAssignmentForWorker = (workerId) => openAssignmentDialog(null, { workerId });
window.openAssignmentForService = (serviceId) => openAssignmentDialog(null, { serviceId });

boot();

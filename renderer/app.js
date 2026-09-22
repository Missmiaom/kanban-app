'use strict';

const COLUMNS = [
  { key: 'Backlog', label: 'Backlog' },
  { key: 'Todo', label: 'To Do' },
  { key: 'In Progress', label: 'In Progress' },
  { key: 'In Review', label: 'In Review' },
  { key: 'Done', label: 'Done' }
];

const state = {
  tasks: [],
  nextId: 1,
  columns: COLUMNS,
  dragId: null,
  editingId: null,
  selectedId: null
};

const boardEl = document.getElementById('board');
const createBtn = document.getElementById('create-task-btn');
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const detailModal = document.getElementById('detail-modal');

/* ---------- Theme ---------- */

const THEME_KEY = 'kanban-theme';

function prefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// Returns the effective theme: explicit stored choice, else the OS preference.
function currentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return prefersDark() ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    // Show the icon of the theme you'd switch TO.
    const dark = theme === 'dark';
    btn.textContent = dark ? '☀️' : '🌙';
    btn.title = dark ? 'Switch to light theme' : 'Switch to dark theme';
    btn.setAttribute('aria-label', btn.title);
  }
}

function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (err) {
    console.error('Failed to persist theme', err);
  }
  applyTheme(next);
}

/* ---------- Persistence ---------- */

async function loadState() {
  try {
    const data = await window.kanbanAPI.loadData();
    if (data && Array.isArray(data.tasks)) {
      state.tasks = data.tasks;
      state.nextId = data.nextId ||
        (state.tasks.length ? Math.max(...state.tasks.map((t) => t.id)) + 1 : 1);
    }
  } catch (err) {
    console.error('Failed to load data', err);
  }
}

async function saveState() {
  try {
    await window.kanbanAPI.saveData({ tasks: state.tasks, nextId: state.nextId });
  } catch (err) {
    console.error('Failed to save data', err);
  }
}

/* ---------- Helpers ---------- */

function statusLabel(key) {
  const c = state.columns.find((x) => x.key === key);
  return c ? c.label : key;
}

function initials(name) {
  if (!name || !name.trim()) return null;
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

/* ---------- Rendering ---------- */

function buildColumn(col) {
  const column = document.createElement('div');
  column.className = 'column';
  column.dataset.tone = col.key;

  const header = document.createElement('div');
  header.className = 'column-header';
  const title = document.createElement('span');
  title.textContent = col.label;
  const count = document.createElement('span');
  count.className = 'column-count';
  count.dataset.count = col.key;
  header.appendChild(title);
  header.appendChild(count);
  column.appendChild(header);

  const body = document.createElement('div');
  body.className = 'column-body';
  body.dataset.column = col.key;
  body.addEventListener('dragover', onColumnDragOver);
  body.addEventListener('drop', (e) => onColumnDrop(e, col.key));
  body.addEventListener('dragleave', onColumnDragLeave);
  column.appendChild(body);

  return column;
}

function renderCard(task, body) {
  const card = document.createElement('div');
  card.className = 'card';
  card.draggable = true;
  card.dataset.taskId = task.id;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', 'Open task ' + task.summary);

  const summary = document.createElement('div');
  summary.className = 'card-summary';
  summary.textContent = task.summary;
  card.appendChild(summary);

  const footer = document.createElement('div');
  footer.className = 'card-footer';
  const left = document.createElement('div');

  const key = document.createElement('span');
  key.className = 'issue-key';
  key.textContent = 'KAN-' + task.id;
  left.appendChild(key);
  left.appendChild(document.createTextNode(' '));

  const prio = document.createElement('span');
  prio.className = 'priority-badge priority-' + task.priority;
  prio.textContent = task.priority;
  left.appendChild(prio);

  const av = document.createElement('span');
  const initVal = initials(task.assignee);
  av.className = 'avatar' + (initVal ? '' : ' unassigned');
  av.textContent = initVal || '?';
  av.title = task.assignee || 'Unassigned';

  footer.appendChild(left);
  footer.appendChild(av);
  card.appendChild(footer);

  card.addEventListener('click', () => openDetail(task.id));
  card.addEventListener('dragstart', onDragStart);
  card.addEventListener('dragend', onDragEnd);
  body.appendChild(card);
}

function renderBoard() {
  boardEl.innerHTML = '';
  state.columns.forEach((c) => boardEl.appendChild(buildColumn(c)));
  renderCounts();
  renderTasks();
}

function renderTasks() {
  state.columns.forEach((col) => {
    const body = document.querySelector(`.column-body[data-column="${col.key}"]`);
    body.querySelectorAll('.card').forEach((c) => c.remove());
    const items = state.tasks.filter((t) => t.status === col.key);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'column-empty';
      empty.textContent = 'Drop tasks here';
      body.appendChild(empty);
    } else {
      items.forEach((t) => renderCard(t, body));
    }
  });
  renderCounts();
}

function renderCounts() {
  state.columns.forEach((c) => {
    const n = state.tasks.filter((t) => t.status === c.key).length;
    const el = document.querySelector(`.column-count[data-count="${c.key}"]`);
    if (el) el.textContent = n;
  });
}

/* ---------- Drag & Drop ---------- */

function onDragStart(e) {
  const card = e.target.closest('.card');
  if (!card) return;
  state.dragId = Number(card.dataset.taskId);
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  try {
    e.dataTransfer.setData('text/plain', '' + state.dragId);
  } catch (err) { /* ignore */ }
}

function onDragEnd(e) {
  const card = e.target.closest('.card');
  if (card) card.classList.remove('dragging');
  document.querySelectorAll('.column-body').forEach((b) => b.classList.remove('drag-over'));
  state.dragId = null;
}

function onColumnDragOver(e) {
  if (state.dragId === null) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}

function onColumnDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function onColumnDrop(e, targetColumn) {
  e.preventDefault();
  e.stopPropagation();
  const id = state.dragId;
  document.querySelectorAll('.column-body').forEach((b) => b.classList.remove('drag-over'));
  if (id == null) return;
  const task = state.tasks.find((t) => t.id === id);
  if (task && task.status !== targetColumn) {
    task.status = targetColumn;
    task.updatedAt = new Date().toISOString();
    saveState().then(renderTasks);
  }
  state.dragId = null;
}

/* ---------- Create / Edit modal ---------- */

function populateStatusSelect() {
  const sel = taskForm['field-status'];
  sel.innerHTML = '';
  state.columns.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.key;
    opt.textContent = c.label;
    sel.appendChild(opt);
  });
}

function openCreate() {
  state.editingId = null;
  modalTitle.textContent = 'Create Task';
  taskForm['field-id'].value = '';
  taskForm['field-summary'].value = '';
  taskForm['field-desc'].value = '';
  taskForm['field-priority'].value = 'Medium';
  taskForm['field-assignee'].value = '';
  populateStatusSelect();
  taskForm['field-status'].value = 'Backlog';
  taskModal.classList.remove('hidden');
  taskForm['field-summary'].focus();
}

function openEdit(task) {
  state.editingId = task.id;
  modalTitle.textContent = 'Edit Task';
  taskForm['field-id'].value = task.id;
  taskForm['field-summary'].value = task.summary;
  taskForm['field-desc'].value = task.description || '';
  taskForm['field-priority'].value = task.priority || 'Medium';
  taskForm['field-assignee'].value = task.assignee || '';
  populateStatusSelect();
  taskForm['field-status'].value = task.status;
  taskModal.classList.remove('hidden');
  taskForm['field-summary'].focus();
}

function closeModal() {
  taskModal.classList.add('hidden');
  state.editingId = null;
}

function handleSubmit(e) {
  e.preventDefault();
  const summary = taskForm['field-summary'].value.trim();
  if (!summary) return;

  const description = taskForm['field-desc'].value.trim();
  const priority = taskForm['field-priority'].value;
  const assignee = taskForm['field-assignee'].value.trim();
  const status = taskForm['field-status'].value;

  if (state.editingId !== null) {
    const task = state.tasks.find((t) => t.id === state.editingId);
    if (task) {
      task.summary = summary;
      task.description = description;
      task.priority = priority;
      task.assignee = assignee;
      task.status = status;
      task.updatedAt = new Date().toISOString();
    }
  } else {
    const task = {
      id: state.nextId++,
      summary,
      description,
      status,
      priority,
      assignee,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.tasks.push(task);
  }

  closeModal();
  saveState().then(renderTasks);
}

/* ---------- Detail modal ---------- */

function openDetail(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  state.selectedId = id;
  document.getElementById('detail-key').textContent = 'KAN-' + task.id;
  const prioEl = document.getElementById('detail-priority');
  prioEl.className = 'priority-badge priority-' + task.priority;
  prioEl.textContent = task.priority;
  document.getElementById('detail-status').textContent = statusLabel(task.status);
  document.getElementById('detail-title').textContent = task.summary;
  document.getElementById('detail-desc').textContent = task.description || 'No description provided.';
  document.getElementById('detail-status-2').textContent = statusLabel(task.status);
  document.getElementById('detail-assignee').textContent = task.assignee || 'Unassigned';
  document.getElementById('detail-created').textContent =
    task.createdAt ? new Date(task.createdAt).toLocaleString() : '—';
  detailModal.classList.remove('hidden');
}

function closeDetail() {
  detailModal.classList.add('hidden');
  state.selectedId = null;
}

function deleteSelected() {
  if (state.selectedId == null) return;
  state.tasks = state.tasks.filter((t) => t.id !== state.selectedId);
  closeDetail();
  saveState().then(renderTasks);
}

/* ---------- Event wiring ---------- */

createBtn.addEventListener('click', openCreate);
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
taskForm.addEventListener('submit', handleSubmit);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('detail-close').addEventListener('click', closeDetail);
document.getElementById('detail-edit').addEventListener('click', () => {
  const task = state.tasks.find((t) => t.id === state.selectedId);
  if (task) {
    closeDetail();
    openEdit(task);
  }
});
document.getElementById('detail-delete').addEventListener('click', deleteSelected);

document.querySelectorAll('.modal').forEach((m) => {
  m.querySelectorAll('[data-close]').forEach((bd) => {
    bd.addEventListener('click', () => m.classList.add('hidden'));
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeDetail();
  }
});

/* ---------- Init ---------- */

async function init() {
  applyTheme(currentTheme());
  await loadState();
  renderBoard();
}

init();
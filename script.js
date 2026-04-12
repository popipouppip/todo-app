const COLS = ['critical', 'important', 'low', 'nodate'];
const COL_NAMES = {
  critical: '🔥 Сверхважные',
  important: '⚡ Важные',
  low: '🌿 Не очень важные',
  nodate: '🕐 Без срока'
};

let tasks = JSON.parse(localStorage.getItem('tasks') || '{"critical":[],"important":[],"low":[],"nodate":[]}');
let activeCol = null;

// Сегодняшняя дата
const today = new Date();
document.getElementById('today').textContent = today.toLocaleDateString('ru-RU', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
});

function save() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function render() {
  COLS.forEach(col => {
    const container = document.getElementById(`tasks-${col}`);
    const count = document.getElementById(`count-${col}`);
    const list = tasks[col] || [];
    count.textContent = list.filter(t => !t.done).length;

    container.innerHTML = list.map((t, i) => {
      const overdue = t.date && !t.done && new Date(t.date) < new Date(today.toDateString());
      return `
        <div class="task-card ${t.done ? 'done' : ''}" data-col="${col}">
          <div class="task-top">
            <div class="task-check" onclick="toggleDone('${col}', ${i})"></div>
            <span class="task-text">${escHtml(t.text)}</span>
            <button class="task-delete" onclick="deleteTask('${col}', ${i})">×</button>
          </div>
          ${t.date ? `<div class="task-date ${overdue ? 'overdue' : ''}">${formatDate(t.date)}${overdue ? ' — просрочено' : ''}</div>` : ''}
        </div>`;
    }).join('');
  });
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function openModal(col) {
  activeCol = col;
  document.getElementById('modal-title').textContent = 'Новая задача — ' + COL_NAMES[col];
  document.getElementById('task-text').value = '';
  document.getElementById('task-date').value = '';
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.getElementById('task-text').focus(), 50);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  activeCol = null;
}

function closeModalOutside(e) {
  if (e.target.id === 'modal') closeModal();
}

function saveTask() {
  const text = document.getElementById('task-text').value.trim();
  if (!text) return document.getElementById('task-text').focus();
  const date = document.getElementById('task-date').value;
  tasks[activeCol].unshift({ id: Date.now(), text, date, done: false });
  save();
  render();
  closeModal();
}

function toggleDone(col, i) {
  tasks[col][i].done = !tasks[col][i].done;
  save();
  render();
}

function deleteTask(col, i) {
  tasks[col].splice(i, 1);
  save();
  render();
}

// Enter в textarea → сохранить (Shift+Enter = новая строка)
document.getElementById('task-text').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTask(); }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

render();

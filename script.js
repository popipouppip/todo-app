const CONFIG = {
  critical:  { label: 'Сверхважная', color: '#ef4444', size: 115 },
  important: { label: 'Важная',       color: '#f59e0b', size: 95  },
  low:       { label: 'Не очень',     color: '#22c55e', size: 78  },
  nodate:    { label: 'Без срока',    color: '#818cf8', size: 72  },
};
const COLS = Object.keys(CONFIG);
const GAP  = 10; // отступ между пузырями

let tasks = JSON.parse(localStorage.getItem('bubbleTasks') || '[]');
let activeCol = null;
let dragging  = null;   // { idx, startMouseX, startMouseY, startTaskX, startTaskY }
let bubbleEls = new Map(); // id -> DOM element
let animFrame = null;

// ── Звёзды ──
(function () {
  const el = document.getElementById('stars');
  for (let i = 0; i < 120; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 2.5 + 0.5;
    s.style.cssText = `width:${sz}px;height:${sz}px;top:${Math.random()*100}%;left:${Math.random()*100}%;--dur:${2+Math.random()*4}s`;
    el.appendChild(s);
  }
})();

function save() { localStorage.setItem('bubbleTasks', JSON.stringify(tasks)); }

function clamp(t) {
  const r = CONFIG[t.type].size / 2;
  t.x = Math.max(r + 4, Math.min(window.innerWidth  - r - 4, t.x));
  t.y = Math.max(r + 60, Math.min(window.innerHeight - r - 90, t.y));
}

function randPos(type) {
  const r = CONFIG[type].size / 2;
  return {
    x: r + 20 + Math.random() * (window.innerWidth  - (r + 20) * 2),
    y: r + 70 + Math.random() * (window.innerHeight - (r + 70) - 110),
  };
}

// ── Физика: разрешение перекрытий ──
function resolveCollisions() {
  const n = tasks.length;
  for (let iter = 0; iter < 4; iter++) {          // 4 итерации для устойчивости
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = tasks[i], b = tasks[j];
        const ra = CONFIG[a.type].size / 2 + GAP;
        const rb = CONFIG[b.type].size / 2 + GAP;
        const minDist = ra + rb;
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
        if (dist >= minDist) continue;

        const overlap = (minDist - dist) * 0.5;
        const nx = dx / dist, ny = dy / dist;
        const fixA = dragging?.idx === i;
        const fixB = dragging?.idx === j;

        if (!fixA) { a.x -= nx * overlap * (fixB ? 2 : 1); a.y -= ny * overlap * (fixB ? 2 : 1); clamp(a); }
        if (!fixB) { b.x += nx * overlap * (fixA ? 2 : 1); b.y += ny * overlap * (fixA ? 2 : 1); clamp(b); }
      }
    }
  }
}

function updateDOM() {
  tasks.forEach(t => {
    const el = bubbleEls.get(t.id);
    if (!el || (dragging && tasks[dragging.idx]?.id === t.id)) return;
    const r = CONFIG[t.type].size / 2;
    el.style.left = (t.x - r) + 'px';
    el.style.top  = (t.y - r) + 'px';
  });
}

function physicsLoop() {
  resolveCollisions();
  updateDOM();
  animFrame = requestAnimationFrame(physicsLoop);
}

// ── Рендер ──
function render() {
  const world = document.getElementById('world');
  world.innerHTML = '';
  bubbleEls.clear();

  const counts = { critical: 0, important: 0, low: 0, nodate: 0 };

  tasks.forEach((t, i) => {
    if (!t.done) counts[t.type]++;
    const size = CONFIG[t.type].size;

    const b = document.createElement('div');
    b.className = `bubble ${t.type}${t.done ? ' done' : ''}`;
    b.style.cssText = `width:${size}px;height:${size}px;left:${t.x - size/2}px;top:${t.y - size/2}px;`;

    const inner = document.createElement('div');
    inner.className = 'bubble-inner';
    inner.style.fontSize = size > 100 ? '0.83rem' : size > 80 ? '0.76rem' : '0.69rem';
    inner.textContent = t.text;
    b.appendChild(inner);

    // Клик — открыть детали (только если не было drag)
    b.addEventListener('click', () => {
      if ((b._moved || 0) < 6) openDetail(i);
    });

    // Drag — мышь
    b.addEventListener('mousedown', e => {
      b._moved = 0;
      dragging = { idx: i, startMouseX: e.clientX, startMouseY: e.clientY, startTaskX: t.x, startTaskY: t.y };
      b.style.zIndex = 999;
      b.style.transition = 'none';
      e.preventDefault();
    });

    bubbleEls.set(t.id, b);
    world.appendChild(b);
  });

  COLS.forEach(k => { document.getElementById(`cnt-${k}`).textContent = counts[k]; });

  if (!animFrame) animFrame = requestAnimationFrame(physicsLoop);
}

// ── Mouse events ──
document.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - dragging.startMouseX;
  const dy = e.clientY - dragging.startMouseY;
  const el = bubbleEls.get(tasks[dragging.idx]?.id);
  if (el) el._moved = Math.abs(dx) + Math.abs(dy);
  tasks[dragging.idx].x = dragging.startTaskX + dx;
  tasks[dragging.idx].y = dragging.startTaskY + dy;
  clamp(tasks[dragging.idx]);
  const r = CONFIG[tasks[dragging.idx].type].size / 2;
  if (el) { el.style.left = (tasks[dragging.idx].x - r) + 'px'; el.style.top = (tasks[dragging.idx].y - r) + 'px'; }
});

document.addEventListener('mouseup', () => {
  if (!dragging) return;
  const el = bubbleEls.get(tasks[dragging.idx]?.id);
  if (el) { el.style.zIndex = ''; el.style.transition = ''; }
  save();
  dragging = null;
});

// ── Touch events ──
document.addEventListener('touchstart', e => {
  const b = e.target.closest('.bubble');
  if (!b) return;
  const idx = tasks.findIndex(t => bubbleEls.get(t.id) === b);
  if (idx < 0) return;
  b._moved = 0;
  const touch = e.touches[0];
  dragging = { idx, startMouseX: touch.clientX, startMouseY: touch.clientY, startTaskX: tasks[idx].x, startTaskY: tasks[idx].y };
  b.style.zIndex = 999;
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (!dragging) return;
  e.preventDefault();
  const touch = e.touches[0];
  const dx = touch.clientX - dragging.startMouseX;
  const dy = touch.clientY - dragging.startMouseY;
  const el = bubbleEls.get(tasks[dragging.idx]?.id);
  if (el) el._moved = Math.abs(dx) + Math.abs(dy);
  tasks[dragging.idx].x = dragging.startTaskX + dx;
  tasks[dragging.idx].y = dragging.startTaskY + dy;
  clamp(tasks[dragging.idx]);
  const r = CONFIG[tasks[dragging.idx].type].size / 2;
  if (el) { el.style.left = (tasks[dragging.idx].x - r) + 'px'; el.style.top = (tasks[dragging.idx].y - r) + 'px'; }
}, { passive: false });

document.addEventListener('touchend', () => {
  if (!dragging) return;
  const el = bubbleEls.get(tasks[dragging.idx]?.id);
  if (el) el.style.zIndex = '';
  save();
  dragging = null;
});

// ── Модалка добавления ──
function openModal(col) {
  activeCol = col;
  const cfg = CONFIG[col];
  const ov = document.getElementById('modal');
  ov.style.setProperty('--modal-color', cfg.color);
  document.getElementById('modal-dot').style.cssText = `background:${cfg.color};box-shadow:0 0 10px ${cfg.color};`;
  document.getElementById('modal-title').textContent = cfg.label;
  document.getElementById('task-text').value = '';
  ov.classList.add('open');
  setTimeout(() => document.getElementById('task-text').focus(), 60);
}
function closeModal() { document.getElementById('modal').classList.remove('open'); activeCol = null; }
function closeOutside(e) { if (e.target.id === 'modal') closeModal(); }

function saveTask() {
  const text = document.getElementById('task-text').value.trim();
  if (!text) return document.getElementById('task-text').focus();
  const pos = randPos(activeCol);
  tasks.push({ id: Date.now(), type: activeCol, text, x: pos.x, y: pos.y, done: false });
  save(); render(); closeModal();
}

document.getElementById('task-text').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTask(); }
});

// ── Модалка деталей ──
let detailIdx = null;

function openDetail(i) {
  detailIdx = i;
  const t = tasks[i], cfg = CONFIG[t.type];
  const ov = document.getElementById('detail-modal');
  ov.style.setProperty('--modal-color', cfg.color);
  document.getElementById('detail-dot').style.cssText = `background:${cfg.color};box-shadow:0 0 10px ${cfg.color};`;
  document.getElementById('detail-type').textContent = cfg.label;
  document.getElementById('detail-text').textContent = t.text;
  const btn = document.getElementById('btn-done');
  btn.innerHTML = t.done
    ? '<span class="material-symbols-rounded">undo</span>Снять отметку'
    : '<span class="material-symbols-rounded">check_circle</span>Выполнено';
  btn.classList.toggle('active', t.done);
  ov.classList.add('open');
}
function closeDetail() { document.getElementById('detail-modal').classList.remove('open'); detailIdx = null; }
function closeDetailOutside(e) { if (e.target.id === 'detail-modal') closeDetail(); }

function toggleDetailDone() {
  tasks[detailIdx].done = !tasks[detailIdx].done;
  save(); render(); openDetail(detailIdx);
}
function deleteDetail() {
  tasks.splice(detailIdx, 1);
  save(); render(); closeDetail();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDetail(); } });

render();

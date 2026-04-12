const POINTS = { critical: 4, important: 2.5, low: 1, nodate: 2 };
const GOAL   = 10;

let score = JSON.parse(localStorage.getItem('taskScore') || '{"pts":0,"games":0}');

function saveScore() { localStorage.setItem('taskScore', JSON.stringify(score)); }

function earnPoints(type) {
  const pts = POINTS[type];
  score.pts += pts;
  let gained = 0;
  while (score.pts >= GOAL) { score.pts -= GOAL; score.games++; gained++; }
  saveScore();
  updateScoreBar(gained > 0);
  if (gained > 0) supernovaExplosion();
  return pts;
}

function supernovaExplosion() {
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const colors = ['#ef4444', '#f59e0b', '#fbbf24', '#ff6b35', '#fff'];

  // Вспышка экрана
  const flash = document.createElement('div');
  flash.className = 'sn-screen-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 650);

  // 6 колец с задержкой
  colors.forEach((c, i) => {
    setTimeout(() => {
      const r = document.createElement('div');
      r.className = 'sn-ring';
      r.style.cssText = `left:${cx}px;top:${cy}px;width:${80+i*40}px;height:${80+i*40}px;--c:${c};--dur:${0.75+i*0.08}s;`;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 1100);
    }, i * 70);
  });

  // 60 частиц
  for (let i = 0; i < 60; i++) {
    const p = document.createElement('div');
    p.className = 'expl-particle';
    const angle = (i / 60) * 360 + Math.random() * 6;
    const dist  = 180 + Math.random() * 350;
    const sz    = 3 + Math.random() * 9;
    const c     = colors[Math.floor(Math.random() * colors.length)];
    const dur   = 0.6 + Math.random() * 0.7;
    p.style.cssText = `left:${cx}px;top:${cy}px;width:${sz}px;height:${sz}px;--c:${c};--a:${angle}deg;--dist:${dist}px;--dur:${dur}s;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000 + 50);
  }

  // Надпись RAMPAGE
  const ov = document.createElement('div');
  ov.className = 'rampage-overlay';
  ov.innerHTML = '<span class="rampage-text">RAMPAGE!!!</span>';
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), 2500);

  // Разбросать шарики
  tasks.forEach(t => {
    const dx = t.x - cx, dy = t.y - cy;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    t.vx += (dx / dist) * 10;
    t.vy += (dy / dist) * 10;
  });
}

function updateScoreBar(newGame = false) {
  const pct = Math.min((score.pts / GOAL) * 100, 100);
  const fill = document.getElementById('score-fill');
  const pts  = document.getElementById('score-pts');
  const gc   = document.getElementById('games-count');
  fill.style.height = pct + '%';
  fill.classList.toggle('full', score.pts === 0 && newGame);
  pts.textContent   = score.pts % 1 === 0 ? score.pts : score.pts.toFixed(1);
  gc.textContent    = score.games;
  if (newGame) {
    document.getElementById('score-games').classList.add('pulse');
    setTimeout(() => document.getElementById('score-games').classList.remove('pulse'), 600);
    fill.classList.remove('full');
  }
}

const CONFIG = {
  critical:  { label: 'Сверхважная', color: '#ef4444', size: 115 },
  important: { label: 'Важная',       color: '#f59e0b', size: 95  },
  low:       { label: 'Не очень',     color: '#22c55e', size: 78  },
  nodate:    { label: 'Без срока',    color: '#818cf8', size: 72  },
};
const COLS    = Object.keys(CONFIG);
const GAP     = 8;       // зазор между шариками
const SPEED   = 0.35;    // начальная скорость (px/frame)
const DAMP    = 0.992;   // затухание
const BOUNCE  = 0.6;     // отскок от стен

let tasks     = JSON.parse(localStorage.getItem('bubbleTasks') || '[]');
let activeCol = null;
let dragging  = null;
let bubbleEls = new Map();
let animFrame = null;

// Добавляем скорости существующим задачам из localStorage
tasks.forEach(t => {
  if (t.vx === undefined) { t.vx = (Math.random() - 0.5) * SPEED * 2; t.vy = (Math.random() - 0.5) * SPEED * 2; }
});

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

function save() {
  // Сохраняем без vx/vy — они временные
  const clean = tasks.map(({ vx, vy, ...rest }) => rest);
  localStorage.setItem('bubbleTasks', JSON.stringify(clean));
}

function clamp(t) {
  const r = CONFIG[t.type].size / 2;
  const minX = r + 4,    maxX = window.innerWidth  - r - 4;
  const minY = r + 60,   maxY = window.innerHeight - r - 90;
  if (t.x < minX) { t.x = minX; t.vx = Math.abs(t.vx) * BOUNCE; }
  if (t.x > maxX) { t.x = maxX; t.vx = -Math.abs(t.vx) * BOUNCE; }
  if (t.y < minY) { t.y = minY; t.vy = Math.abs(t.vy) * BOUNCE; }
  if (t.y > maxY) { t.y = maxY; t.vy = -Math.abs(t.vy) * BOUNCE; }
}

function randPos(type) {
  const r = CONFIG[type].size / 2;
  return {
    x: r + 30 + Math.random() * (window.innerWidth  - (r + 30) * 2),
    y: r + 80 + Math.random() * (window.innerHeight - (r + 80) - 120),
  };
}

// ── Физика ──
function physics() {
  const n = tasks.length;

  // Двигаем шарики
  tasks.forEach((t, i) => {
    if (dragging?.idx === i) return;
    t.x  += t.vx;
    t.y  += t.vy;
    t.vx *= DAMP;
    t.vy *= DAMP;
    // Случайный импульс чтобы не замирали
    if (Math.random() < 0.004) { t.vx += (Math.random() - 0.5) * 0.3; t.vy += (Math.random() - 0.5) * 0.3; }
    clamp(t);
  });

  // Столкновения — упругий удар
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = tasks[i], b = tasks[j];
      const ra = CONFIG[a.type].size / 2 + GAP;
      const rb = CONFIG[b.type].size / 2 + GAP;
      const minDist = ra + rb;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
      if (dist >= minDist) continue;

      // Развести шарики
      const overlap = (minDist - dist) * 0.5;
      const nx = dx / dist, ny = dy / dist;
      const fixA = dragging?.idx === i;
      const fixB = dragging?.idx === j;
      if (!fixA) { a.x -= nx * overlap * (fixB ? 2 : 1); a.y -= ny * overlap * (fixB ? 2 : 1); }
      if (!fixB) { b.x += nx * overlap * (fixA ? 2 : 1); b.y += ny * overlap * (fixA ? 2 : 1); }

      // Обмен скоростями вдоль нормали (упругий удар)
      const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
      const dot = dvx * nx + dvy * ny;
      if (dot >= 0) continue; // уже расходятся
      const imp = dot * 0.85;
      if (!fixA) { a.vx += imp * nx; a.vy += imp * ny; }
      if (!fixB) { b.vx -= imp * nx; b.vy -= imp * ny; }

      if (!fixA) clamp(a);
      if (!fixB) clamp(b);
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

function loop() {
  physics();
  updateDOM();
  animFrame = requestAnimationFrame(loop);
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
    inner.style.fontSize = size > 100 ? '0.78rem' : size > 80 ? '0.71rem' : '0.64rem';
    inner.textContent = t.text;
    b.appendChild(inner);

    b.addEventListener('click', () => { if ((b._moved || 0) < 6) openDetail(i); });

    b.addEventListener('mousedown', e => {
      b._moved = 0;
      dragging = { idx: i, startMouseX: e.clientX, startMouseY: e.clientY, startTaskX: t.x, startTaskY: t.y };
      b.style.zIndex = 999;
      e.preventDefault();
    });

    bubbleEls.set(t.id, b);
    world.appendChild(b);
  });

  COLS.forEach(k => { document.getElementById(`cnt-${k}`).textContent = counts[k]; });

  if (!animFrame) animFrame = requestAnimationFrame(loop);
}

// ── Mouse drag ──
document.addEventListener('mousemove', e => {
  if (!dragging) return;
  const dx = e.clientX - dragging.startMouseX;
  const dy = e.clientY - dragging.startMouseY;
  const t  = tasks[dragging.idx];
  const el = bubbleEls.get(t?.id);
  if (el) el._moved = Math.abs(dx) + Math.abs(dy);
  t.x = dragging.startTaskX + dx;
  t.y = dragging.startTaskY + dy;
  const r = CONFIG[t.type].size / 2;
  t.x = Math.max(r + 4, Math.min(window.innerWidth - r - 4, t.x));
  t.y = Math.max(r + 60, Math.min(window.innerHeight - r - 90, t.y));
  if (el) { el.style.left = (t.x - r) + 'px'; el.style.top = (t.y - r) + 'px'; }
});

document.addEventListener('mouseup', e => {
  if (!dragging) return;
  const t  = tasks[dragging.idx];
  const el = bubbleEls.get(t?.id);
  if (el) { el.style.zIndex = ''; }
  // Придать импульс в направлении броска
  t.vx = (e.clientX - dragging.startMouseX) * 0.04;
  t.vy = (e.clientY - dragging.startMouseY) * 0.04;
  save(); dragging = null;
});

// ── Touch drag ──
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
  const t  = tasks[dragging.idx];
  const el = bubbleEls.get(t?.id);
  if (el) el._moved = Math.abs(dx) + Math.abs(dy);
  t.x = dragging.startTaskX + dx;
  t.y = dragging.startTaskY + dy;
  const r = CONFIG[t.type].size / 2;
  t.x = Math.max(r + 4, Math.min(window.innerWidth - r - 4, t.x));
  t.y = Math.max(r + 60, Math.min(window.innerHeight - r - 90, t.y));
  if (el) { el.style.left = (t.x - r) + 'px'; el.style.top = (t.y - r) + 'px'; }
}, { passive: false });

document.addEventListener('touchend', e => {
  if (!dragging) return;
  const el = bubbleEls.get(tasks[dragging.idx]?.id);
  if (el) el.style.zIndex = '';
  tasks[dragging.idx].vx = 0; tasks[dragging.idx].vy = 0;
  save(); dragging = null;
});

// ── Модалка добавления ──
function openModal(col) {
  activeCol = col;
  const cfg = CONFIG[col];
  const ov  = document.getElementById('modal');
  ov.style.setProperty('--modal-color', cfg.color);
  document.getElementById('modal-dot').style.cssText = `background:${cfg.color};box-shadow:0 0 10px ${cfg.color};`;
  document.getElementById('modal-title').textContent = cfg.label;
  document.getElementById('task-text').value = '';
  ov.classList.add('open');
  setTimeout(() => document.getElementById('task-text').focus(), 60);
}
function closeModal()    { document.getElementById('modal').classList.remove('open'); activeCol = null; }
function closeOutside(e) { if (e.target.id === 'modal') closeModal(); }

function saveTask() {
  const text = document.getElementById('task-text').value.trim();
  if (!text) return document.getElementById('task-text').focus();
  const pos = randPos(activeCol);
  tasks.push({ id: Date.now(), type: activeCol, text, x: pos.x, y: pos.y, done: false, vx: (Math.random()-0.5)*SPEED*2, vy: (Math.random()-0.5)*SPEED*2 });
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
  document.getElementById('detail-pts').textContent  = t.done ? '✓ Выполнено' : `+${POINTS[t.type]} очков за выполнение`;
  const btn = document.getElementById('btn-done');
  btn.classList.toggle('active', !!t.done);
  ov.classList.add('open');
}

function toggleDetailDone() {
  const idx = detailIdx;
  const t   = tasks[idx];
  const el  = bubbleEls.get(t.id);
  const cfg = CONFIG[t.type];
  closeDetail();
  earnPoints(t.type);
  explode(t.x, t.y, cfg.color, cfg.size, idx);
  if (el) el.classList.add('exploding');
  setTimeout(() => { tasks.splice(idx, 1); save(); render(); }, 320);
}
function closeDetail()         { document.getElementById('detail-modal').classList.remove('open'); detailIdx = null; }
function closeDetailOutside(e) { if (e.target.id === 'detail-modal') closeDetail(); }

function deleteDetail() {
  const idx  = detailIdx;
  const t    = tasks[idx];
  const el   = bubbleEls.get(t.id);
  const cfg  = CONFIG[t.type];
  closeDetail();
  explode(t.x, t.y, cfg.color, cfg.size, idx);
  if (el) el.classList.add('exploding');
  setTimeout(() => {
    tasks.splice(idx, 1);
    save(); render();
  }, 320);
}

function explode(x, y, color, size, srcIdx) {
  // Ударная волна на шарики
  tasks.forEach((t, i) => {
    if (i === srcIdx) return;
    const dx = t.x - x, dy = t.y - y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const force = Math.min((size * 180) / (dist * dist), 4.5);
    t.vx += (dx / dist) * force;
    t.vy += (dy / dist) * force;
  });

  const s = size;

  // Кольцо
  const ring = document.createElement('div');
  ring.className = 'expl-ring';
  ring.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;--c:${color};`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 600);

  // Второе кольцо чуть позже
  setTimeout(() => {
    const r2 = document.createElement('div');
    r2.className = 'expl-ring';
    r2.style.cssText = `left:${x}px;top:${y}px;width:${s*0.7}px;height:${s*0.7}px;--c:${color};animation-duration:0.45s;`;
    document.body.appendChild(r2);
    setTimeout(() => r2.remove(), 500);
  }, 80);

  // Вспышка
  const flash = document.createElement('div');
  flash.className = 'expl-flash';
  flash.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;--c:${color};`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 450);

  // Частицы
  const count = 14;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'expl-particle';
    const angle = (i / count) * 360 + Math.random() * 15;
    const dist  = s * 0.6 + Math.random() * s * 0.8;
    const pSize = 3 + Math.random() * 5;
    const dur   = 0.5 + Math.random() * 0.35;
    p.style.cssText = `left:${x}px;top:${y}px;width:${pSize}px;height:${pSize}px;--c:${color};--a:${angle}deg;--dist:${dist}px;--dur:${dur}s;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000 + 50);
  }

  // Искры (тонкие, длинные)
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'expl-particle';
    const angle = Math.random() * 360;
    const dist  = s * 1.2 + Math.random() * s;
    p.style.cssText = `left:${x}px;top:${y}px;width:2px;height:2px;--c:#fff;--a:${angle}deg;--dist:${dist}px;--dur:${0.6+Math.random()*0.3}s;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDetail(); } });

updateScoreBar();
render();

const POINTS = { critical: 4, important: 2.5, low: 1, nodate: 2 };
const GOAL   = 10;

let score = JSON.parse(localStorage.getItem('taskScore') || '{"pts":0,"games":0}');

function saveScore() { localStorage.setItem('taskScore', JSON.stringify(score)); }

function useGame() {
  if (score.games <= 0) return;
  score.games--;
  saveScore();
  updateScoreBar();
}

function earnPoints(type) {
  score.pts += POINTS[type];
  let gained = 0;
  while (score.pts >= GOAL) { score.pts -= GOAL; score.games++; gained++; }
  saveScore();
  updateScoreBar(gained > 0);
  if (gained > 0) supernovaExplosion();
}

function supernovaExplosion() {
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const colors = ['#ef4444', '#f59e0b', '#fbbf24', '#ff6b35', '#fff'];

  const flash = document.createElement('div');
  flash.className = 'sn-screen-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 650);

  colors.forEach((c, i) => {
    setTimeout(() => {
      const r = document.createElement('div');
      r.className = 'sn-ring';
      r.style.cssText = `left:${cx}px;top:${cy}px;width:${80+i*40}px;height:${80+i*40}px;--c:${c};--dur:${0.75+i*0.08}s;`;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 1100);
    }, i * 70);
  });

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

  const ov = document.createElement('div');
  ov.className = 'rampage-overlay';
  ov.innerHTML = '<span class="rampage-text">RAMPAGE!!!</span>';
  document.body.appendChild(ov);
  setTimeout(() => ov.remove(), 2500);

  tasks.forEach(t => {
    const dx = t.x - cx, dy = t.y - cy;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    t.vx += (dx / dist) * 10;
    t.vy += (dy / dist) * 10;
  });
}

function updateScoreBar(newGame = false) {
  const pct  = Math.min((score.pts / GOAL) * 100, 100);
  const fill = document.getElementById('score-fill');
  fill.style.height = pct + '%';
  fill.classList.toggle('full', score.pts === 0 && newGame);
  document.getElementById('score-pts').textContent  = score.pts % 1 === 0 ? score.pts : score.pts.toFixed(1);
  document.getElementById('games-count').textContent = score.games;
  if (newGame) {
    document.getElementById('score-games').classList.add('pulse');
    setTimeout(() => document.getElementById('score-games').classList.remove('pulse'), 600);
    fill.classList.remove('full');
  }
}

// ─────────────────────────────────────────
const CONFIG = {
  critical:  { label: 'Сверхважная', color: '#ef4444', size: 115 },
  important: { label: 'Важная',       color: '#f59e0b', size: 95  },
  low:       { label: 'Не очень',     color: '#22c55e', size: 78  },
  nodate:    { label: 'Без срока',    color: '#818cf8', size: 72  },
};
const COLS   = Object.keys(CONFIG);
const GAP    = 8;
const SPEED  = 0.4;
const DAMP   = 0.994;

let tasks     = JSON.parse(localStorage.getItem('bubbleTasks') || '[]');
let activeCol = null;
let dragging  = null;
let bubbleEls = new Map();
let animFrame = null;

tasks.forEach(t => {
  if (t.vx === undefined) { t.vx = (Math.random() - 0.5) * SPEED; t.vy = (Math.random() - 0.5) * SPEED; }
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
  const clean = tasks.map(({ vx, vy, ...rest }) => rest);
  localStorage.setItem('bubbleTasks', JSON.stringify(clean));
}

function clamp(t) {
  const r = CONFIG[t.type].size / 2;
  const pad = 6;
  if (t.x < r + pad)                    { t.x = r + pad;                    t.vx =  Math.abs(t.vx) * 0.6; }
  if (t.x > window.innerWidth  - r-pad) { t.x = window.innerWidth  - r-pad; t.vx = -Math.abs(t.vx) * 0.6; }
  if (t.y < r + 65)                     { t.y = r + 65;                     t.vy =  Math.abs(t.vy) * 0.6; }
  if (t.y > window.innerHeight - r-90)  { t.y = window.innerHeight - r-90;  t.vy = -Math.abs(t.vy) * 0.6; }
}

function randPos(type) {
  const r = CONFIG[type].size / 2;
  return {
    x: r + 40 + Math.random() * (window.innerWidth  - (r + 40) * 2),
    y: r + 80 + Math.random() * (window.innerHeight - (r + 80) - 120),
  };
}

// ── Физика ──
function physics() {
  const n = tasks.length;

  tasks.forEach((t, i) => {
    if (dragging?.idx === i) return;
    t.x += t.vx;
    t.y += t.vy;
    t.vx *= DAMP;
    t.vy *= DAMP;
    if (Math.random() < 0.005) { t.vx += (Math.random() - 0.5) * 0.25; t.vy += (Math.random() - 0.5) * 0.25; }
    clamp(t);
  });

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = tasks[i], b = tasks[j];
      const minDist = CONFIG[a.type].size/2 + CONFIG[b.type].size/2 + GAP;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 0.001;
      if (dist >= minDist) continue;

      const overlap = (minDist - dist) * 0.5;
      const nx = dx/dist, ny = dy/dist;
      const fA = dragging?.idx === i, fB = dragging?.idx === j;
      if (!fA) { a.x -= nx*overlap*(fB?2:1); a.y -= ny*overlap*(fB?2:1); }
      if (!fB) { b.x += nx*overlap*(fA?2:1); b.y += ny*overlap*(fA?2:1); }

      const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
      const dot = dvx*nx + dvy*ny;
      if (dot >= 0) continue;
      const imp = dot * 0.8;
      if (!fA) { a.vx += imp*nx; a.vy += imp*ny; }
      if (!fB) { b.vx -= imp*nx; b.vy -= imp*ny; }
      if (!fA) clamp(a);
      if (!fB) clamp(b);
    }
  }
}

function updateDOM() {
  tasks.forEach(t => {
    const el = bubbleEls.get(t.id);
    if (!el || (dragging && tasks[dragging.idx]?.id === t.id)) return;
    const r = CONFIG[t.type].size / 2;
    el.style.transform = `translate(${t.x - r}px,${t.y - r}px)`;
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
    const r = size / 2;
    b.className = `bubble ${t.type}${t.done ? ' done' : ''}`;
    b.style.cssText = `width:${size}px;height:${size}px;opacity:0;transform:translate(${t.x-r}px,${t.y-r}px);`;
    requestAnimationFrame(() => { b.style.opacity = '1'; });

    const inner = document.createElement('div');
    inner.className = 'bubble-inner';
    inner.style.fontSize = size > 100 ? '0.78rem' : size > 80 ? '0.71rem' : '0.64rem';
    inner.textContent = t.text;
    b.appendChild(inner);

    b.addEventListener('click', () => { if ((b._moved || 0) < 6) openDetail(i); });

    b.addEventListener('mousedown', e => {
      b._moved = 0;
      dragging = { idx: i, startMouseX: e.clientX, startMouseY: e.clientY, startX: t.x, startY: t.y };
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
  t.x = dragging.startX + dx;
  t.y = dragging.startY + dy;
  clamp(t);
  const r = CONFIG[t.type].size / 2;
  if (el) el.style.transform = `translate(${t.x - r}px,${t.y - r}px)`;
});

document.addEventListener('mouseup', e => {
  if (!dragging) return;
  const t  = tasks[dragging.idx];
  const el = bubbleEls.get(t?.id);
  if (el) el.style.zIndex = '';
  t.vx = (e.clientX - dragging.startMouseX) * 0.05;
  t.vy = (e.clientY - dragging.startMouseY) * 0.05;
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
  dragging = { idx, startMouseX: touch.clientX, startMouseY: touch.clientY, startX: tasks[idx].x, startY: tasks[idx].y };
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
  t.x = dragging.startX + dx; t.y = dragging.startY + dy;
  clamp(t);
  const r = CONFIG[t.type].size / 2;
  if (el) el.style.transform = `translate(${t.x - r}px,${t.y - r}px)`;
}, { passive: false });

document.addEventListener('touchend', () => {
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
  const t = { id: Date.now(), type: activeCol, text, x: pos.x, y: pos.y, done: false,
    vx: (Math.random()-0.5)*SPEED, vy: (Math.random()-0.5)*SPEED };
  tasks.push(t);
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
  document.getElementById('detail-pts').textContent  = `+${POINTS[t.type]} очков`;
  const btn = document.getElementById('btn-done');
  btn.classList.toggle('active', !!t.done);
  ov.classList.add('open');
}
function closeDetail()         { document.getElementById('detail-modal').classList.remove('open'); detailIdx = null; }
function closeDetailOutside(e) { if (e.target.id === 'detail-modal') closeDetail(); }

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

function deleteDetail() {
  const idx = detailIdx;
  const t   = tasks[idx];
  const el  = bubbleEls.get(t.id);
  const cfg = CONFIG[t.type];
  closeDetail();
  explode(t.x, t.y, cfg.color, cfg.size, idx);
  if (el) el.classList.add('exploding');
  setTimeout(() => { tasks.splice(idx, 1); save(); render(); }, 320);
}

// ── Взрыв ──
function explode(x, y, color, size, srcIdx) {
  tasks.forEach((t, i) => {
    if (i === srcIdx) return;
    const dx = t.x - x, dy = t.y - y;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    const force = Math.min((size * 180) / (dist * dist), 5);
    t.vx += (dx / dist) * force;
    t.vy += (dy / dist) * force;
  });

  const ring = document.createElement('div');
  ring.className = 'expl-ring';
  ring.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;--c:${color};`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 600);

  setTimeout(() => {
    const r2 = document.createElement('div');
    r2.className = 'expl-ring';
    r2.style.cssText = `left:${x}px;top:${y}px;width:${size*0.7}px;height:${size*0.7}px;--c:${color};animation-duration:0.45s;`;
    document.body.appendChild(r2);
    setTimeout(() => r2.remove(), 500);
  }, 80);

  const flash = document.createElement('div');
  flash.className = 'expl-flash';
  flash.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;--c:${color};`;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 450);

  const count = 14;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'expl-particle';
    const angle = (i / count) * 360 + Math.random() * 15;
    const dist  = size * 0.6 + Math.random() * size * 0.8;
    const pSize = 3 + Math.random() * 5;
    const dur   = 0.5 + Math.random() * 0.35;
    p.style.cssText = `left:${x}px;top:${y}px;width:${pSize}px;height:${pSize}px;--c:${color};--a:${angle}deg;--dist:${dist}px;--dur:${dur}s;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur * 1000 + 50);
  }

  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'expl-particle';
    const angle = Math.random() * 360;
    const dist  = size * 1.2 + Math.random() * size;
    p.style.cssText = `left:${x}px;top:${y}px;width:2px;height:2px;--c:#fff;--a:${angle}deg;--dist:${dist}px;--dur:${0.6+Math.random()*0.3}s;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 950);
  }
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeDetail(); } });

updateScoreBar();
render();

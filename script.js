const CONFIG = {
  critical:  { label: '🔥 Сверхважная', color: '#ef4444', size: 115 },
  important: { label: '⚡ Важная',       color: '#f59e0b', size: 95  },
  low:       { label: '🌿 Не очень',     color: '#22c55e', size: 78  },
  nodate:    { label: '🕐 Без срока',    color: '#818cf8', size: 72  },
};

let tasks = JSON.parse(localStorage.getItem('bubbleTasks') || '[]');
let activeCol = null;
let dragging = null, dragOffX = 0, dragOffY = 0;

// Звёзды
(function makeStars() {
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

function randPos(size) {
  const pad = size / 2 + 20;
  const bottomPad = 80;
  return {
    x: pad + Math.random() * (window.innerWidth  - pad * 2),
    y: pad + Math.random() * (window.innerHeight - pad * 2 - bottomPad),
  };
}

function render() {
  const world = document.getElementById('world');
  world.innerHTML = '';

  const counts = { critical: 0, important: 0, low: 0, nodate: 0 };

  tasks.forEach((t, i) => {
    if (!t.done) counts[t.type]++;
    const cfg = CONFIG[t.type];
    const size = cfg.size;

    const b = document.createElement('div');
    b.className = `bubble ${t.type}${t.done ? ' done' : ''}`;
    b.style.cssText = `
      width:${size}px; height:${size}px;
      left:${t.x - size/2}px; top:${t.y - size/2}px;
      --drift-dur:${7 + Math.random()*6}s;
      --drift-delay:-${Math.random()*8}s;
    `;

    const inner = document.createElement('div');
    inner.className = 'bubble-inner';
    inner.style.fontSize = size > 100 ? '0.82rem' : size > 80 ? '0.75rem' : '0.68rem';
    inner.textContent = t.text;

    const del = document.createElement('button');
    del.className = 'bubble-del';
    del.textContent = '×';
    del.onclick = (e) => { e.stopPropagation(); tasks.splice(i, 1); save(); render(); };

    b.appendChild(inner);
    b.appendChild(del);

    // Клик = toggle done
    b.addEventListener('click', (e) => {
      if (Math.abs(dragOffX) < 3 && Math.abs(dragOffY) < 3) {
        tasks[i].done = !tasks[i].done;
        save(); render();
      }
    });

    // Drag
    b.addEventListener('mousedown', (e) => {
      if (e.target === del) return;
      dragging = { el: b, idx: i };
      const rect = b.getBoundingClientRect();
      dragOffX = e.clientX - (rect.left + rect.width/2);
      dragOffY = e.clientY - (rect.top  + rect.height/2);
      b.style.animation = 'none';
      b.style.zIndex = 999;
      e.preventDefault();
    });

    world.appendChild(b);
  });

  Object.keys(counts).forEach(k => {
    document.getElementById(`cnt-${k}`).textContent = counts[k];
  });
}

// Drag move / up
document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const x = e.clientX - dragOffX;
  const y = e.clientY - dragOffY;
  const cfg = CONFIG[tasks[dragging.idx].type];
  const half = cfg.size / 2;
  tasks[dragging.idx].x = Math.max(half, Math.min(window.innerWidth  - half, x));
  tasks[dragging.idx].y = Math.max(half, Math.min(window.innerHeight - half, y));
  dragging.el.style.left = tasks[dragging.idx].x - half + 'px';
  dragging.el.style.top  = tasks[dragging.idx].y - half + 'px';
});

document.addEventListener('mouseup', () => {
  if (dragging) { save(); dragging = null; }
});

// Touch support
document.addEventListener('touchmove', (e) => {
  if (!dragging) return;
  e.preventDefault();
  const t = e.touches[0];
  const x = t.clientX - dragOffX;
  const y = t.clientY - dragOffY;
  const cfg = CONFIG[tasks[dragging.idx].type];
  const half = cfg.size / 2;
  tasks[dragging.idx].x = Math.max(half, Math.min(window.innerWidth  - half, x));
  tasks[dragging.idx].y = Math.max(half, Math.min(window.innerHeight - half, y));
  dragging.el.style.left = tasks[dragging.idx].x - half + 'px';
  dragging.el.style.top  = tasks[dragging.idx].y - half + 'px';
}, { passive: false });

document.addEventListener('touchend', () => {
  if (dragging) { save(); dragging = null; }
});

document.addEventListener('touchstart', (e) => {
  const b = e.target.closest('.bubble');
  if (!b || e.target.classList.contains('bubble-del')) return;
  const idx = [...document.querySelectorAll('.bubble')].indexOf(b);
  if (idx < 0) return;
  dragging = { el: b, idx };
  const rect = b.getBoundingClientRect();
  dragOffX = e.touches[0].clientX - (rect.left + rect.width/2);
  dragOffY = e.touches[0].clientY - (rect.top  + rect.height/2);
  b.style.animation = 'none';
  b.style.zIndex = 999;
});

// Modal
function openModal(col) {
  activeCol = col;
  const cfg = CONFIG[col];
  const overlay = document.getElementById('modal');
  document.getElementById('modal-title').textContent = 'Новая задача — ' + cfg.label;
  document.getElementById('modal-dot').style.cssText = `background:${cfg.color};box-shadow:0 0 10px ${cfg.color};`;
  overlay.style.setProperty('--modal-color', cfg.color);
  document.getElementById('task-text').value = '';
  overlay.classList.add('open');
  setTimeout(() => document.getElementById('task-text').focus(), 50);
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  activeCol = null;
}

function closeOutside(e) { if (e.target.id === 'modal') closeModal(); }

function saveTask() {
  const text = document.getElementById('task-text').value.trim();
  if (!text) return document.getElementById('task-text').focus();
  const pos = randPos(CONFIG[activeCol].size);
  tasks.push({ id: Date.now(), type: activeCol, text, x: pos.x, y: pos.y, done: false });
  save(); render(); closeModal();
}

document.getElementById('task-text').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveTask(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

render();

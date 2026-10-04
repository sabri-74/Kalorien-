// Kleine SVG-Diagramme ohne Bibliothek. Farben kommen aus CSS-Variablen,
// damit Hell- und Dunkelmodus automatisch passen.

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

function setupTooltip(container) {
  let tip = container.querySelector('.chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.hidden = true;
    container.appendChild(tip);
  }
  return {
    show(html, x, y) {
      tip.innerHTML = html;
      tip.hidden = false;
      const w = container.clientWidth;
      const tw = tip.offsetWidth;
      tip.style.left = `${Math.min(Math.max(0, x - tw / 2), w - tw)}px`;
      tip.style.top = `${Math.max(0, y - tip.offsetHeight - 10)}px`;
    },
    hide() {
      tip.hidden = true;
    },
  };
}

/**
 * Säulen pro Tag mit Ziellinie.
 * data: [{ label, value, sub }], target: Zahl
 */
export function barChart(container, data, { target, unit = 'kcal', format = (v) => v } = {}) {
  container.querySelectorAll('svg').forEach((s) => s.remove());
  const W = Math.max(280, container.clientWidth || 320);
  const H = 180;
  const pad = { t: 12, r: 8, b: 24, l: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = niceMax(Math.max(target || 0, ...data.map((d) => d.value)) * 1.08);
  const y = (v) => pad.t + ih - (v / max) * ih;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img' });
  svg.setAttribute('aria-label', `Säulendiagramm, ${data.length} Tage`);
  container.prepend(svg);

  for (const t of [0, max / 2, max]) {
    el('line', { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: 'grid' }, svg);
    const tx = el('text', { x: pad.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'axis' }, svg);
    tx.textContent = format(Math.round(t));
  }

  const slot = iw / data.length;
  const bw = Math.min(28, slot * 0.6);
  const tip = setupTooltip(container);
  const labelEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;

  data.forEach((d, i) => {
    const cx = pad.l + slot * i + slot / 2;
    const top = y(d.value);
    const h = pad.t + ih - top;
    if (d.value > 0) {
      const r = Math.min(4, bw / 2, h);
      const over = target && d.value > target * 1.05;
      el(
        'path',
        {
          d: `M${cx - bw / 2},${pad.t + ih} V${top + r} q0,-${r} ${r},-${r} H${cx + bw / 2 - r} q${r},0 ${r},${r} V${pad.t + ih} Z`,
          class: over ? 'bar bar-over' : 'bar',
        },
        svg,
      );
    }
    if (i % labelEvery === 0 || i === data.length - 1) {
      const tx = el('text', { x: cx, y: H - 6, 'text-anchor': 'middle', class: 'axis' }, svg);
      tx.textContent = d.label;
    }
    const hit = el('rect', { x: cx - slot / 2, y: pad.t, width: slot, height: ih, class: 'hit' }, svg);
    const show = () => {
      const rect = container.getBoundingClientRect();
      const sr = svg.getBoundingClientRect();
      tip.show(
        `<b>${d.sub || d.label}</b><br>${format(d.value)} ${unit}${target ? ` · Ziel ${format(target)}` : ''}`,
        (cx / W) * sr.width + (sr.left - rect.left),
        (Math.min(top, y(target || 0)) / H) * sr.height,
      );
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', () => tip.hide());
  });

  if (target) {
    el('line', { x1: pad.l, x2: W - pad.r, y1: y(target), y2: y(target), class: 'target' }, svg);
    const tx = el('text', { x: W - pad.r, y: y(target) - 5, 'text-anchor': 'end', class: 'axis target-label' }, svg);
    tx.textContent = `Ziel ${format(target)}`;
  }
}

/**
 * Linie mit Punkten + Trendlinie (gleitender Durchschnitt).
 * data: [{ date, label, value, trend }]
 */
export function lineChart(container, data, { unit = 'kg', goal } = {}) {
  container.querySelectorAll('svg').forEach((s) => s.remove());
  const W = Math.max(280, container.clientWidth || 320);
  const H = 200;
  const pad = { t: 14, r: 12, b: 24, l: 40 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const vals = data.map((d) => d.value).concat(goal ? [goal] : []);
  let lo = Math.floor(Math.min(...vals) - 1);
  let hi = Math.ceil(Math.max(...vals) + 1);
  if (hi - lo < 4) {
    lo -= 1;
    hi += 1;
  }
  const x = (i) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => pad.t + ih - ((v - lo) / (hi - lo)) * ih;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img' });
  svg.setAttribute('aria-label', `Gewichtsverlauf, ${data.length} Messungen`);
  container.prepend(svg);

  const ticks = [lo, (lo + hi) / 2, hi];
  for (const t of ticks) {
    el('line', { x1: pad.l, x2: W - pad.r, y1: y(t), y2: y(t), class: 'grid' }, svg);
    const tx = el('text', { x: pad.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'axis' }, svg);
    tx.textContent = Number.isInteger(t) ? t : t.toFixed(1);
  }
  if (goal) {
    el('line', { x1: pad.l, x2: W - pad.r, y1: y(goal), y2: y(goal), class: 'target' }, svg);
    const tx = el('text', { x: W - pad.r, y: y(goal) - 5, 'text-anchor': 'end', class: 'axis target-label' }, svg);
    tx.textContent = `Ziel ${goal} ${unit}`;
  }

  if (data.length > 1) {
    const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.value)}`).join(' ');
    el('path', { d: `${line} L${x(data.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`, class: 'area' }, svg);
    el('path', { d: line, class: 'line' }, svg);
    const trend = data.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.trend)}`).join(' ');
    el('path', { d: trend, class: 'trend' }, svg);
  }
  const labelIdx = new Set([0, data.length - 1]);
  data.forEach((d, i) => {
    const last = i === data.length - 1;
    el('circle', { cx: x(i), cy: y(d.value), r: last ? 5 : 3.5, class: last ? 'dot dot-last' : 'dot' }, svg);
    if (labelIdx.has(i)) {
      const tx = el('text', { x: x(i), y: H - 6, 'text-anchor': i === 0 && data.length > 1 ? 'start' : 'end', class: 'axis' }, svg);
      tx.textContent = d.label;
    }
  });

  // Fadenkreuz + Tooltip
  const tip = setupTooltip(container);
  const cross = el('line', { y1: pad.t, y2: pad.t + ih, class: 'cross', visibility: 'hidden' }, svg);
  const hit = el('rect', { x: pad.l, y: pad.t, width: iw, height: ih, class: 'hit' }, svg);
  const move = (ev) => {
    const sr = svg.getBoundingClientRect();
    const px = ((ev.clientX - sr.left) / sr.width) * W;
    let best = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    });
    const d = data[best];
    cross.setAttribute('x1', x(best));
    cross.setAttribute('x2', x(best));
    cross.setAttribute('visibility', 'visible');
    const rect = container.getBoundingClientRect();
    tip.show(
      `<b>${d.label}</b><br>${d.value.toLocaleString('de-DE')} ${unit} · Trend ${d.trend.toLocaleString('de-DE')}`,
      (x(best) / W) * sr.width + (sr.left - rect.left),
      (y(d.value) / H) * sr.height,
    );
  };
  hit.addEventListener('pointermove', move);
  hit.addEventListener('pointerdown', move);
  hit.addEventListener('pointerleave', () => {
    cross.setAttribute('visibility', 'hidden');
    tip.hide();
  });
}

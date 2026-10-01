// Animationen: Konfetti, hochzählende Zahlen, Ringe, die sich füllen.

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#8b5cf6', '#ec4899', '#f97316', '#facc15', '#10b981', '#3b82f6'];

/** Konfetti-Regen; optional mit Emojis statt Schnipseln. */
export function confetti({ count = 90, emojis = null, originY = 0.35 } = {}) {
  if (reduced()) return;
  let layer = document.getElementById('fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const emoji = emojis && Math.random() < 0.55 ? emojis[i % emojis.length] : null;
    p.className = emoji ? 'cf cf-emoji' : 'cf';
    if (emoji) p.textContent = emoji;
    else p.style.background = COLORS[i % COLORS.length];
    const angle = (Math.random() * Math.PI) - Math.PI; // nach oben gerichtet
    const speed = 0.45 + Math.random() * 0.55;
    p.style.left = `${w / 2 + (Math.random() - 0.5) * 60}px`;
    p.style.top = `${h * originY}px`;
    p.style.setProperty('--dx', `${Math.cos(angle) * w * 0.55 * speed}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * h * 0.35 * speed}px`);
    p.style.setProperty('--fall', `${h * (0.55 + Math.random() * 0.4)}px`);
    p.style.setProperty('--rot', `${(Math.random() - 0.5) * 900}deg`);
    p.style.animationDuration = `${1.6 + Math.random() * 1.1}s`;
    p.style.animationDelay = `${Math.random() * 0.15}s`;
    layer.appendChild(p);
    setTimeout(() => p.remove(), 3200);
  }
}

const last = new Map();

/** Zählt die Zahl in `el` vom letzten bekannten Wert (je `key`) auf `to`. */
export function countUp(el, key, to, format = (v) => Math.round(v).toLocaleString('de-DE'), duration = 900) {
  if (!el) return;
  const from = last.has(key) ? last.get(key) : 0;
  last.set(key, to);
  if (reduced() || from === to) {
    el.textContent = format(to);
    return;
  }
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const e = 1 - (1 - t) ** 3;
    el.textContent = format(from + (to - from) * e);
    if (t < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Merkt sich den letzten Füllstand eines Rings, damit er beim Neuzeichnen weich weiterläuft. */
export function ringFrom(key, frac) {
  const prev = last.has(`ring:${key}`) ? last.get(`ring:${key}`) : 0;
  last.set(`ring:${key}`, frac);
  return prev;
}

/** Setzt nach dem Rendern alle Ringe mit data-to auf ihren Zielwert (löst die CSS-Transition aus). */
export function playRings(root = document) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      root.querySelectorAll('[data-ring-to]').forEach((c) => c.setAttribute('stroke-dasharray', c.dataset.ringTo));
    }),
  );
}

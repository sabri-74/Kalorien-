import { store, ui, C, $, $$, actions, forms, inputs, views, setRenderer, afterRender, onSheetClosed, save, openSheet } from './core.js';
import './views/today.js';
import './views/food.js';
import './views/scan.js';
import './views/dishes.js';
import './views/training.js';
import './views/stats.js';
import './views/aitools.js';
import './views/plan.js';
import { checkLevelUp, paletteHtml } from './views/fun.js';
import { checkBadges } from './views/rewards.js';
import { openOnboarding } from './views/profile.js';
import { stopScan } from './views/food.js';

const TABS = ['today', 'dishes', 'training', 'stats', 'profile', 'plan'];

function applyTheme() {
  const t = store.state.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  document.documentElement.dataset.palette = store.state.settings.palette || 'sunset';
}

function render() {
  applyTheme();
  $$('.tab[data-tab]').forEach((b) => {
    if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const root = $('#view');
  root.dataset.view = ui.tab;
  views[ui.tab]?.(root);
  afterRender(root);
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => {
    checkBadges();
    checkLevelUp();
  }, 1400);
}
let badgeTimer;
setRenderer(render);

function go(tab) {
  if (!TABS.includes(tab)) return;
  const changed = ui.tab !== tab;
  ui.tab = tab;
  render();
  if (changed) {
    window.scrollTo({ top: 0 });
    const v = $('#view');
    animateIn();
  }
}

// Einblend-Animation nur beim Seitenwechsel, nicht bei jedem Neuzeichnen
let animTimer;
function animateIn() {
  const v = $('#view');
  v.classList.remove('view-in');
  void v.offsetWidth;
  v.classList.add('view-in');
  clearTimeout(animTimer);
  animTimer = setTimeout(() => v.classList.remove('view-in'), 900);
}

actions['close-sheet'] = () => $('#sheet').close();
actions['palette-open'] = () => openSheet('🎨 Farbwelt', `<p class="hint">Wähl deine Lieblingsfarben – die ganze App passt sich an.</p>${paletteHtml()}`);

actions.goto = (d) => {
  if ($('#sheet').open) $('#sheet').close();
  go(d.tab);
};

// ---------- Ereignisse ----------

document.addEventListener('click', (ev) => {
  const tab = ev.target.closest('.tab[data-tab]');
  if (tab) {
    go(tab.dataset.tab);
    return;
  }
  const btn = ev.target.closest('[data-action]');
  if (!btn || btn.disabled) return;
  const fn = actions[btn.dataset.action];
  if (fn) {
    ev.preventDefault();
    fn(btn.dataset, btn, ev);
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  forms[form.dataset.form]?.(form, ev);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  if (el.type === 'file') return;
  inputs[el.dataset.input || el.id]?.(el, ev);
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.type === 'file') inputs[el.id]?.(el, ev);
});

$('#sheet').addEventListener('close', () => {
  stopScan();
  onSheetClosed();
});

// Tippen auf den abgedunkelten Hintergrund schließt das Sheet
$('#sheet').addEventListener('click', (ev) => {
  if (ev.target === ev.currentTarget) ev.currentTarget.close();
});

// Nach Mitternacht beim Zurückkehren auf den neuen Tag springen
let lastToday = C.dateKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = C.dateKey();
  if (now !== lastToday) {
    if (ui.date === lastToday) ui.date = now;
    lastToday = now;
    render();
  }
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ui.tab === 'stats' && render(), 150);
});

// Direktlinks wie #training (auch für App-Verknüpfungen)
const hash = location.hash.slice(1);
if (TABS.includes(hash)) ui.tab = hash;
if (hash === 'progress') ui.tab = 'stats';

render();
animateIn();
save();

if (!store.state.profile) openOnboarding();

if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.claude) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

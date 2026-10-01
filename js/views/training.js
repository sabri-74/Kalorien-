import {
  store, ui, C, S, $, esc, fmt, num, icon, views, actions, inputs, forms, commit, save, toast, haptic, confirmDialog, currentWeight, dateLabel,
} from '../core.js';
import { EXERCISES, CARDIO, PLANS, MUSCLES, STRENGTH_MET, exerciseById } from '../exercises.js';
import { CARDIO_EMOJI, MUSCLE_EMOJI } from '../emoji.js';
import { confetti } from '../fx.js';

const REST_SECONDS = 90;
const tr = { muscle: null, rest: null };

function allWorkouts() {
  return Object.entries(store.state.days)
    .flatMap(([date, d]) => d.workouts.map((w) => ({ ...w, date })))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function lastSetsFor(exId) {
  for (const w of allWorkouts()) {
    if (w.type !== 'strength') continue;
    const ex = w.exercises.find((e) => e.id === exId);
    if (ex && ex.sets.length) return ex.sets;
  }
  return null;
}

export function personalRecords() {
  const best = {};
  for (const w of allWorkouts()) {
    if (w.type !== 'strength') continue;
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        const orm = C.oneRepMax(s.weight, s.reps);
        if (orm > (best[ex.id]?.orm || 0)) best[ex.id] = { orm, set: s, date: w.date, name: ex.name };
      }
    }
  }
  return Object.values(best).sort((a, b) => b.orm - a.orm);
}

function newExercise(id) {
  const prev = lastSetsFor(id);
  const sets = prev
    ? prev.map((s) => ({ reps: s.reps, weight: s.weight, done: false }))
    : Array.from({ length: 3 }, () => ({ reps: '', weight: '', done: false }));
  return { id, name: exerciseById(id)?.name || id, sets, hadPrev: !!prev };
}

function startWorkout(name, ids) {
  store.state.activeWorkout = { name, start: Date.now(), date: ui.date, exercises: ids.map(newExercise) };
  commit();
  window.scrollTo({ top: 0 });
}

function elapsedMinutes() {
  const w = store.state.activeWorkout;
  return w ? Math.max(1, Math.round((Date.now() - w.start) / 60000)) : 0;
}

function activeHtml(w) {
  const exOptions = MUSCLES.map(
    (m) => `<optgroup label="${m}">${EXERCISES.filter((e) => e.muscle === m).map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</optgroup>`,
  ).join('');
  const doneSets = w.exercises.reduce((s, ex) => s + ex.sets.filter((x) => x.done).length, 0);
  const allSets = w.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  return `
    <header class="page-head">
      <div><p class="eyebrow">Training läuft · ${dateLabel(w.date)}</p><h1>${esc(w.name)}</h1></div>
    </header>
    <section class="live-bar">
      <div><span>Dauer</span><b id="wo-elapsed">${elapsedMinutes()} Min.</b></div>
      <div><span>Sätze</span><b>${doneSets} / ${allSets}</b></div>
      <div class="rest ${tr.rest ? '' : 'rest-idle'}" id="rest-box"><span>Pause</span><b id="rest-left">–</b>
        <button class="link-btn" data-action="rest-stop" ${tr.rest ? '' : 'hidden'}>Weiter</button></div>
    </section>
    ${w.exercises
      .map((ex, ei) => {
        const info = exerciseById(ex.id);
        return `<article class="card ex-card">
          <header class="meal-head">
            <div><h3>${esc(ex.name)}</h3>${info?.tip ? `<p class="sub">${esc(info.tip)}</p>` : ''}</div>
            <button class="icon-btn" data-action="wo-del-ex" data-ex="${ei}" aria-label="${esc(ex.name)} entfernen">${icon('close')}</button>
          </header>
          ${ex.hadPrev ? '<p class="pill pill-info">Werte vom letzten Mal – schaffst du etwas mehr?</p>' : ''}
          <div class="sets">
            <div class="set set-head"><span>Satz</span><span>Wdh.</span><span>kg</span><span>Fertig</span></div>
            ${ex.sets
              .map(
                (s, si) => `<div class="set ${s.done ? 'is-done' : ''}">
                <button class="set-idx" data-action="set-del" data-ex="${ei}" data-set="${si}" aria-label="Satz ${si + 1} löschen" title="Satz löschen">${si + 1}</button>
                <input type="number" inputmode="numeric" min="0" id="s-${ei}-${si}-reps" data-input="set-field" data-ex="${ei}" data-set="${si}" data-field="reps" value="${s.reps}" aria-label="Wiederholungen Satz ${si + 1}">
                <input type="number" inputmode="decimal" min="0" step="0.5" id="s-${ei}-${si}-weight" data-input="set-field" data-ex="${ei}" data-set="${si}" data-field="weight" value="${s.weight}" aria-label="Gewicht Satz ${si + 1}">
                <button class="check" data-action="set-done" data-ex="${ei}" data-set="${si}" aria-pressed="${s.done}" aria-label="Satz ${si + 1} erledigt">${icon('check')}</button>
              </div>`,
              )
              .join('')}
          </div>
          <button class="link-btn" data-action="set-add" data-ex="${ei}">${icon('plus')}Satz hinzufügen</button>
        </article>`;
      })
      .join('')}
    <article class="card">
      <div class="search-inline">
        <select id="wo-add-ex" aria-label="Übung hinzufügen">${exOptions}</select>
        <button class="btn btn-soft" data-action="wo-add-ex">${icon('plus')}Übung</button>
      </div>
      <label class="field">Dauer in Minuten<input id="wo-min" type="number" inputmode="numeric" min="1" placeholder="automatisch: ${elapsedMinutes()}"></label>
      <div class="sheet-actions">
        <button class="btn btn-ghost" data-action="wo-cancel">Verwerfen</button>
        <button class="btn btn-primary grow" data-action="wo-finish">${icon('check')}Training beenden</button>
      </div>
    </article>`;
}

views.training = (root) => {
  const s = store.state;
  if (s.activeWorkout) {
    root.innerHTML = activeHtml(s.activeWorkout);
    updateTimers();
    return;
  }
  const day = S.peekDay(s, ui.date);
  const history = allWorkouts().slice(0, 6);
  const lib = EXERCISES.filter((e) => !tr.muscle || e.muscle === tr.muscle);
  const week = C.lastDays(C.dateKey(), 7).flatMap((k) => S.peekDay(s, k).workouts);
  const weekKcal = week.reduce((a, w) => a + w.kcal, 0);
  const weekMin = week.reduce((a, w) => a + w.minutes, 0);

  root.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">💪 ${esc(dateLabel(ui.date, true))}</p><h1>Training</h1></div>
    </header>
    <div class="tiles tiles-3">
      <div class="tile tile-orange"><span class="tile-label"><i aria-hidden="true">📅</i>Woche</span><b class="tile-value">${week.length}</b><small>Einheiten</small></div>
      <div class="tile tile-green"><span class="tile-label"><i aria-hidden="true">⏱️</i>Aktiv</span><b class="tile-value">${fmt(weekMin)}</b><small>Minuten</small></div>
      <div class="tile tile-pink"><span class="tile-label"><i aria-hidden="true">🔥</i>Kcal</span><b class="tile-value">${fmt(weekKcal)}</b><small>kcal</small></div>
    </div>

    <article class="card">
      <h2 class="card-title"><span class="meal-emoji" aria-hidden="true">🏃</span>Ausdauer eintragen</h2>
      <form class="stack" data-form="cardio">
        <label class="field">Aktivität<select id="cardio-act">${CARDIO.map((a) => `<option value="${a.id}">${CARDIO_EMOJI[a.id] || '🏃'} ${esc(a.name)}</option>`).join('')}</select></label>
        <div class="chips">${[15, 30, 45, 60].map((m) => `<button type="button" class="chip" data-action="cardio-min" data-v="${m}">${m} Min.</button>`).join('')}</div>
        <div class="grid-2 align-end">
          <label class="field">Dauer (Min.)<input id="cardio-min" type="number" inputmode="numeric" min="1" value="30"></label>
          <div class="kcal-preview"><span>Verbrauch</span><b id="cardio-kcal">–</b></div>
        </div>
        <button class="btn btn-primary btn-block">Eintragen</button>
      </form>
    </article>

    <article class="card">
      <h2 class="card-title"><span class="meal-emoji" aria-hidden="true">🏋️</span>Krafttraining</h2>
      <p class="hint">Wähl einen Plan oder starte frei. Gewichte vom letzten Mal werden vorgeschlagen, nach jedem Satz läuft ein Pausentimer.</p>
      <div class="plans">
        ${PLANS.map(
          (p) => `<div class="plan">
            <div class="plan-top"><b>${esc(p.name)}</b><span class="pill">${esc(p.level)}</span></div>
            <small>${esc(p.scheme)}</small>
            <div class="chips">${p.days.map((d, i) => `<button class="chip chip-strong" data-action="wo-start-plan" data-plan="${p.id}" data-day="${i}" title="${esc(d.exercises.map((id) => exerciseById(id).name).join(', '))}">${icon('chevronRight')}${esc(d.name)}</button>`).join('')}</div>
          </div>`,
        ).join('')}
      </div>
      <button class="btn btn-soft btn-block" data-action="wo-start-free">${icon('plus')}Freies Training starten</button>
    </article>

    ${
      day.workouts.length
        ? `<article class="card"><h3>${esc(dateLabel(ui.date))}</h3><ul class="rows">${day.workouts
            .map(
              (w) => `<li class="row"><span class="thumb thumb-emoji" style="--h:25" aria-hidden="true">${w.type === 'strength' ? '🏋️' : CARDIO_EMOJI[w.activity] || '🏃'}</span>
              <span class="row-main"><b>${esc(w.name)}</b><small>${fmt(w.minutes)} Min.${w.type === 'strength' ? ` · ${fmt(C.volume(w.exercises.flatMap((e) => e.sets)))} kg Volumen` : ''}</small></span>
              <span class="row-end">${fmt(w.kcal)}<small>kcal</small></span>
              <button class="icon-btn" data-action="del-workout" data-id="${w.id}" aria-label="${esc(w.name)} löschen">${icon('trash')}</button></li>`,
            )
            .join('')}</ul></article>`
        : ''
    }

    ${
      history.length
        ? `<article class="card"><h3>Letzte Einheiten</h3><ul class="rows">${history
            .map(
              (h) => `<li class="row"><span class="thumb thumb-emoji" style="--h:25" aria-hidden="true">${h.type === 'strength' ? '🏋️' : CARDIO_EMOJI[h.activity] || '🏃'}</span>
              <span class="row-main"><b>${esc(h.name)}</b><small>${dateLabel(h.date)} · ${fmt(h.minutes)} Min.</small></span>
              <span class="row-end">${fmt(h.kcal)}<small>kcal</small></span></li>`,
            )
            .join('')}</ul></article>`
        : ''
    }

    <article class="card">
      <h3>Übungen</h3>
      <div class="chips">
        <button class="chip" data-action="muscle" data-id="" aria-pressed="${!tr.muscle}">Alle</button>
        ${MUSCLES.map((m) => `<button class="chip" data-action="muscle" data-id="${m}" aria-pressed="${tr.muscle === m}">${MUSCLE_EMOJI[m] || ''} ${m}</button>`).join('')}
      </div>
      <ul class="rows">${lib
        .map(
          (e) => `<li class="row"><span class="row-main"><b>${esc(e.name)}</b><small>${esc(e.muscle)} · ${esc(e.tip)}</small></span>
          <button class="btn btn-ghost btn-sm" data-action="wo-start-one" data-id="${e.id}">Start</button></li>`,
        )
        .join('')}</ul>
    </article>`;
  updateCardioPreview();
};

function updateCardioPreview() {
  const act = CARDIO.find((a) => a.id === $('#cardio-act')?.value);
  const out = $('#cardio-kcal');
  if (out && act) out.textContent = `${fmt(C.metCalories(act.met, currentWeight(), num($('#cardio-min')?.value)))} kcal`;
}
inputs['cardio-min'] = updateCardioPreview;
inputs['cardio-act'] = updateCardioPreview;
actions['cardio-min'] = (d) => {
  $('#cardio-min').value = d.v;
  updateCardioPreview();
};

forms.cardio = () => {
  const act = CARDIO.find((a) => a.id === $('#cardio-act').value);
  const minutes = num($('#cardio-min').value);
  if (!act || minutes <= 0) {
    toast('Bitte eine Dauer eingeben.');
    return;
  }
  S.getDay(store.state, ui.date).workouts.push({ id: S.uid(), type: 'cardio', activity: act.id, name: act.name, minutes, kcal: C.metCalories(act.met, currentWeight(), minutes) });
  haptic(18);
  toast(`${CARDIO_EMOJI[act.id] || '🏃'} ${act.name} eingetragen`);
  commit();
};

function updateTimers() {
  const el = $('#wo-elapsed');
  if (el) el.textContent = `${elapsedMinutes()} Min.`;
  const box = $('#rest-box');
  if (!box) return;
  const btn = box.querySelector('button');
  if (!tr.rest) {
    box.classList.add('rest-idle');
    $('#rest-left').textContent = '–';
    if (btn) btn.hidden = true;
    return;
  }
  const left = Math.ceil((tr.rest.end - Date.now()) / 1000);
  if (left <= 0) {
    tr.rest = null;
    haptic([200, 100, 200]);
    toast('Pause vorbei – nächster Satz!');
    updateTimers();
    return;
  }
  box.classList.remove('rest-idle');
  if (btn) btn.hidden = false;
  $('#rest-left').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}
setInterval(() => {
  if (ui.tab === 'training' && store.state.activeWorkout) updateTimers();
}, 1000);

inputs['set-field'] = (el) => {
  const s = store.state.activeWorkout.exercises[num(el.dataset.ex)].sets[num(el.dataset.set)];
  s[el.dataset.field] = el.value === '' ? '' : num(el.value);
  save();
};

actions['del-workout'] = async (d) => {
  const list = S.getDay(store.state, ui.date).workouts;
  const idx = list.findIndex((w) => w.id === d.id);
  if (idx < 0) return;
  const [removed] = list.splice(idx, 1);
  commit();
  toast(`${removed.name} gelöscht`, () => {
    S.getDay(store.state, ui.date).workouts.splice(idx, 0, removed);
    commit();
  });
};
actions.muscle = (d) => {
  tr.muscle = d.id || null;
  commit();
};
actions['wo-start-free'] = () => startWorkout('Freies Training', []);
actions['wo-start-one'] = (d) => startWorkout(exerciseById(d.id).name, [d.id]);
actions['wo-start-plan'] = (d) => {
  const plan = PLANS.find((p) => p.id === d.plan);
  const pd = plan.days[num(d.day)];
  startWorkout(`${plan.name} · ${pd.name}`, pd.exercises);
};
actions['wo-add-ex'] = () => {
  store.state.activeWorkout.exercises.push(newExercise($('#wo-add-ex').value));
  commit();
};
actions['wo-del-ex'] = (d) => {
  store.state.activeWorkout.exercises.splice(num(d.ex), 1);
  commit();
};
actions['set-add'] = (d) => {
  const sets = store.state.activeWorkout.exercises[num(d.ex)].sets;
  const last = sets[sets.length - 1];
  sets.push({ reps: last?.reps ?? '', weight: last?.weight ?? '', done: false });
  commit();
};
actions['set-del'] = (d) => {
  store.state.activeWorkout.exercises[num(d.ex)].sets.splice(num(d.set), 1);
  commit();
};
actions['set-done'] = (d) => {
  const s = store.state.activeWorkout.exercises[num(d.ex)].sets[num(d.set)];
  s.done = !s.done;
  if (s.done) {
    tr.rest = { end: Date.now() + REST_SECONDS * 1000 };
    haptic(15);
  }
  commit();
};
actions['rest-stop'] = () => {
  tr.rest = null;
  updateTimers();
};
actions['wo-cancel'] = async () => {
  if (await confirmDialog('Laufendes Training verwerfen?', 'Verwerfen')) {
    store.state.activeWorkout = null;
    tr.rest = null;
    commit();
  }
};
actions['wo-finish'] = () => {
  const w = store.state.activeWorkout;
  const minutes = num($('#wo-min')?.value) || elapsedMinutes();
  const exercises = w.exercises
    .map((ex) => ({ id: ex.id, name: ex.name, sets: ex.sets.filter((s) => num(s.reps) > 0).map((s) => ({ reps: num(s.reps), weight: num(s.weight) })) }))
    .filter((ex) => ex.sets.length);
  if (!exercises.length) {
    toast('Trag mindestens einen Satz mit Wiederholungen ein.');
    return;
  }
  S.getDay(store.state, w.date).workouts.push({ id: S.uid(), type: 'strength', name: w.name, minutes, kcal: C.metCalories(STRENGTH_MET, currentWeight(), minutes), exercises });
  store.state.activeWorkout = null;
  tr.rest = null;
  haptic(30);
  confetti({ emojis: ['💪', '🏋️', '🔥'], count: 70 });
  toast('💪 Training gespeichert. Stark!');
  commit();
};

export { forms };

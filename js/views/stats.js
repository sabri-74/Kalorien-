import {
  store, C, S, $, esc, fmt, num, icon, views, actions, forms, commit, toast, targets, dayTotals, profile, currentWeight, setWeight, dateLabel, haptic,
} from '../core.js';
import { barChart, lineChart } from '../charts.js';
import { coachFeedback, aiErrorText } from '../ai.js';
import { personalRecords } from './training.js';
import { badgeGridHtml } from './rewards.js';
import * as I from '../insights.js';
import { MOODS } from '../emoji.js';
import { countUp } from '../fx.js';

const st = { range: 7, coach: '', coachBusy: false, controller: null };

function summaryText(t, days) {
  const lines = days.map((k) => {
    const { eaten, burned } = dayTotals(k);
    return `${k}: ${fmt(eaten.kcal)} kcal (E ${fmt(eaten.protein)} g, K ${fmt(eaten.carbs)} g, F ${fmt(eaten.fat)} g), Training ${fmt(burned)} kcal`;
  });
  const p = profile();
  const w = store.state.weights.slice(-6).map((x) => `${x.date}: ${x.kg} kg`).join(', ');
  return `Ziel: ${C.GOALS[p.goal]?.label}. Tagesziel ${fmt(t.kcal)} kcal, Eiweiß ${t.protein} g, Kohlenhydrate ${t.carbs} g, Fett ${t.fat} g.
Aktuelles Gewicht ${fmt(currentWeight(), 1)} kg${p.targetWeight ? `, Zielgewicht ${p.targetWeight} kg` : ''}.
Letzte 7 Tage:
${lines.join('\n')}
Gewichtsmessungen: ${w || 'keine'}`;
}

views.stats = (root) => {
  const s = store.state;
  const t = targets();
  const today = C.dateKey();
  const days = C.lastDays(today, st.range);
  const logged = days.filter((k) => S.hasActivity(s, k));
  const avg = (key) => (logged.length ? logged.reduce((a, k) => a + dayTotals(k).eaten[key], 0) / logged.length : 0);
  const avgKcal = avg('kcal');
  const streak = C.streak((k) => S.hasActivity(s, k), today);
  const onTarget = logged.filter((k) => {
    const { eaten, burned } = dayTotals(k);
    return eaten.kcal <= (t.kcal + burned) * 1.05;
  }).length;

  const p = profile();
  const w = currentWeight();
  const bmiVal = C.bmi(w, p.height);
  const cat = C.bmiCategory(bmiVal);
  const first = s.weights[0];
  const delta = first ? w - first.kg : 0;
  const prs = personalRecords().slice(0, 5);
  const forecast = I.weightForecast(s.weights, p.targetWeight, today);
  const moodRows = C.lastDays(today, 30).map((k) => {
    const { day, eaten, burned } = dayTotals(k);
    const budget = t.kcal + burned;
    return { mood: day.mood, onTarget: eaten.kcal > 0 && eaten.kcal <= budget * 1.05 && eaten.kcal >= budget * 0.8 };
  });
  const moodI = I.moodInsight(moodRows);
  const moodEmoji = (v) => MOODS[Math.min(4, Math.max(0, Math.round(v) - 1))].emoji;
  const earned = s.badges.length;

  root.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">📈 Dein Verlauf</p><h1>Statistik</h1></div>
      <div class="seg" role="group" aria-label="Zeitraum">
        <button data-action="range" data-n="7" aria-pressed="${st.range === 7}">7 Tage</button>
        <button data-action="range" data-n="30" aria-pressed="${st.range === 30}">30 Tage</button>
      </div>
    </header>

    <div class="tiles">
      <div class="tile tile-orange"><span class="tile-label"><i aria-hidden="true">🔥</i>Serie</span><b class="tile-value" id="t-streak">${streak}</b><small>${streak === 1 ? 'Tag' : 'Tage'} in Folge</small></div>
      <div class="tile tile-green"><span class="tile-label"><i aria-hidden="true">🎯</i>Im Ziel</span><b class="tile-value">${onTarget}<small>/${logged.length}</small></b><small>Tage im Zeitraum</small></div>
      <div class="tile tile-violet"><span class="tile-label"><i aria-hidden="true">🍽️</i>Ø Kalorien</span><b class="tile-value" id="t-avg">${fmt(avgKcal)}</b><small>Ziel ${fmt(t.kcal)} kcal</small></div>
      <div class="tile tile-blue"><span class="tile-label"><i aria-hidden="true">⚖️</i>Gewicht</span><b class="tile-value">${fmt(w, 1)}<small> kg</small></b><small>${first ? `${delta <= 0 ? '−' : '+'}${fmt(Math.abs(delta), 1)} kg seit Start` : `BMI ${fmt(bmiVal, 1)} · ${cat.label}`}</small></div>
    </div>

    <article class="card coach">
      <header class="meal-head">
        <span class="meal-emoji" aria-hidden="true">🧠</span><div class="grow"><h3>KI-Coach</h3><p class="sub">Persönliche Tipps aus deinen letzten 7 Tagen</p></div>
      </header>
      <div id="coach-out" class="coach-out">${st.coach ? esc(st.coach).replace(/\n/g, '<br>') : '<p class="hint">Lass dir von der KI zeigen, was gut läuft und wo du ansetzen kannst.</p>'}</div>
      <button class="btn ${st.coach ? 'btn-ghost' : 'btn-primary'}" data-action="coach" ${st.coachBusy ? 'disabled' : ''}>${st.coachBusy ? '<span class="spinner"></span>Denkt nach …' : `✨ ${st.coach ? 'Neu auswerten' : 'Auswertung starten'}`}</button>
    </article>

    <article class="card">
      <h3>📊 Kalorien pro Tag</h3>
      <div class="chart" id="kcal-chart"></div>
      <div class="legend"><span><i class="lg-bar"></i>Im Ziel</span><span><i class="lg-bar lg-over"></i>Über dem Ziel</span><span><i class="lg-target"></i>Tagesziel</span></div>
    </article>

    <article class="card">
      <h3>🥗 Ø Makros pro Tag</h3>
      <div class="macro-bars">
        ${[['🥩 Eiweiß', avg('protein'), t.protein, 'c-protein'], ['🍞 Kohlenhydrate', avg('carbs'), t.carbs, 'c-carbs'], ['🥑 Fett', avg('fat'), t.fat, 'c-fat']]
          .map(([l, v, target, c]) => `<div class="mb"><div class="mb-top"><span>${l}</span><b>${fmt(v)} <small>/ ${fmt(target)} g</small></b></div><div class="mb-track"><i class="${c}" style="width:${Math.min(100, (v / target) * 100)}%"></i></div></div>`)
          .join('')}
      </div>
    </article>

    <article class="card forecast">
      <header class="meal-head"><span class="meal-emoji" aria-hidden="true">🔮</span><div class="grow"><h3>Ziel-Prognose</h3><p class="sub">Aus deinem Gewichtstrend der letzten 30 Tage</p></div></header>
      ${forecastHtml(forecast, p, w, first)}
    </article>

    <article class="card">
      <header class="meal-head"><span class="meal-emoji" aria-hidden="true">🏅</span><div class="grow"><h3>Abzeichen</h3><p class="sub">${earned} von ${I.BADGES.length} gesammelt</p></div></header>
      <div class="badge-progress" aria-hidden="true"><i style="width:${(earned / I.BADGES.length) * 100}%"></i></div>
      ${badgeGridHtml()}
    </article>

    <article class="card">
      <header class="meal-head"><span class="meal-emoji" aria-hidden="true">😊</span><div class="grow"><h3>Stimmung & Essen</h3><p class="sub">Wie hängt dein Essen mit deinem Befinden zusammen?</p></div></header>
      ${
        moodI
          ? `<div class="mood-compare">
              <div><span aria-hidden="true">${moodEmoji(moodI.onTarget)}</span><b>${fmt(moodI.onTarget, 1)}</b><small>an Tagen im Ziel</small></div>
              <div><span aria-hidden="true">${moodEmoji(moodI.other)}</span><b>${fmt(moodI.other, 1)}</b><small>an anderen Tagen</small></div>
            </div>
            <p class="hint">${moodI.diff > 0.2 ? `An Tagen im Kalorienziel fühlst du dich im Schnitt besser. 💚` : moodI.diff < -0.2 ? 'An Tagen im Ziel ist deine Stimmung etwas schlechter – vielleicht ist dein Defizit zu groß?' : 'Deine Stimmung ist an beiden Arten von Tagen ähnlich.'}</p>`
          : '<p class="hint">Trag auf der Startseite ein paar Tage lang ein, wie du dich fühlst. Dann zeige ich dir hier, wie Essen und Stimmung zusammenhängen.</p>'
      }
    </article>

    <article class="card">
      <h3>⚖️ Gewicht</h3>
      <form class="search-inline" data-form="weight">
        <label class="step-field grow"><input id="weight-input" type="number" inputmode="decimal" step="0.1" min="20" max="400" placeholder="${fmt(w, 1)}" aria-label="Gewicht heute in kg"><span>kg</span></label>
        <button class="btn btn-primary">Eintragen</button>
      </form>
      ${
        s.weights.length
          ? `<div class="chart" id="weight-chart"></div>
             <div class="legend"><span><i class="lg-line"></i>Messung</span><span><i class="lg-trend"></i>Trend</span>${p.targetWeight ? '<span><i class="lg-target"></i>Zielgewicht</span>' : ''}</div>
             <ul class="rows">${s.weights.slice(-4).reverse().map((x) => `<li class="row"><span class="row-main"><b>${fmt(x.kg, 1)} kg</b><small>${dateLabel(x.date)}</small></span><button class="icon-btn" data-action="del-weight" data-date="${x.date}" aria-label="Messung vom ${dateLabel(x.date)} löschen">${icon('trash')}</button></li>`).join('')}</ul>`
          : '<p class="hint">Wieg dich am besten morgens nüchtern. Die Trendlinie glättet Tagesschwankungen durch Wasser und Salz.</p>'
      }
      <p class="hint">BMI ${fmt(bmiVal, 1)} · <span class="pill pill-${cat.level}">${cat.label}</span></p>
    </article>

    ${
      prs.length
        ? `<article class="card"><h3>🏆 Bestleistungen</h3><p class="hint">Geschätztes 1-Wiederholungs-Maximum (Epley)</p><ul class="rows">${prs
            .map((r) => `<li class="row"><span class="thumb thumb-emoji" style="--h:45" aria-hidden="true">🏆</span><span class="row-main"><b>${esc(r.name)}</b><small>${fmt(r.set.reps)} × ${fmt(r.set.weight, 1)} kg · ${dateLabel(r.date)}</small></span><span class="row-end">${fmt(r.orm, 1)}<small>kg</small></span></li>`)
            .join('')}</ul></article>`
        : ''
    }`;

  countUp($('#t-avg'), `avg:${st.range}`, avgKcal);
  barChart(
    $('#kcal-chart'),
    days.map((k) => {
      const d = C.parseKey(k);
      return {
        label: st.range === 7 ? d.toLocaleDateString('de-DE', { weekday: 'short' }) : `${d.getDate()}.`,
        sub: d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' }),
        value: dayTotals(k).eaten.kcal,
      };
    }),
    { target: t.kcal, format: (v) => fmt(v) },
  );

  if (s.weights.length) {
    const ws = s.weights.slice(-60);
    const trend = C.movingAverage(ws.map((x) => x.kg), 7);
    lineChart(
      $('#weight-chart'),
      ws.map((x, i) => ({ label: C.parseKey(x.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }), value: x.kg, trend: trend[i] })),
      { goal: p.targetWeight || null },
    );
  }
};

function forecastHtml(f, p, w, first) {
  if (!f) return '<p class="hint">Trag dein Gewicht an mindestens 3 Tagen über eine Woche ein. Dann berechne ich, wann du dein Ziel erreichst.</p>';
  const trend = `${f.perWeek > 0 ? '+' : f.perWeek < 0 ? '−' : '±'}${fmt(Math.abs(f.perWeek), 2)} kg pro Woche`;
  let progress = '';
  if (p.targetWeight && first && first.kg !== p.targetWeight) {
    const pct = Math.max(0, Math.min(100, ((first.kg - w) / (first.kg - p.targetWeight)) * 100));
    progress = `<div class="goal-track"><div class="goal-bar"><i style="width:${pct}%"></i><span class="goal-runner" style="left:${pct}%" aria-hidden="true">🏃</span></div>
      <div class="goal-labels"><span>${fmt(first.kg, 1)} kg</span><b>${Math.round(pct)} % geschafft</b><span>🏁 ${fmt(p.targetWeight, 1)} kg</span></div></div>`;
  }
  const date = f.date ? C.parseKey(f.date).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return `${progress}
    <p class="forecast-text">${
      date
        ? `Bei deinem Tempo (<b>${trend}</b>) erreichst du <b>${fmt(p.targetWeight, 1)} kg</b> voraussichtlich am <b class="hl">${date}</b> 🎯`
        : p.targetWeight
          ? `Dein Trend: <b>${trend}</b>. In diesem Tempo ist dein Zielgewicht noch nicht in Sicht – bleib dran! 💪`
          : `Dein Trend: <b>${trend}</b>. Leg im Profil ein Zielgewicht fest, dann berechne ich das Datum.`
    }</p>`;
}

actions.range = (d) => {
  st.range = Number(d.n);
  commit();
};

actions['del-weight'] = (d) => {
  const s = store.state;
  const removed = s.weights.find((w) => w.date === d.date);
  s.weights = s.weights.filter((w) => w.date !== d.date);
  commit();
  toast('Messung gelöscht', () => {
    setWeight(removed.date, removed.kg);
    commit();
  });
};

forms.weight = () => {
  const kg = num($('#weight-input').value);
  if (kg < 20 || kg > 400) {
    toast('Bitte ein Gewicht zwischen 20 und 400 kg eingeben.');
    return;
  }
  setWeight(C.dateKey(), kg);
  haptic(18);
  toast('Gewicht eingetragen');
  commit();
};

actions.coach = async () => {
  if (st.coachBusy) return;
  st.coachBusy = true;
  st.coach = '';
  commit();
  try {
    const t = targets();
    st.coach = await coachFeedback({
      apiKey: store.state.settings.apiKey,
      summary: summaryText(t, C.lastDays(C.dateKey(), 7)),
      onText: (text) => {
        st.coach = text;
        const out = $('#coach-out');
        if (out) out.innerHTML = esc(text).replace(/\n/g, '<br>');
      },
    });
  } catch (e) {
    st.coach = '';
    toast(aiErrorText(e));
  } finally {
    st.coachBusy = false;
    commit();
  }
};

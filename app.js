/* ============================================================
   VITAFORGE — gamified fitness mini-app (v2)
   Локальный движок: тренировки, питание, аватар-стадии, XP.
   ============================================================ */
(function () {
'use strict';

// ---------- Telegram ----------
var tg = window.Telegram && window.Telegram.WebApp;
try { if (tg) { tg.ready(); tg.expand(); if (tg.setHeaderColor) tg.setHeaderColor('#0F0F10'); if (tg.setBackgroundColor) tg.setBackgroundColor('#0F0F10'); } } catch (e) {}
function haptic(t) { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred(t || 'light'); } catch (e) {} }
function hapNotify(t) { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred(t || 'success'); } catch (e) {} }
function hapSelect() { try { if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged(); } catch (e) {} }
// плавный count-up чисел
function countUp(el, to, dur, fmtFn) {
  if (!el) return; dur = dur || 700; var from = parseFloat((el.getAttribute('data-cv') || '0')) || 0;
  var t0 = null; fmtFn = fmtFn || function (v) { return fmt(v); };
  function step(ts) { if (!t0) t0 = ts; var p = Math.min((ts - t0) / dur, 1); var e = 1 - Math.pow(1 - p, 3); var v = from + (to - from) * e; el.textContent = fmtFn(v); if (p < 1) requestAnimationFrame(step); else el.setAttribute('data-cv', to); }
  requestAnimationFrame(step);
}
// rest-таймер (плавающая стеклянная пилюля)
var _restT = null, _restLeft = 0;
function startRest(sec) {
  sec = sec || 90; _restLeft = sec; var el = $('#restTimer'); if (!el) return;
  function paint() {
    var m = Math.floor(_restLeft / 60), s = _restLeft % 60;
    el.innerHTML = '<button class="rt-x" onclick="VF.stopRest()">✕</button>'
      + '<div><div class="rt-lbl">Отдых</div><div class="rt-time tnum">' + m + ':' + ('0' + s).slice(-2) + '</div></div>'
      + '<button class="rt-add" onclick="VF.addRest()">+15с</button>';
  }
  paint(); el.classList.add('show'); clearInterval(_restT);
  _restT = setInterval(function () {
    _restLeft--; if (_restLeft <= 0) { clearInterval(_restT); hapNotify('success'); toast('⏱ Отдых окончен — следующий подход!', 'win'); stopRest(); return; }
    paint();
  }, 1000);
}
function stopRest() { clearInterval(_restT); var el = $('#restTimer'); if (el) el.classList.remove('show'); }

// ---------- DOM helpers ----------
function $(s, r) { return (r || document).querySelector(s); }
function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }

// ---------- Dates ----------
function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
var WD = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
var MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function ddmm(d) { return d.getDate() + ' ' + MON[d.getMonth()]; }

// ---------- Storage / state ----------
var STORE_PREFIX = 'vitaforge', STORE_VER = 3;
function tgUserId() { try { var u = tg && tg.initDataUnsafe && tg.initDataUnsafe.user; if (u && u.id) return String(u.id); } catch (e) {} return null; }
function storeKey() { var uid = tgUserId(); return STORE_PREFIX + '_v' + STORE_VER + '__' + (uid ? 'tg_' + uid : 'local'); }
var S = null;
function defaultState() {
  return {
    v: 2, onboarded: false, createdAt: Date.now(),
    profile: { name: 'Атлет', sex: 'm', age: 28, height: 178, weight: 75, goal: 'recomp', days: 3, equipment: 'gym', diet: 'all', bodyFat: null },
    program: JSON.parse(JSON.stringify(window.DEFAULT_PROGRAM)),
    sessions: [],
    bestE1RM: {},
    meals: {},
    usedRecipes: {},
    xp: 0,
    nutXp: 0,
    streak: { count: 0, last: null, freezes: 1 },
    nutStreak: { count: 0, last: null },
    reachedStage: 1,
    gold: 0,
    quests: { stamp: null, daily: [], weekly: [] },
    bodyLog: [],
    docs: []
  };
}
function load() {
  var raw = null;
  try { raw = localStorage.getItem(storeKey()); } catch (e) {}
  if (raw) { try { S = JSON.parse(raw); } catch (e) {} }
  if (!S) { try { var legacy = localStorage.getItem('vitaforge_v2'); if (legacy) S = JSON.parse(legacy); } catch (e) {} } // миграция старых данных
  if (!S || (S.v !== 2 && S.v !== 3)) S = defaultState();
  if (!S.program) S.program = JSON.parse(JSON.stringify(window.DEFAULT_PROGRAM));
  if (!S.tombstones) S.tombstones = {};
  S.v = 3;
  buildLib();
  enrichProgram();
  return S;
}
function save() { try { localStorage.setItem(storeKey(), JSON.stringify(S)); } catch (e) {} }

// ---------- Strength math ----------
function e1rm(w, reps) { return w * (1 + reps / 30); }
function allEx() { var a = []; S.program.days.forEach(function (d) { d.exercises.forEach(function (e) { a.push({ ex: e, day: d }); }); }); return a; }
function exById(id) { var r = null; allEx().forEach(function (o) { if (o.ex.id === id) r = o; }); return r; }
function workingE1RM(e) { return e1rm(e.weight, Math.max(e.range ? e.range[0] : e.reps, 1)); }
function bestOf(exId, fallback) { var b = S.bestE1RM[exId]; return b != null ? b : fallback; }
function liftLevel(e) { var best = bestOf(e.id, workingE1RM(e)); return Math.max(1, Math.round(best / 2.5)); }

var KEY_LIFTS = ['bench_mch', 'low_row', 'leg_ext', 'leg_curl', 'biceps_bar'];
function strengthIndex() {
  var sum = 0;
  KEY_LIFTS.forEach(function (id) { var o = exById(id); if (o) sum += bestOf(id, workingE1RM(o.ex)); });
  return sum / Math.max(S.profile.weight, 1);
}

// ---------- XP / Level ----------
function lvlCost(L) { return Math.round(120 * Math.pow(L - 1, 1.4)); }
function levelInfo(totalXp) {
  var L = 1, acc = 0;
  while (true) { var c = lvlCost(L + 1); if (acc + c > totalXp) break; acc += c; L++; if (L > 200) break; }
  var into = totalXp - acc, need = lvlCost(L + 1);
  return { level: L, into: into, need: need, pct: clamp(into / need * 100, 0, 100) };
}
function addXp(n, nutrition) { if (nutrition) S.nutXp += n; S.xp += n; }

// ---------- Avatar stage (honest, monotonic) ----------
var STAGE = {
  2: [1.4, 4, 1.5, 24, 32],
  3: [2.1, 14, 2.0, 18, 27],
  4: [2.9, 28, 2.3, 15, 23],
  5: [3.7, 52, 2.6, 12, 20],
  6: [4.6, 96, 2.8, 10, 18]
};
function recentConsistency() {
  var now = new Date(), c = 0;
  S.sessions.forEach(function (s) { if (daysBetween(parseKey(s.date), now) <= 28) c++; });
  return c / 4;
}
function stageAxes() {
  var nextS = Math.min(S.reachedStage + 1, 6);
  var th = STAGE[nextS] || STAGE[6];
  var bf = S.profile.bodyFat;
  var bfMax = S.profile.sex === 'f' ? th[4] : th[3];
  var axes = [
    { name: 'Сила', val: strengthIndex(), goal: th[0] },
    { name: 'Постоянство', val: recentConsistency(), goal: th[2] },
    { name: 'Объём', val: S.sessions.length, goal: th[1] }
  ];
  if (bf != null) axes.push({ name: 'Сушка', val: 0, goal: th[0], bf: true, bfVal: bf, bfMax: bfMax });
  return { axes: axes, nextStage: nextS };
}
function computeStage() {
  var st = 1;
  for (var s = 2; s <= 6; s++) {
    var th = STAGE[s];
    var bfOk = true;
    if (S.profile.bodyFat != null) { var m = S.profile.sex === 'f' ? th[4] : th[3]; bfOk = S.profile.bodyFat <= m + 0.5; }
    if (strengthIndex() >= th[0] && S.sessions.length >= th[1] && recentConsistency() >= th[2] && bfOk) st = s; else break;
  }
  if (st > S.reachedStage) S.reachedStage = st;
  return S.reachedStage;
}
function stageData() { var i = clamp(computeStage(), 1, 6) - 1; return window.CHARACTER_STAGES[i]; }

// ---------- Nutrition ----------
var PAL = function (days) { return days <= 2 ? 1.375 : days <= 4 ? 1.55 : 1.725; };
function targets() {
  var p = S.profile;
  var bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + (p.sex === 'f' ? -161 : 5);
  var tdee = bmr * PAL(p.days);
  var gf = p.goal === 'cut' ? 0.8 : p.goal === 'bulk' ? 1.1 : 1.0;
  var kcal = Math.round(tdee * gf / 10) * 10;
  var protein = Math.round((p.goal === 'cut' ? 2.2 : 1.8) * p.weight);
  var fat = Math.round(0.9 * p.weight);
  var carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal: kcal, protein: protein, fat: fat, carbs: carbs, tdee: Math.round(tdee) };
}
function eatenOn(key) {
  var list = S.meals[key] || [], t = { kcal: 0, protein: 0, fat: 0, carbs: 0, slots: {} };
  list.forEach(function (m) { t.kcal += m.kcal; t.protein += m.p; t.fat += m.f; t.carbs += m.c; t.slots[m.slot] = true; });
  return t;
}
function eatenToday() { return eatenOn(dayKey()); }
function slotByHour() { var h = new Date().getHours(); return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }
var SLOT_SHARE = { breakfast: 0.25, lunch: 0.35, dinner: 0.30, snack: 0.10 };
var SLOT_RU = { breakfast: 'Завтрак', lunch: 'Обед', dinner: 'Ужин', snack: 'Перекус' };
var SLOT_EMOJI = { breakfast: '🍳', lunch: '🍲', dinner: '🍽️', snack: '🥪' };

// ---------- Выбранная дата (дневник по дням) ----------
var viewDate = dayKey();      // какой день показываем/ведём
var mealSlot = slotByHour();  // выбранный приём пищи для генерации
var calMonth = null;          // месяц, открытый в календаре (1-е число)
function isToday(k) { return k === dayKey(); }
function shiftDay(k, delta) { var d = parseKey(k); d.setDate(d.getDate() + delta); return dayKey(d); }
function sessionsOn(key) { return S.sessions.filter(function (s) { return s.date === key; }); }

function dietBlocks(diet) {
  if (diet === 'nodairy') return ['молок', 'творог', 'сыр', 'йогурт', 'кефир'];
  if (diet === 'veg') return ['кур', 'говяд', 'индейк', 'рыб', 'лосос', 'тунец', 'свин', 'фарш', 'телятин'];
  if (diet === 'nogluten') return ['хлеб', 'овсян', 'паста', 'булгур', 'тортиль', 'макарон', 'мук'];
  return [];
}
function recipeAllowed(r) {
  var blocks = dietBlocks(S.profile.diet);
  if (!blocks.length) return true;
  var bad = false;
  r.ingredients.forEach(function (ing) { var low = ing.item.toLowerCase(); blocks.forEach(function (b) { if (low.indexOf(b) >= 0) bad = true; }); });
  return !bad;
}
function generateMeal(slot, key) {
  slot = slot || slotByHour(); key = key || viewDate;
  var tg2 = targets(), eaten = eatenOn(key);
  var rem = { kcal: Math.max(0, tg2.kcal - eaten.kcal), p: Math.max(0, tg2.protein - eaten.protein), f: Math.max(0, tg2.fat - eaten.fat), c: Math.max(0, tg2.carbs - eaten.carbs) };
  var remShareSum = 0; Object.keys(SLOT_SHARE).forEach(function (sl) { if (!eaten.slots[sl]) remShareSum += SLOT_SHARE[sl]; });
  if (remShareSum <= 0) remShareSum = SLOT_SHARE[slot];
  var f2 = SLOT_SHARE[slot] / remShareSum;
  var slotK = Math.max(150, rem.kcal * f2), slotP = rem.p * f2, slotF = rem.f * f2, slotC = rem.c * f2;
  var used = S.usedRecipes[key] || [];
  var cands = window.RECIPES.filter(function (r) { return r.meal === slot && recipeAllowed(r); });
  if (!cands.length) cands = window.RECIPES.filter(recipeAllowed);
  if (!cands.length) cands = window.RECIPES.slice();
  var scored = cands.map(function (r) {
    var scale = slotP > 5 ? slotP / r.protein : slotK / r.kcal;
    scale = clamp(scale, 0.5, 2.5);
    var sk = r.kcal * scale;
    if (sk < 0.8 * slotK || sk > 1.2 * slotK) { scale = clamp(slotK / r.kcal, 0.5, 2.5); sk = r.kcal * scale; }
    var sp = r.protein * scale, sf = r.fat * scale, sc = r.carbs * scale;
    var score = 1.0 * Math.abs(sp - slotP) / Math.max(slotP, 1) + 0.8 * Math.abs(sk - slotK) / Math.max(slotK, 1)
      + 0.5 * Math.abs(sf - slotF) / Math.max(slotF, 1) + 0.5 * Math.abs(sc - slotC) / Math.max(slotC, 1);
    if (used.indexOf(r.name) >= 0) score += 0.4;
    if (scale <= 0.5 || scale >= 2.5) score += 0.2;
    return { r: r, scale: scale, kcal: Math.round(sk), p: Math.round(sp), f: Math.round(sf), c: Math.round(sc), score: score };
  }).sort(function (a, b) { return a.score - b.score; });
  // широкий взвешенный выбор: в игре весь подходящий список (а не топ-3),
  // лучший макро-фит = выше шанс, но разнообразие максимальное.
  var fresh = scored.filter(function (s) { return used.indexOf(s.r.name) < 0; });
  if (fresh.length < 3) fresh = scored;                                   // всё съедено сегодня — снимаем фильтр
  var pool = fresh.slice(0, Math.max(15, Math.ceil(fresh.length * 0.6))); // пул из ~60% лучших по фиту
  var tot = 0; pool.forEach(function (s) { s._w = 1 / (1 + s.score * s.score); tot += s._w; });
  var rnd = Math.random() * tot, pick = pool[0];
  for (var pi = 0; pi < pool.length; pi++) { rnd -= pool[pi]._w; if (rnd <= 0) { pick = pool[pi]; break; } }
  pick.slot = slot;
  pick.ingredients = pick.r.ingredients.map(function (i) { return { item: i.item, grams: Math.round(i.grams * pick.scale / 5) * 5 }; });
  return pick;
}

// ---------- Training recommendation ----------
function lastPerformed(dayId) {
  var last = null;
  S.sessions.forEach(function (s) { if (s.dayId === dayId) { var d = parseKey(s.date); if (!last || d > last) last = d; } });
  return last;
}
function recommendDay() {
  var now = new Date(), best = null, bestScore = -1;
  S.program.days.forEach(function (d) {
    var lp = lastPerformed(d.id);
    var since = lp ? daysBetween(lp, now) : 999;
    if (since > bestScore) { bestScore = since; best = d; }
  });
  return { day: best, since: bestScore };
}
function lastSessionFor(exId) {
  for (var i = S.sessions.length - 1; i >= 0; i--) {
    var sets = (S.sessions[i].sets || []).filter(function (x) { return x.exId === exId; });
    if (sets.length) return sets;
  }
  return null;
}
function exSuggestion(e) {
  var last = lastSessionFor(e.id);
  if (!last) return { txt: 'рабочий вес ' + e.weight + ' ' + S.program.units + ' × ' + (e.range ? e.range[0] + '–' + e.range[1] : e.reps), bump: false };
  var top = e.range ? e.range[1] : e.reps;
  var allTop = last.length >= (e.sets - 1) && last.every(function (s) { return s.reps >= top; });
  var hardRpe = last.some(function (s) { return s.rpe >= 9.5; });
  if (allTop && !hardRpe) return { txt: '➕ добавь ' + e.inc + ' ' + S.program.units + ' → ' + (e.weight + e.inc) + ', сбрось повторы до ' + (e.range ? e.range[0] : top), bump: true };
  return { txt: 'держи ' + e.weight + ' ' + S.program.units + ', добавь повтор к прошлому', bump: false };
}

function bumpCalendar(weeks) {
  weeks = weeks || 12;
  var events = [], now = new Date(), horizon = new Date(now.getTime() + weeks * 7 * 86400000);
  S.program.days.forEach(function (d) {
    var wd = S.program.schedule[d.id];
    d.exercises.forEach(function (e) {
      var step = e.stepWeeks || 3, k = 1;
      while (true) {
        var wk = step * k;
        var date = nextWeekday(now, wd, wk);
        if (date > horizon) break;
        events.push({ date: date, ex: e.name, w: e.weight + e.inc * k, day: d.name });
        k++;
        if (k > 30) break;
      }
    });
  });
  events.sort(function (a, b) { return a.date - b.date; });
  return events;
}
function nextWeekday(from, wd, addWeeks) {
  var d = new Date(from.getTime());
  var diff = (wd - d.getDay() + 7) % 7; if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff + (addWeeks - 1) * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}
function projectE1RM(e, weeks) {
  weeks = weeks || 12;
  var now = workingE1RM(e), steps = Math.floor(weeks / (e.stepWeeks || 3));
  var future = e1rm(e.weight + e.inc * steps, e.range ? e.range[0] : e.reps);
  return { now: now, future: future, steps: steps };
}

// ---------- Streak ----------
function touchStreak() {
  var today = dayKey(), last = S.streak.last;
  if (last === today) return;
  if (!last) { S.streak.count = 1; }
  else {
    var diff = daysBetween(parseKey(last), parseKey(today));
    if (diff === 1) S.streak.count++;
    else if (diff > 1) {
      if (S.streak.freezes > 0) { S.streak.freezes--; toast('🧊 Заморозка использована — рад, что ты вернулся!', 'win'); }
      else S.streak.count = 1;
    }
  }
  S.streak.last = today;
}
function touchNutStreak() {
  var today = dayKey(), last = S.nutStreak.last;
  if (last === today) return;
  if (!last) S.nutStreak.count = 1;
  else { var diff = daysBetween(parseKey(last), parseKey(today)); S.nutStreak.count = diff === 1 ? S.nutStreak.count + 1 : 1; }
  S.nutStreak.last = today;
}

// ---------- Quests ----------
function ensureQuests() {
  var today = dayKey();
  if (S.quests.stamp === today && S.quests.daily.length) return;
  S.quests.stamp = today;
  S.quests.daily = [
    { id: 'd_workout', icon: '🏋️', t: 'Залогируй тренировку', xp: 120, done: false },
    { id: 'd_protein', icon: '🥩', t: 'Добей дневной белок', xp: 90, done: false },
    { id: 'd_kcal', icon: '🔥', t: 'Уложись в калории', xp: 75, done: false }
  ];
  S.quests.weekly = [
    { id: 'w_sessions', icon: '📅', t: 'Проведи 3 тренировки за неделю', prog: weeklySessions(), goal: 3, xp: 400 },
    { id: 'w_pr', icon: '🏆', t: 'Поставь новый PR на любом лифте', prog: 0, goal: 1, xp: 500 },
    { id: 'w_protein', icon: '💪', t: 'Неделя без пропуска белковой цели', prog: S.nutStreak.count, goal: 7, xp: 350 }
  ];
}
function weeklySessions() { var now = new Date(), c = 0; S.sessions.forEach(function (s) { if (daysBetween(parseKey(s.date), now) < 7) c++; }); return c; }
function refreshDailyQuests() {
  var eaten = eatenToday(), tg2 = targets();
  S.quests.daily.forEach(function (q) {
    if (q.id === 'd_protein' && eaten.protein >= tg2.protein * 0.95) q.done = true;
    if (q.id === 'd_kcal' && eaten.kcal >= tg2.kcal * 0.85 && eaten.kcal <= tg2.kcal * 1.1) q.done = true;
  });
}

// ---------- Muscles (взаимодействие с 3D-аватаром) ----------
var MUSCLE_INFO = {
  chest: { name: 'Грудь', tips: 'Боль в груди или переднем плече после жимов — пауза 3–5 дней. Первые 48 ч лёд 15 мин 2–3 раза в день, затем тепло и мягкая растяжка в дверном проёме. Возврат с 50% рабочего веса, без отказа.' },
  back: { name: 'Спина', tips: 'Поясница/широчайшие: при простреле — покой 2–3 дня, без осевой нагрузки и наклонов с весом. Лёгкая ходьба, «кошка-корова», планка без боли. Резкая боль с отдачей в ногу — к врачу.' },
  shoulders: { name: 'Плечи', tips: 'Плечо любит покой при щелчках и боли над головой. Стоп жимы/махи 3–5 дней, лёд, затем лёгкая наружная ротация с резинкой. Через боль не тянуть — ротаторная манжета капризна.' },
  arms: { name: 'Руки', tips: 'Бицепс/трицепс/локоть: при тендините локтя снизь объём сгибаний, лёгкая эксцентрика, тепло до, лёд после. Боль в сухожилии бицепса у плеча — пауза и малые веса.' },
  abs: { name: 'Пресс', tips: 'Кор восстанавливается быстро. При перенапряжении — 2–3 дня без прямой нагрузки, дыхательные и планка вполсилы. Резкая боль внизу живота (возможна грыжа) — к врачу.' },
  legs: { name: 'Ноги', tips: 'Колени/бёдра: при боли в колене урежь глубину и вес, грей до, лёд после. Потянул заднюю/квадрицепс — RICE 48 ч, затем лёгкая растяжка и низкая нагрузка. Хромаешь — пауза.' }
};
var EX_MUSCLE = { chest_up: 'chest', chest_low: 'chest', bench_mch: 'chest', biceps_bar: 'arms', triceps_rev: 'arms', delts_lat: 'shoulders', delts_front: 'shoulders', delts_rear: 'shoulders', row_chest: 'back', pullover: 'back', low_row: 'back', abs_plan: 'abs', neck: 'back', leg_ext: 'legs', leg_curl: 'legs', calves: 'legs', glutes: 'legs' };
// db-muscle (free-exercise-db вокаб) -> наш тонкий id
var DB2FINE = { abdominals: 'abs', adductors: 'adductors', biceps: 'biceps', calves: 'calves', chest: 'chest', forearms: 'forearms', glutes: 'glutes', hamstrings: 'hams', lats: 'lats', 'lower back': 'lower_back', 'middle back': 'mid_back', quadriceps: 'quads', shoulders: 'delts', traps: 'traps', triceps: 'triceps', neck: 'neck' };
function fineRu(f) { var t = window.MUSCLE_TAX && window.MUSCLE_TAX[f]; return t ? t.ru : f; }
function groupOfFine(f) { var t = window.MUSCLE_TAX && window.MUSCLE_TAX[f]; return t ? t.group : 'other'; }
function slugsOfFine(f) { var t = window.MUSCLE_TAX && window.MUSCLE_TAX[f]; return t ? t.svg : []; }

// ---------- Library (из window.EXERCISES, 865 упр.) ----------
var LIB = { byId: {}, byGroup: { chest: [], back: [], shoulders: [], arms: [], abs: [], legs: [] }, byMuscle: {}, ready: false };
function buildLib() {
  if (LIB.ready) return;
  (window.EXERCISES || []).forEach(function (x) {
    x._group = groupOfFine(x.muscle);
    LIB.byId[x.id] = x;
    if (LIB.byGroup[x._group]) LIB.byGroup[x._group].push(x);
    (LIB.byMuscle[x.muscle] = LIB.byMuscle[x.muscle] || []).push(x);
  });
  // core-упражнения первыми
  Object.keys(LIB.byMuscle).forEach(function (k) { LIB.byMuscle[k].sort(function (a, b) { return (b.core ? 1 : 0) - (a.core ? 1 : 0); }); });
  LIB.ready = !!(window.EXERCISES && window.EXERCISES.length);
}
function enrichProgram() {
  S.program.days.forEach(function (d) {
    d.exercises.forEach(function (e) {
      if (!e.group) e.group = EX_MUSCLE[e.id] || 'other';
      var img = (window.EX_IMAGES && window.EX_IMAGES[e.id]) || {};
      if (!e.primaryMuscles) e.primaryMuscles = (img.muscles || []).map(function (m) { return DB2FINE[m] || m; });
      if (!e.svgSlugs) { var sl = []; (e.primaryMuscles || []).forEach(function (f) { slugsOfFine(f).forEach(function (s) { if (sl.indexOf(s) < 0) sl.push(s); }); }); e.svgSlugs = sl; }
      if (!e.images) e.images = img.images || [];
    });
  });
}
function libEntry(rec) {
  var grp = groupOfFine(rec.muscle), iso = rec.mechanic === 'isolation';
  var slugs = []; (rec.primary || [rec.muscle]).forEach(function (f) { slugsOfFine(f).forEach(function (s) { if (slugs.indexOf(s) < 0) slugs.push(s); }); });
  return {
    id: 'lib_' + rec.id, srcId: rec.id, name: rec.name, group: grp,
    primaryMuscles: (rec.primary || [rec.muscle]).slice(), secondaryMuscles: (rec.secondary || []).slice(), svgSlugs: slugs,
    sets: iso ? 3 : 4, range: rec.reps || (iso ? [10, 15] : [8, 12]), reps: rec.reps ? rec.reps[1] : (iso ? 15 : 12),
    weight: 0, inc: iso ? 2.5 : 5, stepWeeks: iso ? 3 : 2,
    equipment: rec.equipment, mechanic: rec.mechanic, force: rec.force,
    images: (rec.imgs || []), source: 'library', est: true, note: '', addedAt: Date.now()
  };
}
function addToStack(dayId, recId) {
  var rec = LIB.byId[recId]; if (!rec) return null;
  var day = null; S.program.days.forEach(function (d) { if (d.id === dayId) day = d; }); if (!day) return null;
  var e = libEntry(rec), base = e.id, n = 0; while (exById(e.id)) { e.id = base + '_' + (++n); }
  day.exercises.push(e); save(); return e;
}
function swapExercise(exId, newRecId) {
  var rec = LIB.byId[newRecId], o = exById(exId); if (!rec || !o) return null;
  var e = o.ex, fresh = libEntry(rec);
  e.srcId = fresh.srcId; e.name = fresh.name; e.group = fresh.group; e.primaryMuscles = fresh.primaryMuscles;
  e.secondaryMuscles = fresh.secondaryMuscles; e.svgSlugs = fresh.svgSlugs; e.images = fresh.images;
  e.equipment = fresh.equipment; e.mechanic = fresh.mechanic; e.force = fresh.force; e.swappedFrom = rec.id;
  save(); return e;
}
function removeFromStack(exId) {
  var o = exById(exId); if (!o) return false; var e = o.ex;
  var hist = (S.bestE1RM[exId] != null) || S.sessions.some(function (s) { return (s.sets || []).some(function (st) { return st.exId === exId; }); });
  if (hist) S.tombstones[exId] = { name: e.name, group: e.group };
  S.program.days.forEach(function (d) { d.exercises = d.exercises.filter(function (x) { return x.id !== exId; }); });
  save(); return true;
}
// ИИ-ассистент: советы при добавлении (дубль той же мышцы / перетрен)
function addAdvice(rec, dayId) {
  var prim = (rec.primary && rec.primary[0]) || rec.muscle, grp = groupOfFine(rec.muscle), msgs = [];
  var dup = [], dayGroup = 0;
  S.program.days.forEach(function (d) {
    d.exercises.forEach(function (e) {
      if (((e.primaryMuscles && e.primaryMuscles[0]) || EX_MUSCLE[e.id]) === prim && e.name !== rec.name) dup.push(e.name);
      if (d.id === dayId && e.group === grp) dayGroup++;
    });
  });
  if (dup.length) msgs.push('У тебя уже есть упражнение на ту же мышцу (' + fineRu(prim) + '): «' + dup[0] + '». Ещё одно того же типа даст в основном перетрен, а не рост.');
  if (dayGroup >= 4) msgs.push('В этом дне уже ' + dayGroup + ' упражнений на «' + (MUSCLE_INFO[grp] ? MUSCLE_INFO[grp].name : grp) + '» — это много, риск перетрена.');
  return msgs;
}
function weeklyVolumeByGroup(weeks) {
  weeks = weeks || 1; var now = new Date(), out = { chest: 0, back: 0, shoulders: 0, arms: 0, abs: 0, legs: 0 };
  S.sessions.forEach(function (s) {
    if (daysBetween(parseKey(s.date), now) >= weeks * 7) return;
    (s.sets || []).forEach(function (st) { var g = muscleOf(st.exId); if (out[g] != null) out[g]++; });
  });
  return out;
}
function checkOvertraining(weeks) {
  var vol = weeklyVolumeByGroup(weeks || 1), out = [];
  var MRV = { chest: 22, back: 25, shoulders: 26, arms: 26, abs: 25, legs: 25 }, MEV = { chest: 8, back: 10, shoulders: 8, arms: 6, abs: 4, legs: 8 };
  Object.keys(vol).forEach(function (g) { out.push({ group: g, sets: vol[g], status: vol[g] > MRV[g] ? 'high' : (vol[g] < MEV[g] ? 'under' : 'ok') }); });
  return out;
}
function muscleOf(exId) { var o = exById(exId); if (o && o.ex.group) return o.ex.group; if (S.tombstones && S.tombstones[exId]) return S.tombstones[exId].group; return EX_MUSCLE[exId] || 'other'; }

// ---------- Stack UI (Мой стек + пикер по тонкой мышце + ассистент) ----------
var picker = { dayId: null, fine: 'chest', q: '', mode: 'add', swapId: null };
var pendingAdd = null;
function renderStackPanel() {
  var h = '<div class="coach"><span class="ci">🗂</span><div><b style="color:var(--text-hi)">Мой стек</b><br>Твоя программа на этом аккаунте. Добавляй/меняй упражнения — ИИ-ассистент подскажет про дубли и перетрен.</div></div>';
  h += '<button class="pill ghost sm" style="margin:0 0 12px" onclick="VF.regenStack()">↻ Собрать стек из профиля (' + (S.profile.days || 3) + ' дн.)</button>';
  var ot = checkOvertraining(1);
  h += '<div class="vol-badges">' + ot.map(function (o) { return '<span class="vb ' + o.status + '">' + (MUSCLE_INFO[o.group] ? MUSCLE_INFO[o.group].name : o.group) + ' · ' + o.sets + '</span>'; }).join('') + '</div>';
  h += '<div class="hint" style="margin:2px 0 8px">Сеты/нед по группам · <b style="color:var(--accent)">норм</b> / <span style="color:var(--warn)">перебор</span> / <span style="color:var(--text-faint)">мало</span>. Ориентир, не медсовет.</div>';
  S.program.days.forEach(function (d) {
    h += '<div class="section-title">' + esc(d.name.replace(/^День \d+ — /, '')) + '</div>';
    d.exercises.forEach(function (e) {
      h += '<div class="ex stack-ex"><div class="ex-top"><div style="flex:1;cursor:pointer" onclick="VF.exInfoStack(\'' + e.id + '\')"><div class="ex-nm">' + esc(e.name) + ' <span class="ex-go">›</span></div>'
        + '<div class="ex-tg">' + (MUSCLE_INFO[e.group] ? MUSCLE_INFO[e.group].name : e.group) + ' · ' + e.sets + '×' + (e.range ? e.range[0] + '–' + e.range[1] : e.reps) + (e.source === 'library' ? ' · добавлено' : '') + '</div></div>'
        + '<div class="ex-acts"><button class="ico-btn" onclick="VF.swapEx(\'' + e.id + '\')">⇄</button><button class="ico-btn" onclick="VF.removeEx(\'' + e.id + '\')">✕</button></div></div></div>';
    });
    h += '<button class="pill ghost sm" style="margin:2px 0 6px" onclick="VF.addEx(\'' + d.id + '\')">+ Добавить упражнение</button>';
  });
  return h;
}
function pickListHtml() {
  var src = picker.mode === 'swap' ? (LIB.byMuscle[picker.fine] || []).filter(function (x) { var o = exById(picker.swapId); return !o || x.id !== o.ex.srcId; }) : (LIB.byMuscle[picker.fine] || []);
  var list = src.filter(function (x) { return !picker.q || x.name.toLowerCase().indexOf(picker.q.toLowerCase()) >= 0; }).slice(0, 50);
  if (!list.length) return '<div class="empty">Ничего не найдено.</div>';
  return list.map(function (x) {
    return '<div class="pk-item" onclick="VF.exInfo(\'' + x.id + '\')"><img src="' + ((x.imgs && x.imgs[0]) || '') + '" loading="lazy" alt="">'
      + '<div class="pk-tx"><div class="pk-nm">' + esc(x.name) + '</div><div class="pk-meta">' + fineRu(x.muscle) + ' · ' + equipRu(x.equipment) + ' · ' + (x.mechanic === 'compound' ? 'базовое' : 'изолир.') + '</div></div><span class="pk-plus">' + (picker.mode === 'swap' ? '⇄' : '›') + '</span></div>';
  }).join('');
}
function renderPicker() {
  var fines = Object.keys(window.MUSCLE_TAX || {});
  var h = '<div class="grab"></div><h3>' + (picker.mode === 'swap' ? 'Заменить упражнение' : 'Добавить упражнение') + '</h3>';
  h += '<div class="pk-chips">' + fines.map(function (f) { return '<button class="' + (picker.fine === f ? 'on' : '') + '" onclick="VF.pickFine(\'' + f + '\')">' + fineRu(f) + '</button>'; }).join('') + '</div>';
  h += '<input id="pkq" class="pk-search" placeholder="Поиск по названию…" value="' + esc(picker.q) + '" oninput="VF.pickSearch(this.value)">';
  h += '<div class="pk-list" id="pkList">' + pickListHtml() + '</div>';
  openModal(h);
}
function openExPicker(dayId, fine) {
  if (!LIB.ready) { toast('База упражнений ещё грузится…'); return; }
  picker = { dayId: dayId, fine: fine || 'chest', q: '', mode: 'add', swapId: null };
  renderPicker();
}
function pickAdd(recId) {
  var rec = LIB.byId[recId]; if (!rec) return;
  if (picker.mode === 'swap') { var e = swapExercise(picker.swapId, recId); if (e) { hapNotify('success'); closeModal(); renderGym(); toast('Заменено, история сохранена'); } return; }
  var adv = addAdvice(rec, picker.dayId);
  if (adv.length) { confirmAdvice(rec.name, adv, recId); } else { doAdd(recId); }
}
function doAdd(recId) { var e = addToStack(picker.dayId, recId); if (e) { hapNotify('success'); closeModal(); renderGym(); toast('Добавлено в стек'); } }

// ---------- Детальный экран упражнения (как делать + анимация + кнопка внутри) ----------
var EQUIP_RU = { barbell: 'штанга', dumbbell: 'гантели', machine: 'тренажёр', cable: 'блок', 'body only': 'свой вес', kettlebells: 'гири', bands: 'резина', 'e-z curl bar': 'EZ-гриф', 'exercise ball': 'фитбол', 'medicine ball': 'набивной мяч', 'foam roll': 'ролл', other: 'инвентарь' };
var LEVEL_RU = { beginner: 'новичок', intermediate: 'средний', expert: 'продвинутый' };
function equipRu(e) { return EQUIP_RU[e] || e || 'свой вес'; }
function exViewFromRec(r) { return { name: r.name, imgs: r.imgs || [], primary: (r.primary && r.primary.length ? r.primary : [r.muscle]), secondary: r.secondary || [], group: groupOfFine(r.muscle), equipment: r.equipment, mechanic: r.mechanic, force: r.force, level: r.level, range: r.reps }; }
function exViewFromEx(e) { return { name: e.name, imgs: e.images || [], primary: e.primaryMuscles || [], secondary: e.secondaryMuscles || [], group: e.group || groupOfFine((e.primaryMuscles || [])[0]), equipment: e.equipment, mechanic: e.mechanic, force: e.force, level: e.level, range: e.range }; }
function exDemoImgs(imgs, group) {
  var cap = MUSCLE_INFO[group] ? MUSCLE_INFO[group].name : '';
  var mus = '<div class="ed-mus">' + miniMuscleSvg(group) + '<div class="ed-cap">' + esc(cap) + '</div></div>';
  if (!imgs || !imgs.length) return '<div class="ex-demo glass-card" style="justify-content:center">' + mus + '</div>';
  var demo = '<div class="ed-anim"><img src="' + imgs[0] + '" alt="" loading="lazy">' + (imgs[1] ? '<img class="f2" src="' + imgs[1] + '" alt="" loading="lazy">' : '') + '</div>';
  return '<div class="ex-demo glass-card">' + demo + mus + '</div>';
}
function howToText(v) {
  var mech = v.mechanic === 'compound' ? 'Базовое многосуставное упражнение' : v.mechanic === 'isolation' ? 'Изолирующее упражнение' : 'Упражнение';
  var force = v.force === 'push' ? ' с жимовым усилием' : v.force === 'pull' ? ' с тянущим усилием' : v.force === 'static' ? ' статического типа' : '';
  var prim = (v.primary || []).filter(Boolean).map(fineRu).join(', ');
  var sec = (v.secondary || []).filter(Boolean).map(fineRu).join(', ');
  var reps = v.range && v.range.length ? v.range[0] + '–' + v.range[1] : '8–12';
  var s = mech + force + '. ';
  if (prim) s += 'Основная нагрузка — ' + prim + (sec ? '; ассистируют ' + sec : '') + '. ';
  s += 'Анимация выше показывает крайние точки движения. Ориентир: ' + reps + ' повторов, 3–4 рабочих подхода. Двигайся подконтрольно, с полной амплитудой, без рывков — техника важнее веса.';
  return s;
}
var exInfoRec = null;
function openExInfo(ref, ctx) {
  var v, exId = null;
  if (ctx === 'stack') { var o = exById(ref); if (!o) return; v = exViewFromEx(o.ex); exId = ref; }
  else { var rec = LIB.byId[ref]; if (!rec) return; v = exViewFromRec(rec); exInfoRec = ref; }
  var h = '<div class="grab"></div><h3 style="margin-bottom:8px">' + esc(v.name) + '</h3>';
  h += '<div class="exi-tags"><span>' + esc(equipRu(v.equipment)) + '</span><span>' + (v.mechanic === 'compound' ? 'базовое' : 'изолирующее') + '</span>' + (v.level ? '<span>' + (LEVEL_RU[v.level] || v.level) + '</span>' : '') + '</div>';
  h += exDemoImgs(v.imgs, v.group);
  h += '<div class="exi-how"><div class="exi-how-t">Как делать</div><p>' + esc(howToText(v)) + '</p></div>';
  var mus = (v.primary || []).filter(Boolean).map(function (m) { return '<span class="exi-m prim">' + esc(fineRu(m)) + '</span>'; }).join('') + (v.secondary || []).filter(Boolean).map(function (m) { return '<span class="exi-m">' + esc(fineRu(m)) + '</span>'; }).join('');
  if (mus) h += '<div class="exi-mus-t">Работают мышцы</div><div class="exi-mus">' + mus + '</div>';
  if (ctx === 'picker') h += '<button class="pill" onclick="VF.exInfoConfirm()">＋ Добавить в стек</button><button class="pill ghost sm" style="margin-top:8px" onclick="VF.openPickerBack()">‹ Назад к выбору</button>';
  else if (ctx === 'swap') h += '<button class="pill" onclick="VF.exInfoConfirm()">⇄ Заменить на это</button><button class="pill ghost sm" style="margin-top:8px" onclick="VF.openPickerBack()">‹ Назад к выбору</button>';
  else h += '<button class="pill" onclick="VF.exInfoLog(\'' + exId + '\')">Записать подход</button><button class="pill ghost sm" style="margin-top:8px" onclick="VF.closeModal()">Закрыть</button>';
  openModal(h);
}
function exInfoConfirm() {
  var recId = exInfoRec; if (!recId) return;
  if (picker.mode === 'swap') { var e = swapExercise(picker.swapId, recId); if (e) { hapNotify('success'); closeModal(); renderGym(); toast('Заменено, история сохранена'); } return; }
  var rec = LIB.byId[recId]; var adv = addAdvice(rec, picker.dayId);
  if (adv.length) confirmAdvice(rec.name, adv, recId); else doAdd(recId);
}
function confirmAdvice(name, msgs, recId) {
  pendingAdd = recId;
  var h = '<div class="grab"></div><h3>🤖 Ассистент</h3>'
    + '<div class="coach" style="margin-bottom:14px"><span class="ci">⚠️</span><div>' + msgs.map(esc).join('<br><br>') + '</div></div>'
    + '<button class="pill" onclick="VF.confirmAddYes()">Всё равно добавить</button>'
    + '<button class="pill ghost sm" style="margin-top:8px" onclick="VF.openPickerBack()">Назад к выбору</button>';
  openModal(h);
}
function swapEx(exId) { var o = exById(exId); if (!o) return; if (!LIB.ready) { toast('База ещё грузится…'); return; } picker = { dayId: null, fine: (o.ex.primaryMuscles && o.ex.primaryMuscles[0]) || 'chest', q: '', mode: 'swap', swapId: exId }; renderPicker(); }
function removeEx(exId) {
  if (KEY_LIFTS.indexOf(exId) >= 0) {
    var h = '<div class="grab"></div><h3>Убрать ключевой лифт?</h3><div class="coach" style="margin-bottom:14px"><span class="ci">⚠️</span><div>Это один из лифтов силового индекса. История и PR сохранятся, но индекс пересчитается.</div></div><button class="pill" style="color:var(--danger)" onclick="VF.removeExConfirm(\'' + exId + '\')">Убрать</button><button class="pill ghost sm" style="margin-top:8px" onclick="VF.closeModal()">Отмена</button>';
    openModal(h); return;
  }
  removeFromStack(exId); haptic('medium'); renderGym(); toast('Удалено из стека');
}
// slug пути карты -> тонкая мышца
var _slug2fine = null;
var SLUG_PREFER = { 'upper-back': 'lats' };   // lats и mid_back делят один path — отдаём приоритет широчайшим
function fineOfSlug(slug) {
  if (SLUG_PREFER[slug]) return SLUG_PREFER[slug];
  if (!_slug2fine) { _slug2fine = {}; var T = window.MUSCLE_TAX || {}; Object.keys(T).forEach(function (f) { (T[f].svg || []).forEach(function (s) { if (!_slug2fine[s]) _slug2fine[s] = f; }); }); }
  return _slug2fine[slug] || null;
}
// меню КОНКРЕТНОЙ мышцы (тап по карте)
function muscleMenuFine(fine) {
  var grp = groupOfFine(fine), cnt = (LIB.byMuscle[fine] || []).length;
  var h = '<div class="grab"></div><h3>' + esc(fineRu(fine)) + '</h3>'
    + '<p class="hint" style="margin:-6px 0 14px">Конкретно эта мышца · ' + cnt + ' упражнений в базе</p>'
    + '<div style="display:grid;gap:10px">'
    + '<button class="pill" onclick="VF.muscleExFine(\'' + fine + '\')">💪 Упражнения на «' + esc(fineRu(fine)) + '»</button>'
    + '<button class="pill ghost" onclick="VF.muscleInjury(\'' + grp + '\')">🩹 Травма / восстановление</button></div>';
  openModal(h);
}
// ---------- Базовый стек из профиля (научный сплит) ----------
var EQUIP_ALLOW = { gym: ['barbell', 'dumbbell', 'machine', 'cable', 'e-z curl bar', 'kettlebells', 'bands', 'body only', null], home: ['dumbbell', 'bands', 'kettlebells', 'body only', 'exercise ball', 'e-z curl bar', null], bw: ['body only', null] };
function equipOk(eq, prof) { return (EQUIP_ALLOW[prof] || EQUIP_ALLOW.gym).indexOf(eq) >= 0; }
function pickSlot(slot, equip, used) {
  var g = LIB.byGroup[slot.group] || [];
  var pool = g.filter(function (x) { return equipOk(x.equipment, equip) && (!slot.mech || x.mechanic === slot.mech) && (!slot.hint || x.muscle === slot.hint) && used.indexOf(x.id) < 0; });
  if (!pool.length) pool = g.filter(function (x) { return equipOk(x.equipment, equip) && used.indexOf(x.id) < 0; });
  if (!pool.length) pool = g.filter(function (x) { return used.indexOf(x.id) < 0; });
  pool.sort(function (a, b) { return ((b.core ? 2 : 0) + (b.imgs && b.imgs.length ? 1 : 0)) - ((a.core ? 2 : 0) + (a.imgs && a.imgs.length ? 1 : 0)); });
  return pool[0] || null;
}
function slotsFor(k) {
  var P = {
    PUSH: [{ group: 'chest', mech: 'compound', sets: 4, range: [8, 12] }, { group: 'chest', mech: 'isolation', sets: 3, range: [12, 15] }, { group: 'shoulders', mech: 'compound', sets: 4, range: [8, 12] }, { group: 'shoulders', mech: 'isolation', sets: 3, range: [12, 20] }, { group: 'arms', mech: 'isolation', sets: 3, range: [10, 15], hint: 'triceps' }],
    PULL: [{ group: 'back', mech: 'compound', sets: 4, range: [8, 12], hint: 'lats' }, { group: 'back', mech: 'compound', sets: 4, range: [10, 12] }, { group: 'back', mech: 'isolation', sets: 3, range: [12, 15] }, { group: 'arms', mech: 'isolation', sets: 3, range: [10, 15], hint: 'biceps' }],
    LEGS: [{ group: 'legs', mech: 'compound', sets: 4, range: [8, 12], hint: 'quads' }, { group: 'legs', mech: 'isolation', sets: 4, range: [12, 15], hint: 'hams' }, { group: 'legs', mech: 'isolation', sets: 4, range: [12, 15], hint: 'glutes' }, { group: 'legs', mech: 'isolation', sets: 4, range: [20, 30], hint: 'calves' }, { group: 'abs', mech: 'isolation', sets: 4, range: [12, 20] }],
    UPPER: [{ group: 'chest', mech: 'compound', sets: 4, range: [8, 12] }, { group: 'back', mech: 'compound', sets: 4, range: [8, 12], hint: 'lats' }, { group: 'shoulders', mech: 'isolation', sets: 3, range: [12, 20] }, { group: 'arms', mech: 'isolation', sets: 3, range: [10, 15], hint: 'biceps' }, { group: 'arms', mech: 'isolation', sets: 3, range: [10, 15], hint: 'triceps' }],
    LOWER: [{ group: 'legs', mech: 'compound', sets: 4, range: [8, 12], hint: 'quads' }, { group: 'legs', mech: 'isolation', sets: 4, range: [12, 15], hint: 'hams' }, { group: 'legs', mech: 'isolation', sets: 4, range: [20, 30], hint: 'calves' }, { group: 'abs', mech: 'isolation', sets: 4, range: [12, 20] }]
  };
  return P[k] || P.PUSH;
}
function generateBaseStack(profile) {
  var n = clamp(profile.days || 3, 2, 5);
  var TPL = { 2: [['Верх', 'UPPER'], ['Низ', 'LOWER']], 3: [['Толкающие', 'PUSH'], ['Тянущие', 'PULL'], ['Ноги', 'LEGS']], 4: [['Верх A', 'UPPER'], ['Низ A', 'LOWER'], ['Верх B', 'UPPER'], ['Низ B', 'LOWER']], 5: [['Толкающие', 'PUSH'], ['Тянущие', 'PULL'], ['Ноги', 'LEGS'], ['Верх', 'UPPER'], ['Низ', 'LOWER']] };
  var WD = { 2: [1, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };
  var tpl = TPL[n] || TPL[3], used = [], days = [], sched = {};
  tpl.forEach(function (t, i) {
    var exs = [];
    slotsFor(t[1]).forEach(function (slot) {
      var rec = pickSlot(slot, profile.equipment, used);
      if (rec) { used.push(rec.id); var e = libEntry(rec); e.sets = slot.sets; e.range = slot.range; e.reps = slot.range[1]; e.source = 'base'; exs.push(e); }
    });
    var id = 'day' + (i + 1); days.push({ id: id, name: 'День ' + (i + 1) + ' — ' + t[0], exercises: exs }); sched[id] = (WD[n] || WD[3])[i];
  });
  return { units: 'кг', bodyweight: profile.weight, level: 'intermediate', schedule: sched, days: days };
}
function exForMuscle(id) { return allEx().filter(function (o) { return muscleOf(o.ex.id) === id; }); }
function muscleMenu(id) {
  var info = MUSCLE_INFO[id] || { name: 'Мышца' };
  var h = '<div class="grab"></div><h3>' + esc(info.name) + '</h3>'
    + '<p style="color:var(--text-muted);font-size:var(--fs-sm);margin:-6px 0 16px">Что нужно по этой группе?</p>'
    + '<div style="display:grid;gap:10px">'
    + '<button class="pill" onclick="VF.muscleExercises(\'' + id + '\')">💪 Упражнения</button>'
    + '<button class="pill ghost" onclick="VF.muscleInjury(\'' + id + '\')">🩹 Травма / восстановление</button></div>';
  openModal(h);
}
function muscleExercises(id) { closeModal(); renderGym.muscle = id; renderGym.seg = 'today'; go('gym'); }
function muscleInjury(id) {
  var info = MUSCLE_INFO[id] || { name: 'Мышца', tips: '' };
  var h = '<div class="grab"></div><h3>🩹 ' + esc(info.name) + ' — восстановление</h3>'
    + '<div class="coach" style="margin-bottom:14px"><span class="ci">⚠️</span><div>' + esc(info.tips) + '</div></div>'
    + '<div class="hint">Острая боль, отёк, онемение или щелчок при травме — не геройствуй, покажись врачу/физиотерапевту. Это общие советы, не диагноз.</div>'
    + '<button class="pill ghost sm" style="margin-top:14px" onclick="VF.closeModal()">Понятно</button>';
  openModal(h);
}
function renderGymMuscle(id) {
  var info = MUSCLE_INFO[id] || { name: 'Мышца' };
  var list = exForMuscle(id);
  var h = '<div class="scr-head"><div><div class="eyebrow">Упражнения</div><h1>' + esc(info.name) + '</h1></div></div>';
  h += '<button class="btn-chip" style="margin-bottom:14px" onclick="VF.clearMuscle()">← Все тренировки</button>';
  if (!list.length) h += '<div class="empty">Нет упражнений на эту группу.</div>';
  list.forEach(function (o) {
    var e = o.ex, sug = exSuggestion(e);
    h += '<div class="ex" onclick="VF.openLogger(\'' + e.id + '\')"><div class="ex-top"><div><div class="ex-nm">' + esc(e.name) + '</div>'
      + '<div class="ex-tg">' + esc(o.day.name.replace(/^День \d+ — /, '')) + ' · ' + e.sets + '×' + (e.range ? e.range[0] + '–' + e.range[1] : e.reps) + '</div></div>'
      + '<div class="ex-lv">Lv ' + liftLevel(e) + (sug.bump ? ' ⬆' : '') + '</div></div></div>';
  });
  h += '<div class="hint">Тапни упражнение — запишешь подход и получишь XP. Веса и прогрессия считаются автоматически.</div>';
  $('#screen-gym').innerHTML = h;
}

// ---------- Muscle map (SVG, per-muscle highlight + recovery «заряд») ----------
var RECOVERY_DAYS = { chest: 3.5, back: 3.5, shoulders: 3, arms: 2.5, abs: 2, legs: 4 };
function groupLastTrained(group) {
  var last = null;
  S.sessions.forEach(function (s) {
    (s.sets || []).forEach(function (st) {
      if (muscleOf(st.exId) === group) { var d = parseKey(s.date); if (!last || d > last) last = d; }
    });
  });
  return last;
}
function groupRecovery(group) {            // 1 = полностью восстановлена/заряжена, 0 = только что нагружена
  var last = groupLastTrained(group);
  if (!last) return 1;
  var days = (new Date() - last) / 86400000;
  return clamp(days / (RECOVERY_DAYS[group] || 3.5), 0, 1);
}
function svgFor(side) {
  var data = window.MUSCLE_SVG && window.MUSCLE_SVG[side];
  if (!data) return '';
  var paths = data.muscles.map(function (m) {
    if (m.group === 'base') return '<path class="m-base" d="' + m.d + '"/>';
    var rec = Math.round(groupRecovery(m.group) * 100);
    return '<path class="m-mus' + (rec >= 88 ? ' charged' : '') + '" data-group="' + m.group + '" data-slug="' + m.slug + '" style="--rec:' + rec + '" d="' + m.d + '"/>';
  }).join('');
  return '<svg id="mm-' + side + '" class="mmap" viewBox="' + data.viewBox + '" preserveAspectRatio="xMidYMid meet">' + paths + '</svg>';
}
function mountMuscleMap() {
  ['front', 'back'].forEach(function (side) {
    var svg = document.getElementById('mm-' + side);
    if (svg) { try { var b = svg.getBBox(); svg.setAttribute('viewBox', (b.x - 18) + ' ' + (b.y - 18) + ' ' + (b.width + 36) + ' ' + (b.height + 36)); } catch (e) {} }
  });
  var wrap = document.getElementById('mmWrap');
  if (wrap && !wrap._bound) {
    wrap._bound = true;
    wrap.addEventListener('click', function (e) {
      var p = e.target.closest ? e.target.closest('path.m-mus') : null;
      if (p) { haptic('light'); var fine = fineOfSlug(p.getAttribute('data-slug')); if (fine) muscleMenuFine(fine); else window.VF.muscleMenu(p.getAttribute('data-group')); }
    });
  }
}
function muscleMapPanel() {
  var GR = ['chest', 'back', 'shoulders', 'arms', 'abs', 'legs'];
  var ready = GR.filter(function (g) { return groupRecovery(g) >= 0.88; }).length;
  var h = '<div class="coach"><span class="ci">🫀</span><div><b style="color:var(--text-hi)">Карта мышц</b><br>Тапни мышцу → упражнения или восстановление. Ярко-бирюзовые — <b style="color:var(--accent)">заряжены</b> и готовы к нагрузке, тусклые — ещё восстанавливаются.</div></div>';
  h += '<div class="card glass-card" style="margin-top:14px"><div id="mmWrap" class="mmap-wrap">' + svgFor('front') + svgFor('back') + '</div>';
  h += '<div class="mm-legend"><span><i class="d charged"></i>заряжена</span><span><i class="d mid"></i>восстанавливается</span><span><i class="d low"></i>устала</span></div>';
  h += '<div class="hint" style="text-align:center">Готово к тренировке: <b style="color:var(--accent)" class="tnum">' + ready + '/6</b> групп · «заряд» считается по дням с последней нагрузки.</div></div>';
  return h;
}

// ============================================================
//  RENDER
// ============================================================
function ring(pct, kcalCenter, unit, size) {
  size = size || 168; var r = (size - 24) / 2, c = 2 * Math.PI * r, off = c * (1 - clamp(pct, 0, 100) / 100);
  return '<div class="ring" style="width:' + size + 'px;height:' + size + 'px">'
    + '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">'
    + '<defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EE6EA"/><stop offset="1" stop-color="#28B6BD"/></linearGradient></defs>'
    + '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#181B22" stroke-width="14"/>'
    + '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="url(#cg)" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" style="transition:stroke-dashoffset .8s cubic-bezier(.22,1,.36,1);filter:drop-shadow(0 0 8px rgba(63,211,216,.5))"/>'
    + '</svg><div class="center"><div class="big tnum">' + kcalCenter + '</div><div class="unit">' + unit + '</div></div></div>';
}
function silhouette(stage) {
  var sw = 30 + stage * 7;
  var glow = 0.1 + stage * 0.05;
  return '<div class="silho"><svg viewBox="0 0 120 200" xmlns="http://www.w3.org/2000/svg">'
    + '<defs><linearGradient id="bg' + stage + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4150"/><stop offset="1" stop-color="#222732"/></linearGradient>'
    + '<filter id="gl"><feGaussianBlur stdDeviation="3"/></filter></defs>'
    + '<g filter="url(#gl)" opacity="' + glow + '"><ellipse cx="60" cy="110" rx="' + sw + '" ry="80" fill="#3FD3D8"/></g>'
    + '<circle cx="60" cy="24" r="15" fill="url(#bg' + stage + ')"/>'
    + '<path d="M60 40 C' + (60 - sw) + ' 48 ' + (60 - sw) + ' 70 ' + (60 - sw + 6) + ' 96 L' + (60 - 14) + ' 188 h12 L60 150 l8 38 h12 L' + (60 + sw - 6) + ' 96 C' + (60 + sw) + ' 70 ' + (60 + sw) + ' 48 60 40 z" fill="url(#bg' + stage + ')" stroke="rgba(63,211,216,.4)" stroke-width="1.5"/>'
    + '</svg></div>';
}

function renderHome() {
  ensureQuests(); refreshDailyQuests();
  var li = levelInfo(S.xp), st = computeStage(), sd = stageData();
  var p = S.profile, tg2 = targets(), eaten = eatenToday();
  var kpct = eaten.kcal / tg2.kcal * 100;
  var b1 = exById('bench_mch'), b2 = exById('leg_ext');
  var rec = recommendDay();
  var h = '';
  h += '<div class="scr-head"><div><div class="eyebrow">VITA<b style="color:var(--accent)">FORGE</b></div><h1>' + esc(p.name) + '</h1></div>'
    + '<div class="streak"><span class="fl">🔥</span><span class="tnum">' + S.streak.count + '</span> дн.</div></div>';
  var hv = renderHome.view || '3d';
  h += '<div class="hero"><div class="hero-card' + (hv === 'muscles' ? ' mode-mus' : '') + '">';
  if (hv === '3d') {
    h += '<div class="lift-badge l"><div class="nm">Жим</div><div class="lvl">Lv ' + (b1 ? liftLevel(b1.ex) : 1) + '</div><div class="wt tnum">' + (b1 ? b1.ex.weight : '–') + 'кг</div></div>';
    h += '<div class="lift-badge r"><div class="nm">Ноги</div><div class="lvl">Lv ' + (b2 ? liftLevel(b2.ex) : 1) + '</div><div class="wt tnum">' + (b2 ? b2.ex.weight : '–') + 'кг</div></div>';
    h += '<div class="avatar" id="avatar"></div>';
    h += '<div class="stage-tag">Стадия ' + st + ' · ' + esc(sd.title) + '</div>';
  } else {
    h += '<div id="mmWrap" class="mmap-wrap">' + svgFor('front') + svgFor('back') + '</div>';
    h += '<div class="mm-legend"><span><i class="d charged"></i>заряжена</span><span><i class="d mid"></i>восст.</span><span><i class="d low"></i>устала</span></div>';
  }
  h += '<div class="hero-name">' + esc(sd.title) + '</div>';
  h += '<div class="hero-sub">👆 Тапни фигуру → карта мышц на весь экран</div>';
  h += '<div class="level-line"><div class="level-disc"><b class="tnum">' + li.level + '</b></div>'
    + '<div class="xpbar"><div class="meta"><span>Уровень ' + li.level + '</span><span><b class="tnum">' + fmt(li.into) + '</b> / ' + fmt(li.need) + ' XP</span></div>'
    + '<div class="track"><div class="fill" style="width:' + li.pct + '%"></div></div></div></div>';
  h += '</div></div>';
  h += '<div class="row2" style="margin-top:var(--sp-5)">';
  h += '<div class="card" style="margin:0"><div class="eyebrow" style="color:var(--text-muted)">Тренировка дня</div>'
    + '<div style="color:var(--text-hi);font-weight:800;font-size:var(--fs-h3);margin:6px 0 2px">' + esc(rec.day.name.replace(/^День \d+ — /, '')) + '</div>'
    + '<div style="color:var(--text-muted);font-size:var(--fs-sm)">' + rec.day.exercises.length + ' упр. · +' + (rec.day.exercises.length * 60) + ' XP</div>'
    + '<button class="pill sm" style="margin-top:12px" onclick="VF.go(\'gym\')">Начать</button></div>';
  h += '<div class="card" style="margin:0;text-align:center"><div class="eyebrow" style="color:var(--text-muted);text-align:left">Калории</div>'
    + ring(kpct, fmt(eaten.kcal), 'из ' + fmt(tg2.kcal), 120)
    + '<button class="pill sm ghost" style="margin-top:10px" onclick="VF.go(\'food\')">Питание</button></div>';
  h += '</div>';
  h += '<div class="section-title">Дейлики</div>';
  S.quests.daily.forEach(function (q) {
    h += '<div class="quest ' + (q.done ? 'done' : '') + '"><div class="qi">' + (q.done ? '✓' : q.icon) + '</div>'
      + '<div><div class="qt">' + esc(q.t) + '</div></div><div class="qr">+' + q.xp + ' XP</div></div>';
  });
  $('#screen-home').innerHTML = h;
  if (hv === '3d') { if (window.mountAvatar) window.mountAvatar($('#avatar'), Object.assign(avatarParams(), { tapMode: 'open' })); }
  else { mountMuscleMap(); }
}
var labSide = 'front';   // какая сторона анатомии открыта в зале мышц
function openMuscleLab() {
  var lab = $('#muscleLab'); if (!lab) return;
  lab.innerHTML = '<div class="mlab-head"><button class="mlab-x" onclick="VF.closeMuscleLab()">‹ Назад</button><div class="mlab-title">Мышцы</div><div style="width:64px"></div></div>'
    + '<div class="mlab-toggle"><div class="mlab-side-seg"><button class="' + (labSide === 'front' ? 'on' : '') + '" onclick="VF.labSide(\'front\')">Спереди</button><button class="' + (labSide === 'back' ? 'on' : '') + '" onclick="VF.labSide(\'back\')">Сзади</button></div></div>'
    + '<div class="mlab-stage" id="mlabStage"><div id="mlabWrap" class="mlab-map">' + svgFor(labSide) + '</div><div class="mlab-name" id="mlabName"></div></div>'
    + '<div class="mlab-hint">Наведи или тапни мышцу — подсветится целиком, покажу упражнения и восстановление</div>';
  lab.classList.add('show');
  bindLabMap();
  haptic('light');
}
function bindLabMap() {
  var wrap = document.getElementById('mlabWrap'); if (!wrap) return;
  var svg = wrap.querySelector('svg.mmap');
  if (svg) { try { var b = svg.getBBox(); svg.setAttribute('viewBox', (b.x - 14) + ' ' + (b.y - 14) + ' ' + (b.width + 28) + ' ' + (b.height + 28)); } catch (e) {} }
  var nameEl = document.getElementById('mlabName');
  function labelOf(p) { var fine = fineOfSlug(p.getAttribute('data-slug')); if (fine) return fineRu(fine); var g = p.getAttribute('data-group'); return MUSCLE_INFO[g] ? MUSCLE_INFO[g].name : g; }
  function hot(p) {
    if (p === wrap._hot) return;
    if (wrap._hot) wrap._hot.classList.remove('active');
    if (p) { p.classList.add('active'); if (nameEl) { nameEl.textContent = labelOf(p); nameEl.classList.add('show'); } }
    else if (nameEl) nameEl.classList.remove('show');
    wrap._hot = p;
  }
  wrap.addEventListener('pointermove', function (e) { hot(e.target.closest ? e.target.closest('path.m-mus') : null); });
  wrap.addEventListener('pointerleave', function () { hot(null); });
  wrap.addEventListener('pointerdown', function (e) { var p = e.target.closest ? e.target.closest('path.m-mus') : null; if (p) hot(p); });
  wrap.addEventListener('click', function (e) {
    var p = e.target.closest ? e.target.closest('path.m-mus') : null; if (!p) return;
    haptic('light'); var fine = fineOfSlug(p.getAttribute('data-slug'));
    if (fine) muscleMenuFine(fine); else window.VF.muscleMenu(p.getAttribute('data-group'));
  });
}
function closeMuscleLab() { var lab = $('#muscleLab'); if (lab) lab.classList.remove('show'); renderHome(); }
renderHome.view = '3d';
function avatarParams() {
  var st = computeStage();
  var muscle = clamp((st - 1) / 5, 0, 1);
  var bf = S.profile.bodyFat;
  var fat = bf != null ? clamp((bf - 10) / 20, 0, 1) : 0.3;
  return { gender: S.profile.sex === 'f' ? 'f' : 'm', muscle: muscle, fat: fat };
}

function renderGym() {
  if (renderGym.muscle) { return renderGymMuscle(renderGym.muscle); }
  var seg = renderGym.seg || 'today';
  var rec = recommendDay();
  var h = '<div class="scr-head"><div><div class="eyebrow">Зал</div><h1>Качаемся</h1></div></div>';
  h += '<div class="seg seg-scroll">' + segBtn('today', seg, 'Сессия') + segBtn('stack', seg, 'Стек') + segBtn('muscles', seg, 'Мышцы') + segBtn('progress', seg, 'Прогресс') + segBtn('calendar', seg, 'Календарь') + '</div>';
  if (seg === 'today') {
    h += '<div class="coach"><span class="ci">🤖</span><div><b style="color:var(--text-hi)">' + esc(rec.day.name) + '</b><br>Почему этот: дольше всего не тренировал эту группу (' + (rec.since > 90 ? 'ещё не было' : rec.since + ' дн. назад') + ') — восстановилась, бьём её.</div></div>';
    h += '<div style="height:14px"></div>';
    rec.day.exercises.forEach(function (e) {
      var sug = exSuggestion(e);
      h += '<div class="ex" onclick="VF.openLogger(\'' + e.id + '\')"><div class="ex-top"><div><div class="ex-nm">' + esc(e.name) + '</div>'
        + '<div class="ex-tg">' + e.sets + '×' + (e.range ? e.range[0] + '–' + e.range[1] : e.reps) + ' · ' + esc(sug.txt) + '</div></div>'
        + '<div class="ex-lv">Lv ' + liftLevel(e) + (sug.bump ? ' ⬆' : '') + '</div></div></div>';
    });
    h += '<button class="pill" style="margin-top:14px" onclick="VF.finishWorkout(\'' + rec.day.id + '\')">Завершить тренировку</button>';
    h += '<div class="hint">Тапни упражнение, чтобы записать подходы и получить XP. PR подсвечивается золотом и качает уровень лифта.</div>';
  } else if (seg === 'progress') {
    h += '<div class="section-title">Уровни лифтов и 1ПМ</div>';
    allEx().forEach(function (o) {
      var e = o.ex, pr = projectE1RM(e);
      h += '<div class="ex"><div class="ex-top"><div><div class="ex-nm">' + esc(e.name) + '</div>'
        + '<div class="ex-tg tnum">1ПМ сейчас ~' + Math.round(pr.now) + ' → через 12 нед ~' + Math.round(pr.future) + ' ' + S.program.units + '</div></div>'
        + '<div class="ex-lv">Lv ' + liftLevel(e) + '</div></div>'
        + '<div class="track" style="margin-top:10px"><div class="fill" style="width:' + clamp(pr.now / pr.future * 100, 5, 100) + '%"></div></div></div>';
    });
    h += '<div class="hint">Прогноз построен по двойной прогрессии: шаг прибавки и частота заложены в каждое упражнение. Реальные PR двигают линию быстрее.</div>';
  } else if (seg === 'stack') {
    h += renderStackPanel();
  } else if (seg === 'muscles') {
    h += muscleMapPanel();
  } else {
    h += '<div class="section-title">Когда поднимать вес</div>';
    var ev = bumpCalendar(12), curMonth = '';
    if (!ev.length) h += '<div class="empty">Нет запланированных прибавок.</div>';
    ev.slice(0, 40).forEach(function (x) {
      var mk = MON[x.date.getMonth()];
      if (mk !== curMonth) { curMonth = mk; h += '<div class="section-title">' + mk.toUpperCase() + '</div>'; }
      h += '<div class="quest"><div class="qi">📅</div><div><div class="qt tnum">' + WD[x.date.getDay()] + ', ' + ddmm(x.date) + '</div>'
        + '<div class="qs">' + esc(x.ex) + '</div></div><div class="qr tnum">' + x.w + ' кг</div></div>';
    });
    h += '<div class="hint">Это ориентир по прогрессивной перегрузке. Если на тренировке вес дался тяжело (RPE ≥ 9.5) — приложение само сдвинет прибавку.</div>';
  }
  $('#screen-gym').innerHTML = h;
  if (seg === 'muscles') mountMuscleMap();
}
renderGym.seg = 'today';
function segBtn(id, cur2, label) { return '<button class="' + (cur2 === id ? 'on' : '') + '" onclick="VF.gymSeg(\'' + id + '\')">' + label + '</button>'; }

function renderFood() {
  refreshDailyQuests();
  var tg2 = targets(), eaten = eatenOn(viewDate);
  var kpct = eaten.kcal / tg2.kcal * 100;
  var meals = S.meals[viewDate] || [];
  var sess = sessionsOn(viewDate);
  var dayLbl = isToday(viewDate) ? 'сегодня' : 'в этот день';
  var h = '<div class="scr-head"><div><div class="eyebrow">Питание</div><h1>Рацион</h1></div>'
    + '<div class="streak" style="background:var(--accent-tint);border-color:var(--accent-line);color:var(--accent)">🥗 <span class="tnum">' + S.nutStreak.count + '</span> дн.</div></div>';
  h += dateStripHtml();
  h += '<div class="card" style="text-align:center;padding-top:var(--sp-6)">' + ring(kpct, fmt(eaten.kcal), 'из ' + fmt(tg2.kcal) + ' ккал', 184);
  h += '<div class="macro-legend"><div class="m"><div class="ml"><span class="dot" style="background:#5EE6EA"></span>Белок</div><div class="mv tnum">' + Math.round(eaten.protein) + '/' + tg2.protein + 'г</div></div>'
    + '<div class="m"><div class="ml"><span class="dot" style="background:#46D6A0"></span>Углеводы</div><div class="mv tnum">' + Math.round(eaten.carbs) + '/' + tg2.carbs + 'г</div></div>'
    + '<div class="m"><div class="ml"><span class="dot" style="background:#F4B740"></span>Жиры</div><div class="mv tnum">' + Math.round(eaten.fat) + '/' + tg2.fat + 'г</div></div></div>';
  h += '<div style="color:var(--text-muted);font-size:var(--fs-sm);margin-top:14px">Осталось <b class="tnum" style="color:var(--accent)">' + fmt(Math.max(0, tg2.kcal - eaten.kcal)) + '</b> ккал · <b class="tnum">' + Math.max(0, tg2.protein - Math.round(eaten.protein)) + '</b>г белка</div>';
  h += '</div>';
  h += '<div class="section-title">Добавить приём пищи</div>';
  h += mealSlotChips();
  h += '<div style="display:flex;gap:10px;margin-top:10px"><button class="pill" style="flex:1;margin:0" onclick="VF.genDish()">🍽️ Сгенерировать ' + SLOT_RU[mealSlot].toLowerCase() + '</button>'
    + '<button class="pill ghost" style="flex:none;width:auto;margin:0;padding:0 18px" onclick="VF.manualMeal()">✏️ Вписать</button></div>';
  h += '<div id="dishSlot"></div>';
  h += '<div class="section-title">Съедено ' + dayLbl + '</div>';
  if (!meals.length) h += '<div class="empty">Пока ничего. Сгенерируй блюдо или впиши калории.</div>';
  meals.forEach(function (m, i) {
    h += '<div class="quest"><div class="qi">' + (m.emoji || '🍽️') + '</div><div><div class="qt">' + esc(m.name) + (m.manual ? ' <span style="color:var(--text-faint);font-weight:600">· вручную</span>' : '') + '</div>'
      + '<div class="qs tnum">' + (SLOT_RU[m.slot] ? SLOT_RU[m.slot] + ' · ' : '') + m.kcal + ' ккал · Б' + m.p + ' Ж' + m.f + ' У' + m.c + '</div></div>'
      + '<div class="qr" style="background:none;border:none;color:var(--text-faint);cursor:pointer" onclick="VF.delMeal(' + i + ')">✕</div></div>';
  });
  h += '<div class="section-title">Тренировки ' + dayLbl + '</div>';
  if (!sess.length) h += '<div class="empty">В этот день тренировок не было.</div>';
  sess.forEach(function (s) {
    var nSets = (s.sets || []).length, prs = (s.sets || []).filter(function (x) { return x.pr; }).length;
    h += '<div class="quest"><div class="qi">🏋️</div><div><div class="qt">' + esc(dayName(s.dayId)) + '</div>'
      + '<div class="qs tnum">' + nSets + ' подходов' + (prs ? ' · 🏆 ' + prs + ' PR' : '') + ' · +' + (s.xp || 0) + ' XP</div></div>'
      + '<div class="qr tnum">' + nSets + '</div></div>';
  });
  $('#screen-food').innerHTML = h;
}

function renderQuests() {
  ensureQuests(); refreshDailyQuests();
  var h = '<div class="scr-head"><div><div class="eyebrow">Сезон 1</div><h1>Квесты</h1></div></div>';
  h += '<div class="coach"><span class="ci">🏔️</span><div><b style="color:var(--text-hi)">Стать сильнейшим</b><br>Кампания: качай лифты, держи стрик, эволюционируй персонажа от Сухарика до Легенды.</div></div>';
  h += '<div class="section-title">Дейлики сегодня</div>';
  S.quests.daily.forEach(function (q) {
    h += '<div class="quest ' + (q.done ? 'done' : '') + '"><div class="qi">' + (q.done ? '✓' : q.icon) + '</div><div><div class="qt">' + esc(q.t) + '</div></div><div class="qr">+' + q.xp + '</div></div>';
  });
  h += '<div class="section-title">Недельные</div>';
  S.quests.weekly.forEach(function (q) {
    var prog = q.id === 'w_sessions' ? weeklySessions() : q.prog;
    h += '<div class="quest"><div class="qi">' + q.icon + '</div><div><div class="qt">' + esc(q.t) + '</div>'
      + '<div class="track" style="margin-top:8px;height:8px"><div class="fill" style="width:' + clamp(prog / q.goal * 100, 0, 100) + '%"></div></div></div>'
      + '<div class="qr tnum">' + Math.min(prog, q.goal) + '/' + q.goal + '</div></div>';
  });
  $('#screen-quests').innerHTML = h;
}

function renderHero() {
  var li = levelInfo(S.xp), st = computeStage(), sd = stageData(), p = S.profile;
  var sx = stageAxes();
  var si = strengthIndex();
  var h = '<div class="scr-head"><div><div class="eyebrow">Герой</div><h1>' + esc(p.name) + '</h1></div>'
    + '<div class="level-disc"><b class="tnum">' + li.level + '</b></div></div>';
  h += '<div class="hero" style="margin-top:48px"><div class="hero-card"><div class="avatar" id="avatarH"></div>'
    + '<div class="stage-tag">Стадия ' + st + '/6</div>'
    + '<div class="hero-name">' + esc(sd.title) + '</div><div class="hero-sub">' + esc(sd.description.split('.')[0]) + '.</div></div></div>';
  h += '<div class="section-title">Эволюция — до стадии ' + sx.nextStage + '</div><div class="card"><div class="evo">';
  sx.axes.forEach(function (a) {
    var pct = a.bf ? clamp((1 - clamp((a.bfVal - a.bfMax) / 10, 0, 1)) * 100, 0, 100) : clamp(a.val / a.goal * 100, 0, 100);
    var ok = pct >= 99;
    var valTxt = a.bf ? (a.bfVal + '% / цель ≤' + a.bfMax + '%') : (a.name === 'Объём' ? Math.round(a.val) + '/' + a.goal : a.val.toFixed(1) + '/' + a.goal.toFixed(1));
    h += '<div class="e"><div class="eh"><span class="en">' + a.name + '</span><span class="ev tnum">' + valTxt + (ok ? ' ✓' : '') + '</span></div>'
      + '<div class="et"><div class="ef ' + (ok ? 'ok' : '') + '" style="width:' + pct + '%"></div></div></div>';
  });
  h += '</div></div>';
  h += '<div class="section-title">Характеристики</div><div class="row2">';
  h += '<div class="tile"><div class="lbl">Сила (индекс)</div><div class="val accent tnum">' + si.toFixed(2) + '</div></div>';
  h += '<div class="tile"><div class="lbl">Уровень</div><div class="val tnum">' + li.level + '</div></div>';
  h += '<div class="tile"><div class="lbl">Тренировок</div><div class="val tnum">' + S.sessions.length + '</div></div>';
  h += '<div class="tile"><div class="lbl">Золото</div><div class="val tnum">' + S.gold + '</div></div>';
  h += '</div>';
  h += '<div class="section-title">Тело и анализы</div><div class="card">';
  h += '<div class="krow"><span class="k">Вес</span><span class="v tnum">' + p.weight + ' кг</span></div>';
  h += '<div class="krow"><span class="k">% жира</span><span class="v tnum">' + (p.bodyFat != null ? p.bodyFat + '%' : '—') + '</span></div>';
  h += '<button class="pill ghost sm" style="margin-top:12px" onclick="VF.editBody()">Обновить замеры</button>';
  if (S.program.bodyLink) h += '<button class="pill ghost sm" style="margin-top:8px" onclick="VF.openLink()">Открыть отчёт по составу тела</button>';
  h += '<button class="pill ghost sm" style="margin-top:8px" onclick="VF.uploadDoc()">📎 Загрузить анализ / документ (' + S.docs.length + ')</button>';
  h += '<div class="hint">ИИ-анализ документов и автоимпорт замеров — следующий этап (с бэкендом). Сейчас данные хранятся локально на устройстве.</div>';
  h += '</div>';
  h += '<button class="pill ghost sm" style="margin-top:8px" onclick="VF.editProfile()">⚙️ Профиль и цель</button>';
  h += '<button class="pill ghost sm" style="margin:8px 0 30px;color:var(--danger)" onclick="VF.reset()">Сбросить данные</button>';
  $('#screen-hero').innerHTML = h;
  if (window.mountAvatar) window.mountAvatar($('#avatarH'), avatarParams());
}

// ============================================================
//  Interactions
// ============================================================
var draft = null;
var sessionBuf = [];
// мини-силуэт фронт с подсвеченной рабочей группой
function miniMuscleSvg(group) {
  var data = window.MUSCLE_SVG && window.MUSCLE_SVG.front;
  if (!data) return '';
  var paths = data.muscles.map(function (m) {
    if (m.group === 'base') return '<path d="' + m.d + '" fill="#23272f" opacity="0.4"/>';
    var lit = m.group === group;
    return '<path d="' + m.d + '" fill="' + (lit ? '#54C4CE' : '#2b3140') + '"' + (lit ? ' style="filter:drop-shadow(0 0 4px rgba(84,196,206,.85))"' : '') + '/>';
  }).join('');
  return '<svg class="mini-muscle" viewBox="30 215 670 1150" preserveAspectRatio="xMidYMid meet">' + paths + '</svg>';
}
// демо выполнения (кросс-фейд старт↔конец) + подсветка мышцы
function exDemoHtml(exId) {
  var im = window.EX_IMAGES && window.EX_IMAGES[exId];
  var group = muscleOf(exId);
  if (!im || !im.images || !im.images.length) return '';
  var demo = '<div class="ed-anim"><img src="' + im.images[0] + '" alt="" loading="lazy">'
    + (im.images[1] ? '<img class="f2" src="' + im.images[1] + '" alt="" loading="lazy">' : '') + '</div>';
  var cap = (MUSCLE_INFO[group] ? MUSCLE_INFO[group].name : '');
  return '<div class="ex-demo glass-card">' + demo
    + '<div class="ed-mus">' + miniMuscleSvg(group) + '<div class="ed-cap">' + esc(cap) + '</div></div></div>';
}
function _openLogger(exId) {
  var o = exById(exId); if (!o) return; var e = o.ex;
  if (!draft || draft.exId !== exId) draft = { exId: exId, w: e.weight, reps: e.range ? e.range[1] : e.reps, rpe: 8, sets: [] };
  var h = '<div class="grab"></div><h3>' + esc(e.name) + '</h3>';
  h += exDemoHtml(exId);
  h += '<div class="setdots" id="setdots"></div>';
  h += '<div style="display:flex;gap:12px;margin:18px 0 8px"><div style="flex:1"><div class="lbl" style="color:var(--text-muted);font-size:var(--fs-label);text-transform:uppercase;letter-spacing:var(--tracking-label);font-weight:700;margin-bottom:6px">Вес</div>'
    + stepperHtml('w', draft.w, e.inc || 2.5) + '</div>'
    + '<div style="flex:1"><div class="lbl" style="color:var(--text-muted);font-size:var(--fs-label);text-transform:uppercase;letter-spacing:var(--tracking-label);font-weight:700;margin-bottom:6px">Повторы</div>'
    + stepperHtml('reps', draft.reps, 1) + '</div></div>';
  h += '<div class="lbl" style="color:var(--text-muted);font-size:var(--fs-label);text-transform:uppercase;letter-spacing:var(--tracking-label);font-weight:700;margin:14px 0 8px">RPE (тяжесть)</div><div class="rpe" id="rpe"></div>';
  h += '<div class="coach" style="margin-top:14px"><span class="ci">⚡</span><div>За этот подход: <b style="color:var(--accent)" id="xpprev" class="tnum">+0 XP</b></div></div>';
  h += '<button class="pill" style="margin-top:16px" onclick="VF.logSet()">Записать подход</button>';
  h += '<button class="pill ghost sm" style="margin-top:8px" onclick="VF.closeModal()">Готово</button>';
  openModal(h);
  drawLogger();
}
function openLogger(id) { if (draft && draft.sets.length && draft.exId !== id) { sessionBuf = sessionBuf.concat(draft.sets); draft = null; } _openLogger(id); }
function stepperHtml(field, val, step) {
  return '<div class="stepper"><button onclick="VF.step(\'' + field + '\',-' + step + ')">−</button>'
    + '<div class="sv tnum" id="sv_' + field + '">' + val + '</div>'
    + '<button onclick="VF.step(\'' + field + '\',' + step + ')">+</button></div>';
}
function drawLogger() {
  var o = exById(draft.exId), e = o.ex;
  var dd = $('#setdots'); if (dd) { var s = ''; for (var i = 0; i < e.sets; i++) { var done = draft.sets[i]; s += '<div class="setdot ' + (done ? 'done' : '') + '">' + (done ? done.reps : (i + 1)) + '</div>'; } dd.innerHTML = s; }
  var rp = $('#rpe'); if (rp) { var r = ''; [6, 7, 8, 9, 10].forEach(function (v) { r += '<button class="' + (draft.rpe === v ? 'on' : '') + '" onclick="VF.setRpe(' + v + ')">' + v + '</button>'; }); rp.innerHTML = r; }
  var xp = setXpPreview(); var xe = $('#xpprev'); if (xe) xe.textContent = '+' + xp + ' XP';
  var sv = $('#sv_w'); if (sv) sv.textContent = draft.w;
  sv = $('#sv_reps'); if (sv) sv.textContent = draft.reps;
}
function setXpPreview() {
  var o = exById(draft.exId), e = o.ex;
  var best = bestOf(e.id, workingE1RM(e));
  var cur = e1rm(draft.w, draft.reps);
  var base = 12;
  var intensity = clamp(cur / Math.max(best, 1), 0.6, 1.15);
  var xp = Math.round(base * intensity * (draft.rpe >= 8 ? 1.15 : 1));
  if (cur > best) xp = Math.round(xp * 1.6) + 60;
  return xp;
}
function logSet() {
  var o = exById(draft.exId), e = o.ex;
  var cur = e1rm(draft.w, draft.reps), best = bestOf(e.id, workingE1RM(e));
  var isPr = cur > best;
  var xp = setXpPreview();
  draft.sets.push({ exId: e.id, weight: draft.w, reps: draft.reps, rpe: draft.rpe, pr: isPr, xp: xp });
  if (isPr) { S.bestE1RM[e.id] = cur; e.weight = Math.max(e.weight, draft.w); toast('🏆 Новый PR! ' + e.name, 'pr'); burst(); haptic('rigid'); hapNotify('success'); }
  else { haptic('medium'); }
  addXp(xp);
  startRest(90);
  save(); drawLogger();
}
function finishWorkout(dayId) {
  var buf = sessionBuf.slice();
  if (draft && draft.sets.length) buf = buf.concat(draft.sets);
  if (!buf.length) { toast('Запиши хотя бы один подход'); return; }
  var sessXp = buf.reduce(function (a, s) { return a + (s.xp || 0); }, 0);
  var bonus = 40 + (dayId === recommendDay().day.id ? 30 : 0);
  addXp(bonus);
  S.sessions.push({ date: dayKey(), dayId: dayId, sets: buf, xp: sessXp + bonus });
  touchStreak();
  var dq = null; S.quests.daily.forEach(function (q) { if (q.id === 'd_workout') dq = q; }); if (dq) dq.done = true;
  var loot = lootRoll();
  S.gold += loot.gold;
  draft = null; sessionBuf = [];
  save();
  closeModal();
  stopRest();
  hapNotify('success');
  toast('✅ +' + fmt(sessXp + bonus) + ' XP · ' + loot.txt, 'win');
  burst();
  go('home');
}
function lootRoll() {
  var r = Math.random();
  if (r < 0.6) return { gold: 20, txt: '+20 золота' };
  if (r < 0.85) return { gold: 50, txt: '🎁 +50 золота' };
  if (r < 0.97) return { gold: 0, txt: '💎 жетон двойного XP' };
  return { gold: 200, txt: '🏆 эпик-дроп: +200 золота!' };
}

var lastDish = null;
function genDish() {
  var slot = mealSlot;
  var d = generateMeal(slot, viewDate);
  lastDish = d;
  var r = d.r;
  var h = '<div class="recipe" style="margin-top:14px"><div class="rh"><div class="remoji">' + (r.emoji || SLOT_EMOJI[slot] || '🍽️') + '</div>'
    + '<div><div class="rname">' + esc(r.name) + '</div><div class="rmeta">' + SLOT_RU[slot] + ' · ' + r.timeMin + ' мин · порция ×' + d.scale.toFixed(1) + '</div></div></div>';
  h += '<div class="rmac"><div class="mc"><b class="tnum">' + d.kcal + '</b><span>ккал</span></div><div class="mc"><b class="tnum">' + d.p + '</b><span>белок</span></div>'
    + '<div class="mc"><b class="tnum">' + d.f + '</b><span>жиры</span></div><div class="mc"><b class="tnum">' + d.c + '</b><span>углев</span></div></div>';
  h += '<div style="color:var(--text-muted);font-size:var(--fs-label);text-transform:uppercase;letter-spacing:var(--tracking-label);font-weight:700;margin-bottom:4px">Ингредиенты</div><ul>';
  d.ingredients.forEach(function (i) { h += '<li>' + esc(i.item) + ' — <b class="tnum" style="color:var(--text-hi)">' + i.grams + ' г</b></li>'; });
  h += '</ul><div style="color:var(--text-muted);font-size:var(--fs-label);text-transform:uppercase;letter-spacing:var(--tracking-label);font-weight:700;margin:8px 0 4px">Рецепт</div><ol>';
  r.steps.forEach(function (s) { h += '<li>' + esc(s) + '</li>'; });
  h += '</ol><div style="display:flex;gap:10px;margin-top:14px"><button class="pill sm" onclick="VF.addDish()">Добавить в день</button><button class="pill sm ghost" onclick="VF.genDish()">Другое блюдо</button></div></div>';
  $('#dishSlot').innerHTML = h;
  var ds = $('#dishSlot'); if (ds) ds.scrollIntoView({ block: 'start' });
  haptic('light');
}
function addDish() {
  if (!lastDish) return;
  var k = viewDate;
  if (!S.meals[k]) S.meals[k] = [];
  S.meals[k].push({ name: lastDish.r.name, emoji: lastDish.r.emoji || SLOT_EMOJI[lastDish.slot], kcal: lastDish.kcal, p: lastDish.p, f: lastDish.f, c: lastDish.c, slot: lastDish.slot });
  if (!S.usedRecipes[k]) S.usedRecipes[k] = [];
  S.usedRecipes[k].push(lastDish.r.name);
  addXp(20, true);
  if (isToday(k)) { var eaten = eatenToday(), tg2 = targets(); if (eaten.protein >= tg2.protein * 0.95) touchNutStreak(); }
  lastDish = null;
  $('#dishSlot').innerHTML = '';
  save(); renderFood();
  hapNotify('success');
  toast('Добавлено · +20 XP', 'win');
}
function delMeal(i) { var k = viewDate; if (S.meals[k]) { S.meals[k].splice(i, 1); save(); renderFood(); } }

// ---------- Ручной ввод калорий (съеденное вне приложения) ----------
function manualMeal() {
  var h = '<div class="grab"></div><h3>✏️ Вписать калории</h3>'
    + '<p class="hint" style="margin:-6px 0 14px">Своё блюдо или съеденное вне приложения. Обязательны только калории — макросы по желанию.</p>'
    + '<div class="field"><label>Название</label><input id="mm_name" placeholder="напр. шаурма" value=""></div>'
    + '<div class="slot-chips" id="mmSlots">' + ['breakfast', 'lunch', 'dinner', 'snack'].map(function (s) { return '<button class="' + (mealSlot === s ? 'on' : '') + '" data-s="' + s + '" onclick="VF.manualSlot(\'' + s + '\')">' + SLOT_EMOJI[s] + ' ' + SLOT_RU[s] + '</button>'; }).join('') + '</div>'
    + '<div class="field-row"><div class="field"><label>Ккал *</label><input id="mm_k" type="number" inputmode="numeric" placeholder="0"></div>'
    + '<div class="field"><label>Белок, г</label><input id="mm_p" type="number" inputmode="numeric" placeholder="0"></div></div>'
    + '<div class="field-row"><div class="field"><label>Жиры, г</label><input id="mm_f" type="number" inputmode="numeric" placeholder="0"></div>'
    + '<div class="field"><label>Углеводы, г</label><input id="mm_c" type="number" inputmode="numeric" placeholder="0"></div></div>'
    + '<button class="pill" style="margin-top:8px" onclick="VF.saveManual()">Добавить в день</button>';
  openModal(h);
  manualSlotSel = mealSlot;
}
var manualSlotSel = null;
function saveManual() {
  var g = function (id) { var el = $('#' + id); return el ? el.value : ''; };
  var k = +g('mm_k') || 0; if (k <= 0) { toast('Введи калории'); return; }
  var slot = manualSlotSel || mealSlot, key = viewDate;
  if (!S.meals[key]) S.meals[key] = [];
  S.meals[key].push({ name: g('mm_name') || 'Своё блюдо', emoji: SLOT_EMOJI[slot] || '🍽️', kcal: Math.round(k), p: Math.round(+g('mm_p') || 0), f: Math.round(+g('mm_f') || 0), c: Math.round(+g('mm_c') || 0), slot: slot, manual: true });
  addXp(10, true);
  if (isToday(key)) { var eaten = eatenToday(), tg2 = targets(); if (eaten.protein >= tg2.protein * 0.95) touchNutStreak(); }
  manualSlotSel = null;
  save(); closeModal(); renderFood(); hapNotify('success'); toast('Записано · +10 XP', 'win');
}

// ---------- Календарь / дневник по дням ----------
var CAL_MON = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
function dateStripHtml() {
  var d = parseKey(viewDate), label = isToday(viewDate) ? 'Сегодня' : (WD[d.getDay()] + ', ' + ddmm(d));
  return '<div class="datestrip">'
    + '<button class="ds-nav" onclick="VF.prevDay()">‹</button>'
    + '<button class="ds-cur" onclick="VF.openCalendar()"><span class="ds-d">' + label + '</span><span class="ds-cal">📅</span></button>'
    + '<button class="ds-nav" ' + (isToday(viewDate) ? 'disabled' : '') + ' onclick="VF.nextDay()">›</button></div>';
}
function mealSlotChips() {
  return '<div class="slot-chips">' + ['breakfast', 'lunch', 'dinner', 'snack'].map(function (s) {
    return '<button class="' + (mealSlot === s ? 'on' : '') + '" onclick="VF.setMealSlot(\'' + s + '\')">' + SLOT_EMOJI[s] + ' ' + SLOT_RU[s] + '</button>';
  }).join('') + '</div>';
}
function openCalendar() {
  var d = parseKey(viewDate); calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  renderCalendar();
}
function renderCalendar() {
  var y = calMonth.getFullYear(), m = calMonth.getMonth();
  var startDow = (new Date(y, m, 1).getDay() + 6) % 7;   // понедельник = 0
  var dim = new Date(y, m + 1, 0).getDate(), today = dayKey();
  var h = '<div class="grab"></div><div class="cal-head"><button class="ds-nav" onclick="VF.calNav(-1)">‹</button>'
    + '<div class="cal-title">' + CAL_MON[m] + ' ' + y + '</div>'
    + '<button class="ds-nav" onclick="VF.calNav(1)">›</button></div>';
  h += '<div class="cal-grid cal-dow">' + ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(function (w) { return '<span>' + w + '</span>'; }).join('') + '</div>';
  h += '<div class="cal-grid">';
  for (var i = 0; i < startDow; i++) h += '<span class="cal-cell empty"></span>';
  for (var dn = 1; dn <= dim; dn++) {
    var key = y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + dn).slice(-2);
    var hasW = sessionsOn(key).length > 0, hasM = (S.meals[key] && S.meals[key].length > 0), future = key > today;
    var cls = 'cal-cell' + (key === viewDate ? ' sel' : '') + (key === today ? ' today' : '') + (future ? ' future' : '');
    h += '<button class="' + cls + '" ' + (future ? 'disabled' : '') + ' onclick="VF.pickDay(\'' + key + '\')">' + dn
      + '<span class="cal-dots">' + (hasW ? '<i class="w"></i>' : '') + (hasM ? '<i class="m"></i>' : '') + '</span></button>';
  }
  h += '</div>';
  h += '<div class="cal-legend"><span><i class="w"></i>тренировка</span><span><i class="m"></i>питание</span></div>';
  h += '<button class="pill ghost sm" style="margin-top:12px" onclick="VF.today()">К сегодня</button>';
  openModal(h);
}
function dayName(dayId) { var n = 'Тренировка'; S.program.days.forEach(function (d) { if (d.id === dayId) n = d.name; }); return n.replace(/^День \d+ — /, ''); }

// ---------- Onboarding ----------
var onbStep = 0, onbData = null;
function startOnboarding() { onbData = JSON.parse(JSON.stringify(S.profile)); onbStep = 0; $('#onboarding').classList.add('show'); drawOnb(); }
function drawOnb() {
  var d = onbData, total = 5;
  var dots = '<div class="dots">'; for (var i = 0; i < total; i++) dots += '<i class="' + (i <= onbStep ? 'on' : '') + '"></i>'; dots += '</div>';
  var h = '<div class="brand"><div class="logo">VITA<b>FORGE</b></div><div class="tag">Прокачай реальное тело как персонажа</div></div>' + dots;
  if (onbStep === 0) {
    h += '<div class="step-h">Кто ты?</div><div class="step-sub">Нужно для расчёта калорий и силового индекса.</div>';
    h += '<div class="field"><label>Имя героя</label><input id="f_name" value="' + esc(d.name) + '"></div>';
    h += '<div class="opts g2"><button class="opt ' + (d.sex === 'm' ? 'on' : '') + '" onclick="VF.onbSet(\'sex\',\'m\')"><b>Мужчина</b></button>'
      + '<button class="opt ' + (d.sex === 'f' ? 'on' : '') + '" onclick="VF.onbSet(\'sex\',\'f\')"><b>Женщина</b></button></div>';
    h += '<div class="field-row"><div class="field"><label>Возраст</label><input id="f_age" type="number" inputmode="numeric" value="' + d.age + '"></div>'
      + '<div class="field"><label>Рост, см</label><input id="f_height" type="number" inputmode="numeric" value="' + d.height + '"></div></div>';
  } else if (onbStep === 1) {
    h += '<div class="step-h">Текущий вес</div><div class="step-sub">Вес нужен для расчёта — скучных графиков-весов не будет. Жир — опционально.</div>';
    h += '<div class="field-row"><div class="field"><label>Вес, кг</label><input id="f_weight" type="number" inputmode="decimal" value="' + d.weight + '"></div>'
      + '<div class="field"><label>% жира (если знаешь)</label><input id="f_bf" type="number" inputmode="decimal" value="' + (d.bodyFat != null ? d.bodyFat : '') + '"></div></div>';
    h += '<div class="hint">Из твоего замера youjiu позже подтянем точные цифры. Сейчас введи примерно или пропусти жир.</div>';
  } else if (onbStep === 2) {
    h += '<div class="step-h">Цель</div><div class="step-sub">От неё зависит калораж и приоритет.</div>';
    h += '<div class="opts">'
      + onbOpt('goal', 'cut', '🔥 Сушка', 'Снизить жир, сохранить мышцы (дефицит ~20%)')
      + onbOpt('goal', 'recomp', '⚖️ Рекомпозиция', 'Поддержание: сила вверх, состав тела лучше')
      + onbOpt('goal', 'bulk', '📈 Масса', 'Набор мышц (профицит ~10%)') + '</div>';
  } else if (onbStep === 3) {
    h += '<div class="step-h">Частота тренировок</div><div class="step-sub">Сколько раз в неделю планируешь зал?</div>';
    h += '<div class="opts g2">';
    [2, 3, 4, 5].forEach(function (n) { h += '<button class="opt ' + (d.days === n ? 'on' : '') + '" onclick="VF.onbSet(\'days\',' + n + ')"><b>' + n + ' раза</b></button>'; });
    h += '</div>';
  } else if (onbStep === 4) {
    h += '<div class="step-h">Питание</div><div class="step-sub">Ограничения для генератора блюд.</div>';
    h += '<div class="opts">'
      + onbOpt('diet', 'all', '🍗 Без ограничений', 'Ем всё')
      + onbOpt('diet', 'nodairy', '🥛 Без молочки', 'Исключить молоко, творог, сыр')
      + onbOpt('diet', 'veg', '🥦 Вегетарианство', 'Без мяса и рыбы')
      + onbOpt('diet', 'nogluten', '🌾 Без глютена', 'Исключить пшеницу, овёс, пасту') + '</div>';
  }
  h += '<div style="flex:1"></div>';
  h += '<button class="pill" onclick="VF.onbNext()">' + (onbStep < total - 1 ? 'Дальше' : 'Поехали 🚀') + '</button>';
  if (onbStep > 0) h += '<button class="pill ghost sm" style="margin-top:8px" onclick="VF.onbBack()">Назад</button>';
  $('#onboarding').innerHTML = h;
}
function onbOpt(field, val, title, sub) { return '<button class="opt ' + (onbData[field] === val ? 'on' : '') + '" onclick="VF.onbSet(\'' + field + '\',\'' + val + '\')"><b>' + title + '</b><span>' + sub + '</span></button>'; }
function onbCommitInputs() {
  var g = function (id) { var el = $('#' + id); return el ? el.value : null; };
  if (onbStep === 0) { onbData.name = g('f_name') || 'Атлет'; onbData.age = +g('f_age') || 28; onbData.height = +g('f_height') || 178; }
  if (onbStep === 1) { onbData.weight = +g('f_weight') || 75; var bf = g('f_bf'); onbData.bodyFat = bf ? +bf : null; }
}
function onbSet(f, v) { onbCommitInputs(); onbData[f] = v; drawOnb(); }
function onbNext() {
  onbCommitInputs();
  if (onbStep < 4) { onbStep++; drawOnb(); return; }
  S.profile = onbData; S.onboarded = true;
  allEx().forEach(function (o) { S.bestE1RM[o.ex.id] = workingE1RM(o.ex); });
  S.program.bodyweight = S.profile.weight;
  save();
  $('#onboarding').classList.remove('show');
  go('home');
  toast('Добро пожаловать, ' + esc(S.profile.name) + '! 💪', 'win');
}
function onbBack() { onbCommitInputs(); if (onbStep > 0) { onbStep--; drawOnb(); } }

// ---------- Profile / body edit ----------
function editProfile() {
  var p = S.profile;
  var h = '<div class="grab"></div><h3>Профиль и цель</h3>';
  h += '<div class="field"><label>Имя</label><input id="e_name" value="' + esc(p.name) + '"></div>';
  h += '<div class="field-row"><div class="field"><label>Вес, кг</label><input id="e_weight" type="number" value="' + p.weight + '"></div>'
    + '<div class="field"><label>Дней/нед</label><input id="e_days" type="number" value="' + p.days + '"></div></div>';
  h += '<div class="field"><label>Цель</label><select id="e_goal"><option value="cut"' + (p.goal === 'cut' ? ' selected' : '') + '>Сушка</option><option value="recomp"' + (p.goal === 'recomp' ? ' selected' : '') + '>Рекомпозиция</option><option value="bulk"' + (p.goal === 'bulk' ? ' selected' : '') + '>Масса</option></select></div>';
  h += '<div class="field"><label>Питание</label><select id="e_diet"><option value="all"' + (p.diet === 'all' ? ' selected' : '') + '>Без ограничений</option><option value="nodairy"' + (p.diet === 'nodairy' ? ' selected' : '') + '>Без молочки</option><option value="veg"' + (p.diet === 'veg' ? ' selected' : '') + '>Вегетарианство</option><option value="nogluten"' + (p.diet === 'nogluten' ? ' selected' : '') + '>Без глютена</option></select></div>';
  h += '<button class="pill" style="margin-top:8px" onclick="VF.saveProfile()">Сохранить</button>';
  openModal(h);
}
function saveProfile() {
  S.profile.name = $('#e_name').value || S.profile.name;
  S.profile.weight = +$('#e_weight').value || S.profile.weight;
  S.profile.days = +$('#e_days').value || S.profile.days;
  S.profile.goal = $('#e_goal').value;
  S.profile.diet = $('#e_diet').value;
  save(); closeModal(); renderCur(); toast('Сохранено');
}
function editBody() {
  var p = S.profile;
  var h = '<div class="grab"></div><h3>Замеры тела</h3>';
  h += '<div class="field-row"><div class="field"><label>Вес, кг</label><input id="b_w" type="number" value="' + p.weight + '"></div>'
    + '<div class="field"><label>% жира</label><input id="b_bf" type="number" value="' + (p.bodyFat != null ? p.bodyFat : '') + '"></div></div>';
  h += '<button class="pill" onclick="VF.saveBody()">Сохранить замер</button>';
  h += '<div class="hint">Замеры влияют на стадию персонажа (ось «Сушка») и не рисуют скучных графиков — только эволюцию аватара.</div>';
  openModal(h);
}
function saveBody() {
  S.profile.weight = +$('#b_w').value || S.profile.weight;
  var bf = $('#b_bf').value; S.profile.bodyFat = bf ? +bf : null;
  S.bodyLog.push({ date: dayKey(), weight: S.profile.weight, bodyFat: S.profile.bodyFat });
  save(); closeModal(); renderCur(); toast('Замер сохранён');
}
function uploadDoc() {
  var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,application/pdf';
  inp.onchange = function () { if (inp.files[0]) { S.docs.push({ name: inp.files[0].name, date: dayKey() }); save(); renderHero(); toast('📎 ' + inp.files[0].name + ' добавлен'); } };
  inp.click();
}
function openLink() { try { if (tg && tg.openLink) tg.openLink(S.program.bodyLink); else window.open(S.program.bodyLink, '_blank'); } catch (e) { window.open(S.program.bodyLink, '_blank'); } }
function reset() { if (confirm('Сбросить все данные VITAFORGE?')) { localStorage.removeItem(KEY); location.reload(); } }

// ---------- Modal / toast / fx ----------
function openModal(html) { $('#modal').innerHTML = html; $('#modalWrap').classList.add('open'); }
function closeModal() { $('#modalWrap').classList.remove('open'); }
var toastT = null;
function toast(msg, cls) { var t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (cls || ''); clearTimeout(toastT); toastT = setTimeout(function () { t.className = 'toast'; }, 2600); }
function burst() {
  var fx = $('#fx'); var cx = window.innerWidth / 2, cy = window.innerHeight * 0.32;
  for (var i = 0; i < 14; i++) {
    var s = document.createElement('div'); s.className = 'spark';
    var ang = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 120;
    s.style.left = cx + 'px'; s.style.top = cy + 'px';
    s.style.background = Math.random() > 0.5 ? '#FFC53D' : '#3FD3D8';
    fx.appendChild(s);
    (function (el, x, y) {
      el.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + x + 'px,' + y + 'px) scale(0)', opacity: 0 }], { duration: 620, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = function () { el.remove(); };
    })(s, Math.cos(ang) * dist, Math.sin(ang) * dist);
  }
}

// ---------- Router ----------
var cur = 'home';
function go(tab) {
  cur = tab;
  if (tab === 'food') { viewDate = dayKey(); mealSlot = slotByHour(); }   // еда всегда открывается на сегодня
  $all('.screen').forEach(function (s) { s.classList.remove('active'); });
  $('#screen-' + tab).classList.add('active');
  $all('.tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === tab); });
  var _ti = ['home', 'gym', 'food', 'quests', 'hero'].indexOf(tab);
  var _tb = $('#tabbar'); if (_tb) _tb.style.setProperty('--tab-x', _ti < 0 ? 0 : _ti);
  renderCur();
  window.scrollTo(0, 0);
  haptic('light');
}
function renderCur() {
  if (cur === 'home') renderHome();
  else if (cur === 'gym') renderGym();
  else if (cur === 'food') renderFood();
  else if (cur === 'quests') renderQuests();
  else if (cur === 'hero') renderHero();
}
function gymSeg(id) { renderGym.seg = id; renderGym(); }

// ---------- Public API ----------
window.VF = {
  go: go, gymSeg: gymSeg, openLogger: openLogger, closeModal: closeModal,
  step: function (f, d) { draft[f] = Math.max(f === 'reps' ? 1 : 0, (draft[f] || 0) + d); draft[f] = Math.round(draft[f] * 10) / 10; hapSelect(); drawLogger(); },
  setRpe: function (v) { draft.rpe = v; hapSelect(); drawLogger(); },
  stopRest: stopRest, addRest: function () { _restLeft += 15; haptic('light'); },
  logSet: logSet, finishWorkout: finishWorkout,
  genDish: genDish, addDish: addDish, delMeal: delMeal,
  setMealSlot: function (s) { mealSlot = s; hapSelect(); renderFood(); },
  manualMeal: manualMeal, saveManual: saveManual,
  manualSlot: function (s) { manualSlotSel = s; hapSelect(); $all('#mmSlots button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-s') === s); }); },
  openCalendar: openCalendar, calNav: function (d) { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + d, 1); renderCalendar(); },
  pickDay: function (k) { viewDate = k; mealSlot = isToday(k) ? slotByHour() : 'breakfast'; haptic('light'); closeModal(); renderFood(); },
  prevDay: function () { viewDate = shiftDay(viewDate, -1); if (!isToday(viewDate)) mealSlot = 'breakfast'; hapSelect(); renderFood(); },
  nextDay: function () { if (isToday(viewDate)) return; viewDate = shiftDay(viewDate, 1); if (isToday(viewDate)) mealSlot = slotByHour(); hapSelect(); renderFood(); },
  today: function () { viewDate = dayKey(); mealSlot = slotByHour(); haptic('light'); closeModal(); renderFood(); },
  onbSet: onbSet, onbNext: onbNext, onbBack: onbBack,
  editProfile: editProfile, saveProfile: saveProfile, editBody: editBody, saveBody: saveBody,
  uploadDoc: uploadDoc, openLink: openLink, reset: reset,
  muscleMenu: muscleMenu, muscleExercises: muscleExercises, muscleInjury: muscleInjury,
  muscleExFine: function (f) { var rd = recommendDay(); openExPicker(rd && rd.day ? rd.day.id : 'day1', f); },
  clearMuscle: function () { renderGym.muscle = null; renderGym(); },
  heroView: function (v) { renderHome.view = v; haptic('light'); renderHome(); },
  openMuscleLab: function () { openMuscleLab(); },
  closeMuscleLab: function () { closeMuscleLab(); },
  labSide: function (s) { labSide = s; hapSelect(); openMuscleLab(); },
  addEx: function (dayId) { openExPicker(dayId, 'chest'); },
  swapEx: function (id) { swapEx(id); },
  removeEx: function (id) { removeEx(id); },
  removeExConfirm: function (id) { removeFromStack(id); haptic('medium'); closeModal(); renderGym(); toast('Удалено'); },
  pickFine: function (f) { picker.fine = f; renderPicker(); },
  pickSearch: function (v) { picker.q = v; var el = $('#pkList'); if (el) el.innerHTML = pickListHtml(); },
  pickAdd: function (id) { pickAdd(id); },
  exInfo: function (id) { openExInfo(id, picker.mode === 'swap' ? 'swap' : 'picker'); },
  exInfoStack: function (id) { openExInfo(id, 'stack'); },
  exInfoConfirm: function () { exInfoConfirm(); },
  exInfoLog: function (id) { openLogger(id); },
  confirmAddYes: function () { if (pendingAdd) { var r = pendingAdd; pendingAdd = null; doAdd(r); } },
  openPickerBack: function () { renderPicker(); },
  regenStack: function () {
    var h = '<div class="grab"></div><h3>↻ Собрать стек из профиля</h3>'
      + '<div class="coach" style="margin-bottom:14px"><span class="ci">⚠️</span><div>Соберу свежий научный сплит из твоего профиля (цель «' + S.profile.goal + '», ' + (S.profile.days || 3) + ' дн./нед, инвентарь). История и PR сохранятся по id, но текущие упражнения, ручные добавления и замены заменятся.</div></div>'
      + '<button class="pill" onclick="VF.regenYes()">Пересобрать</button>'
      + '<button class="pill ghost sm" style="margin-top:8px" onclick="VF.closeModal()">Отмена</button>';
    openModal(h);
  },
  regenYes: function () { if (!LIB.ready) { toast('База ещё грузится…'); return; } S.program = generateBaseStack(S.profile); enrichProgram(); save(); closeModal(); renderGym(); hapNotify('success'); toast('Стек пересобран из профиля'); }
};

// ---------- Boot ----------
load();
$all('.tab').forEach(function (t) { t.addEventListener('click', function () { renderGym.muscle = null; go(t.getAttribute('data-tab')); }); });
$('#modalBg').addEventListener('click', closeModal);
if (!S.onboarded) startOnboarding();
else go('home');

})();

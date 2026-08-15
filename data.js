// Дефолтная программа — норматив пользователя.
// weight  — текущий рабочий вес (кг)
// sets    — кол-во подходов
// reps     — целевые повторы в рабочем подходе
// range   — [min,max] диапазон повторов (двойная прогрессия)
// inc     — шаг прибавки веса (кг), когда взят верх диапазона
// stepWeeks — за сколько недель в среднем добавляем 1 шаг (для прогноза/календаря)
// est     — вес подобран ориентировочно (в исходных данных не было)
// note    — пояснение
//
// rev — ревизия программы. При её росте load() подтягивает свежие веса и диапазоны
// в уже сохранённый стек (см. syncProgramRev в app.js), иначе правки этого файла
// видят только новые пользователи, а у существующего в localStorage остаётся старое.
window.DEFAULT_PROGRAM = {
  rev: 2,                // rev 2 — сверено с программой от 10.08.2026
  units: 'кг',
  bodyweight: 75,        // ориентир, меняется в профиле
  level: 'intermediate',
  // на какой день недели приходится каждая тренировка (0=Вс ... 6=Сб)
  schedule: { day1: 1, day2: 3, day3: 5 }, // Пн / Ср / Пт
  days: [
    {
      id: 'day1',
      name: 'День 1 — Грудь, руки, плечи',
      exercises: [
        { id: 'chest_up',    name: 'Грудь — верхний блок (кроссовер)', weight: 12.5, sets: 4, reps: 7,  range: [7, 12],   inc: 1,   stepWeeks: 3, note: 'от 7 повторов с прибавлением' },
        { id: 'chest_low',   name: 'Грудь — нижний блок (кроссовер)',  weight: 10.2, sets: 4, reps: 7,  range: [7, 12],   inc: 1,   stepWeeks: 3, note: 'от 7 повторов' },
        { id: 'bench_mch',   name: 'Жим лёжа в тренажёре',             weight: 20,   sets: 4, reps: 15, range: [12, 15],  inc: 2.5, stepWeeks: 2, note: 'в программе от 10.08 не значится' },
        { id: 'biceps_bar',  name: 'Бицепс — штанга',                  weight: 30,   sets: 4, reps: 11, range: [11, 15],  inc: 2.5, stepWeeks: 3, note: 'первый подход от 11, дальше с прибавлением' },
        { id: 'triceps_rev', name: 'Трицепс — обратный хват на блоке', weight: 22,   sets: 4, reps: 6,  range: [6, 10],   inc: 2,   stepWeeks: 3, note: 'от 6 повторов с нарастанием' },
        { id: 'delts_lat',   name: 'Средние дельты («утёнок»)',        weight: 36,   sets: 4, reps: 11, range: [11, 15],  inc: 2,   stepWeeks: 3 },
        { id: 'delts_front', name: 'Передние дельты — жим',            weight: 32,   sets: 4, reps: 10, range: [10, 14],  inc: 2.5, stepWeeks: 3, note: 'с нарастанием' },
        { id: 'delts_rear',  name: 'Задние дельты — махи в наклоне',   weight: 7,    sets: 4, reps: 15, range: [12, 20],  inc: 1,   stepWeeks: 3, note: 'в программе от 10.08 не значится' }
      ]
    },
    {
      id: 'day2',
      name: 'День 2 — Спина',
      exercises: [
        { id: 'row_chest',      name: 'Тяга с упором в грудь',         weight: 40,   sets: 4, reps: 6,  range: [6, 10],   inc: 2.5, stepWeeks: 2, note: 'ноги под 6; планировали понизить до 30 кг' },
        { id: 'pullover',       name: 'Пуловер на спину (верх. блок)', weight: 22.5, sets: 4, reps: 13, range: [13, 18],  inc: 2,   stepWeeks: 3, note: 'блок на максимальной высоте' },
        { id: 'low_row',        name: 'Нижний блок (горизонт. тяга)',  weight: 45,   sets: 4, reps: 9,  range: [9, 13],   inc: 2.5, stepWeeks: 2 },
        { id: 'abs_plan',       name: 'Пресс — «планетарка»',          weight: 50,   sets: 4, reps: 10, range: [10, 16],  inc: 2.5, stepWeeks: 3, note: 'прибавка по 2 повтора' },
        { id: 'neck',           name: 'Шея',                           weight: 14.7, sets: 1, reps: 15, range: [15, 20],  inc: 1,   stepWeeks: 3, note: 'по 15 повторов в каждом из четырёх направлений' },
        { id: 'db_press_close', name: 'Жим гантелей узким хватом',     weight: 16,   sets: 4, reps: 12, range: [12, 16],  inc: 2,   stepWeeks: 3, note: 'вес одной гантели' }
      ]
    },
    {
      id: 'day3',
      name: 'День 3 — Ноги',
      exercises: [
        { id: 'leg_ext',  name: 'Разгибание ног сидя',      weight: 50, sets: 4, reps: 15, range: [15, 20], inc: 5, stepWeeks: 2, note: 'прибавка по 2 повтора' },
        { id: 'leg_curl', name: 'Сгибание ног сидя',        weight: 41, sets: 4, reps: 15, range: [15, 20], inc: 5, stepWeeks: 2 },
        { id: 'calves',   name: 'Икры',                     weight: 40, sets: 4, reps: 17, range: [17, 24], inc: 5, stepWeeks: 2 },
        { id: 'glutes',   name: 'Ягодичные мышцы',          weight: 20, sets: 4, reps: 11, range: [11, 15], inc: 2.5, stepWeeks: 2 },
        { id: 'pec_deck', name: 'Грудное перекрытие',       weight: 45, sets: 4, reps: 11, range: [11, 15], inc: 2.5, stepWeeks: 2 }
      ]
    }
  ],
  // ссылка на внешний отчёт по составу тела — задаётся в приложении, хранится локально (в публичный репозиторий токен не коммитим)
  bodyLink: ''
};

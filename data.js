// Дефолтная программа — норматив пользователя.
// weight  — текущий рабочий вес (кг)
// sets    — кол-во подходов
// reps     — целевые повторы в рабочем подходе
// range   — [min,max] диапазон повторов (двойная прогрессия)
// inc     — шаг прибавки веса (кг), когда взят верх диапазона
// stepWeeks — за сколько недель в среднем добавляем 1 шаг (для прогноза/календаря)
// est     — вес подобран ориентировочно (в исходных данных не было)
// note    — пояснение
window.DEFAULT_PROGRAM = {
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
        { id: 'chest_up',    name: 'Грудь — верхний блок (кроссовер)', weight: 9,  sets: 4, reps: 12, range: [10, 15], inc: 1,   stepWeeks: 3, note: 'рабочий диапазон 7–9 кг' },
        { id: 'chest_low',   name: 'Грудь — нижний блок (кроссовер)',  weight: 7,  sets: 4, reps: 12, range: [10, 15], inc: 1,   stepWeeks: 3, note: 'рабочий диапазон 5–7 кг' },
        { id: 'bench_mch',   name: 'Жим лёжа в тренажёре',             weight: 20, sets: 4, reps: 15, range: [12, 15], inc: 2.5, stepWeeks: 2 },
        { id: 'biceps_bar',  name: 'Бицепс — штанга',                  weight: 25, sets: 4, reps: 12, range: [8, 12],  inc: 2.5, stepWeeks: 3, note: 'пирамида с прибавлением' },
        { id: 'triceps_rev', name: 'Трицепс — обратный хват на блоке', weight: 20, sets: 3, reps: 12, range: [10, 15], inc: 2.5, stepWeeks: 3, est: true },
        { id: 'delts_lat',   name: 'Средние дельты («утёнок»)',        weight: 32, sets: 4, reps: 12, range: [10, 15], inc: 2,   stepWeeks: 3 },
        { id: 'delts_front', name: 'Передние дельты — жим',            weight: 27, sets: 3, reps: 10, range: [8, 12],  inc: 2.5, stepWeeks: 3, note: 'с нарастанием' },
        { id: 'delts_rear',  name: 'Задние дельты — махи в наклоне',   weight: 7,  sets: 4, reps: 15, range: [12, 20], inc: 1,   stepWeeks: 3 }
      ]
    },
    {
      id: 'day2',
      name: 'День 2 — Спина',
      exercises: [
        { id: 'row_chest', name: 'Тяга с упором в грудь',          weight: 15, sets: 4, reps: 12, range: [10, 15], inc: 2.5, stepWeeks: 2, note: 'ноги под 7' },
        { id: 'pullover',  name: 'Пуловер на спину (верх. блок)',   weight: 18, sets: 4, reps: 12, range: [10, 15], inc: 2,   stepWeeks: 3 },
        { id: 'low_row',   name: 'Нижний блок (горизонт. тяга)',    weight: 32, sets: 4, reps: 12, range: [10, 15], inc: 2.5, stepWeeks: 2 },
        { id: 'abs_plan',  name: 'Пресс — «планетарка»',            weight: 15, sets: 4, reps: 15, range: [12, 20], inc: 2.5, stepWeeks: 3, est: true },
        { id: 'neck',      name: 'Шея',                             weight: 10, sets: 3, reps: 15, range: [12, 20], inc: 1,   stepWeeks: 3 }
      ]
    },
    {
      id: 'day3',
      name: 'День 3 — Ноги',
      exercises: [
        { id: 'leg_ext',  name: 'Разгибание ног сидя', weight: 41, sets: 4, reps: 15, range: [12, 15], inc: 5, stepWeeks: 2 },
        { id: 'leg_curl', name: 'Сгибание ног сидя',   weight: 27, sets: 4, reps: 15, range: [12, 15], inc: 5, stepWeeks: 2 },
        { id: 'calves',   name: 'Икры',                weight: 20, sets: 4, reps: 25, range: [20, 30], inc: 5, stepWeeks: 2 },
        { id: 'glutes',   name: 'Ягодичные мышцы',     weight: 27, sets: 4, reps: 15, range: [12, 15], inc: 5, stepWeeks: 2 }
      ]
    }
  ],
  // ссылка на внешний отчёт по составу тела — задаётся в приложении, хранится локально (в публичный репозиторий токен не коммитим)
  bodyLink: ''
};

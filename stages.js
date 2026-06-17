window.CHARACTER_STAGES = [
  {
    "level": 1,
    "title": "Новичок-Сухарик",
    "bodyFatRange": "18-25% (М) / 28-35% (Ж) — мягкий, без мышечного тонуса",
    "description": "Стартовая стадия. Тело мягкое/худое без выраженной мускулатуры — 'soft skinny'. Avatar выглядит обычным человеком в мешковатой одежде, плечи опущены, поза неуверенная. Это точка входа: любая первая залогированная тренировка должна ощущаться как победа, поэтому стадия щедра на XP и быстрые мелкие награды. Разблокируется сразу при регистрации. Задача стадии — закрепить привычку 3 тренировки в неделю, а не нагрузку.",
    "visualPrompt": "Dark gamer 3D character render, full-body hero shot, young androgynous beginner with soft untoned physique and slightly slouched posture, oversized plain hoodie and joggers, neutral skin, slightly insecure expression. Studio gradient backdrop deep charcoal to near-black, single strong teal rim light from back-left edge-lighting the silhouette, soft cool fill from front-right, subtle volumetric haze. Glossy stylized PBR materials, octane/redshift cinematic look, slight subsurface skin, rim-lit hair. Faint holographic UI ring at feet showing 'LVL 1'. Mood: humble starting point, untapped potential. 4k, sharp focus, vignette, teal-and-charcoal color grade."
  },
  {
    "level": 2,
    "title": "Втянулся",
    "bodyFatRange": "16-22% (М) / 26-32% (Ж) — мягкий, появляется минимальный тонус",
    "description": "Привычка закрепилась. Body-fat немного снизился, появился лёгкий мышечный тонус — плечи чуть расправлены, поза увереннее. Визуально разница тонкая, но заметная: одежда сидит чуть лучше, осанка прямее. Разблокируется при streak >= 14 дней активности И >= 12 залогированных тренировок. Это стадия удержания: тут впервые включается полноценный streak-механизм со streak-freeze, чтобы пропуск дня не сломал прогресс.",
    "visualPrompt": "Dark gamer 3D character render, full-body, same young person now standing straighter with light muscle tone and slightly leaner face, fitted athletic t-shirt and shorts, faint shoulder and forearm definition. Deep charcoal-to-black gradient studio backdrop, bold teal rim light carving the silhouette from back-left, cool cyan fill, soft volumetric atmosphere. Glossy cinematic PBR, subtle sweat sheen catching the teal light. Holographic floor ring reads 'LVL 2', a few small drifting particle sparks. Mood: momentum building, quiet confidence. 4k, cinematic, teal-and-charcoal grade, vignette."
  },
  {
    "level": 3,
    "title": "Качок-стажёр",
    "bodyFatRange": "14-18% (М) / 23-28% (Ж) — атлетичный, видимый тонус",
    "description": "Первый честный 'fit' рубеж. Body-fat в атлетичной зоне, мышцы читаются под одеждой и в рукавах: дельты, грудь, квадрицепсы оформлены. Это стадия, где новичок становится 'настоящим тренирующимся'. Разблокируется при достижении силового индекса (сумма e1RM ключевых движений / масса тела) среднего уровня И BF% в указанном диапазоне И streak/консистентность >= 70% за 8 недель. Тут включается weak-point targeting — система начинает балансировать объём по группам.",
    "visualPrompt": "Dark gamer 3D character render, full-body athletic build, visible muscle tone through a tight performance tank top, defined shoulders chest and quads, lean confident face, grounded power stance. Charcoal-to-black studio gradient, strong teal rim light from back-left edge-lighting every muscle contour, cyan-to-deep-blue fill, faint warm key accent on the face, volumetric haze. High-gloss cinematic PBR, sweat highlights tracing the deltoids. Holographic floor ring 'LVL 3' with a thin progress arc, rising ember-teal particles. Mood: earned fitness, athlete-in-training. 4k, sharp, teal-charcoal cinematic grade."
  },
  {
    "level": 4,
    "title": "Зальный",
    "bodyFatRange": "11-15% (М) / 20-24% (Ж) — мускулистый, заметная масса",
    "description": "Среднеопытный лифтер. Заметная мышечная масса и плотность, body-fat достаточно низкий, чтобы читались очертания пресса и сепарация плеч. Avatar явно 'тот, кто живёт в зале'. Разблокируется при заметном силовом приросте (e1RM ключевых движений вырос на конкретный % от стадии 3) + устойчивая консистентность + BF% в диапазоне. Тут уже работают точечные программы прогрессии и deload-циклы по утомлению.",
    "visualPrompt": "Dark gamer 3D character render, full-body muscular lifter with notable mass and density, abs faintly visible, broad capped shoulders, thick forearms, compression top pushed up or tank, strong dominant pose with arms slightly flared. Deep charcoal void backdrop, intense teal rim light wrapping the whole muscular silhouette from behind, cyan fill plus a cool key, dramatic volumetric beams, floating dust. Hyper-glossy cinematic PBR, pronounced sweat sheen and specular muscle highlights. Holographic floor ring 'LVL 4', orbiting data shards, energy crackle at hands. Mood: serious gym presence, formidable. 4k, ultra-sharp, teal-charcoal cinematic grade, strong vignette."
  },
  {
    "level": 5,
    "title": "Машина",
    "bodyFatRange": "8-12% (М) / 17-21% (Ж) — рельефный, спортивная сухость",
    "description": "Продвинутый, эстетично сухой и сильный. Чёткая мышечная сепарация, видимый пресс, выраженная V-форма, сосудистость на руках. Это уровень 'athlete physique'. Разблокируется при высоком силовом индексе относительно массы тела + длительной консистентности (полгода+ стабильной активности) + BF% в рельефной зоне. Прогрессия здесь точечная и осторожная — система чаще советует deload и фокус на слабых звеньях, чем тупой добор веса.",
    "visualPrompt": "Dark gamer 3D character render, full-body shredded athlete, sharp muscle separation, visible six-pack, strong V-taper, vascular arms, posing trunks or fitted shorts, powerful confident hero stance. Pure black-to-charcoal studio void, razor teal rim light slicing every cut and striation from back-left, cyan key plus subtle steel-blue fill, cinematic volumetric god-rays, drifting particles. Liquid-glossy PBR skin with crisp specular striation highlights and sweat micro-detail. Holographic floor ring 'LVL 5' with full progress arc, swirling energy ribbons, glowing core. Mood: peak conditioned athlete, machine-like. 4k, hyper-detailed, teal-charcoal cinematic grade, lens flare on rim."
  },
  {
    "level": 6,
    "title": "Легенда / Босс-Физик",
    "bodyFatRange": "6-10% (М) / 15-19% (Ж) — соревновательная сухость, элитная масса",
    "description": "Эндгейм-аватар. Соревновательная сухость + элитная масса и пропорции — physique уровня сцены/обложки. Это престижная стадия-'босс', достигается единицами и служит долгосрочной морковкой. Разблокируется при элитном силовом индексе + годами выстроенной консистентности + соревновательном BF%. Дальше — не новые стадии тела, а престиж-косметика, титулы и сезонные челленджи (endgame-контент), чтобы удерживать ветеранов без насилия над телом.",
    "visualPrompt": "Dark gamer 3D character render, full-body legendary physique, stage-condition extreme conditioning, elite mass and flawless proportions, deep striations, dry paper-thin skin, dramatic most-muscular or victory pose, epic boss-character energy. Cinematic black arena void, dual teal rim lights from both rear edges sculpting a god-tier silhouette, cyan-and-white key, theatrical volumetric beams, floating embers and energy motes. Ultra-glossy hyper-detailed PBR, intense specular striation map, oiled sheen reflecting teal. Ornate holographic floor sigil 'LVL MAX / LEGEND', crown of orbiting light shards, radiant aura. Mood: final-boss, mythic apex lifter, prestige. 4k, maximal detail, teal-charcoal cinematic grade, heroic lens flare and bloom."
  }
];

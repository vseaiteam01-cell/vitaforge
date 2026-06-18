# -*- coding: utf-8 -*-
"""Берём ingredients+recipes из вывода воркфлоу, считаем макросы рецептов
(сумма по ингредиентам -> 4/4/9 by construction), приводим к формату app
(window.RECIPES) + сохраняем window.INGREDIENTS."""
import json, os

SRC = r"C:\Users\90C5~1\AppData\Local\Temp\claude\C--Users-----claude\16686f07-f355-4fb0-be4d-b7b4c913577a\tasks\wxbv6ruet.output"
DST = r"C:\Users\ПК\Projects\fit-tracker"
d = json.load(open(SRC, encoding="utf-8"))
res = d["result"]
ings = res["ingredients"]
recs = res["recipes"]
by_id = {i["id"]: i for i in ings}

# slot map: новый -> 4 слота приложения
SLOT = {"breakfast": "breakfast", "lunch": "lunch", "dinner": "dinner", "snack": "snack",
        "pre_workout": "snack", "post_workout": "lunch", "dessert": "snack"}

def macros(r):
    k = p = f = c = fib = 0.0
    unknown = 0
    items = []
    for ing in r.get("ingredients", []):
        row = by_id.get(ing.get("ingredient_id"))
        g = float(ing.get("grams", 0) or 0)
        if not row or g <= 0:
            unknown += 1
            continue
        k += g / 100.0 * row["kcal_100g"]
        p += g / 100.0 * row["protein_100g"]
        c += g / 100.0 * row["carb_100g"]
        f += g / 100.0 * row["fat_100g"]
        fib += g / 100.0 * (row.get("fiber_100g") or 0)
        items.append({"item": row["name_ru"], "grams": int(round(g))})
    return k, p, f, c, fib, unknown, items

out = []
skipped = 0
for r in recs:
    k, p, f, c, fib, unknown, items = macros(r)
    if len(items) < 2 or k < 80:        # битый рецепт (нераспознаны ингредиенты)
        skipped += 1
        continue
    slot = SLOT.get((r.get("meal_slot") or ["lunch"])[0], "lunch")
    out.append({
        "name": r.get("name_ru", "Блюдо"),
        "emoji": r.get("emoji", "🍽️"),
        "meal": slot,
        "kcal": int(round(k)),
        "protein": int(round(p)),
        "fat": int(round(f)),
        "carbs": int(round(c)),
        "fiber": int(round(fib)),
        "timeMin": int(r.get("prep_minutes", 15) or 15),
        "tags": r.get("diet_tags", []),
        "ingredients": items,
        "steps": r.get("steps_ru", []),
    })

# дедуп по имени
seen = set(); dedup = []
for r in out:
    if r["name"] in seen:
        continue
    seen.add(r["name"]); dedup.append(r)
out = dedup

with open(os.path.join(DST, "recipes.js"), "w", encoding="utf-8") as fp:
    fp.write("window.RECIPES = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n")
with open(os.path.join(DST, "ingredients.js"), "w", encoding="utf-8") as fp:
    fp.write("window.INGREDIENTS = " + json.dumps(ings, ensure_ascii=False, indent=1) + ";\n")

# отчёт
from collections import Counter
cnt = Counter(r["meal"] for r in out)
print("ingredients:", len(ings))
print("recipes in:", len(recs), "| valid out:", len(out), "| skipped:", skipped)
print("by slot:", dict(cnt))
print("sample:")
for r in out[:6]:
    print(" -", r["meal"], "|", r["name"], "|", r["kcal"], "ккал Б%d Ж%d У%d" % (r["protein"], r["fat"], r["carbs"]), "|", len(r["ingredients"]), "ингр", len(r["steps"]), "шагов")
# валидатор 4/4/9 (информативно)
bad = 0
for r in out:
    atw = 4*r["protein"] + 4*r["carbs"] + 9*r["fat"]
    if r["kcal"] and abs(atw - r["kcal"]) / r["kcal"] > 0.12:
        bad += 1
print("4/4/9 off>12%%: %d/%d" % (bad, len(out)))

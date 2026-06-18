# -*- coding: utf-8 -*-
"""
VITAFORGE Telegram bot (aiogram 3).
/start -> приветствие + кнопка "Открыть VITAFORGE" (Web App).
Задел под ИИ-тренера / генерацию блюд (см. handle_text).
Токен берётся из bot/.env (BOT_TOKEN) — в репозиторий НЕ коммитим.
"""
import os
import asyncio
import logging

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    Message, WebAppInfo,
    InlineKeyboardMarkup, InlineKeyboardButton,
    MenuButtonWebApp,
)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
except Exception:
    pass

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://vseaiteam01-cell.github.io/vitaforge/").strip()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
dp = Dispatcher()


def app_kb() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="💪 Открыть VITAFORGE", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])


@dp.message(CommandStart())
async def cmd_start(m: Message):
    name = m.from_user.first_name or "атлет"
    await m.answer(
        f"<b>VITAFORGE</b> 💪\n\n"
        f"Привет, {name}! Это твой трекер прокачки тела как игрового персонажа.\n\n"
        f"Жми кнопку — открывай приложение, веди тренировки, считай КБЖУ и эволюционируй аватара.",
        reply_markup=app_kb(),
    )


@dp.message(Command("help"))
async def cmd_help(m: Message):
    await m.answer(
        "Открой приложение кнопкой ниже или через меню слева внизу.\n\n"
        "Скоро прямо в чате: ИИ-тренер, генерация блюда под твои КБЖУ, напоминания.",
        reply_markup=app_kb(),
    )


@dp.message(F.text)
async def handle_text(m: Message):
    # TODO: сюда подключим ИИ (Claude API): рекомендации, генерация блюд, ответы по тренировкам.
    await m.answer(
        "Пока я открываю апп 🙂 ИИ-тренер на подходе.\nЖми кнопку:",
        reply_markup=app_kb(),
    )


async def main():
    if not BOT_TOKEN:
        raise SystemExit("BOT_TOKEN не задан. Заполни bot/.env (скопируй из .env.example).")
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    # продублируем кнопку-меню через API (идемпотентно)
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(text="Открыть VITAFORGE", web_app=WebAppInfo(url=WEBAPP_URL))
        )
        me = await bot.get_me()
        logging.info("Бот @%s запущен. WebApp: %s", me.username, WEBAPP_URL)
    except Exception as e:
        logging.warning("set_chat_menu_button/get_me: %s", e)
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())

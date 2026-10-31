import logging
import os
from collections import defaultdict

import httpx
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("donai")

TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
OFOX_API_KEY = os.environ["OFOX_API_KEY"]
OFOX_BASE_URL = os.getenv("OFOX_BASE_URL", "https://api.ofox.ai/v1").rstrip("/")
OFOX_MODEL = os.getenv("OFOX_MODEL", "openai/gpt-6.1-sol")
SYSTEM_PROMPT = os.getenv(
    "SYSTEM_PROMPT",
    "Ты DonAI — дружелюбный ИИ-помощник мессенджера Don. "
    "Отвечай по-русски, если пользователь не просит другой язык. "
    "Будь полезным, ясным и честным.",
)
MAX_HISTORY_MESSAGES = 16

# Conversation history is kept in memory for this first version.
# It resets when the worker restarts or redeploys.
history = defaultdict(list)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    history.pop(update.effective_user.id, None)
    await update.message.reply_text(
        "Привет! Я DonAI 🤖\n"
        "Напиши мне сообщение — отвечу через ИИ.\n\n"
        "/clear — очистить историю\n"
        "/model — показать активную модель\n"
        "/help — помощь"
    )


async def clear(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    history.pop(update.effective_user.id, None)
    await update.message.reply_text("История диалога очищена 🧹")


async def model(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(f"Сейчас используется модель: {OFOX_MODEL}")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Просто отправь текстовое сообщение, и я отвечу.\n"
        "/clear — начать новый диалог\n"
        "/model — активная модель"
    )


async def ask_ofox(user_id: int, prompt: str) -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history[user_id])
    messages.append({"role": "user", "content": prompt})

    timeout = httpx.Timeout(90.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            f"{OFOX_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {OFOX_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OFOX_MODEL,
                "messages": messages,
                "temperature": 0.7,
            },
        )

    if response.is_error:
        log.error("Ofox API returned HTTP %s: %s", response.status_code, response.text[:1000])
        if response.status_code == 401:
            return "Не удалось авторизоваться в Ofox. Проверь API-ключ в настройках Render."
        if response.status_code == 429:
            return "Слишком много запросов или закончился доступный лимит Ofox. Попробуй позже."
        return f"Сервис ИИ вернул ошибку (HTTP {response.status_code}). Попробуй ещё раз."

    data = response.json()
    answer = data.get("choices", [{}])[0].get("message", {}).get("content")
    if not isinstance(answer, str) or not answer.strip():
        log.error("Unexpected Ofox response: %s", str(data)[:1000])
        return "ИИ вернул пустой ответ. Попробуй ещё раз."

    history[user_id].extend([
        {"role": "user", "content": prompt},
        {"role": "assistant", "content": answer},
    ])
    history[user_id] = history[user_id][-MAX_HISTORY_MESSAGES:]
    return answer.strip()


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.message.text:
        return

    user_id = update.effective_user.id
    prompt = update.message.text.strip()
    if not prompt:
        return

    await update.message.chat.send_action(ChatAction.TYPING)
    try:
        answer = await ask_ofox(user_id, prompt)
    except httpx.TimeoutException:
        answer = "Ofox долго не отвечает. Попробуй отправить сообщение ещё раз."
    except httpx.HTTPError:
        log.exception("Network error while calling Ofox")
        answer = "Не удалось связаться с ИИ-сервисом. Попробуй позже."
    except Exception:
        log.exception("Unexpected error while handling a message")
        answer = "Произошла внутренняя ошибка. Попробуй позже."

    # Telegram messages are limited to 4096 characters.
    for offset in range(0, len(answer), 4000):
        await update.message.reply_text(answer[offset:offset + 4000])


def main() -> None:
    app = Application.builder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("clear", clear))
    app.add_handler(CommandHandler("model", model))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    log.info("Starting DonAI Telegram bot with model %s", OFOX_MODEL)
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()

# DonAI on Cloudflare Workers

Webhook-based Telegram bot. No long-running process is needed.

## Worker settings

Create a Worker from this directory and configure these variables/secrets:

- Secret `TELEGRAM_BOT_TOKEN`: token from @BotFather
- Secret `OFOX_API_KEY`: API key from Ofox (create a new key if an old one was exposed)
- Secret `WEBHOOK_SECRET`: random 32+ character string using only A-Z, a-z, 0-9, underscore or hyphen
- Secret `SETUP_SECRET`: another random one-time setup password
- Variable `OFOX_BASE_URL`: `https://api.ofox.ai/v1`
- Variable `OFOX_MODEL`: `openai/gpt-5.4-mini`
- Optional variable `SYSTEM_PROMPT`: assistant instructions

Check Ofox account pricing and limits before sending requests; do not assume API usage is free.

## Register Telegram webhook

After deploying, open this URL once in a browser, replacing the placeholders:

`https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/setup?key=YOUR_SETUP_SECRET`

A successful response contains `"ok":true`. Then delete the `SETUP_SECRET` secret from Worker settings and redeploy.

## Test

Open the Worker root URL. It should say `DonAI webhook is running.`. Then message the Telegram bot.

The first version does not persist conversation history. Telegram updates are validated using the webhook secret header.

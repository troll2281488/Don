# DonAI on Cloudflare Workers

Webhook-based Telegram bot. No long-running process is needed.

## Worker settings

Create a Worker from this directory and configure these variables/secrets:

- Secret `TELEGRAM_BOT_TOKEN`: token from @BotFather
- Secret `GROQ_API_KEY`: API key from Groq Console
- Secret `WEBHOOK_SECRET`: random 32+ character string using only A-Z, a-z, 0-9, underscore or hyphen
- Secret `SETUP_SECRET`: another random one-time setup password
- Variable `GROQ_BASE_URL`: `https://api.groq.com/openai/v1`
- Variable `GROQ_MODEL`: exact model ID available to your Groq account (for example, `openai/gpt-oss-20b`, if shown as available)
- Optional variable `SYSTEM_PROMPT`: assistant instructions

Use Groq's Free plan only. Do not add a payment method or upgrade to a paid plan. Free-plan model availability and rate limits can vary; requests may be rejected when limits are reached.

## Register Telegram webhook

After deploying, open this URL once in a browser, replacing the placeholders:

`https://YOUR-WORKER.YOUR-SUBDOMAIN.workers.dev/setup?key=YOUR_SETUP_SECRET`

A successful response contains `"ok":true`. Then delete the `SETUP_SECRET` secret from Worker settings and redeploy.

## Test

Open the Worker root URL. It should say `DonAI webhook is running.`. Then message the Telegram bot.

The first version does not persist conversation history. Telegram updates are validated using the webhook secret header.

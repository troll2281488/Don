const corsHeaders = { "content-type": "application/json; charset=utf-8" };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

async function telegram(env, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram API error: ${JSON.stringify(result).slice(0, 500)}`);
  return result;
}

async function sendText(env, chatId, text) {
  const chunks = text.match(/[\s\S]{1,4000}/g) || ["Пустой ответ от ИИ."];
  for (const chunk of chunks) {
    await telegram(env, "sendMessage", { chat_id: chatId, text: chunk });
  }
}

async function askGroq(env, prompt) {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not configured");
  if (!env.GROQ_MODEL) throw new Error("GROQ_MODEL is not configured");
  const base = (env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "authorization": `Bearer ${env.GROQ_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: env.SYSTEM_PROMPT || "Ты DonAI — дружелюбный ИИ-помощник. Отвечай по-русски, если пользователь не просит другой язык. Будь полезным и честным.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Groq API error", response.status, JSON.stringify(data).slice(0, 1000));
    if (response.status === 401) throw new Error("Groq rejected API key (401)");
    if (response.status === 429) throw new Error("Groq free-tier rate limit reached (429)");
    throw new Error(`Groq API error ${response.status}`);
  }
  const answer = data?.choices?.[0]?.message?.content;
  if (typeof answer !== "string" || !answer.trim()) throw new Error("Ofox returned an empty response");
  return answer.trim();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return new Response("DonAI webhook is running.", { status: 200 });
    }

    // One-time webhook setup. Remove SETUP_SECRET after successful setup.
    if (request.method === "GET" && url.pathname === "/setup") {
      if (!env.SETUP_SECRET || url.searchParams.get("key") !== env.SETUP_SECRET) {
        return new Response("Forbidden", { status: 403 });
      }
      if (!env.TELEGRAM_BOT_TOKEN || !env.WEBHOOK_SECRET) {
        return json({ ok: false, error: "Set TELEGRAM_BOT_TOKEN and WEBHOOK_SECRET first" }, 400);
      }
      const webhookUrl = new URL("/telegram", url.origin).toString();
      const result = await telegram(env, "setWebhook", {
        url: webhookUrl,
        secret_token: env.WEBHOOK_SECRET,
        allowed_updates: ["message"],
        drop_pending_updates: true,
      });
      return json({ ok: true, webhook: webhookUrl, telegram: result });
    }

    if (request.method !== "POST" || url.pathname !== "/telegram") {
      return new Response("Not found", { status: 404 });
    }

    if (!env.WEBHOOK_SECRET ||
        request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    const message = update?.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim();
    if (!chatId || !text) return json({ ok: true });

    try {
      if (text === "/start" || text.startsWith("/start@")) {
        await sendText(env, chatId,
          "Привет! Я DonAI 🤖\nНапиши сообщение — отвечу через ИИ.\n\n/clear — очистить контекст (в этой версии контекст не сохраняется)\n/help — помощь");
        return json({ ok: true });
      }
      if (text === "/clear" || text.startsWith("/clear@")) {
        await sendText(env, chatId, "Готово! Можем начать новый диалог 🧹");
        return json({ ok: true });
      }
      if (text === "/help" || text.startsWith("/help@")) {
        await sendText(env, chatId, "Просто отправь текстовое сообщение, и я отвечу через ИИ Groq.\n/help — помощь");
        return json({ ok: true });
      }

      await telegram(env, "sendChatAction", { chat_id: chatId, action: "typing" });
      const answer = await askGroq(env, text);
      await sendText(env, chatId, answer);
    } catch (error) {
      console.error("DonAI update failed:", error?.message || error);
      const messageText = String(error?.message || "");
      let userMessage = "Не удалось получить ответ от ИИ. Попробуй позже.";
      if (messageText.includes("401")) userMessage = "Groq не принял API-ключ. Проверь GROQ_API_KEY.";
      else if (messageText.includes("429")) userMessage = "Достигнут бесплатный лимит Groq. Попробуй позже.";
      else if (messageText.includes("GROQ_MODEL")) userMessage = "Не задана модель Groq. Добавь GROQ_MODEL в настройках Worker.";
      await sendText(env, chatId, userMessage).catch((sendError) => console.error("Telegram send failed:", sendError));
    }
    return json({ ok: true });
  },
};

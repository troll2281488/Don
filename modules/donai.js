/* DonAI API adapter.
   Configure a trusted server endpoint before use. Never put provider API keys here. */
(function (global) {
  "use strict";

  var endpoint = "";

  function configure(url) {
    var parsed;
    try { parsed = new URL(String(url || ""), global.location.href); }
    catch (_) { throw new Error("Некорректный адрес сервера DonAI."); }
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
      throw new Error("Для DonAI требуется защищённое HTTPS-соединение.");
    }
    endpoint = parsed.href.replace(/\/$/, "");
  }

  async function send(messages, options) {
    if (!endpoint) throw new Error("Сервер DonAI ещё не подключён.");
    if (!Array.isArray(messages)) throw new Error("Сообщения переданы в неверном формате.");
    var response = await fetch(endpoint + "/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({ messages: messages, options: options || {} })
    });
    if (!response.ok) throw new Error("Сервер DonAI вернул ошибку (" + response.status + ").");
    return response.json();
  }

  global.DonAIClient = { configure: configure, send: send };
})(window);

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = "https://troll2281488.github.io";
    const cors = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    const json = (body, status = 200) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
    });
    if (origin && origin !== allowedOrigin) return json({ error: "Origin not allowed" }, 403);
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: Boolean(env.POLLINATIONS_API_KEY), provider: "Pollinations" });
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const allowed = new Set([
      "/v1/chat/completions",
      "/v1/images/generations",
      "/v1/audio/speech",
      "/v1/audio/transcriptions"
    ]);
    if (!allowed.has(url.pathname)) return json({ error: "Endpoint not allowed" }, 404);
    if (!env.POLLINATIONS_API_KEY) return json({ error: "Worker secret POLLINATIONS_API_KEY is missing" }, 503);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "Too many requests. Try again in a minute." }, 429);
    }
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 20 * 1024 * 1024) return json({ error: "Request body exceeds 20 MB" }, 413);
    const headers = new Headers();
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("Authorization", "Bearer " + env.POLLINATIONS_API_KEY);
    headers.set("Accept", request.headers.get("Accept") || "*/*");
    try {
      const upstream = await fetch("https://gen.pollinations.ai" + url.pathname + url.search, {
        method: "POST", headers, body: request.body, redirect: "manual"
      });
      const responseHeaders = new Headers(upstream.headers);
      for (const [key, value] of Object.entries(cors)) responseHeaders.set(key, value);
      responseHeaders.set("Cache-Control", "no-store");
      responseHeaders.delete("content-encoding");
      responseHeaders.delete("content-length");
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch (error) {
      return json({ error: "Upstream request failed: " + String(error.message || error) }, 502);
    }
  }
};

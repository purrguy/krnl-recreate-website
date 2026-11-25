// /hot-scripts/raw
//   no params          -> JSON list (q, page, max)
//   ?id=<slug>         -> plain-text Luau source
// Everything is proxied through our origin so the client never talks to the
// upstream directly, and cached at the edge.

const UP_SEARCH = "https://scriptblox.com/api/script/search";
const UP_RAW = "https://scriptblox.com/raw/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KRNL/1.0";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

function json(data, maxAge) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAge}`,
      ...CORS,
    },
  });
}

function clean(s, n = 200) {
  return typeof s === "string" ? s.slice(0, n) : "";
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    if (!/^[A-Za-z0-9._!%\-]+$/.test(id)) return new Response("bad id", { status: 400 });

    const cache = caches.default;
    const key = new Request(url.toString(), request);
    const hit = await cache.match(key);
    if (hit) return hit;

    let up;
    try {
      up = await fetch(UP_RAW + encodeURIComponent(id), {
        headers: { "user-agent": UA, referer: "https://scriptblox.com/" },
      });
    } catch {
      return new Response("upstream unreachable", { status: 502, headers: CORS });
    }
    if (!up.ok) return new Response("upstream " + up.status, { status: 502, headers: CORS });

    const res = new Response(await up.text(), {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300",
        ...CORS,
      },
    });
    await cache.put(key, res.clone());
    return res;
  }

  const q = clean(url.searchParams.get("q") || "universal", 64);
  const page = Math.max(1, Math.min(50, parseInt(url.searchParams.get("page") || "1", 10) || 1));
  const max = Math.max(1, Math.min(24, parseInt(url.searchParams.get("max") || "12", 10) || 12));

  const cache = caches.default;
  const key = new Request(url.toString(), request);
  const hit = await cache.match(key);
  if (hit) return hit;

  let up;
  try {
    up = await fetch(`${UP_SEARCH}?q=${encodeURIComponent(q)}&page=${page}&max=${max}`, {
      headers: { "user-agent": UA, referer: "https://scriptblox.com/" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "upstream unreachable" }), {
      status: 502,
      headers: { "content-type": "application/json", ...CORS },
    });
  }
  if (!up.ok) return new Response(JSON.stringify({ error: "upstream " + up.status }), {
    status: 502,
    headers: { "content-type": "application/json", ...CORS },
  });

  const j = await up.json().catch(() => null);
  const scripts = (j?.result?.scripts || []).map((s) => ({
    id: s.slug,
    title: clean(s.title, 160),
    game: clean(s.game?.name, 80),
    gameId: s.game?.gameId || null,
    verified: !!s.verified,
    keyless: !!s.keyless,
    patched: !!s.isPatched,
    views: s.views || 0,
    executes: s.executes || 0,
    likes: s.likeCount || 0,
    updated: s.lastUpdate || s.lastBump || s.createdAt || null,
    thumb: s.image ? "https://scriptblox.com" + s.image : null,
    source: s.slug
      ? `loadstring(game:HttpGet("https://krnl.purrguy.me/hot-scripts/raw?id=${encodeURIComponent(s.slug)}"))()`
      : "",
  }));

  const res = json({
    query: q,
    page,
    totalPages: j?.result?.totalPages ?? 0,
    scripts,
  }, 60);

  await cache.put(key, res.clone());
  return res;
}

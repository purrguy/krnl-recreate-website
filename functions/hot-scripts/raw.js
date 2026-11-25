// /hot-scripts/raw
//   ?src=sb|rs|all &q=...&page=N&max=N   -> JSON list
//   ?src=sb|rs &id=<id>                  -> plain-text Luau source
//
// ScriptBlox and Rscripts are proxied through our origin and cached at the
// edge, so the client never talks to either upstream directly.

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) KRNL/1.0";
const SB_SEARCH = "https://scriptblox.com/api/script/search";
const SB_RAW = "https://scriptblox.com/raw/";
const RS_LIST = "https://rscripts.net/api/v2/scripts";
const RS_DETAIL = "https://rscripts.net/api/v2/script";
const RS_TRENDING = "https://rscripts.net/api/v2/trending";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

const clean = (s, n = 200) => (typeof s === "string" ? s.slice(0, n) : "");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function json(data, maxAge) {
  return new Response(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAge}`,
      ...CORS,
    },
  });
}

async function upstream(url) {
  return fetch(url, { headers: { "user-agent": UA, referer: new URL(url).origin + "/" } });
}

// --- ScriptBlox ------------------------------------------------------------

async function sbList(q, page, max) {
  const res = await upstream(`${SB_SEARCH}?q=${encodeURIComponent(q)}&page=${page}&max=${max}`);
  if (!res.ok) throw new Error("scriptblox " + res.status);
  const j = await res.json();
  const scripts = (j?.result?.scripts || []).map((s) => ({
    id: s.slug,
    origin: "scriptblox",
    title: clean(s.title, 160),
    game: clean(s.game?.name, 80),
    verified: !!s.verified,
    keyless: !!s.keyless,
    patched: !!s.isPatched,
    views: s.views || 0,
    runs: s.executes || 0,
    likes: s.likeCount || 0,
    updated: s.lastUpdate || s.lastBump || s.createdAt || null,
    thumb: s.image ? "https://scriptblox.com" + s.image : null,
    source: `loadstring(game:HttpGet("https://krnl.purrguy.me/hot-scripts/raw?src=sb&id=${encodeURIComponent(s.slug)}"))()`,
  }));
  return { totalPages: j?.result?.totalPages || 0, scripts };
}

async function sbSource(id) {
  const res = await upstream(SB_RAW + encodeURIComponent(id));
  if (!res.ok) throw new Error("scriptblox " + res.status);
  return res.text();
}

// --- Rscripts --------------------------------------------------------------

function rsNormalize(s) {
  const raw = s.rawScript || "";
  return {
    id: s._id || s.slug,
    origin: "rscripts",
    title: clean(s.title, 160),
    game: clean(s.game?.title, 80),
    verified: !!s.user?.verified,
    keyless: !s.keySystem,
    patched: false,
    views: s.views || 0,
    runs: 0,
    likes: s.likes || 0,
    updated: s.lastUpdated || s.createdAt || null,
    thumb: s.image || s.game?.imgurl || null,
    source: `loadstring(game:HttpGet("https://krnl.purrguy.me/hot-scripts/raw?src=rs&id=${encodeURIComponent(s._id || s.slug)}"))()`,
    _raw: raw,
  };
}

async function rsList(q, page, max) {
  const url = q && q !== "universal"
    ? `${RS_LIST}?page=${page}&q=${encodeURIComponent(q)}&orderBy=date&sort=desc`
    : `${RS_LIST}?page=${page}&orderBy=date&sort=desc`;
  const res = await upstream(url);
  if (!res.ok) throw new Error("rscripts " + res.status);
  const j = await res.json();
  let scripts = (j?.scripts || []).map(rsNormalize).map(({ _raw, ...rest }) => rest);
  if (scripts.length > max) scripts = scripts.slice(0, max);
  const totalPages = j?.info?.maxPages || 0;
  return { totalPages, scripts };
}

async function rsSource(id) {
  const res = await upstream(`${RS_DETAIL}?id=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("rscripts " + res.status);
  const j = await res.json();
  const payload = j?.script ?? j?.success ?? j?.data;
  const s = Array.isArray(payload) ? payload[0] : payload;
  if (!s) throw new Error("rscripts: script not found");
  let raw = s.rawScript || "";
  if (raw.startsWith("rscripts.net/")) raw = "https://" + raw;
  if (raw) {
    const r2 = await upstream(raw);
    if (r2.ok) return r2.text();
  }
  if (typeof s.script === "string" && s.script.length > 0) return s.script;
  throw new Error("rscripts: no source");
}

// --- routing ---------------------------------------------------------------

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const src = (url.searchParams.get("src") || "sb").toLowerCase();
  const id = url.searchParams.get("id");

  const cache = caches.default;
  const key = new Request(url.toString(), request);
  const hit = await cache.match(key);
  if (hit) return hit;

  if (id) {
    if (!/^[A-Za-z0-9._%!\-]+$/.test(id)) return new Response("bad id", { status: 400, headers: CORS });
    try {
      const text = src === "rs" ? await rsSource(id) : await sbSource(id);
      const res = new Response(text, {
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300", ...CORS },
      });
      await cache.put(key, res.clone());
      return res;
    } catch (e) {
      return new Response(String(e.message || e), { status: 502, headers: CORS });
    }
  }

  const q = clean(url.searchParams.get("q") || "universal", 64);
  const page = clamp(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1, 50);
  const max = clamp(parseInt(url.searchParams.get("max") || "12", 10) || 12, 1, 24);

  try {
    let totalPages = 0;
    let scripts = [];

    if (src === "rs") {
      ({ totalPages, scripts } = await rsList(q, page, max));
    } else if (src === "all") {
      const half = Math.max(3, Math.floor(max / 2));
      const [a, b] = await Promise.allSettled([sbList(q, page, half), rsList(q, page, half)]);
      if (a.status === "fulfilled") { scripts.push(...a.value.scripts); totalPages = Math.max(totalPages, a.value.totalPages); }
      if (b.status === "fulfilled") { scripts.push(...b.value.scripts); totalPages = Math.max(totalPages, b.value.totalPages); }
    } else {
      ({ totalPages, scripts } = await sbList(q, page, max));
    }

    const res = json({ query: q, src, page, totalPages, scripts }, 60);
    await cache.put(key, res.clone());
    return res;
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e), scripts: [] }), {
      status: 502,
      headers: { "content-type": "application/json", ...CORS },
    });
  }
}

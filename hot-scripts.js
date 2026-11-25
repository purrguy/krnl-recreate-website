const $ = (id) => document.getElementById(id);
const grid = $("grid");
const hint = $("hint");
const more = $("more");

let query = "universal";
let page = 1;
let loading = false;
let source = "all";

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function stat(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "k";
  return String(n || 0);
}

function card(s) {
  const c = el("article", "card");

  const head = el("div", "card-head");
  if (s.thumb) {
    const img = el("img", "thumb");
    img.src = s.thumb;
    img.loading = "lazy";
    img.alt = "";
    head.appendChild(img);
  }
  const titleBox = el("div");
  titleBox.appendChild(el("h3", null, s.title));
  const meta = el("div", "card-meta");
  if (s.origin === "rscripts") meta.appendChild(el("span", "tag src-rs", "RScripts"));
  else if (s.origin === "scriptblox") meta.appendChild(el("span", "tag src-sb", "ScriptBlox"));
  meta.appendChild(el("span", null, s.game || "Universal"));
  if (s.verified) meta.appendChild(el("span", "tag", "verified"));
  if (s.keyless) meta.appendChild(el("span", "tag", "keyless"));
  if (s.patched) meta.appendChild(el("span", "tag bad", "patched"));
  titleBox.appendChild(meta);
  head.appendChild(titleBox);
  c.appendChild(head);

  const stats = el("div", "card-stats");
  stats.appendChild(el("span", null, stat(s.views) + " views"));
  stats.appendChild(el("span", null, stat(s.runs) + " runs"));
  stats.appendChild(el("span", null, stat(s.likes) + " likes"));
  c.appendChild(stats);

  const actions = el("div", "card-actions");

  const copy = el("button", "btn small", "Copy");
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(s.source);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    } catch {
      copy.textContent = "Copy failed";
      setTimeout(() => (copy.textContent = "Copy"), 1200);
    }
  });
  actions.appendChild(copy);

  const src = el("a", "btn small", "Source");
  src.href = `/hot-scripts/raw?src=${s.origin === "rscripts" ? "rs" : "sb"}&id=${encodeURIComponent(s.id)}`;
  src.target = "_blank";
  src.rel = "noopener";
  actions.appendChild(src);

  c.appendChild(actions);
  return c;
}

async function load(reset) {
  if (loading) return;
  loading = true;
  if (reset) {
    page = 1;
    grid.replaceChildren();
    hint.textContent = "Loading…";
  }

  try {
    const r = await fetch(`/hot-scripts/raw?src=${source}&q=${encodeURIComponent(query)}&page=${page}&max=12`);
    const j = await r.json();
    const list = j.scripts || [];

    if (reset && list.length === 0) {
      hint.textContent = "Nothing found.";
    } else {
      hint.textContent = `${j.totalPages || 0} pages for “${j.query || query}”`;
      for (const s of list) grid.appendChild(card(s));
    }

    more.hidden = !j.totalPages || page >= j.totalPages;
  } catch {
    hint.textContent = "Could not load scripts. Try again.";
  } finally {
    loading = false;
  }
}

$("search").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("q").value.trim();
  query = v || "universal";
  load(true);
});

more.addEventListener("click", () => {
  page += 1;
  load(false);
});

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    source = tab.dataset.src;
    for (const t of document.querySelectorAll(".tab")) t.classList.toggle("on", t === tab);
    load(true);
  });
}

$("year").textContent = new Date().getFullYear();
load(true);


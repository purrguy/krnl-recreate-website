const $ = (id) => document.getElementById(id);

function size(n) {
  if (!n) return "—";
  const mb = n / 1048576;
  return (mb >= 1 ? mb.toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
}

async function load() {
  let m;
  try {
    const r = await fetch("/api/latest.json", { cache: "no-store" });
    if (!r.ok) return;
    m = await r.json();
  } catch { return; }

  const label = $("dl-label"), ver = $("dl-ver");
  if (m.version) {
    if (ver) ver.textContent = "v" + m.version;
    if (label) label.textContent = m.channel === "stable" ? "Download" : "Download dev build";
  }
  for (const id of ["dl", "dl2"]) if ($(id) && m.url) $(id).href = m.url;

  if ($("status") && m.status) $("status").textContent = m.status;
  if ($("size")) $("size").textContent = size(m.size);

  if ($("sha") && m.sha256) {
    const short = m.sha256.slice(0, 16) + "…";
    $("sha").textContent = "sha256 " + short;
    $("sha").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(m.sha256);
        $("sha").textContent = "copied";
        setTimeout(() => ($("sha").textContent = "sha256 " + short), 1200);
      } catch {}
    });
  }

  if (Array.isArray(m.notes) && m.notes.length && $("notes"))
    $("notes").innerHTML = m.notes.map((n) => `<li>${n}</li>`).join("");
}

load();
$("year").textContent = new Date().getFullYear();

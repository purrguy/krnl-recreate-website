const B85 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~";
const DEFAULT_KEY = "krnl.v1.7f3a9c2e5b8d4a16";

const $ = (id) => document.getElementById(id);
const te = new TextEncoder();

function b85(data) {
  let out = "";
  for (let i = 0; i < data.length; i += 4) {
    const chunk = [data[i] || 0, data[i + 1] || 0, data[i + 2] || 0, data[i + 3] || 0];
    let n = ((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0;
    let s = "";
    for (let k = 0; k < 5; k++) {
      s = B85[n % 85] + s;
      n = Math.floor(n / 85);
    }
    out += s;
  }
  return out;
}

function be32(n) {
  return new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
}

function concat(...arrs) {
  const len = arrs.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(len);
  let at = 0;
  for (const a of arrs) {
    out.set(a, at);
    at += a.length;
  }
  return out;
}

function xorKey(data, keyBytes) {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] ^ keyBytes[i % keyBytes.length];
  return out;
}

async function hmacKey(raw) {
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function hmac(key, data) {
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

// Turn plain string literals into decimal escapes so the source no longer
// reads as text. Comments and long brackets are left alone.
function scramble(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === "-" && src[i + 1] === "-") {
      const long = src[i + 2] === "[";
      let j = i + 2;
      if (long) {
        while (j < src.length - 1 && !(src[j] === "]" && src[j + 1] === "]")) j++;
        j += 2;
      } else {
        while (j < src.length && src[j] !== "\n") j++;
      }
      out += src.slice(i, j);
      i = j;
      continue;
    }

    if (c === "[" && src[i + 1] === "[") {
      let j = i + 2;
      while (j < src.length - 1 && !(src[j] === "]" && src[j + 1] === "]")) j++;
      j += 2;
      out += src.slice(i, j);
      i = j;
      continue;
    }

    if (c === '"' || c === "'") {
      const q = c;
      let j = i + 1;
      let body = "";
      let ok = true;
      while (j < src.length) {
        const ch = src[j];
        if (ch === "\\") { ok = false; break; }
        if (ch === q) break;
        if (ch === "\n") { ok = false; break; }
        body += ch;
        j++;
      }
      if (ok && src[j] === q) {
        let enc = '"';
        for (const ch of body) enc += "\\" + ch.charCodeAt(0);
        enc += '"';
        out += enc;
        i = j + 1;
        continue;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    out += c;
    i++;
  }
  return out;
}

async function encrypt(source, doScramble) {
  const text = doScramble ? scramble(source) : source;
  const data = te.encode(text);

  const key = crypto.getRandomValues(new Uint8Array(64));
  const nonce = crypto.getRandomValues(new Uint8Array(16));

  const enc = await hmacKey(key.slice(0, 32));
  const mac = await hmacKey(key.slice(32, 64));

  const blocks = Math.ceil(data.length / 32) || 1;
  const ks = new Uint8Array(blocks * 32);
  for (let i = 0; i < blocks; i++) {
    ks.set(await hmac(enc, concat(nonce, be32(i))), i * 32);
  }

  const ct = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) ct[i] = data[i] ^ ks[i];

  const tag = (await hmac(mac, concat(nonce, ct))).slice(0, 16);
  const obf = xorKey(key, te.encode(DEFAULT_KEY));

  const blob = concat(
    new Uint8Array([3]), nonce, tag, be32(data.length),
    new Uint8Array([obf.length]), obf, ct
  );

  return "KRNL3:" + b85(blob);
}

async function run() {
  const src = $("src").value;
  if (!src) return;

  $("go").disabled = true;
  $("stats").textContent = "Working...";

  try {
    const doScramble = $("scramble").checked;
    const payload = await encrypt(src, doScramble);
    $("out").value = `krnl.SECURE_RUN("${payload}")`;
    $("copy").disabled = false;
    $("stats").textContent = `${src.length} bytes -> ${payload.length} chars`;
  } catch (e) {
    $("stats").textContent = "Failed: " + e.message;
  } finally {
    $("go").disabled = false;
  }
}

$("go").addEventListener("click", run);
$("copy").addEventListener("click", async () => {
  await navigator.clipboard.writeText($("out").value);
  $("copy").textContent = "Copied";
  setTimeout(() => ($("copy").textContent = "Copy"), 1200);
});

$("year").textContent = new Date().getFullYear();

// Pages Function: GET /api/latest.json
// Single source of truth for the download button and the in-app updater.
// Replace the values below when a build ships; keep sha256 in sync with the file.

const MANIFEST = {
  version: "0.1.0",
  channel: "dev",
  status: "development",
  url: "/download/krnl-0.1.0.zip",
  sha256: "0000000000000000000000000000000000000000000000000000000000000000",
  size: 0,
  updated: "2026-11-24T00:00:00Z",
  sUNC: null,
  UNC: null,
  notes: [
    "Initial development build. Studio path validated end to end.",
    "Client support in progress.",
  ],
};

export function onRequestGet() {
  return new Response(JSON.stringify(MANIFEST, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

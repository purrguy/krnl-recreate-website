# krnl.purrguy.me — deploy

## What this is

Static site + one Pages Function (`/api/latest.json`). No build step, no framework.

```
site/
  index.html
  download/index.html
  styles.css
  app.js
  assets/logo.svg
  _headers
  _redirects
  functions/api/latest.json.js
```

## Deploy

```
cd site
npx wrangler pages project create krnl --production-branch main
npx wrangler pages deploy . --project-name krnl
```

Then point the subdomain at it:

- Dashboard → Workers & Pages → `krnl` → Custom domains → add `krnl.purrguy.me`
- or DNS: `CNAME krnl → krnl.pages.dev`, proxied.

`purrguy.me` is already on Cloudflare, so the certificate is automatic.

## Shipping a build

1. Drop the archive in `site/download/` (name it with the version, e.g. `krnl-0.1.0.zip`).
2. Update `functions/api/latest.json.js`: `version`, `url`, `sha256`, `size`, `updated`, `notes`.
3. `npx wrangler pages deploy . --project-name krnl`

The site and the updater both read that one JSON.

## Where files live

**v1 (now):** the Pages project. Limit is 25 MiB per file / 20,000 files — enough for the loader and payload. Free, CDN-cached, no egress bill.

**v2:** Cloudflare R2 + a Worker. R2 is not enabled on this account yet; enable it in the dashboard (it asks for a billing method even on the free tier). Then:

```
npx wrangler r2 bucket create krnl-downloads
```

Bind the bucket to a Worker on `dl.krnl.purrguy.me`, stream with `Range` support, and change `url` in the manifest. Same origin from the client's point of view.

Why not GitHub Releases: DMCA/abuse reports against executor binaries are routine there; Pages/R2 buckets are yours and can be swapped without losing the repo.

## Abuse surface

- `noindex` on the download page; no sitemap entry for `/download/`.
- Distribution stays in Discord; the site is a landing page plus manifest.
- Keep filenames hashed/versioned so crawlers can't enumerate builds.
- Nothing here guarantees Cloudflare won't act on a report; keep a second bucket/provider ready.

## Placeholders to replace

- `_redirects`: `https://discord.gg/krnl` → your real invite.
- `functions/api/latest.json.js`: `sha256` and `size` are zero placeholders.
- `site/download/`: add the real archive.

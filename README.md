# krnl-recreate-website

Static site for `krnl.purrguy.me`, deployed on Cloudflare Pages.

```
index.html                 landing
download/index.html        download page
styles.css                 monochrome theme
app.js                     reads /api/latest.json
functions/api/latest.json.js   build manifest (version, url, sha256, size)
_headers, _redirects       Pages config
assets/krnl.png            logo
DEPLOY.md                  hosting + release notes
```

## Deploy

```
npx wrangler pages deploy . --project-name krnl
```

Custom domain `krnl.purrguy.me` is attached to the Pages project.

## Shipping a build

1. Upload the archive to the file host (work.ink), copy the public link.
2. Put the version, link, size and SHA-256 into `functions/api/latest.json.js`.
3. Deploy.

The site and any updater read the same manifest.

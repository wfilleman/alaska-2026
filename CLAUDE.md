# CLAUDE.md — Alaska 2026 PWA maintainer notes

Working notes for AI agents (and future me) maintaining the Filleman family
Alaska 2026 trip PWA. Read this before changing the app, the build, or the deploy.

## What this is

A password-protected, offline-first PWA slideshow (day-by-day itinerary, route
maps, reminders, emergency card) for the **June 4–18, 2026** Alaska cruise +
Denali land tour. 11 people across 3 bookings. Hosted on GitHub Pages (public
repo `wfilleman/alaska-2026`) and AES-encrypted with staticrypt, so the public
repo only ever exposes ciphertext.

## Three locations (all required)

| Location | Role |
|---|---|
| `~/Library/Mobile Documents/com~apple~CloudDocs/Alaska 2026/` | **Source of truth.** Edit `alaska-2026-svg-fallback.html` here. Also holds `maps/*.mp4`, `emergency-card.pdf`, and the generated `alaska-2026.html`. Not a git repo (iCloud-synced). |
| `~/Documents/alaska-remotion-maps/` | Remotion project for the route-map videos + `scripts/inline-build.ts`, which inlines assets and base64-embeds the PDF into `alaska-2026.html`. |
| `~/Documents/alaska-2026-deploy/` | This repo — the **public** GitHub Pages git repo. `deploy.sh`, `sw.js`, `manifest.json`. |

## Build + deploy

```bash
# 1. Build (inlines assets, embeds the PDF, copies maps into the iCloud folder):
cd ~/Documents/alaska-remotion-maps && ./node_modules/.bin/tsx scripts/inline-build.ts

# 2. Encrypt + inject PWA meta + bump SW cache + commit + push:
cd ~/Documents/alaska-2026-deploy && STATICRYPT_PASSWORD='…' ./deploy.sh "commit message"
```

- Edit the app in **`alaska-2026-svg-fallback.html`** — never the built
  `alaska-2026.html`, which is generated and overwritten.
- `deploy.sh` stamps the in-app version = `git rev-list --count HEAD` + 1, so
  each deploy increments the `Vnn` shown on the title slide.
- Live URL: <https://wfilleman.github.io/alaska-2026/>

## Secrets — keep them out of the public repo

- The staticrypt passphrase lives **only** in the `STATICRYPT_PASSWORD` env var.
  Never write it into a file or commit it.
- `emergency-card.pdf` (phone numbers, booking codes) is **base64-embedded
  inside the encrypted HTML** by `inline-build.ts` — it is NOT served as a
  public file. Don't re-add it to `sw.js` `STATIC_ASSETS` or to `deploy.sh`.
- `scripts/make_card.py` (the PDF generator, contains plaintext PII) is
  **gitignored** in this repo. Keep it that way so `deploy.sh`'s `git add -A`
  never publishes it.

## iOS standalone PWA gotchas (learned the hard way)

### 1. Status-bar style controls touch alignment — `black-translucent` breaks taps

With `apple-mobile-web-app-status-bar-style: black-translucent`, the web view
runs full-bleed *under* the status bar. On iPhone (standalone, cold launch) this
desyncs the **touch hit-test layer** from the **render layer** by the status-bar
height: taps land ~one status-bar-height too high. Symptom we hit — tapping the
lower title-slide button ("Check for Update") triggered the button above it
("Emergency Card PDF").

- This is **not** a layout/CSS bug. The paint looked perfect. Driving height
  from a JS `--app-height` var, forcing reflows, and tweaking
  `env(safe-area-inset-*)` did **not** move the touch layer.
- **Fix (v30):** `apple-mobile-web-app-status-bar-style: default` — this insets
  the web view *below* the status bar, so touch and paint share an origin and
  the offset disappears. Set `theme-color` to the paper background (`#f5efe2`)
  so the now-opaque status bar blends in.
- The status-bar meta must be changed in **`deploy.sh`** (the gate-page
  injection — that's the head iOS actually reads at launch) AND in the source
  HTML head for consistency.

### 2. The home-screen icon bakes install-time metas — delete & re-add to apply

iOS captures `apple-mobile-web-app-status-bar-style`, `-capable`, `-title`, and
the icon **at the moment the user taps "Add to Home Screen."** Changing them
server-side does **not** update an already-installed icon, and a force-kill /
relaunch won't pick them up. After any change to the PWA chrome, the user must:
delete the home-screen icon → reopen the URL in Safari (with internet) → Share →
Add to Home Screen again.

### 3. `--app-height` + reflow (kept, but wasn't the actual fix)

`#deck` height is driven by a JS `--app-height` (= `window.innerHeight`) var,
with a reflow on `load` / `pageshow` / `resize` / `orientationchange`, instead
of `inset: 0` / `100vh`. Good hygiene against the `100vh`/`dvh` discrepancy, but
it did not fix the touch offset above — the status-bar style was the real lever.
Kept because it doesn't hurt.

## Other implementation notes

- Buttons use **event delegation** keyed on `data-action` attributes — iOS
  WKWebView can leave ghost-duplicate nodes during slide re-renders, so
  per-element listeners are unreliable.
- The emergency-card download builds a **`blob:` URL** (iOS blocks top-level
  `data:` navigation).
- Service-worker strategy: HTML + MP4 maps = **network-first** (fresh when
  online, cached copy when offline on the plane/cruise); other static assets =
  **cache-first**. `deploy.sh` bumps the SW cache id every deploy so clients
  pick up new content.

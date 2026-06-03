# Alaska 2026 — Filleman Family Voyage

A password-protected, offline-capable PWA slideshow for our 2026 Alaska cruise + Denali land tour.

## What's here

| File | Purpose |
|---|---|
| `index.html` | The slideshow, AES-encrypted via [staticrypt](https://github.com/robinmoisson/staticrypt). Password gate + ~5 MB of encrypted content + decryption JS. |
| `sw.js` | Service worker that caches the encrypted page for offline use. |
| `manifest.json` | PWA manifest so "Add to Home Screen" creates a real app icon. |
| `icon.png` | 512×512 app icon, cropped from the Inside Passage map. |
| `robots.txt` | Disallow all crawlers. |

## For the family

1. Open the URL in **Safari** (on iPhone/iPad).
2. Enter the passphrase you were texted. Tick **Remember me**.
3. Tap **Share → Add to Home Screen**. The icon will install.
4. Open the icon any time — even on a plane or at sea — to flip through the trip.

**Troubleshooting**

- If the icon ever stops working, open the URL in Safari again (with internet) to refresh the cache.
- If taps feel **misaligned** after an update (a button does the wrong thing), **delete the home-screen icon and re-add it** (Safari → Share → Add to Home Screen). iOS bakes some app settings — including the status-bar style — into the icon at install time, so a fresh install is required to pick up changes. A force-kill/relaunch is not enough.

## What the encryption protects

- Anyone who finds the URL without the password sees only an encrypted blob.
- Search engines and link previewers see nothing meaningful.
- The crypto is real (AES-256-GCM via WebCrypto, PBKDF2 key derivation).

## What it doesn't protect against

- Anyone you share the password with has the same access you do.
- If the password leaks, the data leaks (until re-encrypted with a new password).

## Updating

Re-build the slideshow:
```
cd ~/Documents/alaska-remotion-maps
npm run render && npx tsx scripts/inline-build.ts && npx tsx scripts/write-pwa-files.ts
```

Then re-encrypt and redeploy. See `~/Documents/alaska-2026-deploy/` for the deploy workspace.

## Maintainer / agent notes

See [`CLAUDE.md`](CLAUDE.md) for the full build → deploy pipeline, where secrets
live, and hard-won iOS standalone-PWA gotchas (notably: the status-bar style
controls touch-target alignment — `black-translucent` desyncs taps; use
`default`).

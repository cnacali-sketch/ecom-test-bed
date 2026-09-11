# Photo uploader — phone → PC → media library

Shoot products on a phone, upload from the phone, let the PC do the conversion,
land finished WebP in the Savvy In Teal media library.

## Run it

In PowerShell, from this folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

It finds Python, installs Pillow (and optional HEIC support) if missing, asks
for the admin email and password once, then prints two URLs:

```
  Open this on your phone (same Wi-Fi):
      http://192.168.x.x:8765
  On this PC:
      http://localhost:8765
```

Anyone on the same Wi-Fi who opens that URL can upload. Ctrl+C to stop.

### If the phone cannot open that URL

Almost always the Windows firewall. Windows offers to allow Python only on
*Private* networks, but most Wi-Fi is classified **Public** — check with
`Get-NetConnectionProfile` — so that prompt does not help, and the phone's
connection is dropped before Python ever sees it.

Run this once in an **admin** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Savvy In Teal photo uploader (LAN only)" `
  -Direction Inbound -Protocol TCP -LocalPort 8765 `
  -Action Allow -Profile Any -RemoteAddress LocalSubnet
```

`LocalSubnet` keeps it to the network the PC is currently on and follows the PC
between networks, so switching Wi-Fi does not break it. Remove it with
`Remove-NetFirewallRule -DisplayName "Savvy In Teal photo uploader (LAN only)"`.

If the page still will not load, the router is isolating clients from each
other (often called AP isolation or client isolation) — that is a router
setting, not a PC one.

### If sign-in fails with a certificate error

Antivirus HTTPS scanning (Avast, AVG, Kaspersky, ESET, Bitdefender) re-signs
every certificate with a root it installs locally. Those roots leave
`basicConstraints` non-critical, which OpenSSL 3.x rejects and Windows accepts —
so Python cannot reach the API while every browser on the same PC can:

```
CERTIFICATE_VERIFY_FAILED: Basic Constraints of CA cert not marked critical
```

`start.ps1` installs `truststore` for this, which makes Python verify through
Windows instead. Still fully verified, just not by OpenSSL's own parser. Turning
off the antivirus's "web shield" works too.

To skip the credential prompt (e.g. for a shortcut):

```powershell
$env:SAVVY_ADMIN_EMAIL = "you@example.com"
$env:SAVVY_ADMIN_PASSWORD = "..."
powershell -ExecutionPolicy Bypass -File .\start.ps1
```

Other options: `--port 9000`, `--api http://localhost:8000`.

## What it does to each photo

1. Applies EXIF orientation — without this every portrait phone photo lands
   rotated 90°.
2. Centre-crops to the chosen slot's aspect ratio, and reports how much was
   trimmed rather than doing it silently.
3. Downscales with Lanczos to the slot's 2x render size. Never upscales.
4. Encodes WebP at quality 82, `method=6`, stepping quality down only if the
   slot's byte budget demands it.

| Slot | Output | Budget | Typical result |
|---|---|---|---|
| Product photo | 1000×1250 | 250 KB | ~47 KB |
| Homepage hero | 1400×1750 | 400 KB | ~74 KB |
| Campaign band | 1000×1250 | 250 KB | ~47 KB |
| Editorial tile | 900×1125 | 200 KB | ~40 KB |
| Hero inset | 640×480 | 100 KB | ~17 KB |
| Category tile | 640×640 | 120 KB | ~22 KB |

## Why the PC and not the phone browser

- Pillow's WebP encoder at `method=6` searches harder than a browser's
  `canvas.toBlob()`, which is fixed at the browser's default effort.
- Lanczos downscaling holds fine detail — hair, chain links, fabric weave —
  that a canvas resample smears.
- The phone never holds a 3–8 MB decode in memory.

The admin Media Library also compresses in-browser now, so phone uploads work
there too. This tool exists for better output when uploading in bulk.

## Format choice

Measured on a 2304×3456 product photo, encoding the 1000×1250 product slot
(SSIM against the uncompressed original — higher is closer):

| Format | Size | SSIM |
|---|---|---|
| JPEG q75 | 79.5 KB | 0.9799 |
| WebP q80 | 42.7 KB | 0.9708 |
| WebP q88 | 68.7 KB | 0.9767 |
| **AVIF q60** | **32.6 KB** | **0.9763** |
| AVIF q70 | 46.8 KB | 0.9797 |

AVIF is roughly **half the bytes at the same quality**. It is not used because
`backend/app/routers/media.py` `ALLOWED_FORMATS` accepts only JPEG, PNG, WebP
and GIF — adding `"AVIF": ".avif"` there would unlock it, at the cost of the
few percent of browsers that still cannot decode AVIF.

## Auth

There is no API key. `/api/media` sits behind `require_admin`, so this logs in
via `POST /api/auth/login`, keeps the httpOnly cookie jar, echoes the
`csrf_token` cookie back as the `X-CSRF-Token` header, and retries once through
`/api/auth/refresh` when the 15-minute access cookie expires — the same dance
the browser client does.

Credentials are never written to disk.

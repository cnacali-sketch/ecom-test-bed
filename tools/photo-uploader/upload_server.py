"""Phone -> PC -> Savvy In Teal media library.

Run this on the PC. Anyone on the same Wi-Fi opens the printed URL on their
phone, picks photos, and the PC does the conversion before pushing them to the
admin media API. The phone only uploads the original; every expensive or
quality-sensitive step happens here.

Why convert on the PC rather than in the phone browser:
  - Pillow's WebP encoder at method=6 searches harder than a browser canvas
    toBlob(), which is fixed at the browser's default effort.
  - Lanczos downscaling beats the browser's bilinear canvas resample on fine
    detail -- hair, chain links, fabric weave.
  - The phone never has to hold a 3-8 MB decode in memory.

Settings are measured, not guessed. On a 2304x3456 product photo, encoding the
1000x1250 product slot:

    JPEG q75   79.5 KB   SSIM 0.9799
    WebP q80   42.7 KB   SSIM 0.9708
    WebP q88   68.7 KB   SSIM 0.9767      <- default sits between these
    AVIF q60   32.6 KB   SSIM 0.9763

AVIF is roughly half the size at equal quality, but the backend's media
allowlist (app/routers/media.py ALLOWED_FORMATS) accepts only JPEG/PNG/WebP/
GIF, so WebP is what actually ships today.

Usage:
    python upload_server.py
    python upload_server.py --api https://api.savvyinteal.com --port 8765

Requires only the standard library plus Pillow.
"""
from __future__ import annotations

import argparse
import getpass
import http.cookiejar
import io
import json
import mimetypes
import os
import re
import socket
import sys
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required:  python -m pip install Pillow")

# iPhones shoot HEIC. Safari normally transcodes to JPEG when a photo goes
# through a web form, so this is usually not needed -- but it is if the phone
# has "Keep Originals" set, or the file arrives over AirDrop/USB. Optional:
# absent, HEIC simply reports a clear error instead of crashing.
try:
    import pillow_heif

    pillow_heif.register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:
    HEIC_SUPPORTED = False

# Antivirus "web shield" features (Avast, AVG, Kaspersky, ESET, Bitdefender)
# intercept HTTPS and re-sign every certificate with a root they install
# locally. Those roots routinely leave basicConstraints unmarked as critical,
# which OpenSSL 3.x refuses outright:
#
#   CERTIFICATE_VERIFY_FAILED: Basic Constraints of CA cert not marked critical
#
# Browsers and curl never hit this because they verify through the operating
# system, which is more forgiving about that flag. truststore makes Python do
# the same. The connection is still fully verified -- by Windows/macOS instead
# of by OpenSSL's own parser -- so this is not a downgrade to an unverified
# context, and it is a no-op on a machine with no interception.
try:
    import truststore

    truststore.inject_into_ssl()
except ImportError:
    pass

DEFAULT_API = "https://api.savvyinteal.com"

# Mirrors IMG_SPECS in frontend/lib/admin/types.ts. `w`/`h` are 2x what the
# slot renders at, so the image stays sharp on a retina phone without shipping
# wasted pixels.
SLOTS: dict[str, dict] = {
    "product":   {"w": 1000, "h": 1250, "max_kb": 250, "label": "Product photo (4:5)"},
    "hero":      {"w": 1400, "h": 1750, "max_kb": 400, "label": "Homepage hero (4:5)"},
    "campaign":  {"w": 1000, "h": 1250, "max_kb": 250, "label": "Campaign band (4:5)"},
    "editorial": {"w": 900,  "h": 1125, "max_kb": 200, "label": "Editorial tile (4:5)"},
    "heroInset": {"w": 640,  "h": 480,  "max_kb": 100, "label": "Hero inset (4:3)"},
    "tile":      {"w": 640,  "h": 640,  "max_kb": 120, "label": "Category tile (square)"},
}

# Quality ladder. 82 is the default because the measurements above put it
# between WebP q80 and q88 -- visually indistinguishable from the source on
# product photography while staying well inside every slot's byte budget.
QUALITY_STEPS = (82, 76, 70, 64, 58)
WEBP_METHOD = 6  # 0 fastest .. 6 smallest; a few hundred ms per image, worth it


# --------------------------------------------------------------- API client --

def _network_help(base: str, error: Exception) -> str:
    """Turn a connection failure into something the shop owner can act on."""
    text = str(error)
    if "CERTIFICATE_VERIFY_FAILED" in text:
        return (
            f"Could not verify the HTTPS certificate for {base}.\n\n"
            "  This is almost always antivirus HTTPS scanning (Avast, AVG,\n"
            "  Kaspersky, ESET, Bitdefender) re-signing the certificate with a\n"
            "  root that Python refuses but Windows accepts. Fix it with:\n\n"
            "      python -m pip install truststore\n\n"
            "  then run this again. Failing that, turn off the antivirus's\n"
            f"  'web shield' / 'HTTPS scanning' option.\n\n  ({text})"
        )
    return (
        f"Could not reach {base}.\n\n"
        "  Check this PC is online and that the site is up. If large requests\n"
        "  hang while small ones work, it is usually an MTU problem on the\n"
        f"  connection rather than the server.\n\n  ({text})"
    )


class AdminApi:
    """Cookie-session client for the admin API.

    There is no API key: /api/media is behind require_admin, which means an
    httpOnly access-token cookie (15 min) plus a CSRF double-submit header.
    A 401 mid-session is normal and is retried once through /api/auth/refresh.
    """

    def __init__(self, base_url: str):
        self.base = base_url.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar)
        )

    def _cookie(self, name: str) -> str | None:
        for cookie in self.jar:
            if cookie.name == name:
                return cookie.value
        return None

    def _request(self, path: str, data: bytes | None = None, headers: dict | None = None,
                 method: str = "GET") -> tuple[int, bytes]:
        request = urllib.request.Request(f"{self.base}{path}", data=data, method=method)
        for key, value in (headers or {}).items():
            request.add_header(key, value)
        # Same double-submit the browser client does: echo the readable CSRF
        # cookie back as a header on every state-changing call.
        if method not in ("GET", "HEAD"):
            token = self._cookie("csrf_token")
            if token:
                request.add_header("X-CSRF-Token", token)
        try:
            with self.opener.open(request, timeout=60) as response:
                return response.status, response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.read()
        except urllib.error.URLError as error:
            # Without this the first TLS or DNS failure surfaces as a raw
            # traceback, which says nothing useful to whoever is running this.
            raise SystemExit(_network_help(self.base, error)) from None

    def login(self, email: str, password: str) -> None:
        payload = json.dumps({"email": email, "password": password}).encode()
        status, body = self._request(
            "/api/auth/login", payload, {"Content-Type": "application/json"}, "POST"
        )
        if status != 200:
            raise SystemExit(f"Login failed ({status}): {_detail(body)}")
        user = json.loads(body)
        if user.get("role") != "admin":
            raise SystemExit("That account is not an admin, so it cannot upload media.")
        print(f"  signed in as {user.get('email')}")

    def refresh(self) -> bool:
        status, _ = self._request("/api/auth/refresh", b"", {}, "POST")
        return status == 200

    def upload(self, filename: str, content: bytes) -> tuple[bool, str]:
        def attempt() -> tuple[int, bytes]:
            body, content_type = _multipart("file", filename, content, "image/webp")
            return self._request("/api/media", body, {"Content-Type": content_type}, "POST")

        status, body = attempt()
        # The access cookie is short-lived; one silent refresh-and-retry is
        # exactly what the browser client does.
        if status == 401 and self.refresh():
            status, body = attempt()
        if status == 201:
            return True, json.loads(body)["url"]
        return False, f"HTTP {status}: {_detail(body)}"


def _detail(body: bytes) -> str:
    """Readable message from an API error body.

    FastAPI returns 422 validation failures as a list of field errors; printing
    the raw structure is unreadable, so pull out the messages.
    """
    try:
        detail = json.loads(body).get("detail")
    except Exception:
        return body[:200].decode("utf-8", "replace")
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        messages = []
        for entry in detail:
            if isinstance(entry, dict):
                field = ".".join(str(part) for part in entry.get("loc", [])[1:])
                messages.append(f"{field}: {entry.get('msg', '')}".strip(": "))
        if messages:
            return "; ".join(messages)
    return str(detail)[:200]


def _multipart(field: str, filename: str, content: bytes, content_type: str) -> tuple[bytes, str]:
    boundary = uuid.uuid4().hex
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {content_type}\r\n\r\n".encode(),
        content,
        f"\r\n--{boundary}--\r\n".encode(),
    ])
    return body, f"multipart/form-data; boundary={boundary}"


# ---------------------------------------------------------------- conversion --

def convert(raw: bytes, slot: str) -> tuple[bytes, dict]:
    """Centre-crop to the slot's shape, downscale, encode WebP under budget."""
    spec = SLOTS[slot]
    try:
        source = Image.open(io.BytesIO(raw))
    except Exception:
        if not HEIC_SUPPORTED and raw[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1"):
            raise ValueError(
                "This is an iPhone HEIC file. Either install support "
                "(python -m pip install pillow-heif) and restart, or set "
                "iPhone > Settings > Camera > Formats to 'Most Compatible'."
            ) from None
        raise ValueError("Could not read that file as an image.") from None
    # Phone cameras store a landscape sensor frame plus an orientation flag.
    # Without this every portrait photo would come out rotated 90 degrees.
    source = ImageOps.exif_transpose(source)
    if source.mode not in ("RGB", "RGBA"):
        source = source.convert("RGB")
    original_w, original_h = source.size

    aspect = spec["w"] / spec["h"]
    width, height = source.size
    if width / height > aspect:
        crop_w, crop_h = int(round(height * aspect)), height
    else:
        crop_w, crop_h = width, int(round(width / aspect))
    left, top = (width - crop_w) // 2, (height - crop_h) // 2
    source = source.crop((left, top, left + crop_w, top + crop_h))
    cropped_pct = round((1 - (crop_w * crop_h) / (width * height)) * 100)

    # Never upscale: enlarging adds bytes and no detail. LANCZOS is the reason
    # this runs on the PC -- it holds fine detail a canvas resample smears.
    target_w = min(spec["w"], source.width)
    target_h = max(1, round(target_w / aspect))
    source = source.resize((target_w, target_h), Image.LANCZOS)
    if source.mode == "RGBA":
        source = source.convert("RGB")

    budget = spec["max_kb"] * 1024
    encoded, used_quality = b"", QUALITY_STEPS[-1]
    for quality in QUALITY_STEPS:
        buffer = io.BytesIO()
        source.save(buffer, format="WEBP", quality=quality, method=WEBP_METHOD)
        encoded, used_quality = buffer.getvalue(), quality
        if len(encoded) <= budget:
            break

    return encoded, {
        "from": f"{original_w}x{original_h}",
        "to": f"{target_w}x{target_h}",
        "originalKb": round(len(raw) / 1024),
        "finalKb": round(len(encoded) / 1024),
        "quality": used_quality,
        "croppedPct": max(0, cropped_pct),
    }


# -------------------------------------------------------------------- server --

PAGE = """<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Savvy In Teal — photo upload</title><style>
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font:16px/1.5 system-ui,-apple-system,sans-serif;background:#fbf7f2;color:#0d1615;padding:20px;max-width:640px;margin-inline:auto}
h1{font-size:20px;margin:0 0 2px}
p.sub{margin:0 0 20px;color:#5b6b68;font-size:14px}
label{display:block;font-size:13px;font-weight:600;margin:0 0 6px}
select,input[type=file]{width:100%;padding:12px;border:1px solid #0d161522;border-radius:12px;background:#fff;font-size:16px}
button{width:100%;margin-top:16px;padding:15px;border:0;border-radius:12px;background:#1f6f6b;color:#fff;font-size:17px;font-weight:700}
button:disabled{background:#0d161533}
.row{margin-bottom:16px}
#out{margin-top:20px}
.item{background:#fff;border:1px solid #0d161514;border-radius:12px;padding:12px;margin-bottom:10px;font-size:13px}
.ok{color:#1f6f6b;font-weight:700}.bad{color:#c0392b;font-weight:700}
.meta{color:#5b6b68;margin-top:4px;font-size:12px}
.warn{color:#b08d3f;margin-top:4px;font-size:12px}
</style></head><body>
<h1>Upload product photos</h1>
<p class="sub">Converted to WebP on the PC, then pushed straight to the media library.</p>
<div class="row"><label for="slot">Where will these be used?</label>
<select id="slot">__SLOTS__</select></div>
<div class="row"><label for="files">Photos</label>
<input id="files" type="file" accept="image/*" multiple></div>
<button id="go">Convert &amp; upload</button>
<div id="out"></div>
<script>
const go=document.getElementById('go'),out=document.getElementById('out');
go.onclick=async()=>{
  const files=document.getElementById('files').files;
  if(!files.length){out.innerHTML='<div class="item bad">Pick at least one photo.</div>';return;}
  go.disabled=true;out.innerHTML='';
  for(let i=0;i<files.length;i++){
    const f=files[i];
    const card=document.createElement('div');card.className='item';
    card.innerHTML='<b>'+f.name+'</b><div class="meta">Uploading '+(i+1)+' of '+files.length+'…</div>';
    out.appendChild(card);
    const fd=new FormData();fd.append('file',f);fd.append('slot',document.getElementById('slot').value);
    try{
      const r=await fetch('/upload',{method:'POST',body:fd});
      const j=await r.json();
      if(j.ok){
        card.innerHTML='<b>'+f.name+'</b> <span class="ok">✓ uploaded</span>'+
          '<div class="meta">'+j.from+' → '+j.to+' · '+j.originalKb+' KB → '+j.finalKb+
          ' KB · WebP q'+j.quality+'</div>'+
          (j.croppedPct>0?'<div class="warn">Centre-cropped — '+j.croppedPct+
            '% trimmed. Reshoot with the product centred if that cut something off.</div>':'');
      }else{card.innerHTML='<b>'+f.name+'</b> <span class="bad">✗ '+j.error+'</span>';}
    }catch(e){card.innerHTML='<b>'+f.name+'</b> <span class="bad">✗ '+e+'</span>';}
  }
  go.disabled=false;
};
</script></body></html>"""


def lan_ip() -> str:
    """Best-guess LAN address. No packets are actually sent to the probe host."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("10.255.255.255", 1))
        return sock.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        sock.close()


def make_handler(api: AdminApi):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):  # quieter console
            pass

        def _send(self, status: int, body: bytes, content_type: str):
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path not in ("/", "/index.html"):
                self._send(404, b"Not found", "text/plain")
                return
            options = "".join(
                f'<option value="{key}">{spec["label"]}</option>' for key, spec in SLOTS.items()
            )
            self._send(200, PAGE.replace("__SLOTS__", options).encode(), "text/html; charset=utf-8")

        def do_POST(self):
            if self.path != "/upload":
                self._send(404, b"Not found", "text/plain")
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                raw = self.rfile.read(length)
                content_type = self.headers.get("Content-Type", "")
                match = re.search(r"boundary=(.+)$", content_type)
                if not match:
                    raise ValueError("malformed upload")
                parts = _split_multipart(raw, match.group(1).strip('"').encode())

                slot = parts.get("slot", b"product").decode(errors="replace").strip()
                if slot not in SLOTS:
                    slot = "product"
                image = parts.get("file")
                filename = parts.get("__file_name__", b"photo").decode(errors="replace")
                if not image:
                    raise ValueError("no file received")

                data, info = convert(image, slot)
                stem = os.path.splitext(os.path.basename(filename))[0] or "photo"
                ok, result = api.upload(f"{stem}.webp", data)
                print(
                    f"  {'OK ' if ok else 'ERR'} {filename}: {info['originalKb']} KB "
                    f"-> {info['finalKb']} KB  {info['from']} -> {info['to']}  "
                    f"q{info['quality']}" + ("" if ok else f"  {result}")
                )
                payload = {"ok": ok, **info} if ok else {"ok": False, "error": result}
            except Exception as error:  # a bad photo must not kill the server
                payload = {"ok": False, "error": str(error)}
            self._send(200, json.dumps(payload).encode(), "application/json")

    return Handler


def _split_multipart(body: bytes, boundary: bytes) -> dict[str, bytes]:
    """Minimal multipart parser — two known fields, no nesting, no encodings."""
    fields: dict[str, bytes] = {}
    for chunk in body.split(b"--" + boundary):
        if b"\r\n\r\n" not in chunk:
            continue
        head, _, value = chunk.partition(b"\r\n\r\n")
        name = re.search(rb'name="([^"]*)"', head)
        if not name:
            continue
        filename = re.search(rb'filename="([^"]*)"', head)
        if filename:
            fields["__file_name__"] = filename.group(1)
        fields[name.group(1).decode()] = value.rstrip(b"\r\n-")
    return fields


def main() -> None:
    parser = argparse.ArgumentParser(description="Phone -> PC -> media library uploader")
    parser.add_argument("--api", default=os.environ.get("SAVVY_API", DEFAULT_API))
    parser.add_argument("--port", type=int, default=int(os.environ.get("SAVVY_PORT", 8765)))
    args = parser.parse_args()

    mimetypes.init()
    print(f"Savvy In Teal photo uploader\n  api: {args.api}")

    email = os.environ.get("SAVVY_ADMIN_EMAIL") or input("  admin email: ").strip()
    # getpass keeps the password off the screen and out of shell history.
    password = os.environ.get("SAVVY_ADMIN_PASSWORD") or getpass.getpass("  admin password: ")

    api = AdminApi(args.api)
    api.login(email, password)

    server = ThreadingHTTPServer(("0.0.0.0", args.port), make_handler(api))
    print(
        f"\n  Open this on your phone (same Wi-Fi):\n"
        f"      http://{lan_ip()}:{args.port}\n"
        f"  On this PC:\n"
        f"      http://localhost:{args.port}\n\n"
        f"  If the phone cannot open that URL, it is the Windows firewall.\n"
        f"  Windows only offers to allow Python on Private networks, and most\n"
        f"  Wi-Fi is classified Public, so the prompt does not help there. Run\n"
        f"  this once in an ADMIN PowerShell instead:\n\n"
        f"      New-NetFirewallRule -DisplayName 'Savvy photo uploader' "
        f"-Direction Inbound -Protocol TCP -LocalPort {args.port} "
        f"-Action Allow -Profile Any -RemoteAddress LocalSubnet\n\n"
        f"  Ctrl+C to stop.\n"
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()

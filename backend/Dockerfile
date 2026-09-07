# python:3.12-slim -- Python 3.14 may lack prebuilt wheels for some deps
# (asyncpg, Pillow, etc.) at time of writing, so 3.12 is used for compatibility.
FROM python:3.12-slim

WORKDIR /app

# System dependencies needed to build wheels for asyncpg/Pillow if no
# prebuilt wheel is available for the target platform.
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as an unprivileged user rather than root -- limits what an RCE via a
# dependency or the app itself can do to the host (no privileged port bind
# needed here, so there's no reason to run as root at all). Fixed numeric
# uid/gid (not just a name) so the docker-compose media_uploads volume can be
# chowned to match from outside the container deterministically.
RUN groupadd -g 10001 appuser \
    && useradd -u 10001 -g appuser -M -s /usr/sbin/nologin appuser \
    && mkdir -p /app/media_uploads \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# --proxy-headers makes uvicorn trust X-Forwarded-For/-Proto and rewrite
# request.client.host to the real visitor IP instead of the immediate TCP
# peer. --forwarded-allow-ips=* is safe here specifically because this
# container is never reachable directly from the internet (see
# docker-compose.yml's port policy comment) -- Caddy is the only possible
# peer, so there's no untrusted source that could forge the header at this
# hop. Without this, every request looks like it came from Caddy's container
# IP, collapsing every visitor's rate-limit bucket into one shared counter.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]

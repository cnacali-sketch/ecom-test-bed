"""FastAPI application entrypoint."""
import logging
import mimetypes
from pathlib import Path

from starlette.exceptions import HTTPException

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.middleware.error_logging import ErrorLoggingMiddleware
from app.routers import (
    audit,
    auth,
    categories,
    collections,
    contact,
    content,
    coupons,
    customers,
    error_logs,
    events,
    health,
    inventory,
    invoices,
    media,
    orders,
    payments,
    pricing,
    products,
    recommendation,
    returns,
    sections,
)


class _MediaFiles(StaticFiles):
    """Serve the original when a requested derivative does not exist.

    The storefront's image loader rewrites every /media URL into a
    `__w<width>.webp` derivative, because it runs in the browser and cannot
    know which files actually have them. Plenty legitimately do not: anything
    uploaded before derivatives existed, images too small to be worth
    resizing, and animated GIFs, which are skipped rather than silently
    flattened to a still.

    A missing candidate in a srcset is not a soft failure. The browser does
    not fall back to `src` -- it renders a broken image. Falling back here
    turns that into "the visitor gets the full-size original", which is
    exactly the behaviour before any of this existed.
    """

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except HTTPException as exc:
            # Starlette *raises* for a missing file rather than returning a
            # 404 response, so this has to be a caught exception and not a
            # status-code check -- which is how the first version of this
            # silently never fired.
            if exc.status_code != 404:
                raise
            fallback = self._original_for(path)
            if fallback is None:
                raise
            return await super().get_response(fallback, scope)

    def _original_for(self, path: str) -> str | None:
        """The source file a `__w<width>.webp` derivative was made from."""
        stem, _, extension = path.rpartition(".")
        if "__w" not in stem:
            return None
        base, _, width = stem.rpartition("__w")
        if not width.isdigit():
            return None

        # The derivative is always .webp; the original keeps whatever
        # extension it was stored under, so each candidate is tried.
        for candidate_ext in ("png", "jpg", "jpeg", "webp", "gif"):
            candidate = f"{base}.{candidate_ext}"
            if (Path(self.directory) / candidate).is_file():
                return candidate
        return None


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application instance."""
    settings = get_settings()

    # uvicorn configures only its own loggers, so app.* records would be
    # discarded. That silently breaks EMAIL_DEV_STUB, whose entire job is to
    # print the verification link to the console. Attach a handler if the root
    # logger has none.
    if not logging.getLogger().handlers:
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(name)s | %(message)s",
        )

    # /docs, /redoc, and /openapi.json fully disclose the API surface (every
    # route, schema, and field) to anyone who requests them -- fine for local
    # dev, but no reason to hand that map to the public internet in production.
    docs_kwargs = (
        {"docs_url": None, "redoc_url": None, "openapi_url": None}
        if settings.is_production
        else {}
    )
    fastapi_app = FastAPI(title=settings.app_name, **docs_kwargs)

    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    fastapi_app.add_middleware(ErrorLoggingMiddleware)

    fastapi_app.include_router(health.router)
    fastapi_app.include_router(auth.router)
    fastapi_app.include_router(pricing.router)
    fastapi_app.include_router(inventory.router)
    fastapi_app.include_router(recommendation.router)
    fastapi_app.include_router(products.router)
    fastapi_app.include_router(collections.router)
    fastapi_app.include_router(orders.router)
    fastapi_app.include_router(customers.router)
    fastapi_app.include_router(events.router)
    fastapi_app.include_router(coupons.router)
    fastapi_app.include_router(returns.router)
    fastapi_app.include_router(categories.router)
    fastapi_app.include_router(media.router)
    fastapi_app.include_router(invoices.router)
    fastapi_app.include_router(sections.router)
    fastapi_app.include_router(content.router)
    fastapi_app.include_router(audit.router)
    fastapi_app.include_router(error_logs.router)
    fastapi_app.include_router(contact.router)
    fastapi_app.include_router(payments.router)

    # StaticFiles picks the Content-Type from Python's `mimetypes`, which reads
    # the OS table. The slim container image ships no /etc/mime.types, and this
    # Python's built-in table has no .webp entry (verified in the running
    # container: guess_type("a.webp") -> (None, None), while .png and .avif
    # resolve). Starlette then falls back to text/plain, and because the
    # Caddyfile sets X-Content-Type-Options: nosniff the browser refuses to
    # render it — every uploaded WebP showed as a broken image. The admin's
    # crop editor emits WebP exclusively, so this silently broke every image
    # uploaded through it, on the storefront as well as in the media library.
    # Registered here rather than relying on the base image's file list.
    mimetypes.add_type("image/webp", ".webp")
    mimetypes.add_type("image/avif", ".avif")

    fastapi_app.mount(
        "/media", _MediaFiles(directory=media.UPLOAD_DIR), name="media"
    )

    return fastapi_app


app = create_app()

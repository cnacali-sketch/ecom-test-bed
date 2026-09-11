"""FastAPI application entrypoint."""
import logging
import mimetypes

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.middleware.error_logging import ErrorLoggingMiddleware
from app.routers import (
    auth,
    categories,
    collections,
    contact,
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

    fastapi_app.mount("/media", StaticFiles(directory=media.UPLOAD_DIR), name="media")

    return fastapi_app


app = create_app()

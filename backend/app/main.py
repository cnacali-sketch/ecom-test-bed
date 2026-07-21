"""FastAPI application entrypoint."""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    auth,
    collections,
    health,
    inventory,
    orders,
    pricing,
    products,
    recommendation,
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

    fastapi_app = FastAPI(title=settings.app_name)

    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    fastapi_app.include_router(health.router)
    fastapi_app.include_router(auth.router)
    fastapi_app.include_router(pricing.router)
    fastapi_app.include_router(inventory.router)
    fastapi_app.include_router(recommendation.router)
    fastapi_app.include_router(products.router)
    fastapi_app.include_router(collections.router)
    fastapi_app.include_router(orders.router)

    return fastapi_app


app = create_app()

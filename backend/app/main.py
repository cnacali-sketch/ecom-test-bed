"""FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import health, inventory, pricing, products, recommendation


def create_app() -> FastAPI:
    """Construct and configure the FastAPI application instance."""
    settings = get_settings()

    fastapi_app = FastAPI(title=settings.app_name)

    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    fastapi_app.include_router(health.router)
    fastapi_app.include_router(pricing.router)
    fastapi_app.include_router(inventory.router)
    fastapi_app.include_router(recommendation.router)
    fastapi_app.include_router(products.router)

    return fastapi_app


app = create_app()

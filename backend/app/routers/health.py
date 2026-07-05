"""Health check endpoint."""
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Return a simple liveness signal for load balancers / uptime checks."""
    return {"status": "ok"}

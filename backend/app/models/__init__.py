"""ORM models package.

Importing this package registers all models on `app.db.Base.metadata`,
which Alembic's `env.py` relies on for autogenerate support.
"""
from app.models.agent_decision import AgentDecision
from app.models.collection import Collection
from app.models.coupon import Coupon
from app.models.inventory_snapshot import InventorySnapshot
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
from app.models.recommendation import Recommendation
from app.models.refresh_token import RefreshToken
from app.models.return_request import ReturnRequest
from app.models.user import User
from app.models.user_event import UserEvent

__all__ = [
    "AgentDecision",
    "Collection",
    "Coupon",
    "InventorySnapshot",
    "Order",
    "OrderItem",
    "Product",
    "ProductVariant",
    "Recommendation",
    "RefreshToken",
    "ReturnRequest",
    "User",
    "UserEvent",
]

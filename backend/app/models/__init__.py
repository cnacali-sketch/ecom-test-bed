"""ORM models package.

Importing this package registers all models on `app.db.Base.metadata`,
which Alembic's `env.py` relies on for autogenerate support.
"""
from app.models.agent_decision import AgentDecision
from app.models.audit_log import AuditLog
from app.models.category import Category
from app.models.collection import Collection
from app.models.contact_message import ContactMessage
from app.models.coupon import Coupon
from app.models.error_log import ErrorLog
from app.models.homepage_content import HomepageContent
from app.models.inventory_snapshot import InventorySnapshot
from app.models.invoice import Invoice, InvoiceSequence
from app.models.order import Order, OrderItem
from app.models.product import Product, ProductVariant
from app.models.recommendation import Recommendation
from app.models.refresh_token import RefreshToken
from app.models.return_request import ReturnRequest
from app.models.site_content import SiteContent
from app.models.user import User
from app.models.user_event import UserEvent

__all__ = [
    "AgentDecision",
    "AuditLog",
    "Category",
    "Collection",
    "ContactMessage",
    "Coupon",
    "ErrorLog",
    "HomepageContent",
    "InventorySnapshot",
    "Invoice",
    "InvoiceSequence",
    "Order",
    "OrderItem",
    "Product",
    "ProductVariant",
    "Recommendation",
    "RefreshToken",
    "ReturnRequest",
    "SiteContent",
    "User",
    "UserEvent",
]

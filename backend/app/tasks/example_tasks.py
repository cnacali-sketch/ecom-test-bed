"""Stub Celery tasks proving the task queue wiring works.

Real agent tasks (recommendation generation, inventory checks, etc.) are
out of scope for Phase 1 and will be added in a later phase.
"""
from app.celery_app import celery_app


@celery_app.task(name="app.tasks.example_tasks.ping")
def ping() -> str:
    """Trivial task used to prove Celery task registration works end-to-end."""
    return "pong"

"""Celery application wiring.

This only proves the task queue is wired up correctly (broker=RabbitMQ,
result backend=Redis). No tasks are actually dispatched or executed as
part of Phase 1 -- creating a `Celery` instance does not open a network
connection, so this module is safe to import without RabbitMQ/Redis running.
"""
from celery import Celery

from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "backend",
    broker=settings.rabbitmq_url,
    backend=settings.redis_url,
    include=["app.tasks.example_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

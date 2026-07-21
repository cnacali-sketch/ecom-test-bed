"""Outbound email, provider-abstracted.

EMAIL_DEV_STUB=true (the default) logs messages instead of sending them, so
the register flow is exercisable with no SMTP server. Swapping to real SMTP is
config-only: set EMAIL_DEV_STUB=false and the SMTP_* vars.

These functions are dispatched via FastAPI BackgroundTasks, i.e. AFTER the
response is written. That matters for /register: whether we send a "welcome"
or a "you already have an account" mail must not change response timing, or
the enumeration hole we closed in the handler reopens through the side channel.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from urllib.parse import quote

from app.config import get_settings

logger = logging.getLogger(__name__)


def _send(to: str, subject: str, body: str) -> None:
    """Deliver one message, or log it when the dev stub is on."""
    settings = get_settings()

    if settings.email_dev_stub:
        logger.info(
            "[EMAIL DEV STUB] to=%s subject=%s\n%s\n%s", to, subject, "-" * 60, body
        )
        return

    message = EmailMessage()
    message["From"] = settings.email_from
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
    except Exception:
        # A background task that raises would be an unhandled error with no
        # request to attach it to. Log and drop: a failed reminder email must
        # never surface to the caller, since that would leak whether the
        # address exists.
        logger.exception("Failed to send email to %s", to)


def send_verification_email(to: str, token: str) -> None:
    """New signup: prove control of the address."""
    settings = get_settings()
    link = f"{settings.frontend_url}/verify-email?token={quote(token)}"
    _send(
        to,
        "Confirm your Savvy In Teal account",
        (
            "Welcome to Savvy In Teal.\n\n"
            f"Confirm your email address to finish setting up your account:\n{link}\n\n"
            f"This link expires in {settings.email_verify_ttl_hours} hours.\n\n"
            "If you didn't create this account, you can ignore this email."
        ),
    )


def send_order_confirmation_email(to: str, order_id: str) -> None:
    """Order placed — sent right after checkout (COD or, once wired, prepaid)."""
    settings = get_settings()
    track_link = f"{settings.frontend_url}/track-order?order_id={quote(order_id)}"
    _send(
        to,
        "Your Savvy In Teal order is confirmed",
        (
            "Thanks for your order!\n\n"
            f"Order reference: {order_id}\n\n"
            f"Track it any time:\n{track_link}\n\n"
            "We'll email you again as soon as it ships."
        ),
    )


def send_order_shipped_email(
    to: str, order_id: str, courier: str | None, tracking_number: str | None
) -> None:
    """Order moved to 'shipped' with a courier/tracking number attached."""
    settings = get_settings()
    track_link = f"{settings.frontend_url}/track-order?order_id={quote(order_id)}"
    courier_line = (
        f"Carrier: {courier}\nTracking number: {tracking_number}\n\n"
        if courier or tracking_number
        else ""
    )
    _send(
        to,
        "Your Savvy In Teal order has shipped",
        (
            "Good news — your order is on its way.\n\n"
            f"Order reference: {order_id}\n\n"
            f"{courier_line}"
            f"Track it any time:\n{track_link}"
        ),
    )


def send_account_exists_email(to: str) -> None:
    """Signup attempt on an address that already has an account.

    The API told the caller the same thing it tells a new signup. The truth is
    only ever delivered here — to the inbox owner, who is entitled to it. If
    the signup wasn't them, this doubles as a heads-up that someone probed
    their address.
    """
    settings = get_settings()
    _send(
        to,
        "You already have a Savvy In Teal account",
        (
            "Someone (probably you) just tried to sign up with this email address.\n\n"
            "You already have an account, so we didn't create a second one.\n\n"
            f"Sign in:          {settings.frontend_url}/login\n"
            f"Forgot password:  {settings.frontend_url}/forgot-password\n\n"
            "If this wasn't you, no action is needed — your account is unchanged "
            "and no one was told whether this address is registered."
        ),
    )

"""Create or promote an admin account.

Self-registration always creates a customer (see routers/auth.py), so the
first admin has to be made out-of-band. This is that door.

Usage (inside the backend container):
    python scripts/create_admin.py --email admin@savvyinteal.com
    python scripts/create_admin.py --email admin@savvyinteal.com --password '<pw>'

With no --password, one is read from the ADMIN_PASSWORD env var, and failing
that prompted for interactively — so the password never lands in shell history.
"""
import argparse
import asyncio
import getpass
import os
import sys

from sqlalchemy import select

from app.db import async_session_factory
from app.models.user import ROLE_ADMIN, User, normalize_email
from app.schemas.auth import PASSWORD_MIN
from app.services.security import hash_password


async def create_admin(email: str, password: str) -> None:
    email = normalize_email(email)
    async with async_session_factory() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            db.add(
                User(
                    email=email,
                    password_hash=hash_password(password),
                    role=ROLE_ADMIN,
                    is_verified=True,
                )
            )
            action = "created"
        else:
            user.role = ROLE_ADMIN
            user.password_hash = hash_password(password)
            action = "promoted to admin (password reset)"

        await db.commit()
    print(f"{email}: {action}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", help="Omit to use $ADMIN_PASSWORD or an interactive prompt")
    args = parser.parse_args()

    if args.password:
        print(
            "WARNING: --password is visible in your shell history and in `ps` output. "
            "Prefer $ADMIN_PASSWORD or the interactive prompt.",
            file=sys.stderr,
        )

    pw = args.password or os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Admin password: ")
    if len(pw) < PASSWORD_MIN:
        sys.exit(f"Password must be at least {PASSWORD_MIN} characters")

    asyncio.run(create_admin(args.email, pw))

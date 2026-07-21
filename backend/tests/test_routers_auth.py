"""Tests for /api/auth endpoints, the JWT cookie gate, and refresh rotation."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.dependencies.auth import ACCESS_COOKIE, REFRESH_COOKIE
from app.models.refresh_token import RefreshToken
from app.models.user import ROLE_ADMIN, User
from app.routers.auth import REGISTER_ACCEPTED, REGISTER_MAX_PER_IP
from app.services import login_throttle
from app.services.security import hash_password

REGISTER = {"email": "new@example.com", "password": "correct-horse-battery"}
LOGIN = {"email": "new@example.com", "password": "correct-horse-battery"}


@pytest.fixture(autouse=True)
def _clear_throttle():
    """Login throttle is process-global — reset it between tests."""
    login_throttle._attempts.clear()
    yield
    login_throttle._attempts.clear()


@pytest.fixture(autouse=True)
def _no_real_email(monkeypatch):
    """Capture background emails instead of logging/sending them."""
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(
        "app.routers.auth.send_verification_email",
        lambda to, token: sent.append(("verify", to)),
    )
    monkeypatch.setattr(
        "app.routers.auth.send_account_exists_email",
        lambda to: sent.append(("exists", to)),
    )
    return sent


@pytest.fixture
async def registered_user(db_session) -> User:
    user = User(
        email="new@example.com",
        password_hash=hash_password("correct-horse-battery"),
        role="customer",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# ---- register: uniform response, no enumeration ----

@pytest.mark.asyncio
async def test_register_returns_202_for_a_new_email(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/register", json=REGISTER)
    assert resp.status_code == 202
    assert resp.json() == {"detail": REGISTER_ACCEPTED}


@pytest.mark.asyncio
async def test_register_returns_identical_202_for_an_existing_email(
    client: AsyncClient, registered_user: User
) -> None:
    """The whole fix: a taken address is indistinguishable from a free one."""
    resp = await client.post("/api/auth/register", json=REGISTER)
    assert resp.status_code == 202
    assert resp.json() == {"detail": REGISTER_ACCEPTED}


@pytest.mark.asyncio
async def test_register_response_is_byte_identical_either_way(client: AsyncClient) -> None:
    first = await client.post("/api/auth/register", json=REGISTER)
    second = await client.post("/api/auth/register", json=REGISTER)
    assert first.status_code == second.status_code == 202
    assert first.content == second.content


@pytest.mark.asyncio
async def test_register_never_returns_409(client: AsyncClient, registered_user: User) -> None:
    resp = await client.post("/api/auth/register", json=REGISTER)
    assert resp.status_code != 409


@pytest.mark.asyncio
async def test_register_does_not_auto_login(client: AsyncClient) -> None:
    """Owning an inbox is unproven at signup, so no session may be issued."""
    resp = await client.post("/api/auth/register", json=REGISTER)
    assert ACCESS_COOKIE not in resp.cookies
    assert REFRESH_COOKIE not in resp.cookies
    assert (await client.get("/api/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_register_does_not_create_a_duplicate_user(
    client: AsyncClient, registered_user: User, db_session
) -> None:
    await client.post("/api/auth/register", json=REGISTER)
    result = await db_session.execute(select(User).where(User.email == "new@example.com"))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_register_password_of_existing_user_is_unchanged(
    client: AsyncClient, registered_user: User, db_session
) -> None:
    """A signup attempt must not overwrite the real owner's password."""
    before = registered_user.password_hash
    await client.post("/api/auth/register", json={**REGISTER, "password": "attacker-chosen-pw"})
    await db_session.refresh(registered_user)
    assert registered_user.password_hash == before


@pytest.mark.asyncio
async def test_register_sends_verification_email_to_new_address(
    client: AsyncClient, _no_real_email
) -> None:
    await client.post("/api/auth/register", json=REGISTER)
    assert ("verify", "new@example.com") in _no_real_email


@pytest.mark.asyncio
async def test_register_sends_reminder_email_to_existing_address(
    client: AsyncClient, registered_user: User, _no_real_email
) -> None:
    """The truth goes to the inbox owner, never to the caller."""
    await client.post("/api/auth/register", json=REGISTER)
    assert ("exists", "new@example.com") in _no_real_email
    assert ("verify", "new@example.com") not in _no_real_email


@pytest.mark.asyncio
async def test_register_email_is_case_insensitive(
    client: AsyncClient, registered_user: User, db_session
) -> None:
    await client.post("/api/auth/register", json={**REGISTER, "email": "NEW@Example.COM"})
    result = await db_session.execute(select(User))
    assert len(result.scalars().all()) == 1


@pytest.mark.asyncio
async def test_register_rejects_short_password(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/register", json={**REGISTER, "password": "short"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_rejects_invalid_email(client: AsyncClient) -> None:
    resp = await client.post("/api/auth/register", json={**REGISTER, "email": "not-an-email"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_rejects_multibyte_password_over_bcrypt_limit(client: AsyncClient) -> None:
    """A 72-char emoji password is 288 bytes — must 422, not 500 out of bcrypt."""
    resp = await client.post("/api/auth/register", json={**REGISTER, "password": "😀" * 72})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_register_is_throttled_per_ip(client: AsyncClient) -> None:
    for i in range(REGISTER_MAX_PER_IP):
        await client.post("/api/auth/register", json={**REGISTER, "email": f"f{i}@example.com"})
    resp = await client.post("/api/auth/register", json={**REGISTER, "email": "over@example.com"})
    assert resp.status_code == 429


# ---- verify-email ----

@pytest.mark.asyncio
async def test_verify_email_marks_account_verified(client: AsyncClient, db_session) -> None:
    from app.services.security import create_verify_token

    await client.post("/api/auth/register", json=REGISTER)
    result = await db_session.execute(select(User).where(User.email == "new@example.com"))
    user = result.scalar_one()
    assert user.is_verified is False

    token = create_verify_token(user.id, user.email)
    resp = await client.post(f"/api/auth/verify-email?token={token}")
    assert resp.status_code == 200
    await db_session.refresh(user)
    assert user.is_verified is True


@pytest.mark.asyncio
async def test_verify_email_rejects_a_refresh_token(client: AsyncClient, registered_user) -> None:
    """Token types must not be interchangeable."""
    login = await client.post("/api/auth/login", json=LOGIN)
    resp = await client.post(f"/api/auth/verify-email?token={login.cookies[REFRESH_COOKIE]}")
    assert resp.status_code == 400


# ---- login ----

@pytest.mark.asyncio
async def test_login_succeeds_and_sets_cookies(client: AsyncClient, registered_user) -> None:
    resp = await client.post("/api/auth/login", json=LOGIN)
    assert resp.status_code == 200
    assert ACCESS_COOKIE in resp.cookies
    assert REFRESH_COOKIE in resp.cookies


@pytest.mark.asyncio
async def test_login_wrong_password_returns_401(client: AsyncClient, registered_user) -> None:
    resp = await client.post("/api/auth/login", json={**LOGIN, "password": "wrong-password"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_login_does_not_leak_whether_email_exists(
    client: AsyncClient, registered_user
) -> None:
    wrong_pw = await client.post("/api/auth/login", json={**LOGIN, "password": "wrong-password"})
    no_user = await client.post(
        "/api/auth/login", json={"email": "nobody@example.com", "password": "wrong-password"}
    )
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()


@pytest.mark.asyncio
async def test_login_throttled_after_repeated_failures(client: AsyncClient, registered_user) -> None:
    for _ in range(login_throttle.MAX_ATTEMPTS):
        await client.post("/api/auth/login", json={**LOGIN, "password": "wrong-password"})
    resp = await client.post("/api/auth/login", json=LOGIN)
    assert resp.status_code == 429


@pytest.mark.asyncio
async def test_each_login_opens_its_own_family(
    client: AsyncClient, registered_user, db_session
) -> None:
    """Separate devices must be independently revocable."""
    await client.post("/api/auth/login", json=LOGIN)
    await client.post("/api/auth/login", json=LOGIN)
    result = await db_session.execute(select(RefreshToken))
    families = {row.family_id for row in result.scalars().all()}
    assert len(families) == 2


# ---- refresh: rotation ----

@pytest.mark.asyncio
async def test_refresh_rotates_the_token(client: AsyncClient, registered_user) -> None:
    login = await client.post("/api/auth/login", json=LOGIN)
    original = login.cookies[REFRESH_COOKIE]

    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 200
    assert resp.cookies[REFRESH_COOKIE] != original


@pytest.mark.asyncio
async def test_refresh_keeps_the_same_family(
    client: AsyncClient, registered_user, db_session
) -> None:
    await client.post("/api/auth/login", json=LOGIN)
    await client.post("/api/auth/refresh")

    result = await db_session.execute(select(RefreshToken))
    tokens = result.scalars().all()
    assert len(tokens) == 2
    assert len({t.family_id for t in tokens}) == 1
    assert sorted(t.is_used for t in tokens) == [False, True]


@pytest.mark.asyncio
async def test_refresh_without_cookie_returns_401(client: AsyncClient) -> None:
    assert (await client.post("/api/auth/refresh")).status_code == 401


@pytest.mark.asyncio
async def test_refresh_reflects_current_role_not_token_claims(
    client: AsyncClient, registered_user, db_session
) -> None:
    """A promoted/demoted account must not keep its old role by refreshing."""
    await client.post("/api/auth/login", json=LOGIN)
    registered_user.role = ROLE_ADMIN
    await db_session.commit()

    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 200
    assert resp.json()["role"] == "admin"


# ---- refresh: reuse detection (the breach path) ----

@pytest.mark.asyncio
async def test_replaying_a_spent_token_returns_403(client: AsyncClient, registered_user) -> None:
    login = await client.post("/api/auth/login", json=LOGIN)
    stolen = login.cookies[REFRESH_COOKIE]

    await client.post("/api/auth/refresh")  # spends `stolen`, mints a successor

    client.cookies.set(REFRESH_COOKIE, stolen)
    resp = await client.post("/api/auth/refresh")
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_replay_purges_the_entire_family(
    client: AsyncClient, registered_user, db_session
) -> None:
    """The thief's replay must also log out the victim's live token."""
    login = await client.post("/api/auth/login", json=LOGIN)
    stolen = login.cookies[REFRESH_COOKIE]
    await client.post("/api/auth/refresh")

    client.cookies.set(REFRESH_COOKIE, stolen)
    await client.post("/api/auth/refresh")

    result = await db_session.execute(select(RefreshToken))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_live_token_is_dead_after_a_replay_elsewhere(
    client: AsyncClient, registered_user
) -> None:
    login = await client.post("/api/auth/login", json=LOGIN)
    stolen = login.cookies[REFRESH_COOKIE]

    rotated = await client.post("/api/auth/refresh")
    live = rotated.cookies[REFRESH_COOKIE]

    client.cookies.set(REFRESH_COOKIE, stolen)
    await client.post("/api/auth/refresh")  # breach detected, family burned

    client.cookies.set(REFRESH_COOKIE, live)
    assert (await client.post("/api/auth/refresh")).status_code == 403


@pytest.mark.asyncio
async def test_replay_does_not_touch_another_family(
    client: AsyncClient, registered_user, db_session
) -> None:
    """Burning one session must not sign the user out of their other devices."""
    device_a = await client.post("/api/auth/login", json=LOGIN)
    stolen = device_a.cookies[REFRESH_COOKIE]
    client.cookies.set(REFRESH_COOKIE, stolen)
    await client.post("/api/auth/refresh")

    device_b = await client.post("/api/auth/login", json=LOGIN)
    b_family = device_b.cookies[REFRESH_COOKIE]

    client.cookies.set(REFRESH_COOKIE, stolen)
    await client.post("/api/auth/refresh")  # burns device A's family only

    client.cookies.set(REFRESH_COOKIE, b_family)
    assert (await client.post("/api/auth/refresh")).status_code == 200


@pytest.mark.asyncio
async def test_refresh_token_is_not_accepted_as_an_access_token(
    client: AsyncClient, registered_user
) -> None:
    login = await client.post("/api/auth/login", json=LOGIN)
    client.cookies.set(ACCESS_COOKIE, login.cookies[REFRESH_COOKIE])
    assert (await client.get("/api/auth/me")).status_code == 401


# ---- logout ----

@pytest.mark.asyncio
async def test_logout_clears_session(client: AsyncClient, registered_user) -> None:
    await client.post("/api/auth/login", json=LOGIN)
    assert (await client.get("/api/auth/me")).status_code == 200

    assert (await client.post("/api/auth/logout")).status_code == 204
    assert (await client.get("/api/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_logout_purges_the_family_from_the_db(
    client: AsyncClient, registered_user, db_session
) -> None:
    """Clearing cookies alone left the token replayable — the row must die."""
    await client.post("/api/auth/login", json=LOGIN)
    await client.post("/api/auth/logout")

    result = await db_session.execute(select(RefreshToken))
    assert result.scalars().all() == []


@pytest.mark.asyncio
async def test_refresh_token_is_dead_after_logout(client: AsyncClient, registered_user) -> None:
    """The actual vulnerability being fixed: a captured cookie replayed post-logout."""
    login = await client.post("/api/auth/login", json=LOGIN)
    captured = login.cookies[REFRESH_COOKIE]

    await client.post("/api/auth/logout")

    client.cookies.set(REFRESH_COOKIE, captured)
    assert (await client.post("/api/auth/refresh")).status_code == 403


@pytest.mark.asyncio
async def test_logout_only_kills_the_calling_session(
    client: AsyncClient, registered_user, db_session
) -> None:
    device_a = await client.post("/api/auth/login", json=LOGIN)
    device_b = await client.post("/api/auth/login", json=LOGIN)

    client.cookies.set(REFRESH_COOKIE, device_a.cookies[REFRESH_COOKIE])
    await client.post("/api/auth/logout")

    client.cookies.set(REFRESH_COOKIE, device_b.cookies[REFRESH_COOKIE])
    assert (await client.post("/api/auth/refresh")).status_code == 200


@pytest.mark.asyncio
async def test_logout_without_a_session_is_not_an_error(client: AsyncClient) -> None:
    assert (await client.post("/api/auth/logout")).status_code == 204


@pytest.mark.asyncio
async def test_logout_with_a_junk_cookie_is_not_an_error(client: AsyncClient) -> None:
    client.cookies.set(REFRESH_COOKIE, "not.a.jwt")
    assert (await client.post("/api/auth/logout")).status_code == 204


# ---- me ----

@pytest.mark.asyncio
async def test_me_requires_authentication(client: AsyncClient) -> None:
    assert (await client.get("/api/auth/me")).status_code == 401


@pytest.mark.asyncio
async def test_me_rejects_a_garbage_token(client: AsyncClient) -> None:
    client.cookies.set(ACCESS_COOKIE, "not.a.jwt")
    assert (await client.get("/api/auth/me")).status_code == 401


# ---- profile (PATCH /me) ----

@pytest.mark.asyncio
async def test_update_profile_persists(customer_client: AsyncClient) -> None:
    resp = await customer_client.patch(
        "/api/auth/me",
        json={
            "full_name": "Aditi Rao",
            "phone": "+91 98765 43210",
            "postal_address": {"line1": "12 Rose Ln", "city": "Mumbai", "postcode": "400001"},
            "billing_same": True,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["full_name"] == "Aditi Rao"
    assert body["phone"] == "+91 98765 43210"
    assert body["postal_address"]["city"] == "Mumbai"
    # Reload proves it was written, not just echoed.
    again = await customer_client.get("/api/auth/me")
    assert again.json()["full_name"] == "Aditi Rao"


@pytest.mark.asyncio
async def test_billing_same_true_clears_billing(customer_client: AsyncClient) -> None:
    resp = await customer_client.patch(
        "/api/auth/me",
        json={
            "billing_same": True,
            "billing_address": {"line1": "should be ignored"},
        },
    )
    assert resp.status_code == 200
    assert resp.json()["billing_address"] == {}


@pytest.mark.asyncio
async def test_separate_billing_is_kept(customer_client: AsyncClient) -> None:
    resp = await customer_client.patch(
        "/api/auth/me",
        json={
            "billing_same": False,
            "billing_address": {"line1": "9 Billing Rd", "city": "Delhi"},
        },
    )
    assert resp.status_code == 200
    assert resp.json()["billing_address"]["city"] == "Delhi"


@pytest.mark.asyncio
async def test_partial_update_leaves_other_fields(customer_client: AsyncClient) -> None:
    await customer_client.patch("/api/auth/me", json={"full_name": "First Name"})
    resp = await customer_client.patch("/api/auth/me", json={"phone": "12345"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["phone"] == "12345"
    assert body["full_name"] == "First Name"  # untouched by the phone-only PATCH


@pytest.mark.asyncio
async def test_update_profile_requires_auth(client: AsyncClient) -> None:
    resp = await client.patch("/api/auth/me", json={"full_name": "Nobody"})
    assert resp.status_code == 401

"""The site_content migration, actually executed.

The previous phase shipped a migration that had only been eyeballed and checked
by hand in psql. It failed on deploy, because the driver the application uses
behaves differently from the one a person types into. This runs the real
`upgrade()` -- the same function Alembic calls -- against a scratch database,
so the seed and the overlay are exercised rather than assumed.

What it cannot cover is the dialect: these run on SQLite while production is
PostgreSQL. So the parts most likely to differ are written to avoid the
difference rather than to be caught here -- the insert goes through a typed
table so the driver serialises the document itself, instead of a JSON string
handed to a jsonb parameter through raw SQL.
"""
import importlib.util
import json
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "alembic/versions/d4f6b8c0e2a4_site_content_document.py"
)


def _load():
    spec = importlib.util.spec_from_file_location("site_content_migration", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _run_upgrade(engine, module) -> None:
    """Drive the migration the way Alembic does, against a live connection."""
    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            module.upgrade()


def _seed_old_table(engine, **overrides) -> None:
    """The old override table, with whatever the admin had saved in it."""
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "CREATE TABLE homepage_content ("
                "id INTEGER PRIMARY KEY, "
                + ", ".join(f"{column} TEXT" for column in _load().HOMEPAGE_PATHS)
                + ")"
            )
        )
        columns = ", ".join(["id", *overrides])
        values = ", ".join([":id", *(f":{name}" for name in overrides)])
        connection.execute(
            sa.text(f"INSERT INTO homepage_content ({columns}) VALUES ({values})"),
            {"id": 1, **overrides},
        )


@pytest.fixture()
def engine(tmp_path):
    return sa.create_engine(f"sqlite:///{tmp_path / 'scratch.sqlite'}")


def _document(engine) -> dict:
    with engine.begin() as connection:
        raw = connection.execute(sa.text("SELECT document FROM site_content WHERE key = 'site'")).scalar_one()
    return json.loads(raw) if isinstance(raw, str) else raw


def test_a_shop_that_never_opened_the_editor_still_gets_full_content(engine):
    """No old table at all -- a database built from these migrations in one go."""
    module = _load()

    _run_upgrade(engine, module)

    document = _document(engine)
    assert set(document) == {
        "announcement", "brand", "contact", "footer", "home",
        "nav", "policies", "seo", "trustBadges",
    }
    assert document["home"]["hero"]["headline"]


def test_an_edited_headline_survives_the_move(engine):
    """The one thing that must not be lost: content the shop actually wrote."""
    module = _load()
    _seed_old_table(engine, hero_headline="Our own headline")

    _run_upgrade(engine, module)

    assert _document(engine)["home"]["hero"]["headline"] == "Our own headline"


def test_fields_the_admin_never_touched_fall_back_to_the_shipped_copy(engine):
    """Null meant "use the default" in the old table. It has to keep meaning
    that, or every field the shop left alone comes through blank."""
    module = _load()
    _seed_old_table(engine, hero_headline="Ours")

    _run_upgrade(engine, module)

    document = _document(engine)
    assert document["home"]["campaign"]["title"] == module.defaults()["home"]["campaign"]["title"]
    assert document["nav"] == module.defaults()["nav"]


def test_a_json_column_is_carried_across_as_a_list_not_a_string(engine):
    """SQLite hands JSON columns back as text.

    Stored unparsed, `announcement_messages` would arrive at the storefront as
    one long string and the ribbon would render a JSON array as a sentence.
    """
    module = _load()
    _seed_old_table(engine, announcement_messages=json.dumps(["First", "Second"]))

    _run_upgrade(engine, module)

    assert _document(engine)["announcement"]["messages"] == ["First", "Second"]


def test_the_old_table_is_left_intact(engine):
    """Rollback safety. A downgrade that had nothing to go back to would leave
    the shop with the shipped defaults and no way to recover its own words."""
    module = _load()
    _seed_old_table(engine, hero_headline="Ours")

    _run_upgrade(engine, module)

    with engine.begin() as connection:
        surviving = connection.execute(
            sa.text("SELECT hero_headline FROM homepage_content WHERE id = 1")
        ).scalar_one()
    assert surviving == "Ours"


def test_downgrade_removes_only_the_new_table(engine):
    module = _load()
    _seed_old_table(engine, hero_headline="Ours")
    _run_upgrade(engine, module)

    with engine.begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            module.downgrade()

    names = sa.inspect(engine).get_table_names()
    assert "site_content" not in names
    assert "homepage_content" in names

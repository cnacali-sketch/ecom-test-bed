"""Everything the homepage renders must be reachable from the homepage editor.

Two parts of the page were not. "Shop by range" rendered four pieces of copy
and a three-item list with no editor at all, and the hero's second image had
no override path -- HeroBanner.tsx carried a comment saying so. An owner could
see them on their own shop and not change them.

The last test here is the one that matters: it compares the editor's field list
against the document itself, so the next section added to the homepage cannot
quietly arrive without a way to edit it.
"""
import pytest


from app.services.site_content import (
    HOMEPAGE_PATHS,
    apply_homepage,
    defaults,
    project_homepage,
)

NEWLY_REACHABLE = [
    "hero_image_right",
    "hero_image_right_alt",
    "ranges_eyebrow",
    "ranges_sub",
    "ranges_explore_label",
    "ranges_items",
]


@pytest.mark.parametrize("field", NEWLY_REACHABLE)
def test_the_field_is_projected_out_of_the_document(field):
    assert project_homepage(defaults())[field] not in (None, "", [])


@pytest.mark.parametrize("field", NEWLY_REACHABLE)
def test_an_edit_reaches_the_document_and_comes_back(field):
    """A field that saves but does not read back is the same as no editor."""
    flat = project_homepage(defaults())
    edited = ["changed"] if isinstance(flat[field], list) else "changed"
    flat[field] = edited

    document = apply_homepage(defaults(), flat)

    assert project_homepage(document)[field] == edited


def test_clearing_a_new_field_restores_the_shipped_copy():
    """The established contract for every other field on this screen: an empty
    box means "put the default back", not "blank the page"."""
    flat = project_homepage(defaults())
    flat["ranges_eyebrow"] = None

    document = apply_homepage(defaults(), flat)

    assert project_homepage(document)["ranges_eyebrow"] == defaults()["home"]["specimenSectionEyebrow"]


def test_every_piece_of_home_copy_has_an_editor():
    """The guard against this happening again.

    Walks the `home` section of the document and asserts each leaf is reachable
    through HOMEPAGE_PATHS. `layout` is excluded because it has its own screen.
    """
    home = defaults()["home"]
    reachable = {path[1] for path in HOMEPAGE_PATHS.values() if path[0] == "home"}
    unreachable = sorted(set(home) - reachable - {"layout"})

    assert not unreachable, (
        f"{unreachable} render on the homepage with no way to edit them. "
        "Add them to HOMEPAGE_PATHS and to SectionEditor."
    )

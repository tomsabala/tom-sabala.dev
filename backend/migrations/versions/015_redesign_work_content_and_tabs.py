"""redesign: work content columns on projects, slug backfill, tab key remap

Revision ID: 015
Revises: 014
Create Date: 2026-10-18

"""
from alembic import op
import sqlalchemy as sa

from app.utils.slugify import uniqueSlug


revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


NEW_COLUMNS = [
    ('slug', sa.String(100)),
    ('field', sa.String(100)),
    ('lede', sa.Text()),
    ('facts', sa.JSON()),
    ('about_paragraphs', sa.JSON()),
    ('steps', sa.JSON()),
    ('rules_title', sa.String(120)),
    ('rules', sa.JSON()),
    ('run_code', sa.Text()),
    ('specimen', sa.String(40)),
    ('access_label', sa.String(60)),
]


def upgrade():
    # ── Detail-page content, all optional: an un-authored project degrades to
    #    hero + what it has rather than failing to render. ────────────────────
    for name, type_ in NEW_COLUMNS:
        op.add_column('projects', sa.Column(name, type_, nullable=True))

    # ── Backfill slugs from existing titles before the unique constraint ─────
    bind = op.get_bind()
    rows = bind.execute(sa.text('SELECT id, title FROM projects ORDER BY id')).fetchall()
    taken = set()
    for row in rows:
        slug = uniqueSlug(row[1], taken)
        taken.add(slug)
        bind.execute(
            sa.text('UPDATE projects SET slug = :slug WHERE id = :id'),
            {'slug': slug, 'id': row[0]}
        )

    op.create_unique_constraint('uq_projects_slug', 'projects', ['slug'])

    # ── Tab keys follow the redesign's nav: portfolio→work, apps→hangar, and
    #    cv folds into about (inheriting a hidden flag would silently hide the
    #    About section, so the row is dropped rather than renamed). ───────────
    bind.execute(sa.text("UPDATE tab_configs SET tab_key = 'work' WHERE tab_key = 'portfolio'"))
    bind.execute(sa.text("UPDATE tab_configs SET tab_key = 'hangar' WHERE tab_key = 'apps'"))
    bind.execute(sa.text("DELETE FROM tab_configs WHERE tab_key = 'cv'"))


def downgrade():
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE tab_configs SET tab_key = 'portfolio' WHERE tab_key = 'work'"))
    bind.execute(sa.text("UPDATE tab_configs SET tab_key = 'apps' WHERE tab_key = 'hangar'"))

    op.drop_constraint('uq_projects_slug', 'projects', type_='unique')
    for name, _ in reversed(NEW_COLUMNS):
        op.drop_column('projects', name)

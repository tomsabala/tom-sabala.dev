"""first-party traffic analytics: visits, page views, events

Revision ID: 016
Revises: 015
Create Date: 2026-11-05

Three tables and nothing else. No column here holds a raw IP or User-Agent:
`visitor_hash` is a daily-rotating digest of them, and the browser/os/device
labels are the coarse classification derived before they were discarded.

`site` and `identity` are NOT NULL with defaults because every existing row
count is zero — these tables are new — but the defaults stay in place so a
partially-deployed web process writing without them cannot insert a null into
a column every aggregate groups by.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'visit_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('visitor_hash', sa.String(64), nullable=False),
        sa.Column('site', sa.String(16), nullable=False, server_default='portfolio'),
        sa.Column('identity', sa.String(10), nullable=False, server_default='anon'),
        sa.Column('started_at', sa.DateTime(), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(), nullable=False),
        sa.Column('page_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('event_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('entry_path', sa.String(500), nullable=True),
        sa.Column('referrer_host', sa.String(255), nullable=True),
        sa.Column('referrer_path', sa.String(500), nullable=True),
        # No utm_* columns: they could only arrive on the query string of an
        # API request, and neither the content calls (which carry only `_p`)
        # nor the JSON beacon can put them there.
        sa.Column('country', sa.String(2), nullable=True),
        sa.Column('timezone', sa.String(64), nullable=True),
        sa.Column('device', sa.String(20), nullable=True),
        sa.Column('browser', sa.String(40), nullable=True),
        sa.Column('os', sa.String(40), nullable=True),
        sa.Column('is_bot', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('bot_reason', sa.String(60), nullable=True),
        sa.Column('identity_source', sa.String(10), nullable=False, server_default='none'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Session resolution: "is there an open visit for this hash on this site?"
    op.create_index('ix_visit_sessions_visitor_seen', 'visit_sessions',
                    ['visitor_hash', 'last_seen_at'])
    # Console scope. `identity` leads because the default query pins it to one
    # value while leaving `site` as `all`.
    op.create_index('ix_visit_sessions_window', 'visit_sessions',
                    ['identity', 'started_at', 'site'])

    op.create_table(
        'page_views',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('path', sa.String(500), nullable=False),
        sa.Column('source', sa.String(10), nullable=False, server_default='server'),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('scroll_pct', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['visit_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    # Serves the dedupe lookup on write and every per-path aggregate. No index
    # on `created_at` alone — nothing filters or orders by it, and the
    # retention purge cascades through this index's leading column.
    op.create_index('ix_page_views_session_path', 'page_views', ['session_id', 'path'])

    op.create_table(
        'analytics_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(60), nullable=False),
        sa.Column('path', sa.String(500), nullable=True),
        # JSONB: Postgres cannot GROUP BY `json`, which the console does.
        sa.Column('props', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['visit_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_analytics_events_name_created', 'analytics_events',
                    ['name', 'created_at'])
    op.create_index('ix_analytics_events_session', 'analytics_events', ['session_id'])


def downgrade():
    op.drop_index('ix_analytics_events_session', table_name='analytics_events')
    op.drop_index('ix_analytics_events_name_created', table_name='analytics_events')
    op.drop_table('analytics_events')

    op.drop_index('ix_page_views_session_path', table_name='page_views')
    op.drop_table('page_views')

    op.drop_index('ix_visit_sessions_window', table_name='visit_sessions')
    op.drop_index('ix_visit_sessions_visitor_seen', table_name='visit_sessions')
    op.drop_table('visit_sessions')

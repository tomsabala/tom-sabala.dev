"""add job agent tables: board config, posting history, runs, findings, profile

Revision ID: 014
Revises: 013
Create Date: 2026-09-16

"""
from alembic import op
import sqlalchemy as sa


revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    # ── Board configuration on the tracked company ────────────────────────────
    op.add_column('companies', sa.Column('careers_url', sa.String(500), nullable=True))
    op.add_column('companies', sa.Column('ats_provider', sa.String(50), nullable=True))
    op.add_column('companies', sa.Column('ats_token', sa.String(200), nullable=True))
    op.add_column('companies', sa.Column('board_detected_at', sa.DateTime(), nullable=True))
    op.add_column('companies', sa.Column('last_synced_at', sa.DateTime(), nullable=True))
    op.add_column('companies', sa.Column('sync_error', sa.Text(), nullable=True))

    # ── Posting history: what each board had open, and when we first saw it ───
    op.create_table(
        'job_postings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('source', sa.String(50), nullable=False),
        sa.Column('external_id', sa.String(200), nullable=False),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('url', sa.String(1000), nullable=False),
        sa.Column('location', sa.String(300), nullable=True),
        sa.Column('department', sa.String(200), nullable=True),
        sa.Column('is_remote', sa.Boolean(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('content_hash', sa.String(64), nullable=False),
        sa.Column('posted_at', sa.DateTime(), nullable=True),
        sa.Column('first_seen_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('last_seen_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('closed_at', sa.DateTime(), nullable=True),
        sa.Column('dismissed_at', sa.DateTime(), nullable=True),
        sa.Column('last_scored_hash', sa.String(64), nullable=True),
        sa.Column('last_score', sa.Integer(), nullable=True),
        sa.Column('last_verdict', sa.String(20), nullable=True),
        sa.Column('last_reason', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('company_id', 'external_id', name='uq_job_postings_company_external'),
    )
    op.create_index('ix_job_postings_company_open', 'job_postings', ['company_id', 'closed_at'])

    # ── The durable applied-join key (request item 9) ─────────────────────────
    op.add_column('job_applications', sa.Column('job_posting_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_job_applications_job_posting',
        'job_applications', 'job_postings',
        ['job_posting_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_job_applications_job_posting_id', 'job_applications', ['job_posting_id'])

    # ── Runs ─────────────────────────────────────────────────────────────────
    op.create_table(
        'agent_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='queued'),
        # NULL once terminal: Postgres treats NULLs as distinct, so the unique
        # index below allows exactly one queued/running row at a time.
        sa.Column('active_lock', sa.Boolean(), nullable=True),
        sa.Column('queue_job_id', sa.String(64), nullable=True),
        sa.Column('created_by', sa.String(255), nullable=True),
        sa.Column('interests_snapshot', sa.Text(), nullable=False),
        sa.Column('min_score', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('model', sa.String(100), nullable=True),
        sa.Column('companies_total', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('companies_processed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('companies_failed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('postings_seen', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('postings_new', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('postings_rejected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('postings_applied_skipped', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('findings_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('input_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('output_tokens', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('uq_agent_runs_active', 'agent_runs', ['active_lock'], unique=True)

    op.create_table(
        'agent_run_company_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('source', sa.String(50), nullable=True),
        sa.Column('postings_found', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['run_id'], ['agent_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('run_id', 'company_id', name='uq_agent_run_company'),
    )

    op.create_table(
        'agent_run_findings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('run_id', sa.Integer(), nullable=False),
        sa.Column('posting_id', sa.Integer(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=True),
        sa.Column('verdict', sa.String(20), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('is_new', sa.Boolean(), nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['run_id'], ['agent_runs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['posting_id'], ['job_postings.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('run_id', 'posting_id', name='uq_agent_run_finding'),
    )

    # ── Interests, persisted as the default for the next run ─────────────────
    op.create_table(
        'job_search_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('interests', sa.Text(), nullable=False, server_default=''),
        sa.Column('min_score', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
    )
    # Seed the singleton so reads never 404.
    op.bulk_insert(
        sa.table(
            'job_search_profiles',
            sa.column('id', sa.Integer),
            sa.column('interests', sa.Text),
            sa.column('min_score', sa.Integer),
        ),
        [{'id': 1, 'interests': '', 'min_score': 60}],
    )


def downgrade():
    op.drop_table('agent_run_findings')
    op.drop_table('agent_run_company_results')
    op.drop_index('uq_agent_runs_active', table_name='agent_runs')
    op.drop_table('agent_runs')
    op.drop_table('job_search_profiles')

    op.drop_index('ix_job_applications_job_posting_id', table_name='job_applications')
    op.drop_constraint('fk_job_applications_job_posting', 'job_applications', type_='foreignkey')
    op.drop_column('job_applications', 'job_posting_id')

    op.drop_index('ix_job_postings_company_open', table_name='job_postings')
    op.drop_table('job_postings')

    op.drop_column('companies', 'sync_error')
    op.drop_column('companies', 'last_synced_at')
    op.drop_column('companies', 'board_detected_at')
    op.drop_column('companies', 'ats_token')
    op.drop_column('companies', 'ats_provider')
    op.drop_column('companies', 'careers_url')

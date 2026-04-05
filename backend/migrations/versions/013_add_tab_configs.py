"""add tab configs

Revision ID: 013
Revises: 012
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime


revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'tab_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tab_key', sa.String(50), nullable=False),
        sa.Column('is_visible', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tab_key'),
    )


def downgrade():
    op.drop_table('tab_configs')

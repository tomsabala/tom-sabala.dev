"""add company categories

Revision ID: 012
Revises: 011
Create Date: 2026-04-04

"""
from alembic import op
import sqlalchemy as sa


revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('companies', sa.Column('categories', sa.JSON(), nullable=True))


def downgrade():
    op.drop_column('companies', 'categories')

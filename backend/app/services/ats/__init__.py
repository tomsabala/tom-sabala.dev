"""Applicant-tracking-system board adapters (the "query an API first" path)."""
from app.services.ats.base import AtsAdapter, AtsError
from app.services.ats.registry import ADAPTERS, SUPPORTED_PROVIDERS, getAdapter

__all__ = ['AtsAdapter', 'AtsError', 'ADAPTERS', 'SUPPORTED_PROVIDERS', 'getAdapter']

"""Provider → adapter lookup.

`custom` and `none` deliberately resolve to None: a custom board is served by
the discovery agent's own posting list, and `none` means nothing was found.
"""
from app.services.ats.ashby import AshbyAdapter
from app.services.ats.greenhouse import GreenhouseAdapter
from app.services.ats.lever import LeverAdapter
from app.services.ats.smartrecruiters import SmartRecruitersAdapter
from app.services.ats.workable import WorkableAdapter

ADAPTERS = {
    GreenhouseAdapter.provider: GreenhouseAdapter,
    LeverAdapter.provider: LeverAdapter,
    AshbyAdapter.provider: AshbyAdapter,
    WorkableAdapter.provider: WorkableAdapter,
    SmartRecruitersAdapter.provider: SmartRecruitersAdapter,
}

SUPPORTED_PROVIDERS = sorted(ADAPTERS.keys())


def getAdapter(provider):
    adapterClass = ADAPTERS.get(provider or '')
    return adapterClass() if adapterClass else None

"""Equalising capital gains tax with income tax (the "Burnham" reform).

Models raising UK CGT rates to income tax rates (basic 18->20%, higher
24->40%, additional 24->45%) from 2026-27, over fiscal years 2026-27 to
2030-31, via the policyengine.py wrapper (stock Enhanced FRS 2023-24
weights) with an Advani/CenTax-aligned behavioural response.
"""

from .reform import BURNHAM_RATES, ELASTICITY, YEARS, burnham_reform, retention_to_mtr_elasticity

__all__ = [
    "BURNHAM_RATES",
    "ELASTICITY",
    "YEARS",
    "burnham_reform",
    "retention_to_mtr_elasticity",
    "run",
]


def __getattr__(name: str):
    # `run` pulls in the policyengine.py stack, which only the
    # [simulation] extra installs; import it lazily so the pure-logic tests
    # run without it.
    if name == "run":
        from .pipeline import run

        return run
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

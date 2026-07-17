"""Simulation construction, including the policyengine-uk 2.89.2 bug
workarounds and paired-calculation helpers.

CRITICAL — three correctness details ported from the validated notebook:

Bug 1 (baseline branch not registered): ``Microsimulation.__init__`` stores
``self.baseline`` but never registers it in ``self.branches``, so
``relative_capital_gains_mtr_change``'s ``get_branch("baseline")`` forks the
REFORM simulation and the behavioural response is silently zero. Fix: set
``sim.branches["baseline"] = sim.baseline`` immediately after construction.

Bug 2 (response variable neutralised after the first year):
``relative_capital_gains_mtr_change`` neutralizes
``capital_gains_behavioural_response`` on the branch's tax-benefit system,
but branches share the parent's system (``clone_system=False``), so the
response only fires for the FIRST year calculated. Fix: stash the original
variable object at construction and restore it before EVERY reform-side
calculation (:func:`rcalc`).

Positional random draws: PolicyEngine's random draws (e.g. benefit take-up)
are POSITIONAL within each simulation — two sims are only comparable if they
execute the same calculation sequence. All calibration prep calculations run
on a separate throwaway "probe" simulation; the baseline and reformed sims
are created after, and every subsequent calculation is done in matched pairs
(:func:`paired_calculate`). Never calculate on the baseline without the
paired reformed calculation.
"""

from __future__ import annotations

RESPONSE_VAR = "capital_gains_behavioural_response"


def reform_simulation(reform: dict):
    """Build a reformed Microsimulation with the CGT-elasticity bug fixes."""
    from policyengine_uk import Microsimulation

    sim = Microsimulation(reform=reform)
    # Bug 1: register the baseline branch, or the CGT elasticity silently
    # does nothing (get_branch("baseline") would fork the reform sim).
    sim.branches["baseline"] = sim.baseline
    # Stash the original response variable object for bug 2 (see rcalc).
    sim._original_response_variable = sim.tax_benefit_system.variables[RESPONSE_VAR]
    return sim


def rcalc(sim, variable: str, year: int):
    """Reform-side calculate with the bug-2 workaround.

    Restores the original ``capital_gains_behavioural_response`` variable —
    which policyengine-uk neutralises on the SHARED tax-benefit system after
    the first year calculated — before every reform-side calculation.
    """
    sim.tax_benefit_system.variables[RESPONSE_VAR] = sim._original_response_variable
    return sim.calculate(variable, year)


def paired_calculate(baseline, reformed, variable: str, year: int):
    """Calculate ``variable`` on both sims, keeping their positional random
    streams aligned (see module docstring). Returns (baseline, reformed)."""
    base = baseline.calculate(variable, year)
    ref = rcalc(reformed, variable, year)
    return base, ref

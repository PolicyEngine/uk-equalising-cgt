"""Recalibrating the baseline CGT aggregates with populace-calibrate.

PolicyEngine's Enhanced FRS baseline overshoots CGT: ~£106bn of taxable
gains across ~1.28m taxpayers in 2026, versus HMRC outturn of £65.9bn across
378k taxpayers (2023-24). The Advani & Summers-based imputation is
aggregate-unconstrained, and the OBR CGT calibration target is silently
dropped in ``policyengine-uk-data`` (the EFO parser reads sheet 3.9; the CGT
row moved to 3.8). Uncorrected, baseline CGT is ~£25bn versus the OBR's
£16-21bn forecast.

We reweight with populace-calibrate: targets of £70bn total gains and 400k
CGT taxpayers (OBR-consistent uprated HMRC), holding income tax, household
net income, population, and household counts at their baseline aggregates.

IMPORTANT: every calculation here runs on a throwaway "probe"
Microsimulation, NOT on the baseline used for impacts — PolicyEngine's
random draws are positional per simulation, and running prep calculations
on the baseline alone would desynchronise its stream from the reformed
sim's, creating spurious per-household differences (see simulations.py).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

CAL_YEAR = 2026
GAINS_TARGET = 70e9  # OBR-consistent uprated HMRC total taxable gains
PAYERS_TARGET = 400_000  # HMRC CGT taxpayer count, uprated
AEA = 3_000  # annual exempt amount (unchanged by the reform)


@dataclass
class CalibrationResult:
    """Calibrated household weight ratio plus diagnostics and the probe
    person-level arrays needed for baseline validation."""

    weight_ratio: np.ndarray  # per-household new/old weight ratio
    diagnostics: list[dict]  # per-target name/target/final/relative_error
    ess_before: float
    ess_after: float
    # Probe arrays for validation_stats (person order matches all sims).
    hh_id: np.ndarray
    w0: np.ndarray
    p_gains: np.ndarray
    p_hh: np.ndarray
    pw_probe: np.ndarray


def calibrate_baseline(probe) -> CalibrationResult:
    """Run populace-calibrate on the probe simulation's CAL_YEAR data."""
    from populace.calibrate import Target, TargetSet, calibrate, effective_sample_size
    from populace.frame import EntitySchema, Frame, WeightKind, Weights

    w0 = probe.calculate("household_weight", CAL_YEAR).values.astype(np.float64)
    n_hh = len(w0)
    hh_id = probe.calculate("household_id", CAL_YEAR).values
    p_gains = probe.calculate("capital_gains", CAL_YEAR).values
    p_hh = probe.calculate("household_id", CAL_YEAR, map_to="person").values
    payers_hh = (
        pd.Series((p_gains > AEA).astype(float))
        .groupby(pd.Series(p_hh))
        .sum()
        .reindex(pd.Index(hh_id))
        .fillna(0.0)
        .values
    )

    hh_table = pd.DataFrame(
        {
            "household_id": np.arange(n_hh),
            "capital_gains": probe.calculate("capital_gains", CAL_YEAR, map_to="household").values,
            "income_tax": probe.calculate("income_tax", CAL_YEAR, map_to="household").values,
            "net_income": probe.calculate("household_net_income", CAL_YEAR).values,
            "cgt_payers": payers_hh,
            "people": probe.calculate("people", CAL_YEAR, map_to="household").values,
            "ones": np.ones(n_hh),
        }
    )
    frame = Frame(
        tables={
            "person": pd.DataFrame(
                {"person_id": np.arange(n_hh), "person_household_id": np.arange(n_hh)}
            ),
            "household": hh_table,
        },
        schema=EntitySchema(person_entity="person", group_entities=("household",)),
        weights={"household": Weights(values=w0, kind=WeightKind.DESIGN)},
    )
    targets = TargetSet(
        [
            Target(
                name="total_capital_gains",
                entity="household",
                measure="capital_gains",
                value=GAINS_TARGET,
                source="HMRC/OBR",
            ),
            Target(
                name="cgt_taxpayer_count",
                entity="household",
                measure="cgt_payers",
                value=PAYERS_TARGET,
                source="HMRC",
            ),
            Target(
                name="income_tax_total",
                entity="household",
                measure="income_tax",
                value=float((w0 * hh_table.income_tax).sum()),
                source="hold",
            ),
            Target(
                name="net_income_total",
                entity="household",
                measure="net_income",
                value=float((w0 * hh_table.net_income).sum()),
                source="hold",
            ),
            Target(
                name="population",
                entity="household",
                measure="people",
                value=float((w0 * hh_table.people).sum()),
                source="hold",
            ),
            Target(
                name="households",
                entity="household",
                measure="ones",
                value=float(w0.sum()),
                source="hold",
            ),
        ]
    )
    # mass="free" + explicit household-count target: mass="conserve" diverges
    # on these heavy-tailed weights (populace-calibrate footgun).
    result = calibrate(
        frame,
        targets,
        weight_entity="household",
        seed=0,
        epochs=500,
        learning_rate=0.01,
        mass="free",
        max_weight_ratio=5.0,
    )
    return CalibrationResult(
        weight_ratio=result.weights / w0,
        diagnostics=[
            {
                "name": d.name,
                "target": float(d.target),
                "final": float(d.final_estimate),
                "relative_error": float(d.relative_error),
            }
            for d in result.diagnostics
        ],
        ess_before=float(effective_sample_size(w0)),
        ess_after=float(effective_sample_size(result.weights)),
        hh_id=np.asarray(hh_id),
        w0=w0,
        p_gains=np.asarray(p_gains, dtype=np.float64),
        p_hh=np.asarray(p_hh),
        pw_probe=probe.calculate("person_weight", CAL_YEAR).values.astype(np.float64),
    )


def apply_calibrated_weights(sim, weight_ratio: np.ndarray, years: list[int]):
    """Scale household weights by the calibrated ratio in every year.

    person/benunit weights recompute from household_weight (they have
    formulas), so clearing their caches propagates the new weights to every
    entity level.
    """
    for year in years:
        wy = sim.calculate("household_weight", year).values.astype(np.float64)
        sim.set_input("household_weight", year, wy * weight_ratio)
    sim.get_holder("person_weight").delete_arrays()
    sim.get_holder("benunit_weight").delete_arrays()
    return sim


def validation_stats(probe, cal: CalibrationResult) -> dict:
    """Recalibrated-baseline CGT statistics vs HMRC/Advani benchmarks.

    Aggregates align; the extreme tail does not: the FRS-based imputation
    contains no one with gains above ~£2m, so no reweighting can reproduce
    the >=£5m tail (HMRC/Advani: ~40% of gains). Static reform yield is
    therefore somewhat understated (missing 45%-band gains), as is the
    top-end behavioural response.
    """
    hh_ratio = pd.Series(cal.weight_ratio, index=cal.hh_id)
    pw0 = cal.pw_probe * hh_ratio.reindex(pd.Index(cal.p_hh)).values
    payers = cal.p_gains > AEA
    g, w = cal.p_gains[payers], pw0[payers]
    tot = (g * w).sum()
    order = np.argsort(g)
    cw = np.cumsum(w[order]) / w.sum()
    baseline_cgt = (
        probe.calculate("capital_gains_tax", CAL_YEAR, map_to="household").values
        * cal.w0
        * cal.weight_ratio
    ).sum()
    return {
        "cgt_taxpayers": float(w.sum()),
        "total_gains_bn": float(tot / 1e9),
        "mean_gain": float(tot / w.sum()),
        "median_gain": float(g[order][np.searchsorted(cw, 0.5)]),
        "share_gains_over_1m_pct": float(100 * (g[g >= 1e6] * w[g >= 1e6]).sum() / tot),
        "share_gains_over_5m_pct": float(100 * (g[g >= 5e6] * w[g >= 5e6]).sum() / tot),
        "largest_gain_m": float(g.max() / 1e6),
        "baseline_cgt_revenue_bn": float(baseline_cgt / 1e9),
    }

"""Budgetary, decile, winners/losers and sensitivity impacts.

All reform-side calculations go through :func:`uk_equalising_cgt.simulations.rcalc`
(the bug-2 workaround), and every baseline calculation is immediately paired
with its reformed counterpart so the two simulations' positional random
streams stay aligned.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .simulations import rcalc

BAND_NAMES = [
    "gain_more_5_pct",
    "gain_less_5_pct",
    "no_change_pct",
    "lose_less_5_pct",
    "lose_more_5_pct",
]


def fiscal_year_label(year: int) -> str:
    return f"{year}-{str(year + 1)[2:]}"


def budget_impact(baseline, reformed, years: list[int]) -> list[dict]:
    """Change in government revenue (positive = revenue raised), overall and
    for CGT specifically."""
    rows = []
    for year in years:
        base_cgt = baseline.calculate("capital_gains_tax", year).sum()
        ref_cgt = rcalc(reformed, "capital_gains_tax", year).sum()
        base_tax = baseline.calculate("gov_tax", year).sum()
        ref_tax = rcalc(reformed, "gov_tax", year).sum()
        base_bal = baseline.calculate("gov_balance", year).sum()
        ref_bal = rcalc(reformed, "gov_balance", year).sum()
        rows.append(
            {
                "year": fiscal_year_label(year),
                "baseline_cgt_bn": float(base_cgt / 1e9),
                "reform_cgt_bn": float(ref_cgt / 1e9),
                "cgt_change_bn": float((ref_cgt - base_cgt) / 1e9),
                "total_tax_change_bn": float((ref_tax - base_tax) / 1e9),
                "gov_balance_change_bn": float((ref_bal - base_bal) / 1e9),
            }
        )
    return rows


def decile_impact(baseline, reformed, year: int) -> list[dict]:
    """Change in household net income by baseline income decile.

    Households in decile -1 (negative or zero baseline income, PolicyEngine
    convention) are excluded — relative changes there are
    negative-denominator artefacts.
    """
    decile = baseline.calculate("household_income_decile", year)
    base_inc = baseline.calculate("household_net_income", year)
    ref_inc = rcalc(reformed, "household_net_income", year)
    gain = ref_inc - base_inc
    keep = decile >= 1  # exclude decile -1
    decile, base_inc, gain = decile[keep], base_inc[keep], gain[keep]
    avg = gain.groupby(decile).mean()
    rel = 100 * gain.groupby(decile).sum() / base_inc.groupby(decile).sum()
    total = gain.groupby(decile).sum() / 1e9
    return [
        {
            "decile": int(d),
            "avg_change_gbp": float(avg[d]),
            "relative_change_pct": float(rel[d]),
            "total_change_bn": float(total[d]),
        }
        for d in avg.index
    ]


def band_masks(diff: np.ndarray, base_inc: np.ndarray) -> dict[str, np.ndarray]:
    """PolicyEngine's intra-decile winner/loser bands (pure logic, testable).

    Absolute £1 guard: households with negative baseline income otherwise
    show a positive relative "gain" when they lose money (negative
    denominator). ``gain = diff > £1``, ``lose = diff < -£1``, with ±5%
    relative thresholds inside each side.
    """
    diff = np.asarray(diff, dtype=float)
    base_inc = np.asarray(base_inc, dtype=float)
    with np.errstate(divide="ignore", invalid="ignore"):
        rel = diff / base_inc
    gain, lose = diff > 1, diff < -1
    return {
        "gain_more_5_pct": gain & (rel > 0.05),
        "gain_less_5_pct": gain & (rel <= 0.05),
        "no_change_pct": ~gain & ~lose,
        "lose_less_5_pct": lose & (np.abs(rel) <= 0.05),
        "lose_more_5_pct": lose & (np.abs(rel) > 0.05),
    }


def winners_losers(baseline, reformed, year: int) -> list[dict]:
    """Winner/loser band shares of people by decile plus an "All" row.

    Empty bands (this reform has zero gainers) yield 0.0 shares rather than
    NaN — the ``mask.any()`` guard below.
    """
    decile = baseline.calculate("household_income_decile", year)
    base_inc = baseline.calculate("household_net_income", year)
    ref_inc = rcalc(reformed, "household_net_income", year)
    people = baseline.calculate("household_count_people", year)
    keep = decile >= 1  # exclude decile -1
    decile, base_inc, ref_inc, people = decile[keep], base_inc[keep], ref_inc[keep], people[keep]
    diff = ref_inc - base_inc
    # Positional boolean masks (same person order as the filtered series).
    masks = band_masks(diff.values, base_inc.values)
    total = people.groupby(decile).sum()
    table = pd.DataFrame(
        {
            name: (
                100 * people[mask].groupby(decile[mask]).sum().reindex(total.index).fillna(0) / total
                if mask.any()
                else pd.Series(0.0, index=total.index)
            )
            for name, mask in masks.items()
        }
    )
    rows = [
        {"decile": str(int(d)), **{name: float(table.loc[d, name]) for name in BAND_NAMES}}
        for d in table.index
    ]
    rows.append(
        {
            "decile": "All",
            **{
                name: (float(100 * people[mask].sum() / people.sum()) if mask.any() else 0.0)
                for name, mask in masks.items()
            },
        }
    )
    return rows


def sensitivity(baseline, cases: dict[str, float], year: int, make_case_sim) -> list[dict]:
    """Re-run the reform under each institution's elasticity assumption.

    ``make_case_sim(elasticity)`` must return a freshly built, calibrated
    reform simulation (with the bug workarounds applied).
    """
    base_cgt = baseline.calculate("capital_gains_tax", year).sum()
    rows = []
    for name, e in cases.items():
        sim = make_case_sim(e)
        rows.append(
            {
                "name": name,
                "e_mtr": e,
                "revenue_2026_bn": float((rcalc(sim, "capital_gains_tax", year).sum() - base_cgt) / 1e9),
            }
        )
        del sim
    return rows

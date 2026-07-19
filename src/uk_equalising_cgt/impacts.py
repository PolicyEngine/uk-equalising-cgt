"""Budgetary, validation, decile, winners/losers and sensitivity impacts.

Decile and winners/losers tables come from policyengine.py's own standard
outputs (``policyengine.outputs.decile_impact`` and
``policyengine.outputs.intra_decile_impact``) so they match what
PolicyEngine's app would report; grouping uses the model's pre-computed
``household_income_decile`` (decile -1, negative/zero baseline income, is
excluded because the standard outputs iterate deciles 1-10 only).

Aggregates the wrapper does not provide directly — budget totals,
per-decile total change, and the baseline validation statistics — are
computed from the simulations' output datasets with native microdf
weighted operations (``MicroSeries.sum/mean/median/count`` and weighted
``groupby``); there is no manual weight arithmetic anywhere.
"""

from __future__ import annotations

AEA = 3_000  # annual exempt amount, unchanged by the reform

BAND_NAMES = [
    "gain_more_5_pct",
    "gain_less_5_pct",
    "no_change_pct",
    "lose_less_5_pct",
    "lose_more_5_pct",
]

# policyengine.py IntraDecileImpact field -> dashboard band key.
INTRA_DECILE_BAND_MAP = {
    "gain_more_than_5pct": "gain_more_5_pct",
    "gain_less_than_5pct": "gain_less_5_pct",
    "no_change": "no_change_pct",
    "lose_less_than_5pct": "lose_less_5_pct",
    "lose_more_than_5pct": "lose_more_5_pct",
}


def fiscal_year_label(year: int) -> str:
    return f"{year}-{str(year + 1)[2:]}"


def _person(sim):
    return sim.output_dataset.data.person


def _household(sim):
    return sim.output_dataset.data.household


def validation_stats(baseline) -> dict:
    """Baseline (calibrated Enhanced FRS weights) CGT statistics vs HMRC/Advani.

    All statistics are weighted microdf operations over the person table.
    A "CGT taxpayer" is a person with taxable gains above the £3,000
    annual exempt amount.
    """
    person = _person(baseline)
    gains = person["capital_gains"]
    payer_gains = gains[gains > AEA]
    total = float(payer_gains.sum())
    return {
        "cgt_taxpayers": float(payer_gains.count()),
        "total_gains_bn": total / 1e9,
        "mean_gain": float(payer_gains.mean()),
        "median_gain": float(payer_gains.median()),
        "share_gains_over_1m_pct": float(100 * payer_gains[payer_gains >= 1e6].sum() / total),
        "share_gains_over_5m_pct": float(100 * payer_gains[payer_gains >= 5e6].sum() / total),
        "largest_gain_m": float(payer_gains.max() / 1e6),
        "baseline_cgt_revenue_bn": float(person["capital_gains_tax"].sum() / 1e9),
    }


def cgt_revenue(sim) -> float:
    """Weighted total capital gains tax revenue for a simulation."""
    return float(_person(sim)["capital_gains_tax"].sum())


def budget_impact(baseline_sims: dict, reform_sims: dict, years: list[int]) -> list[dict]:
    """Change in government revenue (positive = revenue raised), overall
    and for CGT specifically. Weighted sums via microdf."""
    rows = []
    for year in years:
        base, ref = baseline_sims[year], reform_sims[year]
        base_cgt, ref_cgt = cgt_revenue(base), cgt_revenue(ref)
        base_hh, ref_hh = _household(base), _household(ref)
        rows.append(
            {
                "year": fiscal_year_label(year),
                "baseline_cgt_bn": base_cgt / 1e9,
                "reform_cgt_bn": ref_cgt / 1e9,
                "cgt_change_bn": (ref_cgt - base_cgt) / 1e9,
                "total_tax_change_bn": float(
                    (ref_hh["gov_tax"].sum() - base_hh["gov_tax"].sum()) / 1e9
                ),
                "gov_balance_change_bn": float(
                    (ref_hh["gov_balance"].sum() - base_hh["gov_balance"].sum()) / 1e9
                ),
            }
        )
    return rows


def decile_impact(baseline, reformed) -> list[dict]:
    """Change in household net income by baseline income decile.

    Uses policyengine.py's standard ``calculate_decile_impacts`` (grouped
    by the model's ``household_income_decile``; deciles 1-10 only, so the
    decile -1 convention for negative incomes is excluded), plus a
    microdf weighted groupby for the per-decile total change in £bn.
    """
    from policyengine.outputs.decile_impact import calculate_decile_impacts

    impacts = calculate_decile_impacts(
        baseline_simulation=baseline,
        reform_simulation=reformed,
        income_variable="household_net_income",
        decile_variable="household_income_decile",
        entity="household",
    )
    base_hh, ref_hh = _household(baseline), _household(reformed)
    gain = ref_hh["household_net_income"] - base_hh["household_net_income"]
    deciles = base_hh["household_income_decile"].values.astype(int)
    total_bn = gain.groupby(deciles).sum() / 1e9
    return [
        {
            "decile": int(row.decile),
            "avg_change_gbp": float(row.absolute_change),
            "relative_change_pct": float(row.relative_change),
            "total_change_bn": float(total_bn.get(row.decile, 0.0)),
        }
        for row in impacts.outputs
    ]


def map_intra_decile_row(row: dict) -> dict[str, float]:
    """Map a policyengine.py intra-decile row (proportions, wrapper band
    names) to the dashboard's percentage band keys."""
    return {ours: 100 * float(row[theirs]) for theirs, ours in INTRA_DECILE_BAND_MAP.items()}


def winners_losers(baseline, reformed) -> list[dict]:
    """Winner/loser band shares of people by decile plus an "All" row.

    Uses policyengine.py's standard intra-decile output (people-weighted,
    ±5% relative-change bands with a ±0.1% no-change band), grouped by
    the model's ``household_income_decile``. The wrapper's decile-0
    overall row becomes the dashboard's "All" row.
    """
    from policyengine.outputs.intra_decile_impact import compute_intra_decile_impacts

    impacts = compute_intra_decile_impacts(
        baseline_simulation=baseline,
        reform_simulation=reformed,
        income_variable="household_net_income",
        decile_variable="household_income_decile",
        entity="household",
    )
    rows = []
    for out in impacts.outputs:
        bands = map_intra_decile_row(out.model_dump(include=set(INTRA_DECILE_BAND_MAP)))
        rows.append({"decile": "All" if out.decile == 0 else str(out.decile), **bands})
    return rows


def sensitivity(baseline_cgt: float, cases: dict[str, float], run_case) -> list[dict]:
    """Re-run the 2026 reform under each institution's elasticity assumption.

    ``run_case(elasticity)`` must return the completed reform simulation
    for 2026 with that elasticity.
    """
    rows = []
    for name, e in cases.items():
        sim = run_case(e)
        rows.append(
            {
                "name": name,
                "e_mtr": e,
                "revenue_2026_bn": (cgt_revenue(sim) - baseline_cgt) / 1e9,
            }
        )
    return rows

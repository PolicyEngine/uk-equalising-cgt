"""Budgetary, validation, distributional and sensitivity impacts.

Distributional outputs group the change in household net income by
weighted baseline-income quantile (quintiles and quartiles), by household
type, and by region. Aggregates are computed from the simulations' output
datasets with native microdf weighted operations
(``MicroSeries.sum/mean/median/count`` and weighted ``groupby``); there is
no manual weight arithmetic anywhere.
"""

from __future__ import annotations

import numpy as np

AEA = 3_000  # annual exempt amount, unchanged by the reform

# ONS region codes carried on the output dataset's households. Households
# cloned without an assigned output area have an empty code and are
# excluded from the regional breakdown.
REGION_NAMES = {
    "E12000001": "North East",
    "E12000002": "North West",
    "E12000003": "Yorkshire and the Humber",
    "E12000004": "East Midlands",
    "E12000005": "West Midlands",
    "E12000006": "East of England",
    "E12000007": "London",
    "E12000008": "South East",
    "E12000009": "South West",
    "W99999999": "Wales",
    "S99999999": "Scotland",
    "N99999999": "Northern Ireland",
}

QUANTILE_LABELS = {
    4: ["Lowest 25%", "25–50%", "50–75%", "Highest 25%"],
    5: ["Lowest 20%", "20–40%", "40–60%", "60–80%", "Highest 20%"],
}


def fiscal_year_label(year: int) -> str:
    return f"{year}-{str(year + 1)[2:]}"


def _person(sim):
    return sim.output_dataset.data.person


def _household(sim):
    return sim.output_dataset.data.household


def validation_stats(baseline) -> dict:
    """Baseline (published Enhanced FRS weights) CGT statistics vs HMRC/Advani.

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
        # Top of the HMRC size-of-gain distribution (Table 2.1a), where the
        # published dataset calibrates tightly and the reform's revenue lives.
        "taxpayers_over_500k": float(payer_gains[payer_gains >= 5e5].count()),
        "gains_over_500k_bn": float(payer_gains[payer_gains >= 5e5].sum() / 1e9),
        "gains_over_5m_bn": float(payer_gains[payer_gains >= 5e6].sum() / 1e9),
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


def _group_rows(gain, base_income, labels, order) -> list[dict]:
    """Weighted average and relative net-income change per group."""
    avg = gain.groupby(labels).mean()
    total = gain.groupby(labels).sum()
    income = base_income.groupby(labels).sum()
    return [
        {
            "group": str(group),
            "avg_change_gbp": float(avg.get(group, 0.0)),
            "relative_change_pct": float(100 * total.get(group, 0.0) / income.get(group)),
        }
        for group in order
        if group in set(labels)
    ]


def income_change_groups(baseline, reformed) -> dict:
    """Change in household net income by weighted baseline-income quantile
    (quintiles and quartiles), by household type, and by region."""
    base_hh, ref_hh = _household(baseline), _household(reformed)
    gain = ref_hh["household_net_income"] - base_hh["household_net_income"]
    base_income = base_hh["household_net_income"]

    result = {}
    for n, key, rank in (
        (5, "quintile", base_income.quintile_rank()),
        (4, "quartile", base_income.quartile_rank()),
    ):
        labels = np.array(QUANTILE_LABELS[n], dtype=object)[
            rank.values.astype(int) - 1
        ]
        result[key] = _group_rows(gain, base_income, labels, QUANTILE_LABELS[n])

    # Household type from the members of each household: any child ->
    # "With children"; otherwise all adults at State Pension age ->
    # "Pensioner"; otherwise working-age without children.
    import pandas as pd

    person = _person(baseline)
    members = pd.DataFrame(
        {
            "household_id": person["household_id"].values,
            "is_child": person["is_child"].values.astype(bool),
            "working_age_adult": (
                person["is_adult"].values.astype(bool)
                & ~person["is_SP_age"].values.astype(bool)
            ),
        }
    ).groupby("household_id")
    has_children = members["is_child"].any()
    has_working_age_adult = members["working_age_adult"].any()
    hh_ids = base_hh["household_id"].values
    child = has_children.reindex(hh_ids).fillna(False).values
    pensioner = ~has_working_age_adult.reindex(hh_ids).fillna(False).values & ~child
    type_order = ["With children", "Pensioner", "Working-age, no children"]
    type_labels = np.where(child, type_order[0], np.where(pensioner, type_order[1], type_order[2]))
    result["household_type"] = _group_rows(gain, base_income, type_labels, type_order)

    region_labels = (
        base_hh["region_code_oa"].astype(str).map(REGION_NAMES).fillna("").values
    )
    keep = region_labels != ""
    result["region"] = _group_rows(
        gain[keep], base_income[keep], region_labels[keep], list(REGION_NAMES.values())
    )
    return result


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

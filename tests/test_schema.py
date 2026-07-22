"""Schema tests: the results-JSON shape agreed with the dashboard, checked
against a fake results dict (no simulation)."""

from uk_equalising_cgt.comparison import EXTERNAL_ESTIMATES, SENSITIVITY_CASES, comparison_rows
from uk_equalising_cgt.impacts import fiscal_year_label

YEAR_LABELS = [fiscal_year_label(y) for y in range(2026, 2031)]
from uk_equalising_cgt.reform import YEARS

TOP_LEVEL_KEYS = {
    "metadata",
    "calibration",
    "validation",
    "budget",
    "income_change_groups",
    "sensitivity",
    "comparison",
}


def fake_results() -> dict:
    """A results dict with the exact shape pipeline.run emits."""
    labels = [fiscal_year_label(y) for y in YEARS]
    return {
        "metadata": {
            "generated": "2026-07-17",
            "policyengine_version": "4.20.0",
            "policyengine_uk_version": "2.89.2",
            "dataset": "hf://policyengine/policyengine-uk-data/enhanced_frs_2024_25.h5",
            "calibrated": False,
            "reform_period_start": "2026-01-01",
            "elasticity": -0.7,
            "reform": {"basic_rate": 0.20, "higher_rate": 0.40, "additional_rate": 0.45},
            "years": list(YEARS),
        },
        # No local reweighting: calibration is upstream in policyengine-uk-data.
        "calibration": {
            "targets": [],
            "ess_before": None,
            "ess_after": None,
            "note": "No local reweighting; calibration is upstream in policyengine-uk-data.",
        },
        "validation": {
            "cgt_taxpayers": 400_000.0,
            "total_gains_bn": 70.0,
            "mean_gain": 175_000.0,
            "median_gain": 30_000.0,
            "share_gains_over_1m_pct": 20.0,
            "share_gains_over_5m_pct": 0.0,
            "largest_gain_m": 2.0,
            "baseline_cgt_revenue_bn": 17.2,
        },
        "budget": [
            {
                "year": label,
                "baseline_cgt_bn": 17.2,
                "reform_cgt_bn": 19.5,
                "cgt_change_bn": 2.3,
                "total_tax_change_bn": 2.3,
                "gov_balance_change_bn": 2.3,
            }
            for label in labels
        ],
        "income_change_groups": {
            label: {
                "quintile": [
                    {"group": g, "avg_change_gbp": 0.0, "relative_change_pct": 0.0}
                    for g in ["Lowest 20%", "20–40%", "40–60%", "60–80%", "Highest 20%"]
                ],
                "quartile": [
                    {"group": g, "avg_change_gbp": 0.0, "relative_change_pct": 0.0}
                    for g in ["Lowest 25%", "25–50%", "50–75%", "Highest 25%"]
                ],
                "household_type": [
                    {"group": g, "avg_change_gbp": 0.0, "relative_change_pct": 0.0}
                    for g in ["With children", "Pensioner", "Working-age, no children"]
                ],
                "region": [
                    {"group": "London", "avg_change_gbp": 0.0, "relative_change_pct": 0.0}
                ],
            }
            for label in YEAR_LABELS
        },
        "sensitivity": [
            {"name": name, "e_mtr": e, "revenue_2026_bn": 1.0}
            for name, e in SENSITIVITY_CASES.items()
        ],
        "comparison": comparison_rows(2.3, 2.5, 13.5),
    }


def test_top_level_keys():
    assert set(fake_results()) == TOP_LEVEL_KEYS


def test_metadata_and_years():
    md = fake_results()["metadata"]
    assert md["years"] == [2026, 2027, 2028, 2029, 2030]
    assert md["elasticity"] == -0.7
    assert set(md["reform"]) == {"basic_rate", "higher_rate", "additional_rate"}


def test_budget_rows_use_fiscal_year_labels():
    results = fake_results()
    assert [r["year"] for r in results["budget"]] == [
        "2026-27",
        "2027-28",
        "2028-29",
        "2029-30",
        "2030-31",
    ]
    assert set(results["budget"][0]) == {
        "year",
        "baseline_cgt_bn",
        "reform_cgt_bn",
        "cgt_change_bn",
        "total_tax_change_bn",
        "gov_balance_change_bn",
    }


def test_income_change_groups_keyed_by_fiscal_year():
    groups = fake_results()["income_change_groups"]
    assert set(groups) == {"2026-27", "2027-28", "2028-29", "2029-30", "2030-31"}
    year = groups["2026-27"]
    assert set(year) == {"quintile", "quartile", "household_type", "region"}
    assert set(year["quintile"][0]) == {
        "group",
        "avg_change_gbp",
        "relative_change_pct",
    }


def test_calibration_block_is_explicitly_empty():
    cal = fake_results()["calibration"]
    assert set(cal) == {"targets", "ess_before", "ess_after", "note"}
    assert cal["targets"] == []
    assert cal["ess_before"] is None and cal["ess_after"] is None
    assert "upstream" in cal["note"]


def test_sensitivity_cases():
    rows = fake_results()["sensitivity"]
    assert [r["e_mtr"] for r in rows] == [0.0, -0.35, -0.7]


def test_comparison_rows_include_model_and_externals():
    rows = comparison_rows(2.3, 2.5, 13.5)
    assert len(rows) == 3 + len(EXTERNAL_ESTIMATES)
    assert all(
        set(r) == {"source", "reform_modelled", "behavioural_assumption", "revenue_bn_per_year"}
        for r in rows
    )
    external = {r["source"]: r["revenue_bn_per_year"] for r in rows}
    assert external["CenTax central (Advani, Lonsdale & Summers 2024)"] == 14.0
    assert external["CenTax worst-case (elasticity upper bound)"] == 9.7
    assert external["Advani & Summers (GDP-uprated)"] == 16.7
    assert external["HMRC ready reckoner (+10pp higher rates, yr 3)"] == -2.0

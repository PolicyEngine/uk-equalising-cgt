"""Schema tests: the results-JSON shape agreed with the dashboard, checked
against a fake results dict (no simulation)."""

from uk_equalising_cgt.comparison import EXTERNAL_ESTIMATES, SENSITIVITY_CASES, comparison_rows
from uk_equalising_cgt.impacts import BAND_NAMES, fiscal_year_label
from uk_equalising_cgt.reform import YEARS

TOP_LEVEL_KEYS = {
    "metadata",
    "calibration",
    "validation",
    "budget",
    "decile_impact",
    "winners_losers",
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
            "dataset": "enhanced_frs_2023_24",
            "reform_period_start": "2026-01-01",
            "elasticity": -0.7,
            "reform": {"basic_rate": 0.20, "higher_rate": 0.40, "additional_rate": 0.45},
            "years": list(YEARS),
        },
        # Stock Enhanced FRS weights: no reweighting, so no targets/ESS.
        "calibration": {
            "targets": [],
            "ess_before": None,
            "ess_after": None,
            "note": "Stock Enhanced FRS 2023-24 weights; no populace recalibration.",
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
        "decile_impact": {
            label: [
                {"decile": d, "avg_change_gbp": -10.0, "relative_change_pct": -0.1, "total_change_bn": -0.1}
                for d in range(1, 11)
            ]
            for label in labels
        },
        "winners_losers": {
            label: [{"decile": str(d), **dict.fromkeys(BAND_NAMES, 0.0)} for d in range(1, 11)]
            + [{"decile": "All", **dict.fromkeys(BAND_NAMES, 0.0)}]
            for label in labels
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


def test_decile_impact_keyed_by_fiscal_year():
    di = fake_results()["decile_impact"]
    assert set(di) == {"2026-27", "2027-28", "2028-29", "2029-30", "2030-31"}
    assert set(di["2026-27"][0]) == {
        "decile",
        "avg_change_gbp",
        "relative_change_pct",
        "total_change_bn",
    }


def test_winners_losers_rows():
    wl = fake_results()["winners_losers"]
    assert set(wl) == {"2026-27", "2027-28", "2028-29", "2029-30", "2030-31"}
    rows = wl["2026-27"]
    assert rows[-1]["decile"] == "All"
    assert set(rows[0]) == {"decile", *BAND_NAMES}


def test_calibration_marks_stock_weights():
    cal = fake_results()["calibration"]
    assert cal["targets"] == []
    assert cal["ess_before"] is None
    assert cal["ess_after"] is None


def test_sensitivity_cases():
    rows = fake_results()["sensitivity"]
    assert [r["e_mtr"] for r in rows] == [0.0, -0.35, -0.7, -1.4, -2.0]


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

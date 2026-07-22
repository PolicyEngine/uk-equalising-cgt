"""Main pipeline: build the dashboard JSON for the Burnham CGT reform.

Everything runs on the standard policyengine.py stack: per-year certified
datasets from ``pe.uk.ensure_datasets``, one ``policyengine.Simulation``
per (scenario, year), and policyengine.py's standard decile/intra-decile
outputs. The pipeline asserts that the behavioural CGT elasticity actually
fires (the static e=0 and central e=-0.7 reform runs must differ
materially) before writing any results.

Simulations run directly on the Enhanced FRS dataset as published by
policyengine-uk-data, with no local reweighting: all calibration and
weighting belongs upstream in policyengine-uk-data, not in an analysis
repo. The published gains imputation spreads capital gains more widely
than HMRC records, so the distributional breadth should be read as an
upper bound (see the dashboard methodology and benchmarks tabs).
"""

from __future__ import annotations

import datetime
import importlib.metadata
import json
from pathlib import Path

from .comparison import SENSITIVITY_CASES, comparison_rows
from .impacts import (
    budget_impact,
    cgt_revenue,
    decile_impact,
    fiscal_year_label,
    sensitivity,
    validation_stats,
    winners_losers,
)
from .reform import BURNHAM_RATES, ELASTICITY, PERIOD, YEARS, burnham_reform
from .simulations import DATASET, ensure_uk_datasets, make_policy, run_simulation

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = REPO_ROOT / "data" / "cgt_equalisation_results.json"
DATASET_FOLDER = REPO_ROOT / "data" / "policyengine_datasets"

# Simulation ids double as output-cache filenames (`<id>.h5` beside the
# per-year dataset files), so they must be keyed by dataset vintage —
# otherwise a dataset upgrade silently reuses stale cached outputs.
DATASET_STEM = Path(DATASET.rsplit("@", 1)[0]).stem


def run(output_path: Path = OUTPUT_PATH) -> dict:
    """Run the pipeline end-to-end and write the results JSON."""
    # ── Step 1: certified per-year datasets, as published upstream ───────
    print(f"Step 1: Ensuring {DATASET} datasets for {YEARS}...")
    datasets = ensure_uk_datasets(YEARS, DATASET_FOLDER)

    # ── Step 2: baseline and reformed simulations, one per year ───────────
    print("Step 2: Running baseline and reformed simulations...")
    reform_policy = make_policy(burnham_reform(ELASTICITY), "burnham_e07")
    baseline_sims, reform_sims = {}, {}
    for year in YEARS:
        print(f"    {fiscal_year_label(year)}...")
        baseline_sims[year] = run_simulation(
            datasets[year], sim_id=f"{DATASET_STEM}_baseline_{year}"
        )
        reform_sims[year] = run_simulation(
            datasets[year], policy=reform_policy, sim_id=f"{DATASET_STEM}_burnham_e07_{year}"
        )

    # ── Step 3: elasticity sensitivity (2026), which doubles as the check
    # that the behavioural response fires through policyengine.py ─────────
    print("Step 3: Elasticity sensitivity (2026)...")
    base_cgt_2026 = cgt_revenue(baseline_sims[2026])

    def run_case(e: float):
        if e == ELASTICITY:
            return reform_sims[2026]
        tag = f"burnham_e{abs(e):.2f}".replace(".", "")
        return run_simulation(
            datasets[2026],
            policy=make_policy(burnham_reform(e), tag),
            sim_id=f"{DATASET_STEM}_{tag}_2026",
        )

    sens = sensitivity(base_cgt_2026, SENSITIVITY_CASES, run_case)
    for row in sens:
        print(f"    {row['name']} (e={row['e_mtr']}): {row['revenue_2026_bn']:+.1f}bn")
    static_2026 = next(r["revenue_2026_bn"] for r in sens if r["e_mtr"] == 0.0)
    central_2026 = next(r["revenue_2026_bn"] for r in sens if r["e_mtr"] == ELASTICITY)
    assert static_2026 - central_2026 > 1.0, (
        "Behavioural CGT elasticity did not fire through policyengine.py: "
        f"static (e=0) yield {static_2026:.2f}bn vs central (e={ELASTICITY}) "
        f"{central_2026:.2f}bn. Refusing to write results."
    )

    # ── Step 4: baseline validation (native microdf, published weights) ──
    print("Step 4: Validating the published baseline against HMRC/Advani...")
    validation = validation_stats(baseline_sims[2026])
    print(
        f"    {validation['cgt_taxpayers'] / 1e6:,.2f}m CGT taxpayers, "
        f"£{validation['total_gains_bn']:.1f}bn gains, baseline CGT revenue "
        f"£{validation['baseline_cgt_revenue_bn']:.1f}bn"
    )

    # ── Step 5: budgetary impact ──────────────────────────────────────────
    print("Step 5: Budgetary impact 2026-27 to 2030-31...")
    budget = budget_impact(baseline_sims, reform_sims, YEARS)
    for row in budget:
        print(f"    {row['year']}: gov balance {row['gov_balance_change_bn']:+.2f}bn")
    five_year_total = sum(r["gov_balance_change_bn"] for r in budget)
    print(f"    Five-year total budgetary impact: £{five_year_total:.1f}bn")

    # ── Step 6: decile impacts and winners/losers (policyengine.py
    # standard outputs), all years ─────────────────────────────────────────
    print("Step 6: Decile impacts and winners/losers...")
    deciles = {fiscal_year_label(y): decile_impact(baseline_sims[y], reform_sims[y]) for y in YEARS}
    wl = {fiscal_year_label(y): winners_losers(baseline_sims[y], reform_sims[y]) for y in YEARS}

    # ── Step 7: comparison with other institutions ────────────────────────
    comparison = comparison_rows(
        revenue_2026_bn=budget[0]["gov_balance_change_bn"],
        five_year_avg_bn=five_year_total / len(YEARS),
        static_2026_bn=static_2026,
    )

    # ── Step 8: write the results JSON ────────────────────────────────────
    print("Step 8: Writing results JSON...")
    output = {
        "metadata": {
            "generated": datetime.date.today().isoformat(),
            "policyengine_version": importlib.metadata.version("policyengine"),
            "policyengine_uk_version": importlib.metadata.version("policyengine-uk"),
            "dataset": DATASET,
            "calibrated": False,
            "reform_period_start": PERIOD,
            "elasticity": ELASTICITY,
            "reform": dict(BURNHAM_RATES),
            "years": list(YEARS),
        },
        "calibration": {
            "targets": [],
            "ess_before": None,
            "ess_after": None,
            "note": ("No local reweighting; calibration is upstream in policyengine-uk-data."),
        },
        "validation": validation,
        "budget": budget,
        "decile_impact": deciles,
        "winners_losers": wl,
        "sensitivity": sens,
        "comparison": comparison,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2))
    print(f"    wrote {output_path}")
    print("Done.")
    return output

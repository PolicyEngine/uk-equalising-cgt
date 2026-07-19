"""Main pipeline: build the dashboard JSON for the Burnham CGT reform.

Everything runs on the standard policyengine.py stack: per-year certified
datasets from ``pe.uk.ensure_datasets``, one ``policyengine.Simulation``
per (scenario, year), and policyengine.py's standard decile/intra-decile
outputs. The pipeline asserts that the behavioural CGT elasticity actually
fires (the static e=0 and central e=-0.7 reform runs must differ
materially) before writing any results.

The stock Enhanced FRS weights badly overshoot HMRC's CGT aggregates, so a
probe baseline run on the stock 2026 dataset feeds populace-calibrate
(:mod:`.calibration`), and the resulting household weight ratio is written
back as a **reweighted input dataset** (``calibrated_frs_year_YYYY.h5``)
that every scored simulation then runs on.
"""

from __future__ import annotations

import datetime
import importlib.metadata
import json
from pathlib import Path

from .calibration import (
    CAL_YEAR,
    GAINS_TARGET,
    MAX_TARGET_RELATIVE_ERROR,
    PAYERS_TARGET,
    calibrate_baseline,
    write_calibrated_datasets,
)
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


def run(output_path: Path = OUTPUT_PATH) -> dict:
    """Run the pipeline end-to-end and write the results JSON."""
    # ── Step 1: certified per-year datasets (stock Enhanced FRS weights) ──
    print(f"Step 1: Ensuring {DATASET} datasets for {YEARS}...")
    stock_datasets = ensure_uk_datasets(YEARS, DATASET_FOLDER)

    # ── Step 1b: calibrate household weights to HMRC/OBR CGT aggregates ───
    # A throwaway probe baseline on the stock dataset supplies the
    # calibration inputs; the calibrated ratio (computed once on CAL_YEAR)
    # is written back as a reweighted input dataset for every year.
    print(f"Step 1b: Calibrating household weights on {CAL_YEAR}...")
    probe = run_simulation(stock_datasets[CAL_YEAR], sim_id=f"probe_baseline_{CAL_YEAR}")
    cal = calibrate_baseline(probe)
    for d in cal.diagnostics:
        print(
            f"    {d['name']:<22} target {d['target']:>16,.0f} "
            f"final {d['final']:>16,.0f}  rel err {d['relative_error']:+.4%}"
        )
    print(f"    ESS {cal.ess_before:,.0f} -> {cal.ess_after:,.0f}")
    assert cal.worst_relative_error <= MAX_TARGET_RELATIVE_ERROR, (
        "populace-calibrate missed the HMRC/OBR CGT targets by more than 1% "
        f"(worst {cal.worst_relative_error:.2%}; targets £{GAINS_TARGET / 1e9:.0f}bn "
        f"gains and {PAYERS_TARGET:,} taxpayers). Refusing to write results."
    )
    datasets = write_calibrated_datasets(stock_datasets, cal.weight_ratio, DATASET_FOLDER)

    # ── Step 2: baseline and reformed simulations, one per year ───────────
    print("Step 2: Running baseline and reformed simulations...")
    reform_policy = make_policy(burnham_reform(ELASTICITY), "burnham_e07")
    baseline_sims, reform_sims = {}, {}
    for year in YEARS:
        print(f"    {fiscal_year_label(year)}...")
        baseline_sims[year] = run_simulation(datasets[year], sim_id=f"baseline_{year}_cal")
        reform_sims[year] = run_simulation(
            datasets[year], policy=reform_policy, sim_id=f"burnham_e07_{year}_cal"
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
            sim_id=f"{tag}_2026_cal",
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

    # ── Step 4: baseline validation (native microdf, calibrated weights) ──
    print("Step 4: Validating the calibrated baseline against HMRC/Advani...")
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
            "calibrated": True,
            "reform_period_start": PERIOD,
            "elasticity": ELASTICITY,
            "reform": dict(BURNHAM_RATES),
            "years": list(YEARS),
        },
        "calibration": cal.as_json(),
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

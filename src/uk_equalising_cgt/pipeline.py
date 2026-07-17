"""Main pipeline: build the dashboard JSON for the Burnham CGT reform.

Ordering matters for correctness (positional random draws — see
simulations.py): the populace calibration prep runs on a throwaway probe
simulation FIRST; the baseline and reformed simulations are created after,
and every subsequent calculation runs in matched baseline/reform pairs.
"""

from __future__ import annotations

import datetime
import importlib.metadata
import json
from pathlib import Path

from .calibration import (
    apply_calibrated_weights,
    calibrate_baseline,
    validation_stats,
)
from .comparison import SENSITIVITY_CASES, comparison_rows
from .impacts import (
    budget_impact,
    decile_impact,
    fiscal_year_label,
    sensitivity,
    winners_losers,
)
from .reform import BURNHAM_RATES, ELASTICITY, PERIOD, YEARS, burnham_reform
from .simulations import reform_simulation

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = REPO_ROOT / "data" / "cgt_equalisation_results.json"


def run(output_path: Path = OUTPUT_PATH) -> dict:
    """Run the pipeline end-to-end and write the results JSON."""
    from policyengine_uk import Microsimulation

    # ── Step 1: populace calibration on a throwaway probe simulation ──────
    # All prep calculations run on `probe`, never on the baseline used for
    # impacts, to keep the baseline/reform random streams aligned.
    print("Step 1: Calibrating baseline CGT aggregates with populace...")
    probe = Microsimulation()
    cal = calibrate_baseline(probe)
    for d in cal.diagnostics:
        print(
            f"    {d['name']}: target={d['target']:.3e} final={d['final']:.3e} "
            f"err={d['relative_error']:+.2%}"
        )
    print(f"    ESS {cal.ess_before:,.0f} -> {cal.ess_after:,.0f}")

    # ── Step 2: validation of the recalibrated baseline ───────────────────
    print("Step 2: Validating recalibrated baseline against HMRC/Advani...")
    validation = validation_stats(probe, cal)
    print(
        f"    {validation['cgt_taxpayers'] / 1e3:,.0f}k CGT taxpayers, "
        f"£{validation['total_gains_bn']:.1f}bn gains, baseline CGT revenue "
        f"£{validation['baseline_cgt_revenue_bn']:.1f}bn"
    )

    # ── Step 3: baseline and reformed simulations (created AFTER the probe
    # prep; calibrated identically) ────────────────────────────────────────
    print("Step 3: Building baseline and reformed simulations...")
    reform = burnham_reform(ELASTICITY)
    baseline = apply_calibrated_weights(Microsimulation(), cal.weight_ratio, YEARS)
    reformed = apply_calibrated_weights(reform_simulation(reform), cal.weight_ratio, YEARS)

    # ── Step 4: budgetary impact ──────────────────────────────────────────
    print("Step 4: Budgetary impact 2026-27 to 2030-31...")
    budget = budget_impact(baseline, reformed, YEARS)
    for row in budget:
        print(f"    {row['year']}: gov balance {row['gov_balance_change_bn']:+.2f}bn")
    five_year_total = sum(r["gov_balance_change_bn"] for r in budget)
    print(f"    Five-year total budgetary impact: £{five_year_total:.1f}bn")

    # ── Step 5: decile impacts (all years) ────────────────────────────────
    print("Step 5: Decile impacts...")
    deciles = {fiscal_year_label(y): decile_impact(baseline, reformed, y) for y in YEARS}

    # ── Step 6: winners and losers (2026-27) ──────────────────────────────
    print("Step 6: Winners and losers by decile (2026-27)...")
    wl = winners_losers(baseline, reformed, 2026)

    # ── Step 7: sensitivity to the behavioural elasticity ─────────────────
    print("Step 7: Elasticity sensitivity...")

    def make_case_sim(e: float):
        case_reform = {**reform, "gov.simulation.capital_gains_responses.elasticity": {PERIOD: e}}
        return apply_calibrated_weights(reform_simulation(case_reform), cal.weight_ratio, YEARS)

    sens = sensitivity(baseline, SENSITIVITY_CASES, 2026, make_case_sim)
    for row in sens:
        print(f"    {row['name']} (e={row['e_mtr']}): {row['revenue_2026_bn']:+.1f}bn")

    # ── Step 8: comparison with other institutions ────────────────────────
    static_2026 = next(r["revenue_2026_bn"] for r in sens if r["e_mtr"] == 0.0)
    comparison = comparison_rows(
        revenue_2026_bn=budget[0]["gov_balance_change_bn"],
        five_year_avg_bn=five_year_total / len(YEARS),
        static_2026_bn=static_2026,
    )

    # ── Step 9: write the results JSON ────────────────────────────────────
    print("Step 9: Writing results JSON...")
    output = {
        "metadata": {
            "generated": datetime.date.today().isoformat(),
            "policyengine_uk_version": importlib.metadata.version("policyengine-uk"),
            "elasticity": ELASTICITY,
            "reform": dict(BURNHAM_RATES),
            "years": list(YEARS),
        },
        "calibration": {
            "targets": cal.diagnostics,
            "ess_before": cal.ess_before,
            "ess_after": cal.ess_after,
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

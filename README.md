# Equalising capital gains tax with income tax (the "Burnham" reform)

Data pipeline estimating the budgetary and distributional impact of
**equalising UK CGT rates with income tax rates** — the reform debated in the
Labour leadership contest, associated with Andy Burnham and backed by allies
including Louise Haigh and Wes Streeting — using the standard
[policyengine.py](https://github.com/PolicyEngine/policyengine.py) stack
(the `policyengine` package wrapping the PolicyEngine UK model) on the
Enhanced FRS 2023-24 dataset, reweighted to HMRC/OBR capital gains
aggregates with
[populace-calibrate](https://github.com/PolicyEngine/populace).

**Note on decile impacts vs revenue:** household net-income losses in the decile
tables include both the extra tax paid and the gains taxpayers choose not to
realise under the behavioural response, so they are roughly an order of
magnitude larger than the net revenue raised. This is a mechanical property of
modelling the response as a reduction in realised gains, not a bug.

## Reform (from 2026-27)

| Band | Baseline CGT rate | Reformed rate (= income tax) |
|---|---|---|
| Basic | 18% | **20%** |
| Higher | 24% | **40%** |
| Additional | 24% | **45%** |

Annual exempt amount unchanged at £3,000. Fiscal years 2026-27 through
2030-31.

## Method

### The policyengine.py pathway

- `pe.uk.ensure_datasets(datasets=["enhanced_frs_2023_24"], years=[2026..2030])`
  materialises one certified per-year dataset file per simulated year.
- Those stock weights are then **recalibrated** (see below) and written back
  as a reweighted input dataset, `calibrated_frs_year_YYYY.h5`, which every
  scored simulation runs on.
- Each (scenario, year) pair is one `policyengine.Simulation`, with
  deterministic ids so policyengine.py's output-dataset cache skips
  completed runs.
- Decile impacts and winners/losers use policyengine.py's standard outputs
  (`policyengine.outputs.decile_impact` and `intra_decile_impact`, grouped
  by the model's `household_income_decile`; decile −1 excluded), so tables
  match what PolicyEngine's app machinery reports. The intra-decile bands
  are people-weighted with ±5% relative-change thresholds and a ±0.1%
  no-change band.
- Aggregates the wrapper does not expose directly (budget totals, per-decile
  total change, baseline validation statistics) are computed from the
  simulations' output datasets with **native microdf weighted operations**
  (`MicroSeries.sum/mean/median/count`, weighted `groupby`) — no manual
  weight arithmetic.

### Weight calibration (load-bearing)

The stock Enhanced FRS baseline overshoots CGT badly relative to HMRC
outturn — far more taxable gains across ~1.3m taxpayers in 2026, versus
HMRC's £65.9bn across 378k in 2023-24 — leaving baseline CGT revenue well
above the OBR's £16-21bn forecast. The Advani & Summers-based gains
imputation is aggregate-unconstrained, and the OBR CGT calibration target is
silently dropped in `policyengine-uk-data` (the EFO parser reads sheet 3.9;
the CGT row moved to 3.8).

`src/uk_equalising_cgt/calibration.py` fixes this with populace-calibrate.
A throwaway **probe** baseline simulation on the stock 2026 dataset supplies
the inputs (read from its output dataset — nothing here builds a
`policyengine_uk.Microsimulation` by hand). Targets for 2026:

| Target | Value | Source |
|---|---|---|
| Total capital gains | £70bn | OBR-consistent uprated HMRC |
| CGT taxpayer count | 400,000 | HMRC, persons with gains > £3,000 AEA |
| Income tax, household net income, population, household count | baseline | HOLD |

Calibration runs with `weight_entity="household"`, `seed=0`, `epochs=500`,
`learning_rate=0.01`, `mass="free"`, `max_weight_ratio=5.0`. `mass="free"`
is deliberate: `mass="conserve"` diverges on these heavy-tailed weights, and
the explicit household-count target is what makes free mass safe.

The resulting household weight **ratio is computed once on 2026 and applied
to every year 2026-2030**. Applying it means copying each per-year certified
dataset, overwriting `household_weight` and recomputing the derived
`person_weight` / `benunit_weight` from it, and saving as
`calibrated_frs_year_YYYY.h5`; simulation ids carry a `_cal` suffix so no
stock-weight cache entry is reused. The pipeline refuses to write results if
either HMRC/OBR target is missed by more than 1%, and the `calibration`
block of the output JSON reports every target's final estimate, relative
error, and the effective sample size before and after.

Aggregates align; the extreme tail does not. The FRS-based imputation
contains no one with very large gains, so no reweighting can reproduce the
HMRC/Advani top tail. Static reform yield is therefore somewhat understated,
as is the top-end behavioural response. The `validation` block reports these
baseline statistics so results can be read against that caveat.

### Behavioural response (aligned with Arun Advani / CenTax)

PolicyEngine's `gov.simulation.capital_gains_responses.elasticity` is the
elasticity of taxable gains **with respect to the marginal tax rate**.
Advani, Lonsdale & Summers (CenTax, Oct 2024, *Reforming Capital Gains Tax*)
use a central medium-term elasticity of **1.0 with respect to the retention
rate (1 − t)**, range 0.5–2.0. Converting conventions
(`e_mtr = e_retention × t / (1 − t)`), that is ≈ −0.67 to −0.82 at the
reformed 40–45% top rates; we use **−0.7** as the central case (also
PolicyEngine's Autumn Budget 2024 value). Sensitivity runs cover 0.0 /
−0.35 / −0.7 / −1.4 / −2.0. Caveat: Advani's elasticity assumes accompanying
base broadening we do not model, so behavioural loss may be understated for a
rate-only reform.

### Reforms via `Policy.simulation_modifier` (load-bearing)

policyengine.py 4.20.0 applies a plain-dict reform as post-construction
parameter updates on an unreformed `policyengine_uk.Microsimulation` and
never registers the baseline branch, so the CGT behavioural elasticity is
**silently zero** through that path (verified: e=0 and e=−0.7 produce
identical revenue). The pipeline instead builds each reform as a
policyengine.py `Policy` whose first-class `simulation_modifier` hook
registers the baseline branch (`sim.branches["baseline"] = sim.baseline`,
whose clone keeps its own unreformed parameter tree) before applying the
same parameter updates. Each Simulation covers a single year, so the old
multi-year "restore the neutralised response variable" workaround is no
longer needed. The pipeline asserts that the static (e=0) and central
(e=−0.7) runs differ before writing any results.

### Outputs

`data/cgt_equalisation_results.json`: metadata (wrapper and model
versions), the `calibration` diagnostics (per-target value, final estimate
and relative error, plus ESS before/after), baseline validation vs HMRC/Advani, budget impact by year, decile
impacts, winners/losers bands, the elasticity sensitivity, and a comparison
with CenTax (£14.0bn central / £9.6bn worst-case), Advani & Summers 2020
static (£16.7bn), the HMRC ready reckoner (−£2bn) and the OBR baseline
(~£16.2bn).

## Run

```bash
pip install -e ".[simulation,dev]"
uk-equalising-cgt-build              # or: python -m uk_equalising_cgt
```

Requires a `HUGGING_FACE_TOKEN` with access to PolicyEngine's Enhanced FRS
data. The full pipeline takes several minutes (per-year dataset builds plus
one probe plus thirteen scored simulations; re-runs reuse policyengine.py's output cache).

```bash
pytest        # pure-logic tests only, no simulation
ruff check .
```

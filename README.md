# Equalising capital gains tax with income tax (the "Burnham" reform)

Data pipeline estimating the budgetary and distributional impact of
**equalising UK CGT rates with income tax rates** — the reform debated in the
Labour leadership contest, associated with Andy Burnham and backed by allies
including Louise Haigh and Wes Streeting — using the
[PolicyEngine UK](https://policyengine.org) microsimulation model on the
Enhanced FRS 2023-24 dataset.

## Reform (from 2026-27)

| Band | Baseline CGT rate | Reformed rate (= income tax) |
|---|---|---|
| Basic | 18% | **20%** |
| Higher | 24% | **40%** |
| Additional | 24% | **45%** |

Annual exempt amount unchanged at £3,000. Fiscal years 2026-27 through
2030-31.

## Headline results (elasticity −0.7)

| Result | Value |
| --- | --- |
| Baseline CGT revenue, 2026-27 | £17.2bn |
| Budget impact (gov balance), 2026-27 | +£2.3bn |
| Five-year total budget impact | +£12.7bn |
| Static (e=0) 2026-27 yield | ~£13-14bn |
| Gainers | none (pure revenue-raiser; losses concentrated in decile 10) |

## Method

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

### Baseline recalibration with populace

PolicyEngine's Enhanced FRS baseline overshoots CGT (~£106bn of gains across
~1.28m taxpayers vs HMRC's £65.9bn across 378k). The baseline is reweighted
with **populace-calibrate** to **£70bn total gains** and **400k CGT
taxpayers**, holding income tax, household net income, population and
household counts at their baseline aggregates (`mass="free"` with an explicit
household-count target — `mass="conserve"` diverges on these heavy-tailed
weights; seed=0, 500 epochs, lr=0.01, max weight ratio 5). The extreme tail
(≥£5m gains, ~40% of gains per HMRC/Advani) is structurally absent from the
FRS imputation, so static yield and the top-end behavioural response are
somewhat understated.

### policyengine-uk 2.89.2 bug workarounds (load-bearing)

1. **Baseline branch not registered**: after `Microsimulation(reform=...)`,
   `sim.branches["baseline"] = sim.baseline` must be set, or the CGT
   elasticity silently does nothing (the MTR-change formula forks the reform
   sim instead of the baseline).
2. **Response variable neutralised after the first year**:
   `capital_gains_behavioural_response` is neutralised on the *shared*
   tax-benefit system after the first year calculated; the original variable
   object is restored before every reform-side calculation
   (`simulations.rcalc`).
3. **Positional random draws**: PolicyEngine's random draws (benefit
   take-up) are positional per simulation — baseline and reform sims are
   only comparable if they execute identical calculation sequences. All
   populace-calibration prep runs on a throwaway "probe" simulation; the
   baseline and reformed sims are created afterwards and every calculation
   is done in matched pairs.

### Outputs

`data/cgt_equalisation_results.json`: calibration diagnostics, baseline
validation vs HMRC/Advani, budget impact by year, decile impacts (decile −1
excluded), winners/losers bands (absolute £1 guard plus ±5% thresholds), the
elasticity sensitivity, and a comparison with CenTax (£14.0bn central /
£9.6bn worst-case), Advani & Summers 2020 static (£16.7bn), the HMRC ready
reckoner (−£2bn) and the OBR baseline (~£16.2bn).

## Run

```bash
pip install -e ".[simulation,dev]"
uk-equalising-cgt-build              # or: python -m uk_equalising_cgt
```

Requires a `HUGGING_FACE_TOKEN` with access to PolicyEngine's Enhanced FRS
data. The full pipeline takes several minutes (seven Microsimulations).

```bash
pytest        # pure-logic tests only, no simulation
ruff check .
```

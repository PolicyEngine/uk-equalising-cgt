"""Reform specification and elasticity-convention helpers.

The "Burnham" reform — debated in the Labour leadership contest, associated
with Andy Burnham and backed by allies including Louise Haigh and Wes
Streeting — equalises CGT rates with income tax rates from 2026-27:

| Band       | Baseline CGT rate | Reformed rate (= income tax) |
|------------|-------------------|------------------------------|
| Basic      | 18%               | 20%                          |
| Higher     | 24%               | 40%                          |
| Additional | 24%               | 45%                          |

The annual exempt amount is unchanged at £3,000.

Behavioural response — aligned with Arun Advani (CenTax): PolicyEngine's
``gov.simulation.capital_gains_responses.elasticity`` is the elasticity of
taxable gains with respect to the MARGINAL TAX RATE (default 0 = static).
Advani, Lonsdale & Summers (CenTax, Oct 2024, *Reforming Capital Gains Tax*)
use a central medium-term elasticity of 1.0 with respect to the retention
rate (1 - t), sensitivity range 0.5-2.0, anchored on Agersnap & Zidar (2021)
and Lavecchia & Tazhitdinova (2024). Converting conventions
(``e_mtr = e_retention * t / (1 - t)``), Advani's central 1.0 at the reformed
40-45% top rates is an MTR elasticity of ~= -0.67 to -0.82. We use -0.7 as
the central case — also the value PolicyEngine used in its Autumn Budget 2024
CGT analysis.

Caveats: Advani's elasticity assumes accompanying base broadening
(death-uplift removal, exit charges) which we do not model, so behavioural
loss may be UNDERSTATED for a rate-only reform; and it is a medium-term
elasticity abstracting from short-run forestalling.
"""

from __future__ import annotations

YEARS = [2026, 2027, 2028, 2029, 2030]  # fiscal years 2026-27 .. 2030-31
# policyengine.py reform dicts take a single effective date per value and
# apply it open-endedly (equivalent to the old "2026-01-01.2035-12-31"
# range over the 2026-2030 window simulated here).
PERIOD = "2026-01-01"
ELASTICITY = -0.7  # w.r.t. MTR; ~= Advani/CenTax central (retention e=1.0) at 40-45%

# Reformed CGT rates, equal to the income tax rates for each band.
BURNHAM_RATES = {
    "basic_rate": 0.20,  # from 18%
    "higher_rate": 0.40,  # from 24%
    "additional_rate": 0.45,  # from 24%
}


def burnham_reform(elasticity: float = ELASTICITY) -> dict:
    """The Burnham reform as a PolicyEngine parametric reform dict."""
    return {
        "gov.hmrc.cgt.basic_rate": {PERIOD: BURNHAM_RATES["basic_rate"]},
        "gov.hmrc.cgt.higher_rate": {PERIOD: BURNHAM_RATES["higher_rate"]},
        "gov.hmrc.cgt.additional_rate": {PERIOD: BURNHAM_RATES["additional_rate"]},
        "gov.simulation.capital_gains_responses.elasticity": {PERIOD: elasticity},
    }


def retention_to_mtr_elasticity(e_retention: float, tax_rate: float) -> float:
    """Convert a retention-rate elasticity (Advani/CenTax convention) to
    PolicyEngine's marginal-tax-rate convention.

    ``e_mtr = -e_retention * t / (1 - t)``: a positive elasticity of gains
    with respect to the retention rate (1 - t) is a NEGATIVE elasticity with
    respect to the tax rate t itself.
    """
    if not 0.0 <= tax_rate < 1.0:
        raise ValueError(f"tax rate {tax_rate} outside [0, 1)")
    return -e_retention * tax_rate / (1.0 - tax_rate)

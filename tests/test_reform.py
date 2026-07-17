"""Pure-logic tests for the reform spec and elasticity conversion (no
PolicyEngine needed)."""

import numpy as np
import pytest

from uk_equalising_cgt.reform import (
    BURNHAM_RATES,
    ELASTICITY,
    PERIOD,
    burnham_reform,
    retention_to_mtr_elasticity,
)


def test_burnham_rates_equal_income_tax_rates():
    assert BURNHAM_RATES == {"basic_rate": 0.20, "higher_rate": 0.40, "additional_rate": 0.45}


def test_reform_dict_shape():
    reform = burnham_reform()
    assert reform["gov.hmrc.cgt.basic_rate"] == {PERIOD: 0.20}
    assert reform["gov.hmrc.cgt.higher_rate"] == {PERIOD: 0.40}
    assert reform["gov.hmrc.cgt.additional_rate"] == {PERIOD: 0.45}
    assert reform["gov.simulation.capital_gains_responses.elasticity"] == {PERIOD: ELASTICITY}


def test_elasticity_override():
    reform = burnham_reform(elasticity=-1.4)
    assert reform["gov.simulation.capital_gains_responses.elasticity"] == {PERIOD: -1.4}


def test_retention_to_mtr_conversion_at_reformed_top_rates():
    # Advani/CenTax central retention e=1.0 at the reformed 40-45% rates is
    # an MTR elasticity of ~ -0.67 to -0.82, bracketing the -0.7 central case.
    lo = retention_to_mtr_elasticity(1.0, 0.40)
    hi = retention_to_mtr_elasticity(1.0, 0.45)
    assert np.isclose(lo, -2 / 3)
    assert np.isclose(hi, -0.45 / 0.55)
    assert hi < ELASTICITY < lo


def test_retention_to_mtr_is_negative_and_scales():
    assert retention_to_mtr_elasticity(0.0, 0.4) == 0.0
    assert retention_to_mtr_elasticity(2.0, 0.4) == pytest.approx(2 * retention_to_mtr_elasticity(1.0, 0.4))


def test_retention_to_mtr_rejects_invalid_rates():
    with pytest.raises(ValueError):
        retention_to_mtr_elasticity(1.0, 1.0)
    with pytest.raises(ValueError):
        retention_to_mtr_elasticity(1.0, -0.1)

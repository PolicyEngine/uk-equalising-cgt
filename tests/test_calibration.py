"""Calibration tests: constants, diagnostics contract and the JSON block.

These are pure-logic tests — nothing here builds a simulation or imports
the policyengine.py stack.
"""

import pytest

from uk_equalising_cgt.calibration import (
    AEA,
    CAL_YEAR,
    CALIBRATED_STEM,
    CALIBRATION_TARGET_NAMES,
    GAINS_TARGET,
    HMRC_TARGET_NAMES,
    MAX_TARGET_RELATIVE_ERROR,
    PAYERS_TARGET,
    CalibrationResult,
)


def make_result(errors: dict[str, float]) -> CalibrationResult:
    return CalibrationResult(
        weight_ratio=None,
        diagnostics=[
            {
                "name": name,
                "target": 100.0,
                "final": 100.0 * (1 + errors.get(name, 0.0)),
                "relative_error": errors.get(name, 0.0),
            }
            for name in CALIBRATION_TARGET_NAMES
        ],
        ess_before=20_000.0,
        ess_after=15_000.0,
    )


def test_targets_match_hmrc_obr_figures():
    assert CAL_YEAR == 2026
    assert GAINS_TARGET == 70e9
    assert PAYERS_TARGET == 400_000
    assert AEA == 3_000


def test_hmrc_targets_are_the_first_two():
    assert HMRC_TARGET_NAMES == ("total_capital_gains", "cgt_taxpayer_count")
    assert set(HMRC_TARGET_NAMES) <= set(CALIBRATION_TARGET_NAMES)


def test_calibrated_dataset_stem_is_distinct_from_the_stock_dataset():
    from uk_equalising_cgt.simulations import DATASET

    assert CALIBRATED_STEM != DATASET


def test_worst_relative_error_ignores_hold_targets():
    result = make_result({"cgt_taxpayer_count": -0.004, "population": 0.5})
    assert result.worst_relative_error == pytest.approx(0.004)


def test_worst_relative_error_takes_the_largest_hmrc_miss():
    result = make_result({"total_capital_gains": 0.002, "cgt_taxpayer_count": -0.009})
    assert result.worst_relative_error == pytest.approx(0.009)
    assert result.worst_relative_error <= MAX_TARGET_RELATIVE_ERROR


def test_as_json_shape_matches_the_dashboard_contract():
    block = make_result({}).as_json()
    assert set(block) == {"targets", "ess_before", "ess_after", "note"}
    assert [t["name"] for t in block["targets"]] == list(CALIBRATION_TARGET_NAMES)
    assert all(set(t) == {"name", "target", "final", "relative_error"} for t in block["targets"])
    assert block["ess_before"] == 20_000.0
    assert block["ess_after"] == 15_000.0

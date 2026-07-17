"""Tests for the winner/loser band mapping from policyengine.py's
intra-decile output to the dashboard's band keys (pure logic)."""

import pytest

from uk_equalising_cgt.impacts import BAND_NAMES, INTRA_DECILE_BAND_MAP, map_intra_decile_row


def test_map_covers_all_dashboard_bands():
    assert sorted(INTRA_DECILE_BAND_MAP.values()) == sorted(BAND_NAMES)


def test_proportions_become_percentages():
    row = {
        "gain_more_than_5pct": 0.0,
        "gain_less_than_5pct": 0.0,
        "no_change": 0.9,
        "lose_less_than_5pct": 0.06,
        "lose_more_than_5pct": 0.04,
    }
    mapped = map_intra_decile_row(row)
    assert set(mapped) == set(BAND_NAMES)
    assert mapped["no_change_pct"] == pytest.approx(90.0)
    assert mapped["lose_less_5_pct"] == pytest.approx(6.0)
    assert mapped["lose_more_5_pct"] == pytest.approx(4.0)
    assert mapped["gain_more_5_pct"] == 0.0
    assert sum(mapped.values()) == pytest.approx(100.0)


def test_pure_loser_reform_has_zero_gain_bands():
    row = dict.fromkeys(INTRA_DECILE_BAND_MAP, 0.0)
    row["no_change"] = 0.97
    row["lose_more_than_5pct"] = 0.03
    mapped = map_intra_decile_row(row)
    assert mapped["gain_more_5_pct"] == 0.0
    assert mapped["gain_less_5_pct"] == 0.0

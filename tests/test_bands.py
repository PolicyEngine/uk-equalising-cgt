"""Tests for the winner/loser band classification (pure logic)."""

import numpy as np

from uk_equalising_cgt.impacts import BAND_NAMES, band_masks


def _classify_one(diff, base_inc):
    masks = band_masks(np.array([diff]), np.array([base_inc]))
    hits = [name for name, mask in masks.items() if mask[0]]
    assert len(hits) == 1, f"expected exactly one band, got {hits}"
    return hits[0]


def test_bands_are_exhaustive_and_exclusive():
    rng = np.random.default_rng(0)
    diff = rng.normal(0, 1000, 500)
    base = rng.normal(20_000, 30_000, 500)  # includes negative incomes
    masks = band_masks(diff, base)
    stacked = np.vstack([masks[name] for name in BAND_NAMES])
    assert (stacked.sum(axis=0) == 1).all()


def test_absolute_guard_small_changes_are_no_change():
    assert _classify_one(0.5, 10_000) == "no_change_pct"
    assert _classify_one(-0.5, 10_000) == "no_change_pct"
    assert _classify_one(0.0, 0.0) == "no_change_pct"


def test_five_percent_thresholds():
    assert _classify_one(600, 10_000) == "gain_more_5_pct"  # 6%
    assert _classify_one(400, 10_000) == "gain_less_5_pct"  # 4%
    assert _classify_one(-400, 10_000) == "lose_less_5_pct"
    assert _classify_one(-600, 10_000) == "lose_more_5_pct"


def test_negative_denominator_guard():
    # A household with negative baseline income that LOSES £500 has a
    # positive diff/base ratio; without the £1 absolute guard it would be
    # misclassified as a gainer. It must land in a losing band.
    assert _classify_one(-500, -10_000).startswith("lose")
    assert _classify_one(-600, -10_000) == "lose_more_5_pct"  # |rel| = 6%
    # And a genuine gain on negative income must not land in a losing band.
    assert _classify_one(500, -10_000).startswith("gain")


def test_empty_gain_bands_for_a_pure_loser_reform():
    diff = np.array([-100.0, -5000.0, -0.2])
    base = np.array([10_000.0, 20_000.0, 15_000.0])
    masks = band_masks(diff, base)
    assert not masks["gain_more_5_pct"].any()
    assert not masks["gain_less_5_pct"].any()

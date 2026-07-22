"""Unit tests for the distributional grouping (microdf-native ranks)."""

import numpy as np
from microdf import MicroSeries

from uk_equalising_cgt.impacts import QUANTILE_LABELS, REGION_NAMES


def test_microdf_quantile_ranks_split_weight_evenly():
    income = MicroSeries(np.arange(100, dtype=float), weights=np.ones(100))
    for n, rank in ((5, income.quintile_rank()), (4, income.quartile_rank())):
        labels = np.array(QUANTILE_LABELS[n], dtype=object)[
            rank.values.astype(int) - 1
        ]
        values, counts = np.unique(labels, return_counts=True)
        assert set(values) == set(QUANTILE_LABELS[n])
        assert (counts == 100 // n).all()


def test_microdf_ranks_are_weighted():
    # A heavy high-income household fills the upper groups, leaving the
    # light low-income households ranked in the bottom quartile.
    income = MicroSeries(
        np.array([1.0, 2.0, 3.0, 4.0]), weights=np.array([1.0, 1.0, 1.0, 75.0])
    )
    rank = income.quartile_rank().values.astype(int)
    assert (rank[:3] == 1).all()
    assert rank[-1] == 4


def test_quantile_labels_are_ordered_and_complete():
    assert len(QUANTILE_LABELS[4]) == 4
    assert len(QUANTILE_LABELS[5]) == 5
    assert len(REGION_NAMES) == 12  # 9 English regions + Wales, Scotland, NI

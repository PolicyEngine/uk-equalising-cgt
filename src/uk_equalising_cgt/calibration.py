"""Recalibrating the baseline CGT aggregates with populace-calibrate.

PolicyEngine's Enhanced FRS baseline overshoots CGT: with stock weights
there are ~1.3m people with gains above the annual exempt amount and far
more than HMRC's outturn total of taxable gains. The Advani & Summers-based
imputation is aggregate-unconstrained, and the OBR CGT calibration target is
silently dropped in ``policyengine-uk-data`` (the EFO parser reads sheet
3.9; the CGT row moved to 3.8). Uncorrected, baseline CGT is well above the
OBR's £16-21bn forecast.

We reweight with populace-calibrate: targets of £70bn total gains and 400k
CGT taxpayers (OBR-consistent uprated HMRC), holding income tax, household
net income, population, and household counts at their baseline aggregates.

How the calibration reaches the model
-------------------------------------
policyengine.py remains the simulation engine throughout — nothing here
builds a ``policyengine_uk.Microsimulation``. The calibration inputs are
read from a *baseline policyengine.py simulation's output dataset* (native
microdf tables), and the calibrated weights are fed back as a **reweighted
input dataset**: :func:`write_calibrated_datasets` copies the per-year
certified Enhanced FRS dataset that ``pe.uk.ensure_datasets`` produced,
overwrites ``household_weight`` (and the derived ``person_weight`` /
``benunit_weight``, which are household weight projected down), and saves it
under ``calibrated_frs_year_YYYY.h5``. The pipeline then passes those
datasets to every ``policyengine.Simulation``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

CAL_YEAR = 2026
GAINS_TARGET = 70e9  # OBR-consistent uprated HMRC total taxable gains
PAYERS_TARGET = 400_000  # HMRC CGT taxpayer count, uprated
AEA = 3_000  # annual exempt amount (unchanged by the reform)

CALIBRATED_STEM = "calibrated_frs"

# Target names, in the order populace-calibrate reports them. The first two
# are the HMRC/OBR targets we move to; the rest are HOLD targets pinned at
# their own stock-weight baseline values.
CALIBRATION_TARGET_NAMES = (
    "total_capital_gains",
    "cgt_taxpayer_count",
    "income_tax_total",
    "net_income_total",
    "population",
    "households",
)
HMRC_TARGET_NAMES = CALIBRATION_TARGET_NAMES[:2]
# Refuse to ship if either HMRC/OBR target is missed by more than this.
MAX_TARGET_RELATIVE_ERROR = 0.01


@dataclass
class CalibrationResult:
    """Calibrated household weight ratio plus calibration diagnostics."""

    weight_ratio: pd.Series  # per-household new/old weight ratio, indexed by household_id
    diagnostics: list[dict]  # per-target name/target/final/relative_error
    ess_before: float
    ess_after: float

    def as_json(self) -> dict:
        """The ``calibration`` block of the results JSON."""
        return {
            "targets": self.diagnostics,
            "ess_before": self.ess_before,
            "ess_after": self.ess_after,
            "note": (
                "Enhanced FRS 2023-24 household weights recalibrated with "
                "populace-calibrate to HMRC/OBR capital gains totals and CGT "
                "taxpayer counts, holding income tax, household net income, "
                "population and household counts at baseline. Applied as a "
                "reweighted input dataset for every policyengine.py "
                "simulation."
            ),
        }

    @property
    def worst_relative_error(self) -> float:
        """Largest absolute relative error over the two HMRC/OBR targets."""
        errors = [
            abs(d["relative_error"]) for d in self.diagnostics if d["name"] in HMRC_TARGET_NAMES
        ]
        if len(errors) != len(HMRC_TARGET_NAMES):
            raise ValueError(
                "Calibration diagnostics are missing an HMRC/OBR target: got "
                f"{[d['name'] for d in self.diagnostics]}, expected to find "
                f"{list(HMRC_TARGET_NAMES)}."
            )
        return max(errors)


def calibrate_baseline(baseline) -> CalibrationResult:
    """Run populace-calibrate on a policyengine.py baseline simulation.

    ``baseline`` is a completed ``policyengine.Simulation`` for
    :data:`CAL_YEAR`; its output dataset supplies every calibration input.
    """
    from populace.calibrate import Target, TargetSet, calibrate, effective_sample_size
    from populace.frame import EntitySchema, Frame, WeightKind, Weights

    data = baseline.output_dataset.data
    hh = pd.DataFrame(data.household)
    person = pd.DataFrame(data.person)

    hh_id = hh["household_id"].values
    w0 = hh["household_weight"].values.astype(np.float64)
    n_hh = len(w0)

    # CGT taxpayers: persons with gains above the AEA, counted per household.
    payers_hh = (
        (person["capital_gains"] > AEA)
        .astype(float)
        .groupby(person["household_id"])
        .sum()
        .reindex(pd.Index(hh_id))
        .fillna(0.0)
        .values
    )

    # Person-level money aggregated to the household.
    def to_hh(column: str) -> np.ndarray:
        return (
            person[column]
            .groupby(person["household_id"])
            .sum()
            .reindex(pd.Index(hh_id))
            .fillna(0.0)
            .values.astype(np.float64)
        )

    hh_table = pd.DataFrame(
        {
            "household_id": np.arange(n_hh),
            "capital_gains": to_hh("capital_gains"),
            "income_tax": to_hh("income_tax"),
            "net_income": hh["household_net_income"].values.astype(np.float64),
            "cgt_payers": payers_hh,
            "people": hh["household_count_people"].values.astype(np.float64),
            "ones": np.ones(n_hh),
        }
    )
    frame = Frame(
        tables={
            "person": pd.DataFrame(
                {"person_id": np.arange(n_hh), "person_household_id": np.arange(n_hh)}
            ),
            "household": hh_table,
        },
        schema=EntitySchema(person_entity="person", group_entities=("household",)),
        weights={"household": Weights(values=w0, kind=WeightKind.DESIGN)},
    )
    targets = TargetSet(
        [
            Target(
                name="total_capital_gains",
                entity="household",
                measure="capital_gains",
                value=GAINS_TARGET,
                source="HMRC/OBR",
            ),
            Target(
                name="cgt_taxpayer_count",
                entity="household",
                measure="cgt_payers",
                value=PAYERS_TARGET,
                source="HMRC",
            ),
            Target(
                name="income_tax_total",
                entity="household",
                measure="income_tax",
                value=float((w0 * hh_table.income_tax).sum()),
                source="hold",
            ),
            Target(
                name="net_income_total",
                entity="household",
                measure="net_income",
                value=float((w0 * hh_table.net_income).sum()),
                source="hold",
            ),
            Target(
                name="population",
                entity="household",
                measure="people",
                value=float((w0 * hh_table.people).sum()),
                source="hold",
            ),
            Target(
                name="households",
                entity="household",
                measure="ones",
                value=float(w0.sum()),
                source="hold",
            ),
        ]
    )
    # mass="free" + explicit household-count target: mass="conserve" diverges
    # on these heavy-tailed weights (populace-calibrate footgun).
    result = calibrate(
        frame,
        targets,
        weight_entity="household",
        seed=0,
        epochs=500,
        learning_rate=0.01,
        mass="free",
        max_weight_ratio=5.0,
    )
    ratio = np.where(w0 > 0, result.weights / np.where(w0 > 0, w0, 1.0), 1.0)
    return CalibrationResult(
        weight_ratio=pd.Series(ratio, index=pd.Index(hh_id, name="household_id")),
        diagnostics=[
            {
                # populace suffixes diagnostic names with the period index
                # ("total_capital_gains@0"); the dashboard wants the bare name.
                "name": d.name.split("@")[0],
                "target": float(d.target),
                "final": float(d.final_estimate),
                "relative_error": float(d.relative_error),
            }
            for d in result.diagnostics
        ],
        ess_before=float(effective_sample_size(w0)),
        ess_after=float(effective_sample_size(result.weights)),
    )


def write_calibrated_datasets(
    datasets: dict[int, object],
    weight_ratio: pd.Series,
    data_folder: str | Path,
) -> dict[int, object]:
    """Write a reweighted copy of each per-year input dataset.

    Copies the certified Enhanced FRS dataset for each year, multiplies
    ``household_weight`` by the calibrated ratio (matched on
    ``household_id``), recomputes the derived ``person_weight`` and
    ``benunit_weight`` from the new household weights, and saves to
    ``calibrated_frs_year_YYYY.h5``. Returns ``{year: dataset}`` ready to
    hand to ``policyengine.Simulation``.
    """
    from microdf import MicroDataFrame
    from policyengine.tax_benefit_models.uk.datasets import PolicyEngineUKDataset

    data_folder = Path(data_folder)
    out = {}
    for year, source in sorted(datasets.items()):
        src = pd.DataFrame(source.data.household)
        person = pd.DataFrame(source.data.person)
        benunit = pd.DataFrame(source.data.benunit)

        ratio = weight_ratio.reindex(pd.Index(src["household_id"])).fillna(1.0).values
        src["household_weight"] = src["household_weight"].values.astype(np.float64) * ratio

        # person/benunit weights are the household weight projected down;
        # recompute them from the new household weights rather than keeping
        # the stale stored values.
        hh_weight = pd.Series(src["household_weight"].values, index=pd.Index(src["household_id"]))
        person_hh = (
            person["person_household_id"]
            if "person_household_id" in person.columns
            else person["household_id"]
        )
        person["person_weight"] = hh_weight.reindex(pd.Index(person_hh)).values
        # A benunit sits in exactly one household; take it from its members.
        benunit_weight = (
            pd.Series(person["person_weight"].values, index=pd.Index(person["person_benunit_id"]))
            .groupby(level=0)
            .first()
        )
        benunit["benunit_weight"] = benunit_weight.reindex(pd.Index(benunit["benunit_id"])).values

        filepath = data_folder / f"{CALIBRATED_STEM}_year_{year}.h5"
        dataset = PolicyEngineUKDataset(
            name=f"{CALIBRATED_STEM}-year-{year}",
            description=(f"Enhanced FRS {year} with populace-calibrated household weights"),
            filepath=str(filepath),
            year=int(year),
            data=type(source.data)(
                person=MicroDataFrame(person, weights="person_weight"),
                benunit=MicroDataFrame(benunit, weights="benunit_weight"),
                household=MicroDataFrame(src, weights="household_weight"),
            ),
        )
        dataset.save()
        out[year] = dataset
    return out

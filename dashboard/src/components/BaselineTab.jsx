"use client";

import {
  formatBn,
  formatCount,
  formatCurrency,
  formatPct,
} from "../lib/formatters";
import { getCalibration, getValidation } from "../lib/dataHelpers";
import SectionHeading from "./SectionHeading";

// External benchmarks the recalibrated baseline is validated against. These
// are published HMRC/Advani figures, not model outputs, so they live here
// rather than in the pipeline JSON.
const BENCHMARKS = {
  taxpayers: { value: "~378k", source: "HMRC CGT statistics" },
  totalGains: { value: "~£70bn", source: "HMRC CGT statistics" },
  meanGain: { value: "~£174,000", source: "Implied by HMRC aggregates" },
  medianGain: { value: "~£25,000", source: "Advani & Summers (2020)" },
  shareOver1m: { value: "~60%", source: "Advani & Summers (2020)" },
  shareOver5m: { value: "~40%", source: "Advani & Summers (2020)" },
  baselineRevenue: { value: "£16–21bn", source: "OBR forecast range" },
};

function formatTarget(value) {
  // Calibration targets mix £bn aggregates and person counts.
  return value >= 1e5 ? formatCount(value) : formatBn(value);
}

export default function BaselineTab({ data }) {
  const calibration = getCalibration(data);
  const validation = getValidation(data);

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Recalibrating the baseline to HMRC capital gains data"
          description="The Family Resources Survey barely captures capital gains, so PolicyEngine's Enhanced FRS imputes them. Before running the reform, household weights are recalibrated with populace so that the imputed gains hit HMRC and OBR aggregates — the number of CGT taxpayers and the total gains they realise — while holding the survey's existing income and benefit aggregates in place."
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Calibration targets versus achieved"
          description={`Each row is a target the populace reweighting was asked to hit. The gains and taxpayer targets land within 0.05%, and the held aggregates that anchor the rest of the survey move by no more than 0.3%. The effective sample size falls from ${calibration.ess_before} to ${calibration.ess_after}, a modest cost in precision for a large gain in accuracy on gains.`}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Target</th>
              <th>Target value</th>
              <th>Achieved</th>
              <th>Relative error</th>
            </tr>
          </thead>
          <tbody>
            {calibration.targets.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{formatTarget(row.target)}</td>
                <td>{formatTarget(row.final)}</td>
                <td>{formatPct(row.relative_error, 2)}</td>
              </tr>
            ))}
            <tr>
              <td>Effective sample size (ESS)</td>
              <td>—</td>
              <td>
                {calibration.ess_before} → {calibration.ess_after}
              </td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </section>

      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Validation against HMRC and academic benchmarks"
          description="How the recalibrated baseline compares with published HMRC statistics and the HMRC-administrative-data analysis of Advani & Summers, benchmark by benchmark."
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Model versus external benchmarks"
          description="Aggregates match well by construction; the shape of the distribution matches less well, for the structural reason flagged below."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Quantity</th>
              <th>This model</th>
              <th>Benchmark</th>
              <th>Benchmark source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CGT taxpayers</td>
              <td>{formatCount(validation.cgt_taxpayers)}</td>
              <td>{BENCHMARKS.taxpayers.value}</td>
              <td>{BENCHMARKS.taxpayers.source}</td>
            </tr>
            <tr>
              <td>Total taxable gains</td>
              <td>{formatBn(validation.total_gains_bn)}</td>
              <td>{BENCHMARKS.totalGains.value}</td>
              <td>{BENCHMARKS.totalGains.source}</td>
            </tr>
            <tr>
              <td>Mean gain per CGT taxpayer</td>
              <td>{formatCurrency(validation.mean_gain)}</td>
              <td>{BENCHMARKS.meanGain.value}</td>
              <td>{BENCHMARKS.meanGain.source}</td>
            </tr>
            <tr>
              <td>Median gain per CGT taxpayer</td>
              <td>{formatCurrency(validation.median_gain)}</td>
              <td>{BENCHMARKS.medianGain.value}</td>
              <td>{BENCHMARKS.medianGain.source}</td>
            </tr>
            <tr>
              <td>Share of gains from gains ≥ £1m</td>
              <td>{formatPct(validation.share_gains_over_1m_pct, 0)}</td>
              <td>{BENCHMARKS.shareOver1m.value}</td>
              <td>{BENCHMARKS.shareOver1m.source}</td>
            </tr>
            <tr>
              <td>Share of gains from gains ≥ £5m</td>
              <td>{formatPct(validation.share_gains_over_5m_pct, 0)}</td>
              <td>{BENCHMARKS.shareOver5m.value}</td>
              <td>{BENCHMARKS.shareOver5m.source}</td>
            </tr>
            <tr>
              <td>Largest gain in the data</td>
              <td>£{validation.largest_gain_m}m</td>
              <td>Gains above £5m are common in HMRC data</td>
              <td>Advani &amp; Summers (2020)</td>
            </tr>
            <tr>
              <td>Baseline CGT revenue</td>
              <td>{formatBn(validation.baseline_cgt_revenue_bn)}</td>
              <td>{BENCHMARKS.baselineRevenue.value}</td>
              <td>{BENCHMARKS.baselineRevenue.source}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section-card note-card p-6">
        <p className="note-eyebrow eyebrow mb-2">
          Known limitation: the missing extreme tail
        </p>
        <p className="note-body text-sm leading-6">
          The extreme top tail of the gains distribution is structurally missing
          from the FRS-based imputation. In HMRC administrative data, gains of
          £1m or more account for roughly 60% of all gains and gains of £5m or
          more for roughly 40%; in this model the largest imputed gain is £
          {validation.largest_gain_m}m, so those shares are{" "}
          {formatPct(validation.share_gains_over_1m_pct, 0)} and{" "}
          {formatPct(validation.share_gains_over_5m_pct, 0)} respectively.
          Reweighting a household survey can hit aggregate totals but cannot
          create the handful of individuals with eight-figure gains that
          dominate the true distribution. The model instead spreads the same
          aggregate gains across more mid-sized realisations — which is why the
          median gain is above HMRC&apos;s and why revenue concentrated on the
          very largest gains (and their behavioural response) is approximated
          rather than directly observed.
        </p>
      </section>
    </div>
  );
}

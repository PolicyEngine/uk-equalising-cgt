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
  taxpayers: { value: "~378k", source: "HMRC CGT statistics", url: "https://www.gov.uk/government/statistics/capital-gains-tax-statistics" },
  totalGains: { value: "~£70bn", source: "HMRC CGT statistics", url: "https://www.gov.uk/government/statistics/capital-gains-tax-statistics" },
  meanGain: { value: "~£174,000", source: "Implied by HMRC aggregates", url: "https://www.gov.uk/government/statistics/capital-gains-tax-statistics" },
  medianGain: { value: "~£25,000", source: "Advani & Summers (2020)", url: "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/publications/workingpapers/2020/capital_gains_and_uk_inequality/" },
  shareOver1m: { value: "~60%", source: "Advani & Summers (2020)", url: "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/publications/workingpapers/2020/capital_gains_and_uk_inequality/" },
  shareOver5m: { value: "~40%", source: "Advani & Summers (2020)", url: "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/publications/workingpapers/2020/capital_gains_and_uk_inequality/" },
  baselineRevenue: { value: "£16–21bn", source: "OBR forecast range", url: "https://obr.uk/forecasts-in-depth/tax-by-tax-spend-by-spend/capital-gains-tax/" },
};

function BenchmarkCell({ benchmark }) {
  return (
    <td>
      <a
        href={benchmark.url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline decoration-1 underline-offset-2 hover:opacity-80"
        title={benchmark.source}
      >
        {benchmark.value}
      </a>
    </td>
  );
}

// Human labels and formats for the pipeline's raw calibration target names.
const TARGET_LABELS = {
  total_capital_gains: { label: "Total taxable capital gains", money: true },
  cgt_taxpayer_count: { label: "CGT taxpayer count", money: false },
  income_tax_total: { label: "Income tax (held)", money: true },
  net_income_total: { label: "Household net income (held)", money: true },
  population: { label: "Population (held)", money: false },
  households: { label: "Households (held)", money: false },
};

function targetMeta(name) {
  const key = name.replace(/@\d+$/, "");
  return TARGET_LABELS[key] ?? { label: key.replace(/_/g, " "), money: false };
}

function formatTarget(value, money) {
  return money ? formatBn(value / 1e9) : formatCount(value);
}

export default function BaselineTab({ data }) {
  const calibration = getCalibration(data);
  const validation = getValidation(data);

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Baseline estimation"
          description="The Family Resources Survey barely captures capital gains, so PolicyEngine's Enhanced FRS imputes them. Before running the reform, household weights are recalibrated with populace so that the imputed gains hit HMRC and OBR aggregates — the number of CGT taxpayers and the total gains they realise — while holding the survey's existing income and benefit aggregates in place."
        />
      </div>


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
              <th>PolicyEngine</th>
              <th>Official statistic</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>CGT taxpayers</td>
              <td>{formatCount(validation.cgt_taxpayers)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.taxpayers} />
            </tr>
            <tr>
              <td>Total taxable gains</td>
              <td>{formatBn(validation.total_gains_bn)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.totalGains} />
            </tr>
            <tr>
              <td>Mean gain per CGT taxpayer</td>
              <td>{formatCurrency(validation.mean_gain)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.meanGain} />
            </tr>
            <tr>
              <td>Median gain per CGT taxpayer</td>
              <td>{formatCurrency(validation.median_gain)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.medianGain} />
            </tr>
            <tr>
              <td>Share of gains from gains ≥ £1m</td>
              <td>{formatPct(validation.share_gains_over_1m_pct, 0)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.shareOver1m} />
            </tr>
            <tr>
              <td>Share of gains from gains ≥ £5m</td>
              <td>{formatPct(validation.share_gains_over_5m_pct, 0)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.shareOver5m} />
            </tr>
            <tr>
              <td>Largest gain in the data</td>
              <td>£{validation.largest_gain_m.toFixed(1)}m</td>
              <td>
                <a
                  href="https://warwick.ac.uk/fac/soc/economics/research/centres/cage/publications/workingpapers/2020/capital_gains_and_uk_inequality/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-1 underline-offset-2 hover:opacity-80"
                  title="Advani & Summers (2020)"
                >
                  Gains above £5m are common in HMRC data
                </a>
              </td>
            </tr>
            <tr>
              <td>Baseline CGT revenue</td>
              <td>{formatBn(validation.baseline_cgt_revenue_bn)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.baselineRevenue} />
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
          {validation.largest_gain_m.toFixed(1)}m, so those shares are{" "}
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

"use client";

import {
  formatBn,
  formatCount,
  formatCurrency,
  formatPct,
  formatSignedBn,
} from "../lib/formatters";
import { getCalibration, getComparison, getValidation } from "../lib/dataHelpers";
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
  const comparison = getComparison(data);

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Baseline estimation"
          description="The Family Resources Survey barely captures capital gains, so PolicyEngine's Enhanced FRS imputes them and household weights are recalibrated with populace to hit HMRC and OBR capital gains aggregates, holding the survey's existing income and benefit aggregates in place. The table compares the recalibrated baseline with published HMRC statistics and the OBR forecast."
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Model versus external benchmarks"
          description="Aggregates match published statistics by construction."
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
              <td>Baseline CGT revenue</td>
              <td>{formatBn(validation.baseline_cgt_revenue_bn)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.baselineRevenue} />
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section-card scroll-mt-24" id="comparison">
        <SectionHeading
          title="Comparison with other institutions"
          description="Estimates differ mainly because the reforms modelled and the behavioural assumptions differ, not because the models disagree about the same question."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th>Reform modelled</th>
              <th>Behavioural assumption</th>
              <th>Revenue (£bn/year)</th>
            </tr>
          </thead>
          <tbody>
            {comparison.map((row) => (
              <tr
                key={row.source}
                className={
                  row.source.startsWith("This model") ? "font-semibold" : ""
                }
              >
                <td>{row.source}</td>
                <td>{row.reform_modelled}</td>
                <td>{row.behavioural_assumption}</td>
                <td>{formatSignedBn(row.revenue_bn_per_year)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The interpretation: equalising <em>rates only</em>, at Advani&apos;s
          central elasticity, raises only about £2.3–2.8bn a year. CenTax&apos;s
          much larger £14bn figure comes from pairing equalisation with base
          broadening — removing the uplift at death and adding exit charges —
          which shuts down the main avoidance margins and so supports a smaller
          behavioural response (its worst case is £9.6bn). Advani &amp;
          Summers&apos; £16.7bn is a static score of a similar reform;
          HMRC&apos;s ready reckoner, with a much higher implied elasticity,
          scores even a 10-point rate rise as <em>losing</em> around £2bn a
          year. The IFS similarly argues that raising rates without reforming
          the base would raise little. All sit against an OBR baseline of
          roughly £16.2bn of CGT revenue.
        </p>
      </section>

    </div>
  );
}

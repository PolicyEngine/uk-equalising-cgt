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

// External benchmarks the baseline is validated against. These
// are published HMRC/Advani figures, not model outputs, so they live here
// rather than in the pipeline JSON.
const BENCHMARKS = {
  taxpayers: { value: "~378k", source: "HMRC CGT statistics", url: "https://www.gov.uk/government/statistics/capital-gains-tax-statistics" },
  totalGains: { value: "~£66bn (2023-24)", source: "HMRC CGT statistics", url: "https://www.gov.uk/government/statistics/capital-gains-tax-statistics" },
  meanGain: { value: "~£174,000", source: "Implied by HMRC aggregates", url: "https://www.gov.uk/government/statistics/capital-gains-tax-statistics" },
  medianGain: { value: "~£25,000", source: "Advani & Summers (2020)", url: "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/publications/workingpapers/2020/capital_gains_and_uk_inequality/" },
  shareOver1m: { value: "~60%", source: "Advani & Summers (2020)", url: "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/publications/workingpapers/2020/capital_gains_and_uk_inequality/" },
  shareOver5m: { value: "~40%", source: "Advani & Summers (2020)", url: "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/publications/workingpapers/2020/capital_gains_and_uk_inequality/" },
  staticEqualisation: {
    value: "£16.7bn",
    source: "Advani & Summers, static, GDP-uprated",
    url: "https://arunadvani.com/taxreform.html",
  },
  baselineRevenue: { value: "£20.3bn (2025-26)", source: "OBR forecast", url: "https://obr.uk/forecasts-in-depth/tax-by-tax-spend-by-spend/capital-gains-tax/" },
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

const COMPARISON_LINKS = {
  "CenTax central": "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=5",
  "CenTax worst-case": "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=39",
  "Advani & Summers 2020": "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/manage/publications/wp465.2020.pdf",
  "HMRC ready reckoner": "https://www.gov.uk/government/statistics/direct-effects-of-illustrative-tax-changes",
  "OBR baseline": "https://obr.uk/forecasts-in-depth/tax-by-tax-spend-by-spend/capital-gains-tax/",
  "This model": "https://github.com/PolicyEngine/uk-equalising-cgt",
};

function comparisonLink(source) {
  const key = Object.keys(COMPARISON_LINKS).find((prefix) => source.startsWith(prefix));
  return key ? COMPARISON_LINKS[key] : null;
}

export default function BaselineTab({ data }) {
  const calibration = getCalibration(data);
  const validation = getValidation(data);
  const comparison = getComparison(data);
  const staticRow = comparison.find((row) => row.source.includes("static"));
  const centralRow = comparison.find((row) => row.source.includes("2026-27"));

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Baseline estimation"
          description="The Family Resources Survey barely captures capital gains, so PolicyEngine's Enhanced FRS imputes them from HMRC administrative data. Left as imputed, that baseline has roughly three times as many CGT taxpayers as HMRC records, so household weights are recalibrated with populace to hit HMRC's taxpayer count and total gains while holding income tax, net income, population and household counts fixed. policyengine.py then simulates the reform on the reweighted dataset."
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Model versus external benchmarks"
          description="PolicyEngine's baseline and reform estimates alongside the closest official or academic number. Rows are limited to quantities this model can compute directly."
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
            <tr>
              <td>Equalisation revenue, static</td>
              <td>{staticRow ? formatSignedBn(staticRow.revenue_bn_per_year, 1) : "—"}</td>
              <BenchmarkCell benchmark={BENCHMARKS.staticEqualisation} />
            </tr>
            <tr>
              <td>Equalisation revenue, with behavioural response (e=−0.7), 2026-27</td>
              <td>{centralRow ? formatSignedBn(centralRow.revenue_bn_per_year, 1) : "—"}</td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Estimates differ mainly because the reforms and behavioural
          assumptions differ, not because the models disagree:{" "}
          <a
            href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=5"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            CenTax&apos;s £14bn
          </a>{" "}
          pairs equalisation with base broadening not modelled here, and{" "}
          <a
            href="https://www.gov.uk/government/statistics/direct-effects-of-illustrative-tax-changes"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            HMRC&apos;s ready reckoner
          </a>{" "}
          implies so much behaviour that rate rises lose revenue.
        </p>
      </section>

    </div>
  );
}

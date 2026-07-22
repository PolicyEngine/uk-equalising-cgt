"use client";

import { formatBn, formatCount } from "../lib/formatters";
import { getValidation } from "../lib/dataHelpers";
import SectionHeading from "./SectionHeading";

// External benchmarks the baseline is validated against. These
// are published HMRC/Advani figures, not model outputs, so they live here
// rather than in the pipeline JSON.
const BENCHMARKS = {
  // Figures below are from HMRC's Capital Gains Tax statistics, 2023-24
  // (provisional). The aggregate £65.9bn is stated in the published
  // commentary; the band figures are from Table 2.1a (sheet 2_1a_2023-24 of
  // the size-of-gain ODS, linked directly). Shares are ratios within that
  // table: gains of £1m+ = £38.3bn and £5m+ = £22.7bn of the £62.9bn table
  // total (the published aggregate differs slightly through rounding).
  totalGains: { value: "£66bn", source: "HMRC CGT statistics commentary", url: "https://www.gov.uk/government/statistics/capital-gains-tax-statistics/capital-gains-tax-commentary" },
  shareOver1m: { value: "61%", source: "HMRC CGT statistics, Table 2.1a (ODS, sheet 2_1a_2023-24)", url: "https://assets.publishing.service.gov.uk/media/6878ac562bad77c3dae4dcef/Table_2_2025_Size_of_gain.ods" },
  shareOver5m: { value: "36%", source: "HMRC CGT statistics, Table 2.1a (ODS, sheet 2_1a_2023-24)", url: "https://assets.publishing.service.gov.uk/media/6878ac562bad77c3dae4dcef/Table_2_2025_Size_of_gain.ods" },
  taxpayersOver500k: { value: "18k", source: "HMRC CGT statistics, Table 2.1a (ODS, sheet 2_1a_2023-24)", url: "https://assets.publishing.service.gov.uk/media/6878ac562bad77c3dae4dcef/Table_2_2025_Size_of_gain.ods" },
  gainsOver500k: { value: "£44bn", source: "HMRC CGT statistics, Table 2.1a (ODS, sheet 2_1a_2023-24)", url: "https://assets.publishing.service.gov.uk/media/6878ac562bad77c3dae4dcef/Table_2_2025_Size_of_gain.ods" },
  gainsOver5m: { value: "£22.7bn", source: "HMRC CGT statistics, Table 2.1a (ODS, sheet 2_1a_2023-24)", url: "https://assets.publishing.service.gov.uk/media/6878ac562bad77c3dae4dcef/Table_2_2025_Size_of_gain.ods" },
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

export default function BaselineTab({ data }) {
  const validation = getValidation(data);

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="Baseline estimation"
          description="The Family Resources Survey barely captures capital gains, so PolicyEngine's Enhanced FRS imputes them from HMRC administrative data and calibrates household weights to HMRC's CGT aggregates and size-of-gain distribution. This analysis uses that dataset exactly as published by policyengine-uk-data, with no local reweighting: calibration belongs upstream in the data, not in an analysis repository. The table below shows the fit: total gains and their concentration at the top track HMRC closely, while the modelled taxpayer count (about 600k) still runs above HMRC's 378,000 — so read the share of people affected by the reform as a modest upper bound on breadth."
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title="Model versus external benchmarks"
          description="PolicyEngine's baseline for the first simulated year, 2026-27, alongside HMRC's most recent published statistics — the 2023-24 tax year (July 2025 release; the 2024-25 statistics are due around August 2026). The vintages differ by design: the dataset uprates 2023-24 administrative gains to the simulated years. The model aligns closely with HMRC across the table — most tightly at the top of the distribution, where the reform\u2019s revenue is decided: taxpayers with gains over £500k and the gains in the £5m-and-over band match administrative records within a few per cent."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Quantity</th>
              <th>PolicyEngine (2026-27)</th>
              <th>Official statistic (2023-24)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total taxable gains</td>
              <td>{formatBn(validation.total_gains_bn)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.totalGains} />
            </tr>
            <tr>
              <td>Share of gains from gains of £1m or more</td>
              <td>{validation.share_gains_over_1m_pct.toFixed(0)}%</td>
              <BenchmarkCell benchmark={BENCHMARKS.shareOver1m} />
            </tr>
            <tr>
              <td>Share of gains from gains of £5m or more</td>
              <td>{validation.share_gains_over_5m_pct.toFixed(0)}%</td>
              <BenchmarkCell benchmark={BENCHMARKS.shareOver5m} />
            </tr>
            <tr>
              <td>Taxpayers with gains over £500k</td>
              <td>{formatCount(validation.taxpayers_over_500k)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.taxpayersOver500k} />
            </tr>
            <tr>
              <td>Gains held by taxpayers with gains over £500k</td>
              <td>{formatBn(validation.gains_over_500k_bn)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.gainsOver500k} />
            </tr>
            <tr>
              <td>Gains held in the £5m-and-over band</td>
              <td>{formatBn(validation.gains_over_5m_bn)}</td>
              <BenchmarkCell benchmark={BENCHMARKS.gainsOver5m} />
            </tr>
          </tbody>
        </table>
      </section>


    </div>
  );
}

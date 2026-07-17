"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { colors } from "../lib/colors";
import {
  formatBn,
  formatPct,
  formatSignedBn,
  formatSignedCurrency,
  formatSignedPct,
} from "../lib/formatters";
import {
  getBudget,
  getDecileImpact,
  getFirstYear,
  getFiveYearTotal,
  getSensitivity,
  getWinnersLosers,
  getReform,
  getYearLabels,
} from "../lib/dataHelpers";
import ChartLogo from "./ChartLogo";
import SectionHeading from "./SectionHeading";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

function Toggle({ options, value, onChange }) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-300 text-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? "bg-[color:var(--pe-color-primary-600)] px-3 py-1.5 font-semibold text-white"
              : "bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function YearSelect({ years, value, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
      Year
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800"
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}

function MetricCard({ label, value, note }) {
  return (
    <div className="metric-card">
      <p className="text-sm font-semibold leading-snug text-slate-700">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {note && (
        <p className="mt-2 border-t border-slate-100 pt-2 text-xs leading-5 text-slate-500">
          {note}
        </p>
      )}
    </div>
  );
}

function TipHeader({ label, tip }) {
  return (
    <th>
      {label}{" "}
      <span className="info-tip" tabIndex={0}>
        i<span className="info-tip-bubble">{tip}</span>
      </span>
    </th>
  );
}

// Where each sensitivity scenario's elasticity comes from. Keys match the
// scenario names emitted by the pipeline's SENSITIVITY_CASES.
const ELASTICITY_SOURCES = {
  "Static (Advani & Summers 2020 style)": {
    label: "Advani & Summers (2020), CAGE WP 465",
    url: "https://warwick.ac.uk/fac/soc/economics/research/centres/cage/manage/publications/wp465.2020.pdf",
  },
  "CenTax lower (retention e=0.5)": {
    label: "Advani, Lonsdale & Summers (2024), CenTax",
    url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
  },
  "CenTax central (retention e=1.0)": {
    label: "Advani, Lonsdale & Summers (2024), CenTax",
    url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
  },
  "CenTax upper (retention e=2.0)": {
    label: "Advani, Lonsdale & Summers (2024), CenTax",
    url: "https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38",
  },
  "HMRC ready-reckoner-like": {
    label: "HMRC, Direct effects of illustrative tax changes",
    url: "https://www.gov.uk/government/statistics/direct-effects-of-illustrative-tax-changes",
  },
};

function SourceLink({ name }) {
  const source = ELASTICITY_SOURCES[name];
  if (!source) return <td>—</td>;
  return (
    <td>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-normal text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 hover:opacity-80"
      >
        {source.label}
      </a>
    </td>
  );
}

export default function ReformTab({ data }) {
  const budget = getBudget(data);
  const firstYear = getFirstYear(data);
  const years = getYearLabels(data);
  const fiveYearTotal = getFiveYearTotal(data);
  const [budgetView, setBudgetView] = useState("change");
  const [decileYear, setDecileYear] = useState(firstYear);
  const [decileMetric, setDecileMetric] = useState("relative");
  const [wlYear, setWlYear] = useState(firstYear);
  const deciles = getDecileImpact(data, decileYear);
  const headlineDeciles = getDecileImpact(data, firstYear);
  const winnersLosers = getWinnersLosers(data, wlYear);
  const headlineWl = getWinnersLosers(data, firstYear);
  const sensitivity = getSensitivity(data);
  const reform = getReform(data);
  const firstYearRow = budget[0];
  const topDecile = headlineDeciles.find((d) => d.decile === 10);
  const allRow = headlineWl.find((row) => row.decile === "All");
  const decileRows = winnersLosers.filter((row) => row.decile !== "All");
  const isDecileRelative = decileMetric === "relative";
  const loseAnyPct = allRow.lose_less_5_pct + allRow.lose_more_5_pct;
  const gainAnyPct = allRow.gain_less_5_pct + allRow.gain_more_5_pct;

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <SectionHeading
          size="lg"
          title="The proposed reform"
          description={`Capital gains are currently taxed at lower rates than income. The reform aligns each CGT rate with the corresponding income tax rate from ${firstYear}: the basic rate rises from ${formatPct(reform.basic_rate.baseline * 100, 0)} to ${formatPct(reform.basic_rate.reform * 100, 0)}, the higher rate from ${formatPct(reform.higher_rate.baseline * 100, 0)} to ${formatPct(reform.higher_rate.reform * 100, 0)}, and the additional rate from ${formatPct(reform.additional_rate.baseline * 100, 0)} to ${formatPct(reform.additional_rate.reform * 100, 0)}. Taxpayers respond by realising fewer gains, modelled with Advani/CenTax's central retention-rate elasticity of 1.0 (≈ MTR elasticity of −0.7).`}
        />
      </div>

      <section className="section-card">
        <SectionHeading
          title={`Headline results, ${firstYear}`}
          description="Revenue after the behavioural response; distributional figures cover all households."
        />
        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard
            label={`Revenue raised, ${firstYear}`}
            value={formatSignedBn(firstYearRow.gov_balance_change_bn, 1)}
            note="Net change in the government balance after taxpayers reduce realisations in response to the higher rates."
          />
          <MetricCard
            label="Five-year total, 2026-27 to 2030-31"
            value={formatSignedBn(fiveYearTotal, 1)}
            note="Sum of the annual government balance changes over the five modelled years."
          />
          <MetricCard
            label="Top decile net income change"
            value={formatSignedPct(topDecile.relative_change_pct)}
            note={`Average of ${formatSignedCurrency(topDecile.avg_change_gbp)} per household in decile 10, where realised gains are concentrated.`}
          />
          <MetricCard
            label="People losing income"
            value={formatPct(loseAnyPct)}
            note={`${formatPct(allRow.lose_more_5_pct)} of people lose more than 5% of net income; ${gainAnyPct === 0 ? "no household gains" : `${formatPct(gainAnyPct)} gain`}. Only those realising gains are affected.`}
          />
        </div>
      </section>

      <details className="section-card group">
        <summary className="cursor-pointer select-none font-semibold text-slate-800 marker:text-[color:var(--pe-color-primary-600)]">
          What exactly does the reform change?
          <span className="ml-2 text-sm font-normal text-slate-500 group-open:hidden">
            (expand for the full specification)
          </span>
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            Effective from the 2026-27 fiscal year and held in place through 2030-31. All results on
            this page compare this reform against current policy on the same recalibrated baseline.
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Policy parameter</th>
                <th>Baseline (current policy)</th>
                <th>Reform</th>
                <th>What it means</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic CGT rate</td>
                <td>{formatPct(reform.basic_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.basic_rate.reform * 100, 0)}</td>
                <td>Gains falling in the basic income tax band are taxed at the 20% basic income tax rate.</td>
              </tr>
              <tr>
                <td>Higher CGT rate</td>
                <td>{formatPct(reform.higher_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.higher_rate.reform * 100, 0)}</td>
                <td>Gains in the higher band are taxed at the 40% higher income tax rate — the largest rise in the package.</td>
              </tr>
              <tr>
                <td>Additional CGT rate</td>
                <td>{formatPct(reform.additional_rate.baseline * 100, 0)}</td>
                <td className="font-semibold">{formatPct(reform.additional_rate.reform * 100, 0)}</td>
                <td>Gains in the additional band (income over £125,140) are taxed at the 45% additional income tax rate.</td>
              </tr>
              <tr>
                <td>Annual exempt amount</td>
                <td>£3,000</td>
                <td>£3,000</td>
                <td>Unchanged: the first £3,000 of gains each year stays tax-free.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      <section className="section-card">
        <SectionHeading
          title="Budgetary impact by year"
          description="Baseline and reform CGT revenue, and the net change in the government balance, for each fiscal year. Baseline revenue grows with the OBR's forecast of gains; the reform raises a broadly stable increment on top."
        />
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <Toggle
            options={[
              { value: "levels", label: "Revenue levels" },
              { value: "change", label: "Change vs baseline" },
            ]}
            value={budgetView}
            onChange={setBudgetView}
          />
        </div>
        <div className="h-[380px] w-full">
          <ResponsiveContainer>
            <BarChart data={budget} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
              <XAxis dataKey="year" tick={AXIS_STYLE} />
              <YAxis
                tick={AXIS_STYLE}
                tickFormatter={(v) => formatBn(v)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip formatter={(v) => formatBn(v)} />
              <Legend />
              {budgetView === "levels" ? (
                <>
                  <Bar
                    dataKey="baseline_cgt_bn"
                    name="Baseline CGT revenue"
                    fill={colors.gray[400]}
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="reform_cgt_bn"
                    name="Reform CGT revenue"
                    fill={colors.primary[600]}
                    radius={[6, 6, 0, 0]}
                  />
                </>
              ) : (
                <Bar
                  dataKey="gov_balance_change_bn"
                  name="Government balance change"
                  fill={colors.primary[600]}
                  radius={[6, 6, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLogo />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
      <section className="section-card">
        <SectionHeading
          title="Average household net income change"
          description="Average change in household net income by baseline income decile. Losses are concentrated in decile 10, where most taxable gains are realised."
        />
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <Toggle
            options={[
              { value: "relative", label: "Relative (%)" },
              { value: "absolute", label: "Average £ per household" },
            ]}
            value={decileMetric}
            onChange={setDecileMetric}
          />
          <YearSelect years={years} value={decileYear} onChange={setDecileYear} />
        </div>
        <div className="h-[380px] w-full">
          <ResponsiveContainer>
            <BarChart data={deciles} margin={{ top: 10, right: 20, bottom: 15, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
              <XAxis
                dataKey="decile"
                tick={AXIS_STYLE}
                label={{
                  value: "Income decile (1 = lowest income)",
                  position: "insideBottom",
                  offset: -8,
                  fontSize: 12,
                }}
              />
              <YAxis
                tick={AXIS_STYLE}
                tickFormatter={(v) =>
                  isDecileRelative ? formatSignedPct(v, 1) : formatSignedCurrency(v)
                }
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v, name, item) => [
                  `${formatSignedPct(item.payload.relative_change_pct)} (${formatSignedCurrency(item.payload.avg_change_gbp)}/household)`,
                  "Net income change",
                ]}
                labelFormatter={(label) => `Decile ${label}`}
              />
              <Bar
                dataKey={isDecileRelative ? "relative_change_pct" : "avg_change_gbp"}
                name={
                  isDecileRelative
                    ? "Relative net income change"
                    : "Average change per household"
                }
                fill={colors.primary[600]}
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLogo />
      </section>

      <section className="section-card">
        <SectionHeading
          title="Winners and losers"
          description="Share of people in each decile by outcome. The reform creates no gainers; changes below £1 a year count as no change."
        />
        <div className="mb-3 flex flex-wrap items-center gap-4">
          <YearSelect years={years} value={wlYear} onChange={setWlYear} />
        </div>
        <div className="h-[380px] w-full">
          <ResponsiveContainer>
            <BarChart
              data={decileRows}
              layout="vertical"
              stackOffset="none"
              margin={{ top: 10, right: 20, bottom: 15, left: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
              <XAxis
                type="number"
                tick={AXIS_STYLE}
                tickFormatter={(v) => `${Math.round(v)}%`}
                domain={[0, 100]}
                allowDataOverflow
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="decile"
                reversed
                tick={AXIS_STYLE}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => formatPct(v)}
                labelFormatter={(label) => `Decile ${label}`}
              />
              <Legend formatter={(value) => <span style={{ color: "#475569" }}>{value}</span>} />
              <Bar
                dataKey="no_change_pct"
                name="No change"
                stackId="wl"
                fill={colors.gray[200]}
                radius={[6, 0, 0, 6]}
              />
              <Bar
                dataKey="lose_less_5_pct"
                name="Lose less than 5%"
                stackId="wl"
                fill={colors.primary[400]}
              />
              <Bar
                dataKey="lose_more_5_pct"
                name="Lose more than 5%"
                stackId="wl"
                fill={colors.primary[800]}
                radius={[0, 6, 6, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLogo />
      </section>
      </div>

      <section className="section-card">
        <SectionHeading
          title="Sensitivity to the behavioural elasticity"
          description="The revenue estimate hinges on how strongly taxpayers reduce realisations when rates rise. Each row re-runs the reform with a different marginal-tax-rate elasticity of realised gains. The bold row is the central Advani/CenTax assumption used everywhere else in this dashboard; at HMRC-like responsiveness the reform loses money. Retention-rate elasticities are converted at the reformed 40–45% rates; CenTax’s 0.5–2.0 range is anchored on Agersnap & Zidar (2021) and Lavecchia & Tazhitdinova (2024)."
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <TipHeader
                label="MTR elasticity"
                tip="Percentage change in realised gains for a one per cent change in the marginal tax rate. Converted from retention-rate elasticities via e_mtr = e_retention × t/(1−t)."
              />
              <TipHeader
                label={`Revenue, ${firstYear}`}
                tip="Net change in the government balance in the first year of the reform under this elasticity."
              />
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {sensitivity.map((row) => (
              <tr
                key={row.name}
                className={row.e_mtr === -0.7 ? "font-semibold" : ""}
              >
                <td>{row.name}</td>
                <td>{row.e_mtr.toFixed(2)}</td>
                <td>{formatSignedBn(row.revenue_2026_bn)}</td>
                <SourceLink name={row.name} />
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

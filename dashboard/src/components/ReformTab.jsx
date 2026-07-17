"use client";

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
} from "../lib/dataHelpers";
import ChartLogo from "./ChartLogo";
import SectionHeading from "./SectionHeading";

const AXIS_STYLE = { fontSize: 12, fill: colors.gray[500] };

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

export default function ReformTab({ data }) {
  const budget = getBudget(data);
  const firstYear = getFirstYear(data);
  const fiveYearTotal = getFiveYearTotal(data);
  const deciles = getDecileImpact(data, firstYear);
  const winnersLosers = getWinnersLosers(data);
  const sensitivity = getSensitivity(data);
  const reform = getReform(data);
  const firstYearRow = budget[0];
  const topDecile = deciles.find((d) => d.decile === 10);
  const allRow = winnersLosers.find((row) => row.decile === "All");
  const decileRows = winnersLosers.filter((row) => row.decile !== "All");
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
            value={formatSignedBn(firstYearRow.gov_balance_change_bn)}
            note="Net change in the government balance after taxpayers reduce realisations in response to the higher rates."
          />
          <MetricCard
            label="Five-year total, 2026-27 to 2030-31"
            value={formatSignedBn(fiveYearTotal)}
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

      <section className="section-card">
        <SectionHeading
          title="Budgetary impact by year"
          description="Baseline and reform CGT revenue, and the net change in the government balance, for each fiscal year. Baseline revenue grows with the OBR's forecast of gains; the reform raises a broadly stable increment on top."
        />
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
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLogo />
        <table className="data-table mt-4">
          <thead>
            <tr>
              <th>Year</th>
              <TipHeader
                label="Baseline CGT"
                tip="CGT revenue with no reform, on the recalibrated baseline."
              />
              <TipHeader
                label="Reform CGT"
                tip="CGT revenue under equalised rates, after the behavioural response."
              />
              <TipHeader
                label="CGT change"
                tip="Reform minus baseline CGT revenue."
              />
              <TipHeader
                label="Government balance"
                tip="Net change in the consolidated government balance, including any knock-on tax effects."
              />
            </tr>
          </thead>
          <tbody>
            {budget.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                <td>{formatBn(row.baseline_cgt_bn)}</td>
                <td>{formatBn(row.reform_cgt_bn)}</td>
                <td>{formatSignedBn(row.cgt_change_bn)}</td>
                <td>{formatSignedBn(row.gov_balance_change_bn)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td>Five-year total</td>
              <td>—</td>
              <td>—</td>
              <td>
                {formatSignedBn(
                  budget.reduce((sum, row) => sum + row.cgt_change_bn, 0),
                )}
              </td>
              <td>{formatSignedBn(fiveYearTotal)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="section-card">
        <SectionHeading
          title={`Average household net income change by decile, ${firstYear}`}
          description="Relative change in household net income across all households in each baseline income decile, gainers and non-gainers alike. Every decile loses on average — nobody's tax falls — but the impact is concentrated in decile 10, where most taxable gains are realised. Decile 1's larger relative loss reflects a small number of low-income households with large realised gains."
        />
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
                tickFormatter={(v) => formatSignedPct(v, 1)}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v, name, item) => [
                  `${formatSignedPct(v)} (${formatSignedCurrency(item.payload.avg_change_gbp)}/household)`,
                  "Net income change",
                ]}
                labelFormatter={(label) => `Decile ${label}`}
              />
              <Bar
                dataKey="relative_change_pct"
                name="Relative net income change"
                fill={colors.primary[600]}
                radius={[0, 0, 6, 6]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLogo />
      </section>

      <section className="section-card">
        <SectionHeading
          title={`Winners and losers by decile, ${firstYear}`}
          description="Share of people in each income decile by outcome. The reform creates no gainers: nobody's tax liability falls, so every bar is split between people whose household net income is unchanged and those who lose. Changes below £1 a year are counted as no change."
        />
        <div className="h-[380px] w-full">
          <ResponsiveContainer>
            <BarChart
              data={decileRows}
              stackOffset="none"
              margin={{ top: 10, right: 20, bottom: 15, left: 10 }}
            >
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
                tickFormatter={(v) => `${v}%`}
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                formatter={(v) => formatPct(v)}
                labelFormatter={(label) => `Decile ${label}`}
              />
              <Legend />
              <Bar
                dataKey="no_change_pct"
                name="No change"
                stackId="wl"
                fill={colors.gray[200]}
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
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLogo />
      </section>

      <section className="section-card">
        <SectionHeading
          title={`Sensitivity to the behavioural elasticity, ${firstYear}`}
          description="The revenue estimate hinges on how strongly taxpayers reduce realisations when rates rise. Each row re-runs the reform with a different marginal-tax-rate elasticity of realised gains. The bold row is the central Advani/CenTax assumption used everywhere else in this dashboard; at HMRC-like responsiveness the reform loses money."
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

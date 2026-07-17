"use client";

import { useEffect } from "react";
import { formatPct } from "../lib/formatters";
import { getComparison } from "../lib/dataHelpers";
import SectionHeading from "./SectionHeading";

export default function MethodologyTab({ data }) {
  // Analysis sections can link here with /?tab=methodology#<id>; the tab
  // mounts after navigation, so the browser's native hash scroll has already
  // missed and we replay it.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    }
  }, []);

  const reform = data.metadata.reform;
  const elasticity = data.metadata.elasticity;
  const comparison = getComparison(data);

  return (
    <div className="space-y-6">
      <section className="section-card scroll-mt-24" id="reform-spec">
        <SectionHeading
          title="Reform specification"
          description={`Modelled in PolicyEngine UK (${data.metadata.policyengine_uk_version}) over ${data.metadata.years[0]} to ${data.metadata.years[data.metadata.years.length - 1]}.`}
        />
        <table className="data-table">
          <thead>
            <tr>
              <th>CGT rate</th>
              <th>Baseline</th>
              <th>Reform (aligned with income tax)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic rate</td>
              <td>{formatPct(reform.basic_rate.baseline * 100, 0)}</td>
              <td>{formatPct(reform.basic_rate.reform * 100, 0)}</td>
            </tr>
            <tr>
              <td>Higher rate</td>
              <td>{formatPct(reform.higher_rate.baseline * 100, 0)}</td>
              <td>{formatPct(reform.higher_rate.reform * 100, 0)}</td>
            </tr>
            <tr>
              <td>Additional rate</td>
              <td>{formatPct(reform.additional_rate.baseline * 100, 0)}</td>
              <td>{formatPct(reform.additional_rate.reform * 100, 0)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Rates only: the annual exempt amount, Business Asset Disposal Relief,
          the uplift at death and the rest of the CGT base are left unchanged.
          That distinction matters when comparing revenue estimates across
          institutions (see the comparison table below).
        </p>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="Behavioural response: the Advani/CenTax elasticity"
          description="How the retention-rate elasticity in the literature maps onto the marginal-tax-rate elasticity the model applies."
        />
        <p className="text-sm leading-6 text-slate-600">
          Arun Advani and CenTax express the responsiveness of realised gains as
          an elasticity with respect to the <em>retention rate</em> (1 − t): how
          much realisations rise when taxpayers keep a larger share of each
          pound of gain. PolicyEngine applies an elasticity with respect to the{" "}
          <em>marginal tax rate</em> t. The two are related by
        </p>
        <p className="my-3 rounded-lg bg-slate-50 p-4 text-center font-mono text-sm">
          e<sub>mtr</sub> = e<sub>retention</sub> × t / (1 − t)
        </p>
        <p className="text-sm leading-6 text-slate-600">
          because a small rise in t is a proportionally larger fall in (1 − t)
          when t is high. At the gains-weighted average marginal rates under the
          reform, the central retention-rate elasticity of{" "}
          {elasticity.retention_rate_elasticity.toFixed(1)} converts to an MTR
          elasticity of about{" "}
          {elasticity.mtr_elasticity_approx.toFixed(1)}, which is what the model
          applies. The reform tab&apos;s sensitivity table re-runs the analysis
          across the CenTax range and an HMRC-like high-response case.
        </p>
      </section>

      <section className="section-card scroll-mt-24" id="calibration-method">
        <SectionHeading
          title="Baseline recalibration with populace"
          description="Reweighting the Enhanced FRS so its imputed capital gains match administrative aggregates."
        />
        <p className="text-sm leading-6 text-slate-600">
          The Enhanced FRS imputes capital gains onto survey households, but the
          raw weights understate both the number of CGT taxpayers and total
          gains. We use populace, PolicyEngine&apos;s survey-calibration
          library, to adjust household weights by gradient descent against a
          loss over calibration targets: total taxable gains (£70bn) and the
          CGT taxpayer count (400k) from HMRC/OBR, alongside held targets for
          the survey&apos;s existing income tax, employment income and benefit
          aggregates so the recalibration cannot degrade the rest of the model.
          The Baseline &amp; calibration tab reports every target, the achieved
          value, and the effective-sample-size cost of the reweighting.
        </p>
      </section>

      <section className="section-card scroll-mt-24" id="pitfalls">
        <SectionHeading
          title="Three simulation pitfalls, and how they are handled"
          description="Each of these silently produces wrong numbers in the Rust-backed policyengine-uk-compiled stack if unhandled; the pipeline guards against all three."
        />
        <ul className="list-disc space-y-3 pl-6 text-sm leading-6 text-slate-600">
          <li>
            <span className="font-semibold text-slate-800">
              Baseline-branch registration.
            </span>{" "}
            A raw Microsimulation silently ignores the CGT elasticity unless the
            baseline simulation is registered as a branch of the reform
            simulation (<code>sim.branches[&quot;baseline&quot;]</code>), because
            the behavioural-response formula computes the rate change relative
            to that branch. The pipeline registers the branch explicitly and
            asserts that reform realisations differ from baseline before
            accepting a run.
          </li>
          <li>
            <span className="font-semibold text-slate-800">
              Behavioural-response variable neutralisation.
            </span>{" "}
            When the elasticity parameter is set, the baseline simulation must
            have its behavioural-response variables neutralised — otherwise the
            baseline itself responds to its own rates and the reform-minus-
            baseline difference double-counts the response. The pipeline
            neutralises the response in the baseline branch and verifies
            baseline CGT is invariant to the elasticity setting.
          </li>
          <li>
            <span className="font-semibold text-slate-800">
              Positional randomness and stream-aligned pairing.
            </span>{" "}
            Several imputations draw random values keyed to the position of the
            entity in the simulation, so two independently built simulations
            can assign different random draws to the same household. Baseline
            and reform are therefore computed as a paired calculation on a
            single simulation object with aligned random streams; winners and
            losers are differences within the same household under identical
            draws, never across independently seeded runs.
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="winners-losers-method">
        <SectionHeading
          title="Winners/losers guards"
          description="Two rules keep the distributional statistics honest."
        />
        <ul className="list-disc space-y-3 pl-6 text-sm leading-6 text-slate-600">
          <li>
            <span className="font-semibold text-slate-800">
              £1 absolute guard.
            </span>{" "}
            A person counts as a loser (or gainer) only if their household net
            income changes by at least £1 a year. Floating-point noise in a
            paired microsimulation produces penny-scale differences for
            millions of unaffected households; without the guard they would all
            be misclassified as losers.
          </li>
          <li>
            <span className="font-semibold text-slate-800">
              Decile −1 exclusion.
            </span>{" "}
            Households that cannot be ranked into an income decile (PolicyEngine
            assigns them decile −1, typically zero or negative recorded income)
            are excluded from the decile charts rather than being lumped into
            decile 1, where their extreme relative changes would distort the
            bottom-decile bars.
          </li>
        </ul>
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
                  row.source.startsWith("PolicyEngine") ? "font-semibold" : ""
                }
              >
                <td>{row.source}</td>
                <td>{row.reform_modelled}</td>
                <td>{row.behavioural_assumption}</td>
                <td>{row.revenue_bn_per_year}</td>
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

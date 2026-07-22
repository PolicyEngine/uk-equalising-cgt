"use client";

import { useEffect } from "react";
import { getElasticity } from "../lib/dataHelpers";
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

  const elasticity = getElasticity(data);

  return (
    <div className="space-y-6">


      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading title="Data and simulation" />
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>
            <strong>Dataset.</strong> The Enhanced FRS 2024-25 exactly as
            published by{" "}
            <a
              href="https://github.com/PolicyEngine/policyengine-uk-data"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              policyengine-uk-data
            </a>
            , with no local reweighting &mdash; calibration belongs upstream in
            the dataset, so whatever the published release provides is what is
            simulated here.
          </li>
          <li>
            <strong>Gains imputation.</strong> The FRS barely captures capital
            gains, so the dataset imputes them onto survey households from the{" "}
            <a
              href="https://warwick.ac.uk/fac/soc/economics/research/centres/cage/manage/publications/wp465.2020.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Advani &amp; Summers
            </a>{" "}
            distribution of gains by income band, drawn from HMRC
            administrative records.
          </li>
          <li>
            <strong>Large gains.</strong> HMRC&apos;s size-of-gain distribution
            (
            <a
              href="https://www.gov.uk/government/statistics/capital-gains-tax-statistics"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              CGT statistics, Table 2.1a
            </a>
            ) is represented directly: households carrying each published
            size-of-gain band&apos;s mean gain are included in the dataset, and
            the calibrated weights are targeted to reproduce each band&apos;s
            taxpayer count and gains total &mdash; so the concentration of
            gains at the top matches administrative records rather than an
            extrapolation.
          </li>
          <li>
            <strong>Calibration.</strong> Household weights are calibrated
            upstream against HMRC CGT aggregates (taxpayer count and total
            chargeable gains), the per-band targets above, and PolicyEngine&apos;s
            standard demographic and fiscal targets. The measured fit is in the
            benchmarks table on the Baseline tab.
          </li>
          <li>
            <strong>Remaining gap.</strong> The modelled CGT taxpayer count
            still runs above HMRC&apos;s 378,000, so the share of people
            affected by the reform reads as a modest upper bound on breadth.
            Gains concentration and totals track HMRC closely, so revenue
            estimates are largely unaffected.
          </li>
          <li>
            <strong>Simulation.</strong> The reform runs through{" "}
            <a
              href="https://github.com/PolicyEngine/policyengine.py"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              policyengine.py
            </a>
            , PolicyEngine&apos;s standard simulation wrapper: budget and
            distributional outputs (income quintiles/quartiles, household
            type and region) are weighted microdf aggregates over the
            simulation outputs.
          </li>
          <li>
            <strong>Behavioural response.</strong> Applied through a policy
            simulation modifier that registers the baseline branch, so the
            elasticity measures the true change in marginal rates; the
            pipeline verifies the response is active before writing results.
          </li>
        </ul>
      </section>

      <section className="section-card scroll-mt-24" id="elasticity">
        <SectionHeading
          title="Behavioural response: the Advani/CenTax elasticity"
          description="How the retention-rate elasticity in the literature maps onto the marginal-tax-rate elasticity the model applies."
        />
        <p className="text-sm leading-6 text-slate-600">
          <a
            href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf#page=38"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            Arun Advani and CenTax
          </a>{" "}
          express the responsiveness of realised gains as
          an elasticity with respect to the <em>retention rate</em> (1 − t): how
          much realisations rise when taxpayers keep a larger share of each
          pound of gain. PolicyEngine applies an elasticity with respect to the{" "}
          <em>marginal tax rate</em> t. The two are related by
        </p>
        <p className="my-3 rounded-lg bg-slate-50 p-4 text-center font-mono text-sm">
          e<sub>mtr</sub> = −e<sub>retention</sub> × t / (1 − t)
        </p>
        <p className="text-sm leading-6 text-slate-600">
          because a small rise in t is a proportionally larger fall in (1 − t)
          when t is high. At the gains-weighted average marginal rates under the
          reform, the central retention-rate elasticity of{" "}
          {elasticity.retention_rate_elasticity.toFixed(1)} converts to an MTR
          elasticity of about{" "}
          {elasticity.mtr_elasticity_approx.toFixed(1)}, which is what the model
          applies. The reform tab&apos;s sensitivity table re-runs the analysis
          under the static case and the lower end of CenTax&apos;s range.
        </p>
      </section>



    </div>
  );
}

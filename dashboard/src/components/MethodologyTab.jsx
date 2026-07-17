"use client";

import { useEffect } from "react";
import { getElasticity, getReform } from "../lib/dataHelpers";
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

  const reform = getReform(data);
  const elasticity = getElasticity(data);

  return (
    <div className="space-y-6">


      <section className="section-card scroll-mt-24" id="pathway">
        <SectionHeading title="Data and simulation pathway" />
        <p className="text-sm leading-6 text-slate-600">
          All simulations run through{" "}
          <a
            href="https://github.com/PolicyEngine/policyengine.py"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-1 underline-offset-2 hover:opacity-80"
          >
            policyengine.py
          </a>{" "}
          — PolicyEngine&apos;s standard simulation wrapper — on the Enhanced
          FRS 2023-24 dataset with its stock weights; no reweighting is
          applied. Budget, decile and winners/losers outputs use the
          wrapper&apos;s standard computations, with aggregates taken via
          native microdf weighted operations. The behavioural response is
          applied through a policy simulation modifier that registers the
          baseline branch, and the pipeline verifies the elasticity is active
          before writing results.
        </p>
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
          across the CenTax range and an HMRC-like high-response case.
        </p>
      </section>



    </div>
  );
}

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



    </div>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BaselineTab from "../src/components/BaselineTab";
import MethodologyTab from "../src/components/MethodologyTab";
import PolicyEngineHeader from "../src/components/PolicyEngineHeader";
import ReformTab from "../src/components/ReformTab";
import results from "../public/data/cgt_equalisation_results.json";

const TAB_OPTIONS = [
  { id: "reform", label: "Reform impacts" },
  { id: "baseline", label: "Baseline" },
  { id: "methodology", label: "Methodology" },
];

function getInitialTab(tabParam) {
  if (TAB_OPTIONS.some((tab) => tab.id === tabParam)) {
    return tabParam;
  }
  return "reform";
}

function TabLink({ onSelect, children }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="font-semibold text-[color:var(--pe-color-primary-600)] underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80"
    >
      {children}
    </button>
  );
}

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState(() => getInitialTab(searchParams.get("tab")));
  // Bundled at build time: a runtime fetch() 404s when the app is served
  // behind proxies/rewrites that don't forward public assets.
  const data = results;
  const loading = false;
  const error = null;

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    setActiveTab(getInitialTab(tabParam));
  }, [searchParams]);

  function handleTabChange(tab) {
    setActiveTab(tab);
    if (tab === "reform") {
      router.replace("/", { scroll: false });
      return;
    }
    router.replace(`/?tab=${tab}`, { scroll: false });
  }

  return (
    <div className="app-shell min-h-screen">
      <PolicyEngineHeader />
      <header className="title-row">
        <div className="mx-auto flex max-w-[96rem] items-center justify-between px-6 py-4 md:px-8">
          <h1>Capital gains tax analysis dashboard</h1>
        </div>
      </header>

      <main className="relative z-[1] mx-auto max-w-[96rem] px-6 py-10 md:px-8 md:py-12">
        <div className="animate-[fadeIn_0.4s_ease-out]">
          <p className="mb-3 text-[1.05rem] leading-relaxed text-slate-600">
            This dashboard uses{" "}
            <a href="https://policyengine.org" target="_blank" rel="noreferrer" className="underline">
              PolicyEngine
            </a>{" "}
            UK&apos;s microsimulation model to estimate equalising capital
            gains tax rates with income tax rates from 2026-27 (18%→20%,
            24%→40%, 24%→45%) on the Enhanced Family Resources Survey, with
            behavioural elasticities from{" "}
            <a
              href="https://centax.org.uk/wp-content/uploads/2024/10/AdvaniLonsdaleSummers2024_CGTReform.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Advani, Lonsdale &amp; Summers (CenTax, 2024)
            </a>
            . As{" "}
            <a
              href="https://www.bloomberg.com/news/articles/2026-05-21/streeting-backs-hiking-uk-capital-gains-levy-to-match-income-tax"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-1 underline-offset-2 hover:opacity-80"
            >
              Bloomberg
            </a>{" "}
            reports, leading Labour leadership contenders have backed this
            reform, so the next government may well consider it.{" "}
            <TabLink onSelect={() => handleTabChange("reform")}>Reform impacts</TabLink>{" "}
            shows revenue and distributional effects,{" "}
            <TabLink onSelect={() => handleTabChange("baseline")}>
              Baseline
            </TabLink>{" "}
            validates the baseline against HMRC, and{" "}
            <TabLink onSelect={() => handleTabChange("methodology")}>Methodology</TabLink>{" "}
            explains the method.
          </p>
        </div>

        <div className="mb-8 mt-8 flex w-fit flex-wrap border-b-2 border-slate-200">
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            Error: {error}
          </p>
        )}
        {loading && !error && (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading data...
          </p>
        )}

        {!loading && !error && data && (
          <>
            {activeTab === "reform" && <ReformTab data={data} />}
            {activeTab === "baseline" && <BaselineTab data={data} />}
            {activeTab === "methodology" && <MethodologyTab data={data} />}
          </>
        )}

        <footer className="mt-12 border-t border-slate-200 pt-8 text-center text-sm text-slate-500">
          <p>
            Replication code:{" "}
            <a
              href="https://github.com/PolicyEngine/uk-equalising-cgt"
              target="_blank"
              rel="noreferrer"
            >
              PolicyEngine/uk-equalising-cgt
            </a>
            {data?.metadata?.policyengine_uk_version
              ? `, run on policyengine ${data.metadata.policyengine_version ?? ""} and policyengine-uk ${data.metadata.policyengine_uk_version}`
              : ""}
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={<p className="p-12 text-center text-slate-500">Loading...</p>}
    >
      <Dashboard />
    </Suspense>
  );
}

/**
 * Accessors for the cgt_equalisation_results.json payload.
 *
 * Deliberately no fallbacks: if a field is missing the consumer throws
 * visibly rather than rendering placeholders.
 */

export function getMetadata(data) {
  return data.metadata;
}

export function getCalibration(data) {
  return data.calibration;
}

export function getValidation(data) {
  return data.validation;
}

export function getBudget(data) {
  return data.budget;
}

export function getIncomeChangeGroups(data, year) {
  return data.income_change_groups[year];
}

export function getYearLabels(data) {
  return Object.keys(data.income_change_groups);
}

export function getSensitivity(data) {
  return data.sensitivity;
}

export function getComparison(data) {
  return data.comparison;
}

const BASELINE_CGT_RATES = { basic_rate: 0.18, higher_rate: 0.24, additional_rate: 0.24 };

export function getReform(data) {
  // The pipeline emits flat reform rates ({basic_rate: 0.2, ...}); normalise to
  // {basic_rate: {baseline, reform}, ...} so components render both columns.
  const reform = data.metadata.reform;
  return Object.fromEntries(
    Object.entries(BASELINE_CGT_RATES).map(([band, baseline]) => {
      const value = reform[band];
      return [band, typeof value === "number" ? { baseline, reform: value } : value];
    }),
  );
}

export function getElasticity(data) {
  // The pipeline emits the MTR elasticity as a plain number; derive the
  // retention-rate convention (CenTax central 1.0 <-> MTR -0.7 at 40-45% rates).
  const e = data.metadata.elasticity;
  if (typeof e === "number") {
    return { retention_rate_elasticity: 1.0, mtr_elasticity_approx: e };
  }
  return e;
}

export function getFirstYear(data) {
  // metadata.years may hold calendar ints (2026) while income_change_groups is keyed
  // by fiscal labels ("2026-27") — normalise to the fiscal label.
  const year = data.metadata.years[0];
  if (typeof year === "number") {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return year;
}

export function getFiveYearTotal(data) {
  return data.budget.reduce((sum, row) => sum + row.gov_balance_change_bn, 0);
}

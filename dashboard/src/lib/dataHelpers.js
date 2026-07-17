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

export function getDecileImpact(data, year) {
  return data.decile_impact[year];
}

export function getWinnersLosers(data) {
  return data.winners_losers;
}

export function getSensitivity(data) {
  return data.sensitivity;
}

export function getComparison(data) {
  return data.comparison;
}

export function getFirstYear(data) {
  return data.metadata.years[0];
}

export function getFiveYearTotal(data) {
  return data.budget.reduce((sum, row) => sum + row.gov_balance_change_bn, 0);
}

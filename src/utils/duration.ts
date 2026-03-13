/**
 * ISO 8601 Duration helpers.
 */

/** Convert integer hours to ISO 8601 duration string */
export function hoursToISO(hours: number): string {
  if (hours <= 0) return "PT0H";
  return `PT${hours}H`;
}

/** Convert tau (in temporal_resolution units, default 1H) to ISO 8601 */
export function tauToISO(tau: number, resolutionHours = 1): string {
  return hoursToISO(tau * resolutionHours);
}

import type { AppSettings } from "../settings/model";

/** Single feature flag for paid features. No billing yet — toggled on the Pro screen. */
export function isPro(settings: Pick<AppSettings, "isPro">): boolean {
  return settings.isPro;
}

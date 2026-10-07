import type { DeviationRule } from "@/lib/services/deviation-rules";

/**
 * Single source for how each deviation rule is drawn as a data series (dashboard legend,
 * trend chart segments, ranking structure bar). Colours are the --rule-* tokens in
 * src/styles/global.css (values and contrast: context/changes/dashboard-ui-tokens/token-source.md).
 * Class names stay full literals so Tailwind's scanner generates them.
 */
export const RULE_SERIES: Record<DeviationRule, { label: string; className: string }> = {
  missing_gps: { label: "Brak GPS", className: "bg-rule-gps" },
  phone_instead_of_visit: { label: "Telefon", className: "bg-rule-phone" },
  route_deviation: { label: "Trasa", className: "bg-rule-route" },
};

/** Display order for legends and stacked bars (stacked bars draw the first entry at the bottom). */
export const RULE_SERIES_ORDER: readonly DeviationRule[] = ["missing_gps", "phone_instead_of_visit", "route_deviation"];

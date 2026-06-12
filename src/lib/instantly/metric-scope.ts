// ─── Metric scope tracking ────────────────────────────────────────────────────
//
// Instantly analytics fields (sent, bounces, unsubscribes, opens, opportunities)
// are returned as ALL-TIME totals — the API does not support date filtering on
// the analytics endpoint. Email pull fields (actual_received_count,
// positive_reply_count) respect date/org/sector/state UI filters.
//
// Percentages are only meaningful when numerator and denominator have the same
// scope. Use canCalculatePercentage() before displaying a rate.

export type MetricScope =
  | 'lifetime'     // all-time from Instantly analytics API — never date-filtered
  | 'email_pull'   // from /api/v2/emails pull — respects all active UI filters
  | 'mixed';       // numerator and denominator have different scopes (don't display %)

/** Returns true only when both scopes are identical and neither is mixed. */
export function canCalculatePercentage(
  numeratorScope: MetricScope,
  denominatorScope: MetricScope,
): boolean {
  return (
    numeratorScope !== 'mixed' &&
    denominatorScope !== 'mixed' &&
    numeratorScope === denominatorScope
  );
}

// Scope reference for NormalizedCampaign fields:
//   lifetime  : sent, bounces, unsubscribes, opportunities, open_rate,
//               bounce_rate, unsubscribe_rate, opportunity_rate
//   email_pull: actual_received_count, positive_reply_count, positive_reply_rate
//   mixed     : reply_rate  (actual_received_count / sent)

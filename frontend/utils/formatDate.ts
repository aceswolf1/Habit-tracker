/**
 * Human-readable label for an ISO calendar date ('YYYY-MM-DD' → 'Oct 12 2026').
 * Parsed as a local calendar date so the label never shifts by timezone.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatHumanDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!match) return iso;
  const [, y, m, d] = match;
  return `${MONTHS[Number(m) - 1]} ${Number(d)} ${y}`;
}

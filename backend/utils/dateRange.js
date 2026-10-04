const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse an inclusive range start (?startDate=). Returns null when absent, or an
 * Invalid Date the caller can reject.
 */
export const parseRangeStart = (value) => (value ? new Date(value) : null);

/**
 * Parse an inclusive range end (?endDate=).
 *
 * The admin date pickers send bare `YYYY-MM-DD` values, and `new Date("2026-10-03")`
 * is midnight at the START of that day. Used as `$lte`, it silently dropped the whole
 * end day — every "last 30 days" view excluded today's orders. A date-only value is
 * widened to the end of that UTC day, the same way the audit-log endpoints already
 * treat it; a full timestamp is used as-is.
 */
export const parseRangeEnd = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (DATE_ONLY.test(value) && !isNaN(d.getTime())) d.setUTCHours(23, 59, 59, 999);
  return d;
};

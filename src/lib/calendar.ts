/** Standard full-time working day. */
const HOURS_PER_DAY = 8;

/** Count of weekdays (Mon–Fri, holidays included) in a month, × 8 hours. */
export function weekdayHours(year: number, month: number): number {
  const days = new Date(year, month, 0).getDate();
  let weekdays = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) weekdays++;
  }
  return weekdays * HOURS_PER_DAY;
}

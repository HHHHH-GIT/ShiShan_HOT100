'use strict';
const REPORT_TIME_ZONE = 'Asia/Shanghai';
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
function periodKey(window, instant) {
  if (window === 'allTime') return 'all';
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  return window === 'today' ? date : date.slice(0, 7);
}
module.exports = { REPORT_TIME_ZONE, periodKey };

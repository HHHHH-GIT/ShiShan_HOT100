'use strict';
const REPORT_TIME_ZONE = 'Asia/Shanghai';
function periodKey(window, instant) {
  if (window === 'allTime') return 'all';
  const date = new Date(instant).toISOString().slice(0, 10);
  return window === 'today' ? date : date.slice(0, 7);
}
module.exports = { REPORT_TIME_ZONE, periodKey };

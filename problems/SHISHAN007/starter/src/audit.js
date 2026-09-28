'use strict';
const { WINDOWS, COMPONENTS, normalizePeriod } = require('./periods');
const log = require('./logger');
module.exports = function audit(record) {
  // Report projection versus its retained export rows. A diagnostic only:
  // this never changes accepted data or substitutes a corrected query result.
  for (const window of WINDOWS) {
    const period = record.periods[window];
    const rows = normalizePeriod(period);
    const mismatches = ['totalTokens', ...COMPONENTS].filter(key => rows[key] !== period[key]);
    if (mismatches.length) log('WARN', 'REPORT_COMPONENT_DRIFT', { deviceId: record.deviceId, window, fields: mismatches });
  }
};

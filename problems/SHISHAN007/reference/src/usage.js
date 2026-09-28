'use strict';
const { WINDOWS, emptyPeriod, addClient, normalizePeriod, addPeriodInto } = require('./periods');
const { REPORT_TIME_ZONE, periodKey } = require('./calendar');

function shouldPreservePeriod(window, existing, incoming) {
  if (window === 'allTime') return true;
  return periodKey(window, existing.usageUpdatedAt) === periodKey(window, incoming.usageUpdatedAt);
}
function preserveClient(target, source, client) {
  addClient(target, client, source.clientModelComponents[client]);
}
function mergeDeviceRecord(existing, incoming) {
  const record = {
    deviceId: incoming.deviceId,
    updatedAt: new Date(incoming.updatedAt).toISOString(),
    receivedAt: new Date().toISOString(),
    usageUpdatedAt: existing?.usageUpdatedAt || null,
    trackedClients: existing?.trackedClients || [],
    limits: structuredClone(incoming.limits ?? existing?.limits ?? {}),
    periods: {},
  };
  if (incoming.limitsOnly) {
    record.periods = structuredClone(existing.periods);
    return record;
  }
  record.usageUpdatedAt = record.updatedAt;
  record.trackedClients = [...incoming.trackedClients];
  const active = new Set(record.trackedClients);
  for (const window of WINDOWS) {
    const target = normalizePeriod(incoming[window]);
    record.periods[window] = target;
    if (!existing || !shouldPreservePeriod(window, existing, record)) continue;
    const source = existing.periods[window];
    for (const client of Object.keys(source.clients)) {
      if (active.has(client) || Object.hasOwn(target.clients, client)) continue;
      preserveClient(target, source, client);
    }
  }
  return record;
}
function deviceView(record) {
  return { ...record, periodKeys: Object.fromEntries(WINDOWS.map(window => [window, periodKey(window, record.usageUpdatedAt)])) };
}
function aggregateDevices(records, at) {
  const instant = at || records.map(record => record.usageUpdatedAt).sort().at(-1) || null;
  const keys = Object.fromEntries(WINDOWS.map(window => [window, instant ? periodKey(window, instant) : null]));
  const periods = Object.fromEntries(WINDOWS.map(window => [window, emptyPeriod()]));
  for (const record of records) {
    for (const window of WINDOWS) {
      if (periodKey(window, record.usageUpdatedAt) === keys[window]) addPeriodInto(periods[window], record.periods[window]);
    }
  }
  return { reportTimeZone: REPORT_TIME_ZONE, asOf: instant, periodKeys: keys, deviceCount: records.length, periods };
}
module.exports = { mergeDeviceRecord, deviceView, aggregateDevices };

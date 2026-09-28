// Author-side fixtures and an independent replay oracle. Never shipped in starter.
// Oracle stores each tool's latest sample per window, then materializes a report;
// it does not call or duplicate the service's incremental preservation functions.
const fields = ['inputTokens', 'outputTokens', 'cacheReadTokens', 'cacheWriteTokens'];
const windows = ['today', 'month', 'allTime'];
const counts = (input, output, read, write) => Object.fromEntries(fields.map((field, i) => [field, [input, output, read, write][i]]));
const tool = (input, output, read, write, model = 'model-shared') => ({ [model]: counts(input, output, read, write) });
function scaled(matrix, scale) {
  return Object.fromEntries(Object.entries(matrix).map(([client, models]) => [client,
    Object.fromEntries(Object.entries(models).map(([model, value]) => [model,
      Object.fromEntries(fields.map(field => [field, (value[field] || 0) * scale]))]))]));
}
function report(at, matrix, deviceId = 'desk-a') {
  return { deviceId, updatedAt: at, trackedClients: Object.keys(matrix),
    ...Object.fromEntries(windows.map((window, i) => [window, { clientModelComponents: scaled(matrix, [1, 3, 7][i]) }])) };
}
const seed = (at = '2026-09-28T12:00:00Z', device = 'desk-a') => report(at, {
  alpha: tool(40, 10, 50, 0), beta: tool(20, 15, 10, 5, 'model-b'),
}, device);
const update = (at = '2026-09-28T12:01:00Z', device = 'desk-a') => report(at, { beta: tool(25, 20, 20, 10, 'model-b') }, device);
const quota = (at, remaining = 80) => ({ deviceId: 'desk-a', updatedAt: at, limitsOnly: true, limits: { remaining } });
const cases = [
  { id: 'full-snapshot', name: '完整快照的三个统计视角', reports: [seed()] },
  { id: 'partial-components', name: '未采集工具的分项完整保留', reports: [seed(), update()] },
  { id: 'shared-model', name: '共用模型的分项归属', reports: [
    report('2026-09-28T12:00:00Z', { alpha: tool(7,11,13,17), beta: tool(19,23,29,31) }),
    report('2026-09-28T12:01:00Z', { beta: tool(37,41,43,47) }),
  ] },
  { id: 'explicit-zero', name: '采集到零值必须替换旧快照', reports: [seed(), report('2026-09-28T12:01:00Z', { alpha: {}, beta: tool(0,0,0,0,'model-b') })] },
  { id: 'repeat-full', name: '相同完整快照重传不累加', reports: [seed(), seed()] },
  { id: 'repeat-partial', name: '部分采集重传不累加保留数据', reports: [seed(), update(), update()] },
  { id: 'local-midnight', name: '业务日切换的保留范围', reports: [seed('2026-09-28T15:59:00Z'), update('2026-09-28T16:01:00Z')] },
  { id: 'utc-midnight', name: '同一业务日跨 UTC 午夜', reports: [seed('2026-09-28T23:59:00Z'), update('2026-09-29T00:01:00Z')] },
  { id: 'local-month', name: '业务月切换的保留范围', reports: [seed('2026-09-30T15:59:00Z'), update('2026-09-30T16:01:00Z')] },
  { id: 'utc-month', name: '同一业务月跨 UTC 月末', reports: [seed('2026-09-30T23:59:00Z'), update('2026-10-01T00:01:00Z')] },
  { id: 'local-year', name: '业务年末的日月窗口', reports: [seed('2026-12-31T15:59:00Z'), update('2026-12-31T16:01:00Z')] },
  { id: 'utc-year', name: '同一业务日跨 UTC 年末', reports: [seed('2026-12-31T23:59:00Z'), update('2027-01-01T00:01:00Z')] },
  { id: 'quota-only', name: '额度刷新不改用量快照', reports: [seed(), quota('2026-09-29T12:00:00Z',61), quota('2026-09-30T12:00:00Z',59)] },
  { id: 'direct-next-day', name: '隔日直接采集的统计结果', reports: [seed('2026-09-28T15:59:00Z'), update('2026-09-29T00:02:00Z')] },
  { id: 'quota-next-day', name: '额度刷新不能重定用量业务日', reports: [seed('2026-09-28T15:59:00Z'), quota('2026-09-29T00:00:00Z',70), quota('2026-09-29T00:01:00Z',65), update('2026-09-29T00:02:00Z')] },
  { id: 'quota-next-month', name: '额度刷新不能重定用量业务月', reports: [seed('2026-09-30T15:59:00Z'), quota('2026-10-01T00:01:00Z',42), update('2026-10-01T00:02:00Z')] },
  { id: 'multi-device', name: '多设备共用工具与模型分别汇总', reports: [seed(), report('2026-09-28T12:02:00Z', { alpha: tool(3,5,7,11), gamma: tool(13,17,19,23,'model-b') }, 'desk-b')] },
  { id: 'mixed-device-dates', name: '不同快照日期按窗口汇总', reports: [seed('2026-09-27T12:00:00Z'), seed('2026-09-28T12:00:00Z','desk-b')] },
  { id: 'rescan-tool', name: '恢复采集后旧数据被完整替换', reports: [seed(), update(), report('2026-09-28T12:02:00Z', { alpha: tool(2,3,5,7), beta: tool(11,13,17,19,'model-b') })], checkpoints: [2] },
  { id: 'offset-equivalence', name: '等价时区表示得到同一报表', reports: [seed('2026-09-28T20:00:00+08:00'), seed('2026-09-28T12:00:00Z')] },
];

// UTC+08:00 is the documented business offset for these modern fixed fixtures.
// This oracle intentionally does not use the service calendar helper or Intl.
function key(window, instant) {
  if (window === 'allTime') return 'all';
  const date = new Date(Date.parse(instant) + 8*3600000).toISOString().slice(0,10);
  return window === 'today' ? date : date.slice(0,7);
}
function periodFrom(matrix) {
  const out = { totalTokens:0, ...counts(0,0,0,0), clients:{}, models:{}, clientComponents:{}, modelComponents:{}, clientModelComponents:matrix };
  for (const [client, models] of Object.entries(matrix)) {
    out.clients[client]=0; out.clientComponents[client]=counts(0,0,0,0);
    for (const [model, value] of Object.entries(models)) {
      out.models[model] ??= 0; out.modelComponents[model] ??= counts(0,0,0,0);
      for (const field of fields) {
        const n=value[field]||0;
        out.totalTokens+=n; out[field]+=n; out.clients[client]+=n; out.models[model]+=n;
        out.clientComponents[client][field]+=n; out.modelComponents[model][field]+=n;
      }
    }
  }
  return out;
}
function expectedAfter(reports, at) {
  const archive = new Map();
  for (const report of reports) {
    if (!archive.has(report.deviceId)) archive.set(report.deviceId,{ entries:[], limits:{}, latest:null, usage:null });
    const device=archive.get(report.deviceId); device.latest=report;
    if (report.limits) device.limits=report.limits;
    if (!report.limitsOnly) { device.entries.push(report); device.usage=report; }
  }
  const devices=[];
  for (const [deviceId, state] of archive) {
    const usageUpdatedAt=new Date(state.usage.updatedAt).toISOString();
    const periods={};
    for (const window of windows) {
      const latestTool=new Map();
      for (const entry of state.entries) for (const client of entry.trackedClients) latestTool.set(client,{ instant:entry.updatedAt, models:entry[window].clientModelComponents[client] });
      const matrix={};
      for (const [client, sample] of latestTool) if (key(window,sample.instant)===key(window,usageUpdatedAt)) matrix[client]=structuredClone(sample.models);
      periods[window]=periodFrom(matrix);
    }
    devices.push({deviceId,updatedAt:new Date(state.latest.updatedAt).toISOString(),usageUpdatedAt,trackedClients:state.usage.trackedClients,limits:state.limits,periodKeys:Object.fromEntries(windows.map(window=>[window,key(window,usageUpdatedAt)])),periods});
  }
  devices.sort((a,b)=>a.deviceId.localeCompare(b.deviceId));
  const asOf=at || devices.map(device=>device.usageUpdatedAt).sort().at(-1) || null;
  const periodKeys=Object.fromEntries(windows.map(window=>[window,asOf?key(window,asOf):null]));
  const periods={};
  for (const window of windows) {
    const matrix={};
    for (const device of devices) {
      if (device.periodKeys[window]!==periodKeys[window]) continue;
      for (const [client,models] of Object.entries(device.periods[window].clientModelComponents)) {
        matrix[client]??={};
        for (const [model,value] of Object.entries(models)) {
          matrix[client][model]??=counts(0,0,0,0);
          for(const field of fields)matrix[client][model][field]+=value[field]||0;
        }
      }
    }
    periods[window]=periodFrom(matrix);
  }
  return { devices, stats:{reportTimeZone:'Asia/Shanghai',asOf,periodKeys,deviceCount:devices.length,periods} };
}
module.exports={cases,expectedAfter};

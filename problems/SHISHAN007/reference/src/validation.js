'use strict';
const { WINDOWS, COMPONENTS } = require('./periods');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function requireValue(condition, message) {
  if (!condition) throw Object.assign(new Error(message), { status: 400 });
}
function validInstant(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}
function validateReport(body, existing) {
  requireValue(object(body), '请求须为 JSON 对象');
  requireValue(typeof body.deviceId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(body.deviceId), 'deviceId 无效');
  requireValue(validInstant(body.updatedAt), 'updatedAt 须为带时区的 ISO 时间');
  requireValue(!existing || Date.parse(body.updatedAt) >= Date.parse(existing.updatedAt), '按采集时间顺序上报');
  requireValue(body.limitsOnly === undefined || typeof body.limitsOnly === 'boolean', 'limitsOnly 须为布尔值');
  if (body.limits !== undefined) {
    requireValue(object(body.limits) && Number.isFinite(body.limits.remaining) && body.limits.remaining >= 0, 'limits.remaining 须为非负数');
  }
  if (body.limitsOnly) {
    requireValue(Boolean(existing), '先上报一次用量，再刷新额度');
    requireValue(body.limits !== undefined, '额度刷新须包含 limits');
    requireValue(WINDOWS.every(window => body[window] === undefined), '额度刷新不包含用量');
    return;
  }
  requireValue(Array.isArray(body.trackedClients) && body.trackedClients.every(client => typeof client === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(client)), 'trackedClients 须为工具名数组');
  requireValue(new Set(body.trackedClients).size === body.trackedClients.length, 'trackedClients 不可重复');
  const active = new Set(body.trackedClients);
  for (const window of WINDOWS) {
    const raw = body[window];
    requireValue(object(raw) && object(raw.clientModelComponents), `缺少 ${window}.clientModelComponents`);
    requireValue(Object.keys(raw.clientModelComponents).length === active.size && [...active].every(client => Object.hasOwn(raw.clientModelComponents, client)), '每个窗口须且仅须包含本次采集的工具；空工具用 {} 表示');
    let total = 0;
    for (const models of Object.values(raw.clientModelComponents)) {
      requireValue(object(models), '工具明细须为模型映射');
      for (const [model, components] of Object.entries(models)) {
        requireValue(model.length > 0 && model.length <= 100 && object(components), '模型明细无效');
        requireValue(Object.keys(components).every(key => COMPONENTS.includes(key)), '不支持的用量分项');
        for (const key of COMPONENTS) {
          const value = components[key] ?? 0;
          requireValue(Number.isSafeInteger(value) && value >= 0 && value <= 1e9, '用量须为 0–1000000000 的整数');
          total += value;
        }
      }
    }
    requireValue(Number.isSafeInteger(total), '用量超出整数范围');
  }
}
module.exports = { validateReport, validInstant };

'use strict';

const DEFAULT_LIMITS_REFRESH_MS = 5 * 60 * 1000;
const VALID_PROVIDERS = new Set(['claude', 'codex', 'cursor', 'antigravity', 'opencode', 'deepseek']);
const VALID_STATUSES = new Set(['ok', 'disabled', 'notConfigured', 'unauthorized', 'rateLimited', 'sourceRateLimited', 'unavailable', 'error']);
const VALID_SOURCES = new Set(['oauth', 'cli', 'web', 'rpc', 'local', 'api']);
const VALID_SOURCE_DETAILS = new Set(['app', 'cli', 'managed', 'unknown']);
const WINDOW_ORDER = ['session', 'weekly', 'billing'];

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/[%,$]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeProviderId(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!VALID_PROVIDERS.has(raw)) return null;
  return raw;
}

function normalizeStatus(value) {
  const raw = String(value || '').trim();
  return VALID_STATUSES.has(raw) ? raw : 'error';
}

function normalizeSource(value) {
  const raw = String(value || '').trim().toLowerCase();
  return VALID_SOURCES.has(raw) ? raw : '';
}

function normalizeSourceDetail(value) {
  const raw = String(value || '').trim().toLowerCase();
  return VALID_SOURCE_DETAILS.has(raw) ? raw : '';
}

function normalizeAccountLabel(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 32 || raw.includes('@') || /^https?:\/\//i.test(raw)) return '';
  const clean = raw.replace(/[^a-z0-9 +._-]/gi, '').replace(/\s+/g, ' ').trim();
  return clean.length <= 32 ? clean : '';
}

function normalizeAccountEmail(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw.length > 254 || !raw.includes('@')) return '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : '';
}

function normalizeWindowKind(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/[_\s-]+/g, '');
  if (raw === 'session') return 'session';
  if (raw === 'weekly') return 'weekly';
  if (raw === 'billing' || raw === 'billingcycle' || raw === 'monthly') return 'billing';
  return null;
}

function normalizeWindowLabel(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 32) return '';
  const clean = raw.replace(/[^a-z0-9 +._/-]/gi, '').replace(/\s+/g, ' ').trim();
  return clean.length <= 32 ? clean : '';
}

function normalizeIsoTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  let date;
  if (typeof value === 'number' && Number.isFinite(value)) {
    date = new Date(value < 20_000_000_000 ? value * 1000 : value);
  } else {
    date = new Date(String(value));
  }
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numberOrNull(value) {
  const number = asNumber(value);
  return number === null ? null : number;
}

function percentFromWindow(input, used, limit) {
  const explicit = numberOrNull(input.usedPercent ?? input.used_percent ?? input.utilization ?? input.percent);
  if (explicit !== null) return clamp(explicit, 0, 100);
  if (used !== null && limit !== null && limit > 0) return clamp((used / limit) * 100, 0, 100);
  return null;
}

function normalizeLimitWindow(input) {
  if (!input || typeof input !== 'object') return null;
  const kind = normalizeWindowKind(input.kind || input.type || input.name || input.window || input.windowKind);
  if (!kind) return null;
  const used = numberOrNull(input.used);
  const limit = numberOrNull(input.limit);
  const remaining = numberOrNull(input.remaining);
  const usedPercent = percentFromWindow(input, used, limit);
  return {
    kind,
    label: normalizeWindowLabel(input.label || input.displayLabel || input.title),
    used,
    limit,
    remaining,
    usedPercent,
    remainingPercent: usedPercent === null ? null : Number((100 - usedPercent).toFixed(3)),
    resetsAt: normalizeIsoTimestamp(input.resetsAt ?? input.resets_at ?? input.resetAt ?? input.reset_at),
    windowMinutes: numberOrNull(input.windowMinutes ?? input.window_minutes ?? input.windowDurationMins),
    resetDescription: input.resetDescription ? String(input.resetDescription) : '',
    showMeter: input.showMeter !== false && input.meter !== false
  };
}

function normalizeProviderBalance(input) {
  if (!input || typeof input !== 'object') return null;
  const amount = numberOrNull(input.amount);
  const currency = String(input.currency || '').trim().toUpperCase().slice(0, 8) || null;
  if (amount === null && !currency) return null;
  return {
    amount,
    currency,
    todaySpend: numberOrNull(input.todaySpend),
    monthSpend: numberOrNull(input.monthSpend),
    monthSinceTracking: Boolean(input.monthSinceTracking)
  };
}

function normalizeLimitProvider(input) {
  if (!input || typeof input !== 'object') return null;
  const provider = normalizeProviderId(input.provider);
  if (!provider) return null;
  const windows = Array.isArray(input.windows)
    ? input.windows.map(normalizeLimitWindow).filter(Boolean)
    : [];
  windows.sort((a, b) => WINDOW_ORDER.indexOf(a.kind) - WINDOW_ORDER.indexOf(b.kind));
  return {
    provider,
    accountKey: input.accountKey ? String(input.accountKey) : '',
    accountLabel: normalizeAccountLabel(input.accountLabel),
    accountEmail: normalizeAccountEmail(input.accountEmail ?? input.email),
    status: normalizeStatus(input.status),
    source: normalizeSource(input.source),
    sourceDetail: normalizeSourceDetail(input.sourceDetail ?? input.source_detail),
    updatedAt: normalizeIsoTimestamp(input.updatedAt) || normalizeIsoTimestamp(input.checkedAt),
    windows,
    balanceUsd: numberOrNull(input.balanceUsd),
    balance: normalizeProviderBalance(input.balance)
  };
}

function normalizeRefreshMs(value) {
  const parsed = asNumber(value);
  return parsed && parsed > 0 ? Math.round(parsed) : DEFAULT_LIMITS_REFRESH_MS;
}

function normalizeLimitsSummary(input) {
  const source = input && typeof input === 'object' ? input : {};
  const providers = Array.isArray(source.providers)
    ? source.providers.map(normalizeLimitProvider).filter(Boolean)
    : [];
  return {
    updatedAt: normalizeIsoTimestamp(source.updatedAt),
    refreshMs: normalizeRefreshMs(source.refreshMs),
    providers
  };
}

function statusRank(status) {
  if (status === 'ok') return 3;
  if (status === 'rateLimited') return 2;
  if (status === 'sourceRateLimited' || status === 'unauthorized' || status === 'unavailable' || status === 'error') return 1;
  return 0;
}

function timestampMs(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function isProviderStale(provider, summary, device, staleAfterMs, nowMs) {
  if (device?.stale) return true;
  const updatedAt = timestampMs(provider.updatedAt || summary.updatedAt);
  if (!updatedAt) return false;
  const threshold = Math.max(normalizeRefreshMs(summary.refreshMs) * 2, Number(staleAfterMs || 0));
  return threshold > 0 ? nowMs - updatedAt > threshold : false;
}

function providerAggregateKey(provider) {
  return `${provider.provider}:${provider.accountKey || provider.status}`;
}

function isConfiguredProvider(provider) {
  return Boolean(provider.accountKey && provider.status !== 'notConfigured' && provider.status !== 'disabled');
}

function providerCollapseKey(provider) {
  if ((provider.provider === 'codex' || provider.provider === 'opencode') && isConfiguredProvider(provider)) {
    return providerAggregateKey(provider);
  }
  return provider.provider;
}

function pickBetterProvider(current, candidate) {
  if (!current) return candidate;
  if (current.stale !== candidate.stale) return current.stale ? candidate : current;
  const rankDiff = statusRank(candidate.status) - statusRank(current.status);
  if (rankDiff !== 0) return rankDiff > 0 ? candidate : current;
  return timestampMs(candidate.updatedAt) >= timestampMs(current.updatedAt) ? candidate : current;
}

function aggregateLimits(devices, staleAfterMs = 0, nowMs = Date.now()) {
  const aggregate = { updatedAt: new Date(nowMs).toISOString(), providers: [] };
  const byKey = new Map();
  const providersWithConfiguredAccounts = new Set();

  for (const device of devices || []) {
    const summary = normalizeLimitsSummary(device?.limits);
    for (const provider of summary.providers) {
      if (isConfiguredProvider(provider)) providersWithConfiguredAccounts.add(provider.provider);
      const candidate = {
        ...provider,
        sourceDeviceId: String(device?.deviceId || ''),
        stale: isProviderStale(provider, summary, device, staleAfterMs, nowMs)
      };
      const key = providerAggregateKey(provider);
      byKey.set(key, pickBetterProvider(byKey.get(key), candidate));
    }
  }

  // Second pass: collapse by provider name. Same OAuth account on Mac vs Windows
  // hashes to different accountKeys (keychain identity vs file path), so byKey
  // keeps them as separate entries; without this pass the renderer's per-provider
  // Map.set() would arbitrarily overwrite the fresh one with the stale one.
  const byProvider = new Map();
  for (const candidate of byKey.values()) {
    if (!isConfiguredProvider(candidate) && providersWithConfiguredAccounts.has(candidate.provider)) continue;
    const collapseKey = providerCollapseKey(candidate);
    byProvider.set(collapseKey, pickBetterProvider(byProvider.get(collapseKey), candidate));
  }
  aggregate.providers = Array.from(byProvider.values())
    .sort((a, b) => {
      const providerSort = a.provider.localeCompare(b.provider);
      if (providerSort !== 0) return providerSort;
      const aLabel = a.accountEmail || a.accountLabel || a.accountKey;
      const bLabel = b.accountEmail || b.accountLabel || b.accountKey;
      return aLabel.localeCompare(bLabel);
    });
  return aggregate;
}

function publicLimits(limits) {
  const normalized = normalizeLimitsSummary(limits);
  return {
    updatedAt: normalized.updatedAt,
    refreshMs: normalized.refreshMs,
    providers: normalized.providers.map(({ accountKey, accountEmail, accountLabel, ...provider }) => provider)
  };
}

// Sync to the authenticated hub carries the full account identity (key, email,
// plan label) so other devices can show which Codex account each limit belongs
// to. Hub ingest is Secret-protected; the PUBLIC surface is still scrubbed by
// publicLimits() above, which drops every account identifier including email.
function syncLimits(limits) {
  const normalized = normalizeLimitsSummary(limits);
  return {
    updatedAt: normalized.updatedAt,
    refreshMs: normalized.refreshMs,
    providers: normalized.providers
  };
}

module.exports = {
  DEFAULT_LIMITS_REFRESH_MS,
  aggregateLimits,
  normalizeLimitProvider,
  normalizeLimitsSummary,
  normalizeLimitWindow,
  publicLimits,
  syncLimits
};

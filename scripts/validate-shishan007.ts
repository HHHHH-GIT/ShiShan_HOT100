/** npx tsx scripts/validate-shishan007.ts
 * Run after pack:problem. Requires port 18086 free; owns/stops all child services.
 * No real device files, accounts or source projects are accessed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import net from 'node:net';
import AdmZip from 'adm-zip';
import { readSpec } from '../lib/problems';
import { runTestCase } from '../lib/runner/executors';
import type { RunnerContext } from '../lib/runner/types';

const require = createRequire(import.meta.url);
const { cases, expectedAfter } = require('./shishan007-cases.cjs');
const problem = path.resolve('problems/SHISHAN007');
const baseUrl = 'http://127.0.0.1:18086';
const spec = await readSpec('SHISHAN007');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'shishan007-validation-'));
const report: Record<string, unknown> = {};
const expectedFailures = ['partial-components', 'shared-model', 'repeat-partial', 'local-midnight',
  'utc-midnight', 'local-month', 'utc-month', 'local-year', 'utc-year', 'direct-next-day',
  'quota-next-day', 'quota-next-month', 'diagnostic-integrity'];

async function assertPortFree() {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error('Port 18086 is occupied; refusing to test another service')));
    probe.listen(18086, '127.0.0.1', () => probe.close(() => resolve()));
  });
}
async function withService(directory: string, action: () => Promise<void>, timezone = 'UTC') {
  await assertPortFree();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: directory, env: { ...process.env, PORT: '18086', TZ: timezone, NODE_PATH: '' },
    windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Startup timeout: ${output}`)), 5000);
      const fail = (error: Error) => { clearTimeout(timer); reject(error); };
      child.once('error', fail);
      child.once('exit', code => fail(new Error(`Service exited ${code}: ${output}`)));
      child.stderr.on('data', chunk => { output += chunk; });
      child.stdout.on('data', chunk => {
        output += chunk;
        if (output.includes('Usage report:')) { clearTimeout(timer); resolve(); }
      });
    });
    await action();
  } finally {
    if (child.exitCode === null && child.pid) {
      const exited = once(child, 'exit'); child.kill(); await exited;
    }
  }
}
async function judge(directory: string) {
  const logFile = path.join(directory, 'logs/app.log');
  const offset = await fs.stat(logFile).then(stat => stat.size, () => 0);
  const context: RunnerContext = {
    problemId: 'SHISHAN007', vars: { baseUrl }, logFile, logBaseDir: directory,
    logOffsets: new Map([[logFile, offset]]), log: () => {},
  };
  const failures: string[] = [];
  for (const test of spec.tests) {
    const outcome = await runTestCase(test, context);
    if (!outcome.passed) failures.push(test.id);
  }
  return failures;
}
async function api(endpoint: string, body?: unknown, expectedStatus = 200) {
  const response = await fetch(baseUrl + endpoint, {
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(5000),
  });
  const data = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(data));
  return data;
}
async function checkReplayOracle() {
  for (const scenario of cases) {
    await api('/api/reset', {});
    for (let index = 0; index < scenario.reports.length; index++) {
      const result = await api('/api/ingest', scenario.reports[index]);
      const expected = expectedAfter(scenario.reports.slice(0, index + 1));
      const { receivedAt: receipt, ...device } = result.device;
      assert.ok(Number.isFinite(Date.parse(receipt)));
      assert.deepEqual(device, expected.devices.find((entry: { deviceId: string }) => entry.deviceId === device.deviceId), `${scenario.id} ingest ${index}`);
      assert.deepEqual(await api('/api/stats'), expected.stats, `${scenario.id} stats ${index}`);
      const inventory = await api('/api/devices');
      const actual = inventory.devices.map((entry: Record<string, unknown>) => {
        const { receivedAt: _receipt, ...rest } = entry;
        return rest;
      });
      assert.deepEqual(actual, expected.devices, `${scenario.id} devices ${index}`);
    }
  }
  const mixed = cases.find((scenario: { id: string }) => scenario.id === 'mixed-device-dates');
  await api('/api/reset', {});
  for (const payload of mixed.reports) await api('/api/ingest', payload);
  const at = '2026-09-27T12:00:00.000Z';
  assert.deepEqual(await api(`/api/stats?at=${encodeURIComponent(at)}`), expectedAfter(mixed.reports, at).stats);
  const before = await api('/api/devices');
  await api('/api/ingest', { ...mixed.reports[0], updatedAt: '2026-09-27T12:00:00' }, 400);
  await api('/api/ingest', { ...mixed.reports[0], updatedAt: '2026-09-26T12:00:00Z' }, 400);
  await api('/api/ingest', { ...mixed.reports[0], trackedClients: ['not-in-sample'] }, 400);
  assert.deepEqual(await api('/api/devices'), before, 'Invalid input changed accepted snapshots');
}
async function npmCi(directory: string) {
  const npm = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const child = spawn(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: directory, windowsHide: true, stdio: 'pipe' });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, output);
}
try {
  const reference = path.join(problem, 'reference');
  const starter = path.join(problem, 'starter');
  await withService(reference, async () => {
    const failed = await judge(reference);
    report.reference = failed; assert.deepEqual(failed, []);
    await checkReplayOracle();
  });
  console.log(`reference: ${spec.tests.length}/${spec.tests.length}; every intermediate snapshot matches independent oracle`);
  await withService(reference, async () => {
    await checkReplayOracle(); report.hostTimezone = 'America/Los_Angeles: passed';
  }, 'America/Los_Angeles');
  console.log('reference: host timezone independence passed');
  await withService(starter, async () => {
    const rounds = [];
    for (let index = 0; index < 3; index++) {
      const failed = await judge(starter); rounds.push(failed);
      report.starter = rounds; assert.deepEqual(failed, expectedFailures);
    }
  });
  console.log(`starter: three identical rounds, ${expectedFailures.length} expected failures`);

  const goodUsage = await fs.readFile(path.join(reference, 'src/usage.js'), 'utf8');
  const badUsage = await fs.readFile(path.join(starter, 'src/usage.js'), 'utf8');
  const badPreserve = badUsage.match(/function preserveClient\([^]*?\n}/)?.[0];
  assert.ok(badPreserve);
  for (const mutation of [
    { id: 'partial-projection', targets: ['partial-components', 'shared-model'], source: goodUsage.replace(/function preserveClient\([^]*?\n}/, badPreserve) },
    { id: 'utc-calendar', targets: ['local-midnight', 'utc-midnight', 'local-month', 'utc-month', 'local-year', 'utc-year'] },
    { id: 'quota-timestamp', targets: ['quota-next-day', 'quota-next-month'], source: goodUsage.replace('periodKey(window, existing.usageUpdatedAt) === periodKey(window, incoming.usageUpdatedAt)', 'periodKey(window, existing.updatedAt) === periodKey(window, incoming.updatedAt)') },
  ]) {
    const directory = path.join(scratch, mutation.id);
    await fs.cp(reference, directory, { recursive: true, filter: name => !['logs','node_modules'].includes(path.basename(name)) });
    if (mutation.source) {
      assert.notEqual(mutation.source, goodUsage);
      await fs.writeFile(path.join(directory, 'src/usage.js'), mutation.source);
    } else await fs.copyFile(path.join(starter, 'src/calendar.js'), path.join(directory, 'src/calendar.js'));
    await withService(directory, async () => {
      const failed = await judge(directory); report[mutation.id] = failed;
      for (const target of mutation.targets) assert.ok(failed.includes(target), `${mutation.id} escaped ${target}`);
      assert.ok(!failed.includes('full-snapshot'), 'Mutation broke the ordinary path');
    });
    console.log(`mutant ${mutation.id}: detected`);
  }

  const download = path.join(scratch, 'download');
  new AdmZip(path.join(problem, 'dist/SHISHAN007.zip')).extractAllTo(download);
  await npmCi(download);
  await withService(download, async () => {
    const failed = await judge(download); report.download = failed;
    assert.deepEqual(failed, expectedFailures);
  });
  console.log('download: fresh npm ci, startup and judge results passed');
} finally {
  await fs.writeFile(path.join(scratch, 'results.json'), JSON.stringify(report, null, 2));
  console.log(`Validation artifacts: ${scratch}`);
}

/** Author acceptance: real judge workflows, streamed/history parity and isolated mutants.
 * Run after packing: npx tsx scripts/validate-shishan006.ts
 * Requires port 18085 to be free. Temporary services are stopped in finally blocks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import AdmZip from 'adm-zip';
import { readSpec } from '../lib/problems';
import { runTestCase } from '../lib/runner/executors';
import type { RunnerContext } from '../lib/runner/types';

const problem = path.resolve('problems/SHISHAN006');
const url = 'http://127.0.0.1:18085';
const spec = await readSpec('SHISHAN006');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'shishan006-validation-'));
const report: Record<string, unknown> = {};
const expectedFailures = ['optional-field-space', 'multiline-event', 'cr-event-boundaries',
  'mixed-archive-layout', 'eof-without-receipt', 'interrupted-read', 'malformed-event',
  'unfinished-data-event', 'unfinished-receipt'];
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withService(directory: string, action: () => Promise<void>) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: directory, windowsHide: true,
    env: { ...process.env, PORT: '18085', NODE_PATH: path.join(problem, 'reference/node_modules') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (child.exitCode !== null) throw new Error(`Service stopped: ${output}`);
      try { ready = (await fetch(`${url}/hello`)).ok; } catch { /* starting */ }
      if (ready) break;
      await wait(50);
    }
    assert.ok(ready, `Service did not start: ${output}`);
    await action();
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }
}

async function judge(directory: string) {
  const logFile = path.join(directory, 'logs/app.log');
  const offset = await fs.stat(logFile).then(stat => stat.size, () => 0);
  const context: RunnerContext = {
    problemId: 'SHISHAN006', vars: { baseUrl: url }, logFile, logBaseDir: directory,
    logOffsets: new Map([[logFile, offset]]), log: () => {},
  };
  const failed: string[] = [];
  for (const test of spec.tests) {
    const outcome = await runTestCase(test, context);
    if (!outcome.passed) failed.push(test.id);
  }
  return failed;
}

async function post(endpoint: string, body = {}) {
  const response = await fetch(url + endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.ok(response.ok);
  return response;
}

async function checkStreamParity() {
  for (let number = 1; number <= 14; number++) {
    await post('/api/chat/reset');
    const { conversation } = await (await post('/api/conversations', {
      sampleId: `R${String(number).padStart(3, '0')}`,
    })).json();
    const prompt = `核验 ${number}："你好"\\\n🌍`;
    const wire = await (await post('/api/chat/send-stream', { conversation_id: conversation.id, content: prompt })).text();
    const events = wire.trim().split('\n\n').map(frame => {
      const lines = frame.split('\n');
      return { type: lines[0].slice(7), data: JSON.parse(lines[1].slice(6)) };
    });
    const history = await (await fetch(`${url}/api/conversations/${conversation.id}/messages`)).json();
    const assistant = history.messages[1];
    const content = events.filter(event => event.type === 'content').map(event => event.data.delta).join('');
    const reasoning = events.filter(event => event.type === 'reasoning').map(event => event.data.delta).join('');
    assert.equal(content, assistant.content);
    assert.equal(reasoning, assistant.reasoning_content);
    const failed = number >= 9 && number <= 13;
    assert.equal(content, failed ? '收到：' : `收到：${prompt}。祝你今天顺利🌍！`);
    assert.equal(assistant.status, failed ? 'failed' : 'completed');
    assert.equal(events.filter(event => event.type === 'done').length, failed ? 0 : 1);
    assert.equal(events.filter(event => event.type === 'error').length, failed ? 1 : 0);
  }
  // A second turn must append to the same conversation without changing the first reply.
  const { conversation } = await (await post('/api/conversations', { sampleId: 'R001' })).json();
  for (const content of ['第一问', '第二问']) await (await post('/api/chat/send-stream', { conversation_id: conversation.id, content })).text();
  const history = await (await fetch(`${url}/api/conversations/${conversation.id}/messages`)).json();
  assert.equal(history.messages.length, 4);
  assert.equal(history.messages[1].content, '收到：第一问。祝你今天顺利🌍！');
  assert.equal(history.messages[3].content, '收到：第二问。祝你今天顺利🌍！');
}

function command(executable: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child: ChildProcess = spawn(executable, args, { cwd, windowsHide: true, stdio: 'pipe' });
    let output = '';
    child.stdout?.on('data', chunk => { output += chunk; });
    child.stderr?.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(output)));
  });
}

try {
  const occupied = await fetch(`${url}/hello`).then(() => true, () => false);
  assert.equal(occupied, false, 'Port 18085 already in use; refusing to test an unrelated service');
  const reference = path.join(problem, 'reference');
  await withService(reference, async () => {
    const failed = await judge(reference);
    report.reference = failed;
    assert.deepEqual(failed, []);
    await checkStreamParity();
  });
  console.log(`reference: ${spec.tests.length}/${spec.tests.length} + stream/history parity passed`);

  const starter = path.join(problem, 'starter');
  await withService(starter, async () => {
    const rounds = [];
    for (let round = 0; round < 3; round++) {
      const failed = await judge(starter);
      assert.deepEqual(failed, expectedFailures);
      rounds.push(failed);
    }
    report.starter = rounds;
  });
  console.log(`starter: three identical rounds, ${expectedFailures.length} expected failures`);

  const source = await fs.readFile(path.join(reference, 'src/llm.js'), 'utf8');
  const mutations = [
    { id: 'field-space', target: 'optional-field-space', source: source.replace("if (field === 'data')", "if (field === 'data' && line.startsWith('data: '))") },
    { id: 'line-json', target: 'multiline-event', source: source.replace('yield* decodeEvent(data);', "for (const item of data.split('\\n')) yield* decodeEvent(item);") },
    { id: 'lf-only', target: 'cr-event-boundaries', source: source.replace("character === '\\r' || character === '\\n'", "character === '\\n'") },
    { id: 'skip-malformed', target: 'malformed-event', source: source.replace("throw new Error('上游事件无法读取');", 'return;') },
    { id: 'early-receipt', target: 'unfinished-receipt', source: source.replace("if (line === '') {", "if (line === 'data: [DONE]') { yield { type: 'done' }; return; }\n    if (line === '') {") },
    { id: 'blind-completion', target: 'eof-without-receipt', source },
  ];
  for (const mutation of mutations) {
    const directory = path.join(scratch, mutation.id);
    await fs.cp(reference, directory, { recursive: true, filter: file => !['node_modules', 'logs'].includes(path.basename(file)) });
    if (mutation.id === 'blind-completion') {
      await fs.copyFile(path.join(starter, 'src/completion.js'), path.join(directory, 'src/completion.js'));
    } else {
      assert.notEqual(mutation.source, source, `Mutation ${mutation.id} was not applied`);
      await fs.writeFile(path.join(directory, 'src/llm.js'), mutation.source);
    }
    await withService(directory, async () => {
      const failed = await judge(directory);
      report[mutation.id] = failed;
      assert.ok(failed.includes(mutation.target), `${mutation.id} escaped its test`);
    });
    console.log(`mutant ${mutation.id}: detected`);
  }

  const unpacked = path.join(scratch, 'download');
  new AdmZip(path.join(problem, 'dist/SHISHAN006.zip')).extractAllTo(unpacked);
  const npm = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  await command(process.execPath, [npm, 'ci', '--ignore-scripts', '--no-audit', '--no-fund'], unpacked);
  // Own dependencies must resolve without NODE_PATH before starting the archive.
  await command(process.execPath, ['-e', "require('./node_modules/express'); require('./src/provider')"], unpacked);
  await withService(unpacked, async () => {
    const failed = await judge(unpacked);
    report.download = failed;
    assert.deepEqual(failed, expectedFailures);
  });
  console.log('download: fresh npm ci, startup and expected judge results passed');
} finally {
  await fs.writeFile(path.join(scratch, 'results.json'), JSON.stringify(report, null, 2));
  console.log(`Validation artifacts: ${scratch}`);
}

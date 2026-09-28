/** npx tsx scripts/validate-shishan008.ts -- run after pack:problem. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import AdmZip from 'adm-zip';
import { readSpec } from '../lib/problems';
import { runTestCase } from '../lib/runner/executors';
import type { RunnerContext } from '../lib/runner/types';
import type { WorkflowTest } from '../lib/types';

const require = createRequire(import.meta.url);
const { fixture, scenarioSteps } = require('./shishan008-cases.cjs');
const problem = path.resolve('problems/SHISHAN008');
const baseUrl = 'http://127.0.0.1:18087';
const spec = await readSpec('SHISHAN008');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'shishan008-validation-'));
const report: Record<string, unknown> = {};
const python = process.env.SHISHAN_PYTHON || 'python';
const expectedFailures = ['summary-source','source-summary-source','hot-isolation',
  'identity-self-other','identity-other-self','identity-guest-self','queued-switch',
  'queued-logout','queued-other','two-windows','reverse-execution','summary-reload',
  'combined-journey','diagnostic-integrity'];

async function withService(directory: string, action: () => Promise<void>) {
  await new Promise<void>((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(new Error('Port 18087 occupied; refusing to test another service')));
    probe.listen(18087, '127.0.0.1', () => probe.close(() => resolve()));
  });
  const state = await fs.mkdtemp(path.join(scratch, 'state-'));
  const child = spawn(python, ['-B', '-u', 'server.py'], {
    cwd: directory, env: { ...process.env, PORT:'18087', REPORT_STATE_DIR:state, PYTHONIOENCODING:'utf-8' },
    windowsHide:true, stdio:['ignore','pipe','pipe'],
  });
  let output = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Startup timeout: '+output)), 8000);
      const fail = (e: Error) => { clearTimeout(timer); reject(e); };
      child.once('error',fail);
      child.once('exit',code=>fail(new Error(`Python exited ${code}: ${output}`)));
      child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('Report workbench:')){clearTimeout(timer);resolve();}});
      child.stderr.on('data',chunk=>{output+=chunk;});
    });
    await action();
  } finally {
    if(child.exitCode===null && child.pid){const exited=once(child,'exit');child.kill();await exited;}
  }
}
async function context(directory: string): Promise<RunnerContext> {
  const logFile=path.join(directory,'logs/app.log');
  const offset=await fs.stat(logFile).then(s=>s.size,()=>0);
  return {problemId:'SHISHAN008',vars:{baseUrl},logFile,logBaseDir:directory,
    logOffsets:new Map([[logFile,offset]]),log:()=>{}};
}
async function judge(directory: string) {
  const ctx=await context(directory);
  const failures=[];
  for(const test of spec.tests){
    const outcome=await runTestCase(test,ctx);
    if(!outcome.passed){failures.push(test.id);await fs.appendFile(path.join(scratch,'failures.log'),`${directory} ${test.id}: ${outcome.reason}\n`);}
  }
  return failures;
}
async function api(endpoint: string, body?: unknown, status=200) {
  const response=await fetch(baseUrl+endpoint,{...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),signal:AbortSignal.timeout(5000)});
  const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;
}
async function extraJourneys(directory: string) {
  const actors: (string|null)[]=[null,...Object.keys(fixture.accounts)];
  let count=0;
  for(const before of actors)for(const after of actors){
    const actions=[{kind:'login',account:before},{kind:'queue',target:'alice'},
      {kind:'login',account:after},{kind:'report',target:'bob',view:'summary'},
      {kind:'run',id:1},{kind:'reload'},{kind:'report',target:'alice',view:'source'}];
    const test: WorkflowTest={id:'extra-'+(++count),type:'workflow',name:'Extra identity journey',steps:scenarioSteps({actions})};
    const result=await runTestCase(test,await context(directory));assert.equal(result.passed,true,result.reason ?? 'Extra identity journey failed');
  }
  await api('/api/reset',{});
  await api('/api/session',{account:'alice'});
  assert.equal((await api('/api/session?slot=desk')).account,'alice');
  assert.equal((await api('/api/session?slot=new-window')).account,null);
  await api('/api/reports',{target:'alice'});
  const before=await api('/api/history');
  for(const body of [{target:'missing'},{target:'alice',sampleCount:0},{target:'alice',sampleCount:true},
    {target:'alice',languages:'python'},{target:'alice',languages:['ruby']},{target:'alice',view:'raw'}]){
    await api('/api/reports',body,400);
  }
  await api('/api/session',{account:'unknown'},400);
  assert.deepEqual(await api('/api/history'),before,'Invalid requests changed queued tasks');
  const done=await api('/api/jobs/job-1/run',{});
  assert.equal(done.report.viewer,'alice');
  const calls=(await api('/api/source-audit')).calls;
  assert.deepEqual(calls.filter((c:{operation:string})=>c.operation==='page').map((c:{offset:number})=>c.offset),[0,2,4,6]);
  assert.equal(calls.filter((c:{operation:string})=>c.operation==='detail').length,6);
  const page=await fetch(baseUrl+'/').then(r=>r.text());assert.ok(page.includes('张冠李戴'));
  report.extraJourneys=count;
}
async function sourceContract(directory:string){
  const child=spawn(python,['-B',path.resolve('scripts/validate-shishan008-source.py'),directory],{windowsHide:true,stdio:'pipe',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  let out='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>out+=c);
  const [code]=await once(child,'exit');assert.equal(code,0,out);console.log(out.trim());
}
try {
  const reference=path.join(problem,'reference'),starter=path.join(problem,'starter');
  await sourceContract(reference);
  await sourceContract(starter);
  await withService(reference,async()=>{
    report.reference=await judge(reference);assert.deepEqual(report.reference,[]);
    await extraJourneys(reference);
  });
  console.log(`reference: ${spec.tests.length}/${spec.tests.length}; 25 additional identity journeys passed`);
  await withService(starter,async()=>{
    const rounds=[];
    for(let i=0;i<3;i++){const failures=await judge(starter);rounds.push(failures);report.starter=rounds;assert.deepEqual(failures,expectedFailures);}
  });
  console.log(`starter: three identical rounds, ${expectedFailures.length} expected failures`);
  for(const mutation of [
    {file:'identity.py',targets:['identity-self-other','identity-other-self','identity-guest-self']},
    {file:'cache.py',targets:['hot-isolation','two-windows']},
    {file:'views.py',targets:['summary-source','source-summary-source','summary-reload']},
    {file:'jobs.py',targets:['queued-switch','queued-logout','queued-other']},
  ]){
    const directory=path.join(scratch,'mutation-'+mutation.file);
    await fs.cp(reference,directory,{recursive:true,filter:name=>!['logs','__pycache__','.runtime'].includes(path.basename(name))});
    await fs.copyFile(path.join(starter,'reporting',mutation.file),path.join(directory,'reporting',mutation.file));
    await withService(directory,async()=>{
      const failed=await judge(directory);report[mutation.file]=failed;
      for(const id of mutation.targets)assert.ok(failed.includes(id),`${mutation.file} escaped ${id}`);
      for(const id of ['ordinary-alice','ordinary-bob','guest','other-account'])assert.ok(!failed.includes(id),`mutation broke ${id}`);
    });
    console.log(`mutant ${mutation.file}: detected independently`);
  }
  const bypass=path.join(scratch,'mutation-no-reuse');
  await fs.cp(reference,bypass,{recursive:true,filter:name=>!['logs','__pycache__','.runtime'].includes(path.basename(name))});
  const cachePath=path.join(bypass,'reporting/cache.py');
  const source=await fs.readFile(cachePath,'utf8');
  const noReuse=source.replace(/    def remember\([\s\S]*$/, '    def remember(self, namespace, key, fetch):\n        return fetch()\n');
  assert.notEqual(noReuse,source);await fs.writeFile(cachePath,noReuse);
  await withService(bypass,async()=>{const failed=await judge(bypass);report.noReuse=failed;assert.deepEqual(failed,['collection-budget']);});
  console.log('cache-removal shortcut: rejected by upstream budget');
  const download=path.join(scratch,'download');
  const zip=new AdmZip(path.join(problem,'dist/SHISHAN008.zip'));
  assert.ok(!zip.getEntries().some(e=>/(?:\.runtime|__pycache__|tests\.yaml|solution\.md|hints\.md)/.test(e.entryName)));
  zip.extractAllTo(download);
  await withService(download,async()=>{report.download=await judge(download);assert.deepEqual(report.download,expectedFailures);});
  console.log('download: standalone Python startup and judge parity passed');
} finally {
  await fs.writeFile(path.join(scratch,'results.json'),JSON.stringify(report,null,2));
  console.log('Validation artifacts: '+scratch);
}

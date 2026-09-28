// Authoring fixtures + independent declarative oracle; never shipped in the ZIP.
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const root = path.resolve('problems/SHISHAN008');
const accounts = {};
for (const [account, size, solved, rating] of [
  ['alice', 7, 137, 1684], ['bob', 6, 82, 1491], ['carol', 5, 219, 1907], ['dana', 0, 0, 0],
]) {
  accounts[account] = {
    profile: { account, solved, rating, contests: size * 3 },
    submissions: Array.from({ length: size }, (_, i) => {
      const language = ['python', 'java', 'javascript'][i % 3];
      const marker = `${account}/${i + 1} 中文🧩`;
      const code = language === 'python'
        ? `# ${marker}\ndef solve_${i + 1}(values):\n    return sum(values) + ${solved + i}\n`
        : language === 'java'
          ? `// ${marker}\nclass Solution${i + 1} {\n    int solve(int value) {\n        return value + ${solved + i};\n    }\n}\n`
          : `// ${marker}\nfunction solve${i + 1}(value) {\n    return value + ${solved + i};\n}\n`;
      return { id: `${account}-${i + 1}`, owner: account, title: `练习 ${solved + i}`,
        language, verdict: i === size - 1 ? 'Wrong Answer' : 'Accepted',
        submittedAt: 1700000000 + i * 43200, content: { code } };
    }),
  };
}
const fixture = { version: 1, accounts };
const login = (account, slot = 'desk') => ({ kind: 'login', account, slot });
const report = (target, view = 'source', options = {}) => ({ kind: 'report', target, view, ...options });
const queue = (target, options = {}) => ({ kind: 'queue', target, view: 'source', ...options });
const run = id => ({ kind: 'run', id });
const reload = { kind: 'reload' };
const cases = [
  ['ordinary-alice', '单账号完整采集', [login('alice'), report('alice')]],
  ['ordinary-bob', '不同样本数量与完整分页', [login('bob'), report('bob')]],
  ['guest', '游客只展示公开资料', [report('carol')]],
  ['other-account', '非本人访问的正常边界', [login('bob'), report('alice')]],
  ['repeat-source', '重复正文请求一致', [login('carol'), report('carol'), report('carol')]],
  ['language-selection', '语言范围与不同采样数量', [login('alice'), report('alice', 'source', {languages:['python']}), report('alice', 'source', {languages:['java','javascript']}), report('alice', 'source', {sampleCount:2})]],
  ['empty-selection', '明确空语言范围不能等同全部', [login('bob'), report('bob', 'source', {languages:[]}), report('bob')]],
  ['empty-owner', '本人无提交记录仍正常生成', [login('dana'), report('dana')]],
  ['summary-source', '摘要投影不能修改后续正文', [login('alice'), report('alice','summary'), report('alice')]],
  ['source-summary-source', '读取摘要后的正文和历史保持不变', [login('bob'), report('bob'), report('bob','summary'), report('bob')]],
  ['hot-isolation', '进程索引与持久层隔离口径一致', [login('alice'), report('alice'), login('bob'), report('bob'), login('carol'), report('carol')]],
  ['identity-self-other', '登录状态不能跟随报告对象复用', [login('alice'), report('alice'), reload, login('bob'), report('alice')]],
  ['identity-other-self', '他人查询不能污染本人的登录判断', [login('bob'), report('alice'), reload, login('alice'), report('alice')]],
  ['identity-guest-self', '游客记录不能遮蔽后续本人身份', [report('carol'), reload, login('carol'), report('carol')]],
  ['queued-switch', '排队任务保持提交时身份', [login('alice'), queue('alice'), login('bob'), run(1)]],
  ['queued-logout', '退出登录不改写已提交任务', [login('carol'), queue('carol'), login(null), run(1)]],
  ['queued-other', '原先无权限的任务不能借后续登录升级', [login('bob'), queue('alice'), login('alice'), run(1)]],
  ['two-windows', '两个窗口共享工作台但不共享身份', [login('alice','left'), login('bob','right'), report('alice','source',{slot:'left'}), report('bob','source',{slot:'right'})]],
  ['disk-roundtrip', '持久化重读仍满足隔离和内容契约', [login('alice'), report('alice'), reload, login('bob'), report('bob'), reload, login('alice'), report('alice')]],
  ['reverse-execution', '交错提交与逆序执行', [login('alice'), queue('alice'), login('bob'), queue('bob'), run(2), reload, run(1)]],
  ['summary-reload', '投影前后重载的一致性', [login('carol'), report('carol','summary'), reload, report('carol'), report('carol','summary'), report('carol')]],
  ['combined-journey', '投影和登录切换的组合回归', [login('alice'), report('alice'), report('alice','summary'), login('bob'), report('bob'), reload, login('alice'), report('alice')]],
].map(([id,name,actions]) => ({id,name,actions}));
cases.push({id:'collection-budget',name:'重复及范围缩小请求遵守上游读取预算',
  actions:[login('alice'),report('alice'),report('alice'),report('alice','source',{languages:['python']}),
    report('alice','source',{languages:[]})],expectedReads:{profile:1,pages:4,details:6}});

function expectedReport(viewer, action) {
  const target = action.target;
  let samples = viewer === target
    ? accounts[target].submissions.filter(s => s.verdict === 'Accepted' &&
      (action.languages == null || action.languages.includes(s.language))) : [];
  // Fixed golden selection for the one bounded sampling case (seed 42, two buckets).
  if (action.sampleCount === 2 && samples.length > 2) {
    if (target !== 'alice' || action.languages != null) throw Error('Add an explicit sampling golden');
    samples = [samples[2], samples[3]];
  }
  samples = structuredClone(samples);
  const languageDistribution = {};
  let totalLines = 0;
  for (const sample of samples) {
    languageDistribution[sample.language] = (languageDistribution[sample.language] || 0) + 1;
    totalLines += sample.content.code.split('\n').filter(s => s.trim()).length;
    if (action.view === 'summary') sample.content = {};
  }
  return {profile: structuredClone(accounts[target].profile), status: viewer === target ? 'ready' : 'restricted',
    samples, metrics: {sampleCount:samples.length,languageDistribution,totalLines},
    target,viewer,view:action.view || 'source',sampleCount:samples.length};
}

function scenarioSteps(scenario) {
  const steps = [];
  const slots = new Map();
  const jobs = [];
  const push = (url, body, expected, get = false, notContains = []) => steps.push({
    id:'step-'+(steps.length+1), continueOnFail:true,
    request:{method:get?'GET':'POST',url:'${baseUrl}'+url,...(get?{}:{json:body}),timeoutMs:4000},
    expect:{status:200,json:expected,...(notContains.length?{notContains}:{})},
  });
  push('/api/reset',{}, {status:'ok'});
  function execute(index) {
    const item = jobs[index-1];
    item.public.status = 'completed';
    item.public.report = expectedReport(item.public.viewer,item.action);
    const forbidden = item.public.report.view==='summary'||item.public.report.status==='restricted'?['"code":']:[];
    push(`/api/jobs/job-${index}/run`,{},structuredClone(item.public),false,forbidden);
    push(`/api/jobs/job-${index}`,null,structuredClone(item.public),true,forbidden);
    // Execution receipts are immutable; retry must return exactly the same snapshot.
    push(`/api/jobs/job-${index}/run`,{},structuredClone(item.public),false,forbidden);
  }
  for (const action of scenario.actions) {
    const slot = action.slot || 'desk';
    if (action.kind==='login') {
      slots.set(slot,action.account);
      push('/api/session',{slot,account:action.account},{slot,account:action.account});
    } else if (action.kind==='reload') push('/api/reload',{}, {status:'ok'});
    else if (action.kind==='run') execute(action.id);
    else {
      const body = {slot,target:action.target,view:action.view || 'source',sampleCount:action.sampleCount || 20,languages:action.languages ?? null};
      const receipt = {jobId:'job-'+(jobs.length+1),status:'queued',target:action.target,viewer:slots.get(slot)??null};
      jobs.push({public:receipt,action});
      push('/api/reports',body,structuredClone(receipt));
      if (action.kind==='report') execute(jobs.length);
    }
  }
  push('/api/history',null,{jobs:jobs.map(j=>structuredClone(j.public))},true);
  if(scenario.expectedReads)push('/api/source-audit',null,{reads:scenario.expectedReads},true);
  return steps;
}

function generate() {
  for (const variant of ['starter','reference']) {
    const dir=path.join(root,variant,'samples');fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'upstream.json'),JSON.stringify(fixture,null,2)+'\n');
  }
  const tests=[{id:'heartbeat',type:'http',name:'服务就绪',displayName:'服务就绪',
    request:{method:'GET',url:'${baseUrl}/api/health',timeoutMs:4000},expect:{status:200,json:{status:'ok'}}},
    ...cases.map((c,i)=>({id:c.id,type:'workflow',name:c.name,displayName:`报告核验 ${i+1}`,
      description:'核对报告内容、身份、公开资料、源码、指标与历史快照，并验证重复执行。',steps:scenarioSteps(c)})),
    {id:'diagnostic-integrity',type:'log',name:'业务来源和报告快照一致',displayName:'运行记录核验',
      match:['REPORT_READY'],notMatch:['REPORT_CONTEXT_DRIFT','REPORT_FAILED']}];
  fs.writeFileSync(path.join(root,'tests.yaml'),YAML.stringify({version:1,baseUrl:'http://127.0.0.1:18087',tests},{aliasDuplicateObjects:false,lineWidth:140}));
}
if(require.main===module)generate();
module.exports={cases,fixture,expectedReport,scenarioSteps};

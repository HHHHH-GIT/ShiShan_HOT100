const $ = id => document.getElementById(id);
let batches = [], cursor = 0, stats = null;
async function request(url, body) {
  const response = await fetch(url, body === undefined ? {} : { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '请求失败');
  return data;
}
function table(target, rows) {
  const element = document.createElement('table');
  const head = element.createTHead().insertRow();
  for (const label of ['项目','总量','输入','输出','缓存读取','缓存写入']) {
    const th = document.createElement('th'); th.textContent = label; head.append(th);
  }
  const body = element.createTBody();
  for (const [name, total, components] of rows) {
    const row = body.insertRow();
    for (const value of [name, total, ...['inputTokens','outputTokens','cacheReadTokens','cacheWriteTokens'].map(key => components?.[key] ?? 0)]) row.insertCell().textContent = String(value);
  }
  $(target).replaceChildren(element);
}
function render() {
  if (!stats) return;
  const window = $('window').value;
  const period = stats.periods[window];
  $('date').textContent = `快照归属：${stats.periodKeys[window] ?? '暂无记录'} · ${stats.reportTimeZone}`;
  $('total').textContent = period.totalTokens.toLocaleString();
  table('overview', [['合计',period.totalTokens,period]]);
  table('clients', Object.entries(period.clients).map(([name,total]) => [name,total,period.clientComponents[name]]));
  table('models', Object.entries(period.models).map(([name,total]) => [name,total,period.modelComponents[name]]));
}
async function refresh() {
  const [report, inventory] = await Promise.all([request('/api/stats'),request('/api/devices')]);
  stats = report; render(); $('devices').replaceChildren();
  for (const device of inventory.devices) {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${device.deviceId} · 用量日期 ${device.periodKeys.today} · 剩余额度 ${device.limits.remaining ?? '未上报'}`;
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(device,null,2); details.append(summary,pre); $('devices').append(details);
  }
}
function preview() {
  const batch = batches.find(item => item.id === $('batch').value);
  $('progress').textContent = `已提交 ${cursor} / ${batch.reports.length}`;
  $('next').disabled = cursor >= batch.reports.length;
  $('report').value = JSON.stringify(batch.reports[Math.min(cursor,batch.reports.length-1)],null,2);
}
async function action(work) {
  for (const id of ['next','reset','submit','batch','refresh']) $(id).disabled = true;
  $('notice').textContent = '';
  try { await work(); } catch (error) { $('notice').textContent = error.message; }
  finally {
    for (const id of ['reset','submit','batch','refresh']) $(id).disabled = false;
    const batch = batches.find(item => item.id === $('batch').value);
    $('next').disabled = !batch || cursor >= batch.reports.length;
  }
}
$('next').onclick = () => action(async () => {
  const batch = batches.find(item => item.id === $('batch').value);
  await request('/api/ingest',batch.reports[cursor]); cursor++; preview(); await refresh();
});
$('batch').onchange = () => { cursor = 0; preview(); $('notice').textContent = '已切换回访记录；设备数据保留，需要时可清空。'; };
$('reset').onclick = () => action(async () => { await request('/api/reset',{}); cursor=0; preview(); await refresh(); });
$('submit').onclick = () => action(async () => { await request('/api/ingest',JSON.parse($('report').value)); await refresh(); $('notice').textContent='已提交编辑内容；回访步骤未推进。'; });
$('refresh').onclick = () => action(refresh);
$('window').onchange = render;
action(async () => {
  ({ batches } = await request('/samples/reports.json'));
  for (const batch of batches) { const option=document.createElement('option'); option.value=batch.id; option.textContent=`${batch.id} · ${batch.label}`; $('batch').append(option); }
  preview(); await refresh();
});

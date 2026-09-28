'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { mergeDeviceRecord, aggregateDevices, deviceView } = require('./src/usage');
const { validateReport, validInstant } = require('./src/validation');
const audit = require('./src/audit');
const log = require('./src/logger');
const devices = new Map();
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
};
async function readBody(req) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 1024 * 1024) throw Object.assign(new Error('请求体超过 1 MB'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('JSON 无效'), { status: 400 }); }
}
const assets = {
  '/': ['public/index.html', 'text/html'], '/app.js': ['public/app.js', 'text/javascript'],
  '/samples/reports.json': ['samples/reports.json', 'application/json'],
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && assets[url.pathname]) {
      const [file, type] = assets[url.pathname];
      const contents = await fs.readFile(path.join(__dirname, file));
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` }); res.end(contents); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { status: 'ok' });
    if (req.method === 'POST' && url.pathname === '/api/reset') {
      devices.clear(); log('INFO', 'REPORT_RESET'); return json(res, 200, { status: 'ok' });
    }
    if (req.method === 'POST' && url.pathname === '/api/ingest') {
      const body = await readBody(req);
      const existing = devices.get(body?.deviceId);
      validateReport(body, existing);
      const record = mergeDeviceRecord(existing, body);
      audit(record);
      devices.set(record.deviceId, record);
      log('INFO', 'REPORT_ACCEPTED', { deviceId: record.deviceId, limitsOnly: Boolean(body.limitsOnly) });
      return json(res, 200, { ok: true, device: deviceView(record) });
    }
    if (req.method === 'GET' && url.pathname === '/api/stats') {
      const at = url.searchParams.get('at');
      if (at && !validInstant(at)) return json(res, 400, { error: 'at 须为带时区的 ISO 时间' });
      return json(res, 200, aggregateDevices([...devices.values()], at ? new Date(at).toISOString() : undefined));
    }
    if (req.method === 'GET' && url.pathname === '/api/devices') {
      return json(res, 200, { devices: [...devices.values()].map(deviceView).sort((a, b) => a.deviceId.localeCompare(b.deviceId)) });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/devices/')) {
      const record = devices.get(decodeURIComponent(url.pathname.slice('/api/devices/'.length)));
      return record ? json(res, 200, { device: deviceView(record) }) : json(res, 404, { error: '设备不存在' });
    }
    json(res, 404, { error: '接口不存在' });
  } catch (error) {
    const status = error.status || 500;
    log(status >= 500 ? 'ERROR' : 'WARN', 'REPORT_REJECTED', { message: error.message });
    json(res, status, { error: status >= 500 ? '报表处理失败' : error.message });
  }
});
server.listen(Number(process.env.PORT || 18086), '127.0.0.1', () => {
  log('INFO', 'SERVICE_READY', { port: server.address().port });
  console.log(`Usage report: http://127.0.0.1:${server.address().port}`);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });

const express = require('express');
const path = require('node:path');
const store = require('./src/repository');
const { samples, replay } = require('./src/provider');
const { streamLLM } = require('./src/llm');
const complete = require('./src/completion');
const log = require('./src/logger');
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/hello', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/samples', (_req, res) => res.json({ samples }));
app.post('/api/chat/reset', (_req, res) => { store.reset(); res.json({ status: 'ok' }); });
app.post('/api/conversations', (req, res) => {
  const sampleId = req.body.sampleId ?? 'R001';
  if (!samples.some(sample => sample.id === sampleId)) return res.status(400).json({ error: '未知历史记录' });
  const { id } = store.create(sampleId);
  res.status(201).json({ conversation: { id, sampleId } });
});
app.get('/api/conversations/:id/messages', (req, res) => {
  const conversation = store.get(req.params.id);
  if (!conversation) return res.status(404).json({ error: '会话不存在' });
  res.json({ messages: conversation.messages });
});
app.post('/api/chat/send-stream', async (req, res) => {
  const { conversation_id, content } = req.body;
  const conversation = store.get(conversation_id);
  if (!conversation) return res.status(404).json({ error: '会话不存在' });
  if (typeof content !== 'string' || !content.trim() || content.length > 4000) {
    return res.status(400).json({ error: '消息须为 1–4000 字符的非空文本' });
  }
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  const emit = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const user = store.append(conversation, 'user', content, 'completed');
  const assistant = store.append(conversation, 'assistant', '', 'streaming');
  emit('user_message', user);
  let receivedReceipt = false;
  let upstreamError = null;
  try {
    for await (const chunk of streamLLM(replay(conversation.sampleId, content))) {
      if (chunk.type === 'done') receivedReceipt = true;
      if (chunk.type === 'error') {
        upstreamError = chunk.message;
        emit('error', { message: chunk.message });
        break;
      }
      if (chunk.type === 'reasoning') {
        assistant.reasoning_content += chunk.delta;
        emit('reasoning', { delta: chunk.delta });
      }
      if (chunk.type === 'content') {
        assistant.content += chunk.delta;
        emit('content', { delta: chunk.delta });
      }
    }
    complete(assistant, receivedReceipt, upstreamError, emit);
    log('INFO', 'REPLY_SAVED', { messageId: assistant.id, status: assistant.status, length: assistant.content.length });
  } catch (error) {
    assistant.status = 'failed';
    log('ERROR', 'REPLY_FAILED', { messageId: assistant.id, message: error.message });
    emit('error', { message: '回答未完成，已保留收到的内容' });
  } finally {
    res.end();
  }
});
app.use((err, _req, res, _next) => {
  res.status(err.status === 400 ? 400 : 500).json({ error: '请求处理失败' });
});
const port = Number(process.env.PORT || 18085);
const server = app.listen(port, '127.0.0.1', () => {
  log('INFO', 'SERVICE_READY', { port });
  console.log(`Reply service: http://127.0.0.1:${port}`);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });

// Adapted from SQL-Final-Project src/utils/llm.js (streamLLM).
const log = require('./logger');

function* decodeEvent(data) {
  if (data === '') return; // integration keepalive
  if (data === '[DONE]') { yield { type: 'done' }; return; }
  let parsed;
  try { parsed = JSON.parse(data); }
  catch {
    log('WARN', 'REPLY_EVENT_REJECTED', { length: data.length });
    throw new Error('上游事件无法读取');
  }
  const delta = parsed?.choices?.[0]?.delta;
  if (!delta) return; // role / usage metadata carries no reply text
  for (const [field, type] of [['reasoning_content', 'reasoning'], ['content', 'content']]) {
    if (delta[field] == null || delta[field] === '') continue;
    if (typeof delta[field] !== 'string') throw new Error('上游内容格式无效');
    yield { type, delta: delta[field] };
  }
}

async function* streamLLM(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let line = '';
  let skipLF = false;
  let dataLines = [];
  function* acceptLine() {
    if (line === '') {
      const data = dataLines.join('\n');
      dataLines = [];
      yield* decodeEvent(data);
    } else if (!line.startsWith(':')) {
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      let value = colon < 0 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') dataLines.push(value);
    }
    line = '';
  }
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        decoder.decode(); // detect an incomplete UTF-8 sequence
        throw new Error('回答连接结束，但未收到完成凭据');
      }
      for (const character of decoder.decode(value, { stream: true })) {
        if (skipLF) {
          skipLF = false;
          if (character === '\n') continue;
        }
        if (character === '\r' || character === '\n') {
          skipLF = character === '\r';
          for (const event of acceptLine()) {
            yield event;
            if (event.type === 'done') return;
          }
        } else line += character;
      }
    }
  } catch (err) {
    yield { type: 'error', message: `流读取错误: ${err.message}` };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
module.exports = { streamLLM };

// Adapted from SQL-Final-Project src/utils/llm.js (streamLLM).
const log = require('./logger');
async function* streamLLM(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          yield { type: 'done' };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;
          if (delta.reasoning_content) yield { type: 'reasoning', delta: delta.reasoning_content };
          if (delta.content) yield { type: 'content', delta: delta.content };
        } catch {
          log('WARN', 'REPLY_EVENT_REJECTED', { length: data.length });
        }
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

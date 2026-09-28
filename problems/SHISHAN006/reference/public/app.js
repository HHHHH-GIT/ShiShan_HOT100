const $ = id => document.getElementById(id);
const labels = { streaming: '正在回答', completed: '已完成', failed: '未完成' };
let conversationId = null;
async function request(url, body) {
  const response = await fetch(url, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error((await response.json()).error || '请求失败');
  return response;
}
function bubble(message) {
  const article = document.createElement('article');
  const heading = document.createElement('strong');
  heading.textContent = message.role === 'user' ? '你' : '资料助手';
  const text = document.createElement('div'); text.className = 'text'; text.textContent = message.content;
  const status = document.createElement('div'); status.className = 'status'; status.textContent = labels[message.status];
  article.append(heading, text, status); $('messages').append(article);
  return { text, status };
}
function busy(value) {
  for (const id of ['sample', 'fresh', 'send']) $(id).disabled = value;
  $('reload').disabled = value || !conversationId;
}
$('fresh').onclick = () => { conversationId = null; $('messages').replaceChildren(); $('notice').textContent = ''; busy(false); };
$('sample').onchange = $('fresh').onclick;
$('reload').onclick = async () => {
  busy(true);
  try {
    const data = await (await request(`/api/conversations/${conversationId}/messages`)).json();
    $('messages').replaceChildren(); data.messages.forEach(bubble);
  } catch (error) { $('notice').textContent = error.message; }
  finally { busy(false); }
};
$('form').onsubmit = async event => {
  event.preventDefault();
  const content = $('prompt').value;
  if (!content.trim()) return;
  busy(true); $('notice').textContent = '';
  let assistant;
  let terminal = false;
  try {
    if (!conversationId) {
      const data = await (await request('/api/conversations', { sampleId: $('sample').value })).json();
      conversationId = data.conversation.id;
    }
    const response = await request('/api/chat/send-stream', { conversation_id: conversationId, content });
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary;
        // This service emits canonical LF event frames; upstream formats are independent.
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
          const lines = frame.split('\n');
          const type = lines.find(line => line.startsWith('event: '))?.slice(7);
          const data = JSON.parse(lines.find(line => line.startsWith('data: ')).slice(6));
          if (type === 'user_message') {
            bubble(data); assistant = bubble({ role: 'assistant', content: '', status: 'streaming' });
          }
          if (type === 'content') assistant.text.textContent += data.delta;
          if (type === 'done') { assistant.status.textContent = labels.completed; terminal = true; }
          if (type === 'error') {
            $('notice').textContent = data.message;
            assistant.status.textContent = labels.failed; terminal = true;
          }
        }
      }
      if (!terminal) throw new Error('回答连接已结束，请重新读取记录确认状态');
    } finally { reader.releaseLock(); }
  } catch (error) {
    $('notice').textContent = error.message;
    if (assistant) assistant.status.textContent = labels.failed;
  } finally { busy(false); }
};
(async () => {
  busy(true);
  try {
    const { samples } = await (await request('/api/samples')).json();
    for (const sample of samples) {
      const option = document.createElement('option'); option.value = sample.id;
      option.textContent = `${sample.id} · ${sample.label}`; $('sample').append(option);
    }
  } catch (error) { $('notice').textContent = error.message; }
  finally { busy(false); }
})();

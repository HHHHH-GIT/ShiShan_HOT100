const samples = Array.from({ length: 14 }, (_, i) => ({
  id: `R${String(i + 1).padStart(3, '0')}`, label: `历史记录 ${i + 1}`,
}));
const encoder = new TextEncoder();
const json = (field, content) => JSON.stringify({ choices: [{ delta: { [field]: content } }] });

function replay(sampleId, prompt) {
  if (!samples.some(sample => sample.id === sampleId)) throw new Error('Unknown archive');
  const number = Number(sampleId.slice(1));
  const payloads = [json('reasoning_content', '正在整理资料。'),
    json('content', '收到：'), json('content', prompt), json('content', '。祝你今天顺利🌍！')];
  const normal = data => `data: ${data}\n\n`;
  let frames = payloads.map(normal);
  let ending = normal('[DONE]');
  if (number === 3) { frames = payloads.map(data => `data:${data}\n\n`); ending = 'data:[DONE]\n\n'; }
  if (number === 4) frames = payloads.map(data => normal(data).replace('"choices":[', '"choices":\ndata: ['));
  if (number === 5) { frames = frames.map(frame => frame.replaceAll('\n', '\r\n')); ending = ending.replaceAll('\n', '\r\n'); }
  if (number === 6) { frames = frames.map(frame => frame.replaceAll('\n', '\r')); ending = ending.replaceAll('\n', '\r'); }
  if (number === 7) {
    frames = frames.map(frame => ': archive heartbeat\nid: ticket-7\nretry: 1000\nevent: message\n' + frame);
    frames.splice(2, 0, ': idle\n\ndata:\n\n\n');
  }
  if (number === 8) {
    frames = [normal(payloads[0]), `data:${payloads[1]}\r\r`,
      `data: ${payloads[2].replace('"choices":[', '"choices":\r\ndata: [')}\r\n\r\n`,
      normal(payloads[3])];
  }
  if (number === 9 || number === 10) { frames = frames.slice(0, 2); ending = ''; }
  if (number === 11) frames.splice(2, 0, normal('{"choices":broken}'));
  if (number === 12) { frames = frames.slice(0, 2); ending = `data: ${payloads[2]}`; }
  if (number === 13) { frames = frames.slice(0, 2); ending = 'data: [DONE]\n'; }
  if (number === 14) ending += normal(json('content', '这段是归档连接上的后续记录，不属于本次回答。'));
  const bytes = encoder.encode(frames.join('') + ending);
  const sizes = number === 2 || number === 5 || number === 8 ? [1] : [17, 3, 61, 2];
  let offset = 0, turn = 0;
  return {
    ok: true,
    body: new ReadableStream({
      pull(controller) {
        if (offset === bytes.length) {
          if (number === 10) controller.error(new Error('archive transport interrupted'));
          else controller.close();
          return;
        }
        const end = Math.min(bytes.length, offset + sizes[turn++ % sizes.length]);
        controller.enqueue(bytes.slice(offset, end));
        offset = end;
      },
    }),
  };
}
module.exports = { samples, replay };

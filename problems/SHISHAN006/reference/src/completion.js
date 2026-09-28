// Archival policy: retain the text received so far, including failed attempts.
const log = require('./logger');
module.exports = function complete(message, receivedReceipt, upstreamError, emit) {
  if (!receivedReceipt || upstreamError) {
    log('WARN', 'REPLY_RECEIPT_MISSING', { messageId: message.id, length: message.content.length });
    message.status = 'failed';
    if (!upstreamError) emit('error', { message: '回答未完成，已保留收到的内容' });
    return;
  }
  message.status = 'completed';
  emit('done', { messageId: message.id, status: message.status });
};

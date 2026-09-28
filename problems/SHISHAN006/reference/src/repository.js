let nextConversation = 1;
let nextMessage = 1;
const conversations = new Map();
module.exports = {
  create(sampleId) {
    const conversation = { id: nextConversation++, sampleId, messages: [] };
    conversations.set(conversation.id, conversation);
    return conversation;
  },
  get(id) { return conversations.get(Number(id)); },
  append(conversation, role, content, status) {
    const message = { id: nextMessage++, role, content, reasoning_content: '', status };
    conversation.messages.push(message);
    return message;
  },
  reset() { conversations.clear(); nextConversation = 1; nextMessage = 1; },
};

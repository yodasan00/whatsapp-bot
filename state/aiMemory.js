// key: chatId, value: array of messages
const aiMemory = new Map()

const MAX_MEMORY = 5

function addToMemory(jid, role, content) {
  const history = aiMemory.get(jid) || []
  history.push({ role, content })

  if (history.length > MAX_MEMORY) {
    history.shift()
  }

  aiMemory.set(jid, history)
}

function getMemory(jid) {
  return aiMemory.get(jid) || []
}

module.exports = { addToMemory, getMemory }

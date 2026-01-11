const history = new Map()
const MAX_MSGS = 5

function addUserMessage(jid, userJid, text) {
  const key = `${jid}:${userJid}`
  const arr = history.get(key) || []

  arr.push(text)
  if (arr.length > MAX_MSGS) arr.shift()

  history.set(key, arr)
}

function getUserHistory(jid, userJid) {
  return history.get(`${jid}:${userJid}`) || []
}

module.exports = { addUserMessage, getUserHistory }

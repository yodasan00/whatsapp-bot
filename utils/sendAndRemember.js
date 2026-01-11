const { rememberBotMessage } = require('../state/botMessages')

async function sendAndRemember(sock, jid, content, options = {}) {
  const sent = await sock.sendMessage(jid, content, options)
  rememberBotMessage(sent.key.id)
  return sent
}

module.exports = { sendAndRemember }

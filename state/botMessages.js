const botMessages = new Set()

function rememberBotMessage(id) {
  if (id) botMessages.add(id)
}

function isReplyToBot(msg) {
  const stanzaId =
    msg.message?.extendedTextMessage?.contextInfo?.stanzaId
  return stanzaId && botMessages.has(stanzaId)
}

module.exports = { rememberBotMessage, isReplyToBot }

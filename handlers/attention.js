function isReplyToBot(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
  return !!ctx?.quotedMessage
}

function shouldBotRespond({ msg, text, isGroup }) {
  if (!isGroup) return true
  if (text.startsWith('.')) return true
  if (isReplyToBot(msg)) return true

  return false
}

module.exports = { shouldBotRespond }


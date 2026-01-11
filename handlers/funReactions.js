function chance(p) {
  return Math.random() < p
}

async function handleFunReactions({
  sock,
  msg,
  jid,
  isGroup
}) {
  if (!isGroup) return false

  // Random emoji reaction (rare, harmless)
  if (chance(0.04)) {
    const emojis = ['😂', '👀', '😈', '🔥', '💀']
    const emoji = emojis[Math.floor(Math.random() * emojis.length)]

    await sock.sendMessage(jid, {
      react: { text: emoji, key: msg.key }
    })
    return true
  }

  return false
}

module.exports = { handleFunReactions }

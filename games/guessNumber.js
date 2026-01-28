const { activeGames } = require('../state/activeGames')
const { addXP } = require('../state/xp') // ⭐ ADD THIS

async function startGuessGame({ sock, jid }) {
  const answer = Math.floor(Math.random() * 10) + 1

  const sent = await sock.sendMessage(jid, {
    text: '🎲 I’m thinking of a number between *1 and 10*\nReply to this message with your guess.'
  })

  // Store game using bot message ID
  activeGames.set(sent.key.id, {
    answer,
    max: 10
  })
}

async function handleGuessReply({ sock, msg, jid }) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo
  if (!ctx?.stanzaId) return false

  const game = activeGames.get(ctx.stanzaId)
  if (!game) return false

  const text = msg.message.extendedTextMessage.text.trim()
  const guess = Number(text)

  if (Number.isNaN(guess)) {
    await sock.sendMessage(jid, { text: '❌ Send a number.' })
    return true
  }

  if (guess < game.answer) {
    await sock.sendMessage(jid, { text: '📉 Too low!' })
    return true
  }

  if (guess > game.answer) {
    await sock.sendMessage(jid, { text: '📈 Too high!' })
    return true
  }

  // 🎉 Correct guess
  const winner = msg.key.participant || msg.key.remoteJid

  // ⭐ GIVE XP (you can change amount)
  const xpGained = 50
  const totalXP = addXP(jid, winner, xpGained)

  await sock.sendMessage(jid, {
    text: `🎉 Correct! <@${winner.split('@')[0]}> wins!\n+${xpGained} XP 🧠 (Total: ${totalXP})`,
    mentions: [winner]
  })

  // End game
  activeGames.delete(ctx.stanzaId)
  return true
}

module.exports = {
  startGuessGame,
  handleGuessReply
}

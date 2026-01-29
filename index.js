const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const Pino = require('pino')
const qrcode = require('qrcode-terminal')
require('dotenv').config()

// helpers
const { extractText } = require('./utils/extractText')
const { shouldBotRespond } = require('./handlers/attention')
const { handleFunCommand } = require('./commands/fun')
const { handleAdminCommand } = require('./commands/admin')
const { handleEconomyCommand } = require('./commands/economy')
const { handleGambleCommand } = require('./commands/gamble') // ⭐ Added this
const { handleMediaCommand } = require('./commands/media') // ⭐ Added this
const { handleFunReactions } = require('./handlers/funReactions')
const { handleGuessReply } = require('./games/guessNumber')
const { handleMathReply } = require('./games/mathGame') // ⭐ Added this
const { aiReply } = require('./ai/responder')
const { handleAICommand } = require('./commands/ai')
const { addUserMessage } = require('./state/userHistory')
const { getGame, endGame } = require('./state/guessGame')
const { checkUnscramble, hasUnscramble } = require('./games/unscramble')
const { addXP } = require('./state/xp')
const { startServer } = require('./server/app')
const { addGroup, startRandomEvents, handleEventReply } = require('./games/autoTrivia') // ⭐ Added this

// ⭐ stanzaId tracker
const { rememberBotMessage } = require('./state/botMessages')

// moderation
const { mutedGroups } = require('./state/mutedGroups')
const { mutedUsers } = require('./state/mutedUsers')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: 'silent' })
  })

  /* =====================================================
     🔥 GLOBAL sendMessage WRAPPER (ONE-TIME FIX)
     ===================================================== */

  const originalSendMessage = sock.sendMessage.bind(sock)

  sock.sendMessage = async (...args) => {
    const sent = await originalSendMessage(...args)
    if (sent?.key?.id) {
      rememberBotMessage(sent.key.id)
    }
    return sent
  }

  /* ---------- AUTH ---------- */
  sock.ev.on('creds.update', saveCreds)

  /* ---------- CONNECTION ---------- */
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    console.log('Connection Update:', connection)
    if (qr) {
      console.log('\n📱 Scan this QR code:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected')
      
      // ⭐ Fetch and register ALL groups
      const groups = await sock.groupFetchAllParticipating()
      Object.keys(groups).forEach(jid => addGroup(jid))
      console.log(`🌍 Auto-Trivia: Registered ${Object.keys(groups).length} groups.`)
    }

    if (connection === 'close') {
      console.log('❌ Connection closed due to:', lastDisconnect?.error)
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('🔄 Should reconnect:', shouldReconnect)
      if (shouldReconnect) startBot()
    }
  })

  console.log('OPENROUTER KEY EXISTS:', !!process.env.OPENROUTER_API_KEY)

  /* ---------- MESSAGE ENTRY ---------- */
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg?.message || msg.key.fromMe) return

    const jid = msg.key.remoteJid
    const isGroup = jid.endsWith('@g.us')
    const sender = isGroup ? msg.key.participant : jid

    const text = extractText(msg)
    if (!text) return

    console.log(`📩 ${isGroup ? '[GROUP]' : '[PRIVATE]'} ${text}`)

    /* ---------- MODERATION ---------- */

    if (isGroup) {
      const muted = mutedUsers.get(jid)
      if (muted?.has(sender)) {
        await sock.sendMessage(jid, { delete: msg.key })
        return
      }
    }

    if (isGroup && mutedGroups.has(jid)) {
        // If disabled, ONLY allow .enable or .admins
        if (!text.startsWith('.enable') && !text.startsWith('.admins')) {
            return
        }
    }

    await handleFunReactions({ sock, msg, jid, isGroup })

    if (isGroup && !text.startsWith('.')) {
      addUserMessage(jid, sender, text)
    }

    /* ---------- ATTENTION GATE ---------- */

    const allow = shouldBotRespond({ msg, text, isGroup })
    console.log('ATTENTION RESULT:', allow)
    if (!allow) return

    /* ---------- COMMANDS ---------- */

    if (text.startsWith('.')) {
      const args = text.slice(1).split(/\s+/)
      const command = args.shift().toLowerCase()

      if (await handleAdminCommand({ command, sock, jid, msg })) return
      if (await handleEconomyCommand({ command, args, sock, jid, sender, msg })) return
      if (await handleGambleCommand({ command, args, sock, jid, sender })) return // ⭐ Added this
      if (await handleMediaCommand({ command, args, sock, jid, sender })) return // ⭐ Added this
      if (await handleAICommand({ command, args, sock, jid, msg })) return
      if (await handleFunCommand({ command, args, sock, jid, sender })) return
    }

    /* ---------- GAMES ---------- */

    if (await handleGuessReply({ sock, msg, jid })) return
    if (await handleMathReply({ sock, msg, jid, sender })) return // ⭐ Added this

    const game = getGame(jid)

    if (game && game.active && Array.isArray(game.answers)) {
      if (text.startsWith('.')) return

      const normalize = str =>
        str.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

      const guessNorm = normalize(text)

      if (game.answers.some(a => guessNorm.includes(normalize(a)))) {
        addXP(jid, sender, 50)
        endGame(jid)

        await sock.sendMessage(
          jid,
          { text: `🎉 Correct! The answer was "${game.answers[0]}".\n+50 XP 🧠` },
          { quoted: msg }
        )
      }
      return
    }

    if (hasUnscramble(jid)) {
      if (text.startsWith('.')) return

      const result = checkUnscramble(jid, text)

      await sock.sendMessage(
        jid,
        {
          text: result.correct
            ? '🎉 Correct! You unscrambled the word\n+80 XP 🧠'
            : '❌ Nope, try again!'
        },
        { quoted: msg }
      )

      if (result.correct) addXP(jid, sender, 80)
      return
    }

    /* ---------- AUTO TRIVIA ---------- */
    // ⭐ Check if this is an answer to a random event
    const triviaResult = handleEventReply(jid, sender, text)
    if (triviaResult) {
      await sock.sendMessage(jid, { 
        text: `🎉 *Correct!* @${sender.split('@')[0]} won +${triviaResult.reward} XP! 🧠`,
        mentions: [sender]
      }, { quoted: msg })
      return
    }

    /* ---------- AI ---------- */

    console.log('AI BLOCK REACHED')

    const reply = await aiReply(jid, text)
    console.log('AI RAW REPLY:', reply)

    if (!reply) return

    await sock.sendMessage(
      jid,
      { text: reply },
      { quoted: msg }
    )
  })

  // ⭐ SCHEDULER: Check for random events every 5 minutes
  setInterval(() => {
    startRandomEvents(sock)
  }, 5 * 60 * 1000)
}

startServer()
startBot()

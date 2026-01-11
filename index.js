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
const { handleFunReactions } = require('./handlers/funReactions')
const { handleGuessReply } = require('./games/guessNumber')
const { aiReply } = require('./ai/responder')
const { handleAICommand } = require('./commands/ai')
const { addUserMessage } = require('./state/userHistory')
const { getGame, endGame } = require('./state/guessGame')
const { checkUnscramble,hasUnscramble } = require('./games/unscramble')
const { addXP } = require('./state/xp')


// moderation state
const { mutedGroups } = require('./state/mutedGroups')
const { mutedUsers } = require('./state/mutedUsers')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth')

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: 'silent' })
  })

  /* ---------- AUTH ---------- */
  sock.ev.on('creds.update', saveCreds)

  /* ---------- CONNECTION ---------- */
  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan this QR code:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected')
    }

    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (shouldReconnect) startBot()
    }
  })
console.log('OPENROUTER KEY EXISTS:', !!process.env.OPENROUTER_API_KEY)


  /* ---------- MESSAGE ENTRY POINT ---------- */
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg?.message || msg.key.fromMe) return

    const jid = msg.key.remoteJid
    const isGroup = jid.endsWith('@g.us')
    const sender = msg.key.participant

    const text = extractText(msg)
    if (!text) return

    console.log(`📩 ${isGroup ? '[GROUP]' : '[PRIVATE]'} ${text}`)

    /* =====================================================
       🔥 HARD MODERATION (RUN FIRST)
       ===================================================== */

    // 🔕 Delete messages from muted users
    if (isGroup) {
      const muted = mutedUsers.get(jid)
      if (muted?.has(sender)) {
        await sock.sendMessage(jid, { delete: msg.key })
        return
      }
    }

    // Bot muted in group (admins still allowed via commands)
    if (isGroup && mutedGroups.has(jid) && !text.startsWith('.')) {
      return
    }

    await handleFunReactions({
      sock,
      msg,
      jid,
      isGroup
    })

    if (isGroup && text && !text.startsWith('.')) {
    const sender = msg.key.participant
    addUserMessage(jid, sender, text)
}

    /* =====================================================
       🧠 ATTENTION GATE
       ===================================================== */
    if (!shouldBotRespond({ msg, text, isGroup })) return

    /* =====================================================
       🛠️ COMMAND HANDLING
       ===================================================== */
    if (text.startsWith('.')) {
      const args = text.slice(1).split(/\s+/)
      const command = args.shift().toLowerCase()

      // admin commands first
      if (await handleAdminCommand({command,sock,jid,msg})) return

      if (await handleAICommand({ command, args, sock, jid, msg })) return

      // fun commands
      if (await handleFunCommand({command,args,sock,jid,sender})) return
    }

    /* =====================================================
       🎮 GAME REPLIES
       ===================================================== */
    const handledGame = await handleGuessReply({
      sock,
      msg,
      jid
    })
    if (handledGame) return

    //guess game check
const game = getGame(jid)

if (game && game.active && Array.isArray(game.answers)) {
  // Ignore commands & bot messages
  if (text.startsWith('.') || msg.key.fromMe) return

  const normalize = str =>
    str.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()

  const guessNorm = normalize(text)

  const isCorrect = game.answers.some(answer =>
    guessNorm === normalize(answer) ||
    guessNorm.includes(normalize(answer))
  )

  if (isCorrect) {
    const newXP = addXP(jid, sender, 10)
    endGame(jid)
    await sock.sendMessage(
      jid,
      { text: `🎉 Correct! The answer was "${game.answers[0]}".\n +10xp 🧠` },
      { quoted: msg }
    )
    return
  }
  else{
    await sock.sendMessage(
      jid,
      { text: `NUH Try Again!` },
      { quoted: msg }
    )
  }
  return
}

//scramble game check
  if (hasUnscramble(jid)) {
  // Ignore commands
  if (text.startsWith('.')) return

  const result = checkUnscramble(jid, text)

  if (result.correct) {
    const newXP = addXP(jid, sender, 8)
    await sock.sendMessage(
      jid,
      { text: '🎉 Correct! You unscrambled the word\n +8xp 🧠' },
      { quoted: msg }
    )
  } else {
    await sock.sendMessage(
      jid,
      { text: '❌ Nope, try again!' },
      { quoted: msg }
    )
  }

  return
  }

   /* =====================================================
   🤖 AI (REPLY-TO-REPLY BEHAVIOR)
   ===================================================== */

    const isReply =
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage

    if (!isGroup || isReply) {
      const reply = await aiReply(jid, text)
      if (!reply) return

      await sock.sendMessage(
        jid,
        { text: reply },
        { quoted: msg } 
      )
    }

  })
}

startBot()

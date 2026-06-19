const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
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

// ⭐ stanzaId tracker
const { rememberBotMessage } = require('./state/botMessages')

// moderation
const { mutedGroups } = require('./state/mutedGroups')
const { mutedUsers } = require('./state/mutedUsers')

const paths = require('./utils/paths')

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(paths.getAuthPath())
  const { version, isLatest } = await fetchLatestBaileysVersion()
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`)

  const sock = makeWASocket({
    version,
    auth: state,
    logger: Pino({ level: 'silent' }),
    syncFullHistory: false,
    generateHighQualityLinkPreview: true,
    browser: ['Yaadobot', 'Chrome', '1.0.0']
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

  /* ---------- CONTACTS SYNC ---------- */
  sock.ev.on('messaging-history.set', ({ contacts: historyContacts }) => {
    if (historyContacts) {
      const { saveContactName } = require('./state/contacts')
      const { saveLidMapping } = require('./state/lidMap')
      for (const contact of historyContacts) {
        if (contact.id && contact.id.endsWith('@lid') && contact.phoneNumber) {
          const pnJid = contact.phoneNumber.endsWith('@s.whatsapp.net') ? contact.phoneNumber : `${contact.phoneNumber}@s.whatsapp.net`
          saveLidMapping(contact.id, pnJid)
        }
        const name = contact.name || contact.verifiedName || contact.notify
        if (contact.id && name) {
          saveContactName(contact.id, name)
        }
      }
    }
  })

  sock.ev.on('contacts.upsert', (newContacts) => {
    const { saveContactName } = require('./state/contacts')
    const { saveLidMapping } = require('./state/lidMap')
    for (const contact of newContacts) {
      if (contact.id && contact.id.endsWith('@lid') && contact.phoneNumber) {
        const pnJid = contact.phoneNumber.endsWith('@s.whatsapp.net') ? contact.phoneNumber : `${contact.phoneNumber}@s.whatsapp.net`
        saveLidMapping(contact.id, pnJid)
      }
      const name = contact.name || contact.verifiedName || contact.notify
      if (contact.id && name) {
        saveContactName(contact.id, name)
      }
    }
  })

  sock.ev.on('contacts.update', (updates) => {
    const { saveContactName } = require('./state/contacts')
    const { saveLidMapping } = require('./state/lidMap')
    for (const update of updates) {
      if (update.id && update.id.endsWith('@lid') && update.phoneNumber) {
        const pnJid = update.phoneNumber.endsWith('@s.whatsapp.net') ? update.phoneNumber : `${update.phoneNumber}@s.whatsapp.net`
        saveLidMapping(update.id, pnJid)
      }
      const name = update.name || update.verifiedName || update.notify
      if (update.id && name) {
        saveContactName(update.id, name)
      }
    }
  })

  sock.ev.on('lid-mapping.update', (mapping) => {
    const { saveLidMapping } = require('./state/lidMap')
    if (mapping) {
      if (Array.isArray(mapping)) {
        for (const map of mapping) {
          if (map.lid && map.pn) {
            saveLidMapping(map.lid, map.pn)
          }
        }
      } else if (mapping.lid && mapping.pn) {
        saveLidMapping(mapping.lid, mapping.pn)
      }
    }
  })

  /* ---------- CONNECTION ---------- */
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    console.log('Connection Update:', connection)
    if (qr) {
      console.log('\n📱 Scan this QR code:\n')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected')
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
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    // Save contact pushNames dynamically from all messages (even historical / sync messages)
    const { saveContactName } = require('./state/contacts')
    for (const m of messages) {
      const s = m.key.participant || m.key.remoteJid
      if (s && m.pushName) {
        saveContactName(s, m.pushName)
      }
    }

    if (type === 'append') return

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
        try {
          await sock.sendMessage(jid, { delete: msg.key })
        } catch (err) {
          console.error('[MUTED] Failed to delete message from muted user (likely missing admin permissions):', err)
        }
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
    
    // ⭐ Global Toggle Check
    const { getSettings } = require('./state/globalSettings')
    const settings = getSettings()
    
    if (!settings.botEnabled) {
        // Allow ONLY owner to interact
        const ownerNumbers = (process.env.OWNER_NUMBER || '').split(',')
        const isOwner = ownerNumbers.some(n => n && sender.includes(n.trim()))

        if (!isOwner) {
            // Check if it was a command attempt
            if (text.startsWith('.') && settings.customMessage) {
                 await sock.sendMessage(jid, { text: settings.customMessage }, { quoted: msg })
            }
            return // Stop processing for everyone else
        }
    }

    const allow = shouldBotRespond({ msg, text, isGroup })
    console.log('ATTENTION RESULT:', allow)
    if (!allow) return

    /* ---------- COMMANDS ---------- */

    if (text.startsWith('.')) {
      const args = text.slice(1).split(/\s+/)
      const command = args.shift().toLowerCase()

      if (await handleAdminCommand({ command, sock, jid, msg, sender })) return
      if (await handleEconomyCommand({ command, args, sock, jid, sender, msg })) return
      if (await handleGambleCommand({ command, args, sock, jid, sender })) return // ⭐ Added this
      if (await handleMediaCommand({ command, args, sock, jid, sender })) return // ⭐ Added this
      if (await handleAICommand({ command, args, sock, jid, msg })) return
      if (await handleFunCommand({ command, args, sock, jid, sender, msg })) return
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
}

const { spawn } = require('child_process')
const path = require('path')

function startMusicService() {
  const fs = require('fs')
  const scriptPath = path.join(__dirname, 'music-service', 'app.py')

  // Resolve python executable path (check virtual env first)
  let pythonExe = 'python'
  const winVenv = path.join(__dirname, 'music-service/.venv/Scripts/python.exe')
  const nixVenv = path.join(__dirname, 'music-service/.venv/bin/python')
  if (fs.existsSync(winVenv)) {
    pythonExe = winVenv
  } else if (fs.existsSync(nixVenv)) {
    pythonExe = nixVenv
  } else {
    pythonExe = process.platform === 'win32' ? 'python' : 'python3'
  }

  console.log(`[MUSIC] Starting Python music microservice: "${pythonExe}" "${scriptPath}"`)
  const pyProcess = spawn(pythonExe, [scriptPath], {
    stdio: 'inherit',
    shell: false
  })

  pyProcess.on('error', (err) => {
    console.error('❌ Failed to start Python Music Microservice:', err)
  })

  // Ensure python process dies when Node exit/SIGINT/SIGTERM is received
  process.on('exit', () => pyProcess.kill())
  process.on('SIGINT', () => {
    pyProcess.kill()
    process.exit()
  })
  process.on('SIGTERM', () => {
    pyProcess.kill()
    process.exit()
  })
}

startMusicService()
startServer()
startBot()

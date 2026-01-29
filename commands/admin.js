const { mutedGroups } = require('../state/mutedGroups')
const { mutedUsers } = require('../state/mutedUsers')
const { getGroupMetadata, isUserAdmin, getAdmins } = require('../utils/group')

const { setBotEnabled, setCustomMessage } = require('../state/globalSettings')

// ✅ ONLY these require admin privileges
const ADMIN_COMMANDS = [
  'admins',
  'disable',
  'enable',
  'kick',
  'mute',
  'unmute',
  'adminonly',
  'adminall',
  'tagall',
  'disablegames',
  'enablegames'
]

// 👑 OWNER ONLY commands
const OWNER_COMMANDS = [
    'bot',
    'botmsg',
    'send'
]

const { disableGames, enableGames } = require('../games/autoTrivia')

async function handleAdminCommand({ command, sock, jid, msg, sender }) {
  // 1️⃣ Check Owner Commands First
  if (OWNER_COMMANDS.includes(command)) {
      const ownerNumbers = (process.env.OWNER_NUMBER || '').split(',')
      const isOwner = ownerNumbers.some(n => n && sender.includes(n.trim()))

      if (!isOwner) {
          return false 
      }

      switch (command) {
          case 'bot': {
            const arg = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').split(' ')[1]?.toLowerCase()
            if (arg === 'off') {
                setBotEnabled(false)
                await sock.sendMessage(jid, { text: '🛑 Bot is now disabled globally.\n(Only YOU can use it).' })
            } else if (arg === 'on') {
                setBotEnabled(true)
                await sock.sendMessage(jid, { text: '🟢 Bot is now enabled globally.' })
            } else {
                await sock.sendMessage(jid, { text: 'Usage: .bot on | .bot off' })
            }
            return true
          }

          case 'botmsg': {
            // Extract text after ".botmsg "
            const fullText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '')
            const msgContent = fullText.split(' ').slice(1).join(' ')

            if (!msgContent) {
                await sock.sendMessage(jid, { text: 'Usage: .botmsg <message> | .botmsg off' })
                return true
            }

            if (msgContent.toLowerCase() === 'off') {
                setCustomMessage(null)
                await sock.sendMessage(jid, { text: '✅ Custom disabled message removed.' })
            } else {
                setCustomMessage(msgContent)
                await sock.sendMessage(jid, { text: `✅ Custom message set:\n"${msgContent}"` })
            }
            return true
          }

          case 'send': {
              const fullText = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '')
              const broadcastMsg = fullText.split(' ').slice(1).join(' ')

              if (!broadcastMsg) {
                  await sock.sendMessage(jid, { text: 'Usage: .send <message>' })
                  return true
              }

              await sock.sendMessage(jid, { text: '📢 Sending to all groups...' })
              
              try {
                  const groups = await sock.groupFetchAllParticipating()
                  const groupJids = Object.keys(groups)
                  
                  let sentCount = 0
                  for (const gJid of groupJids) {
                      try {
                          await sock.sendMessage(gJid, { text: `📢 *Announcement:*\n\n${broadcastMsg}` })
                          sentCount++
                          // Small delay to be safe
                          await new Promise(r => setTimeout(r, 500))
                      } catch (err) {
                          console.error(`Failed to send to ${gJid}`, err)
                      }
                  }
                  
                  await sock.sendMessage(jid, { text: `✅ Sent to ${sentCount} groups.` })
              } catch (e) {
                  await sock.sendMessage(jid, { text: '❌ Failed to fetch groups.' })
              }
              return true
          }
      }
      return true
  }

  // ✅ Ignore non-admin commands entirely if not captured above
  if (!ADMIN_COMMANDS.includes(command)) return false

  if (!jid.endsWith('@g.us')) return false

  // Fix: sender might not be passed correctly in some calls, fallbacks:
  const actualSender = sender || msg.key.participant || msg.key.remoteJid
  const metadata = await getGroupMetadata(sock, jid)

  if (!isUserAdmin(metadata, actualSender)) {
    await sock.sendMessage(jid, { text: '❌ Admins only.' })
    return true
  }

  const mentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

  switch (command) {
    case 'admins': {
      const admins = getAdmins(metadata)
      await sock.sendMessage(jid, {
        text: `👮 Admins:\n${admins.map(a => `@${a.split('@')[0]}`).join('\n')}`,
        mentions: admins
      })
      return true
    }

    case 'disable': {
      mutedGroups.add(jid)
      await sock.sendMessage(jid, { text: '🔇 Bot is disabled in this group.' })
      return true
    }

    case 'enable': {
      mutedGroups.delete(jid)
      await sock.sendMessage(jid, { text: '🔊 Bot is enabled in this group.' })
      return true
    }

    case 'kick': {
      if (mentioned.length === 0) {
        await sock.sendMessage(jid, { text: '❌ Mention a user to kick.' })
        return true
      }

      await sock.groupParticipantsUpdate(jid, mentioned, 'remove')
      await sock.sendMessage(jid, { text: '👢 kicked. Jaa side laag.' })
      return true
    }

    case 'mute': {
      if (mentioned.length === 0) {
        await sock.sendMessage(jid, { text: '❌ Mention a user to mute.' })
        return true
      }

      const set = mutedUsers.get(jid) || new Set()
      mentioned.forEach(u => set.add(u))
      mutedUsers.set(jid, set)

      await sock.sendMessage(jid, {
        text: '🔕 Chup laag! (messages will be deleted).'
      })
      return true
    }

    case 'unmute': {
      const set = mutedUsers.get(jid)
      if (!set) return true

      mentioned.forEach(u => set.delete(u))
      await sock.sendMessage(jid, { text: '🔊 User unmuted.' })
      return true
    }

    case 'adminonly': {
      await sock.groupSettingUpdate(jid, 'announcement')
      await sock.sendMessage(jid, {
        text: '🔒 Only admins can send messages now.'
      })
      return true
    }

    case 'adminall': {
      await sock.groupSettingUpdate(jid, 'not_announcement')
      await sock.sendMessage(jid, {
        text: '🔓 Everyone can send messages now.'
      })
      return true
    }

    case 'tagall': {
      const members = metadata.participants.map(p => p.id)

      await sock.sendMessage(jid, {
        text: '📢 Attention everyone!',
        mentions: members
      })

      return true
    }

    case 'disablegames': {
        disableGames(jid)
        await sock.sendMessage(jid, { text: '🚫 Auto-Trivia & Mystery Box disabled for this group.' })
        return true
    }

    case 'enablegames': {
        enableGames(jid)
        await sock.sendMessage(jid, { text: '✅ Auto-Trivia & Mystery Box enabled!' })
        return true
    }

  }

  return true
}

module.exports = { handleAdminCommand }

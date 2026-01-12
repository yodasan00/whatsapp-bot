const { mutedGroups } = require('../state/mutedGroups')
const { mutedUsers } = require('../state/mutedUsers')
const { getGroupMetadata, isUserAdmin, getAdmins } = require('../utils/group')

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
  'tagall'
]

async function handleAdminCommand({ command, sock, jid, msg }) {
  // ✅ Ignore non-admin commands entirely
  if (!ADMIN_COMMANDS.includes(command)) return false

  if (!jid.endsWith('@g.us')) return false

  const sender = msg.key.participant || msg.key.remoteJid
  const metadata = await getGroupMetadata(sock, jid)

  if (!isUserAdmin(metadata, sender)) {
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

  }

  return true
}

module.exports = { handleAdminCommand }

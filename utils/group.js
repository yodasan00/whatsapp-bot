async function getGroupMetadata(sock, jid) {
  return await sock.groupMetadata(jid)
}

function isUserAdmin(metadata, userJid) {
  const participant = metadata.participants.find(
    p => p.id === userJid
  )
  return participant?.admin === 'admin' || participant?.admin === 'superadmin'
}

function getAdmins(metadata) {
  return metadata.participants
    .filter(p => p.admin)
    .map(p => p.id)
}

module.exports = {
  getGroupMetadata,
  isUserAdmin,
  getAdmins
}

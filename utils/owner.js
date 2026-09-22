/**
 * Checks if a given JID or phone string belongs to one of the configured bot owners.
 * @param {string} jid WhatsApp JID or phone number
 * @returns {boolean}
 */
function isOwner(jid) {
  if (!jid) return false
  const ownerNumbers = (process.env.OWNER_NUMBER || '')
    .split(',')
    .map(n => n.trim())
    .filter(Boolean)
  
  // Strip JID domain suffix (@s.whatsapp.net, @lid, etc) for comparison
  const cleanId = jid.split('@')[0].replace(/[^0-9]/g, '')
  
  return ownerNumbers.some(owner => {
    const cleanOwner = owner.replace(/[^0-9]/g, '')
    return cleanOwner && (cleanId.includes(cleanOwner) || cleanOwner.includes(cleanId) || jid.includes(owner))
  })
}

module.exports = { isOwner }

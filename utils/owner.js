let getPnFromLid = null
try {
  getPnFromLid = require('../state/lidMap').getPnFromLid
} catch (_) {}

/**
 * Checks if a given JID or phone string belongs to one of the configured bot owners.
 * Supports both standard phone JIDs (@s.whatsapp.net) and private WhatsApp LIDs (@lid).
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
  
  // Try resolving LID if applicable
  let mappedPn = null
  if (jid.endsWith('@lid') && getPnFromLid) {
    try {
      const resolved = getPnFromLid(jid)
      if (resolved) mappedPn = resolved.split('@')[0].replace(/[^0-9]/g, '')
    } catch (_) {}
  }
  
  return ownerNumbers.some(owner => {
    const cleanOwner = owner.replace(/[^0-9]/g, '')
    if (!cleanOwner) return false
    return (
      cleanId === cleanOwner ||
      cleanId.includes(cleanOwner) || 
      cleanOwner.includes(cleanId) || 
      jid.includes(owner) ||
      (mappedPn && (mappedPn === cleanOwner || mappedPn.includes(cleanOwner) || cleanOwner.includes(mappedPn)))
    )
  })
}

module.exports = { isOwner }

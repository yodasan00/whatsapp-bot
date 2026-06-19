const fs = require('fs')
const paths = require('../utils/paths')
const { getPnFromLid, getLidFromPn } = require('./lidMap')

const FILE = paths.getContactsPath ? paths.getContactsPath() : require('path').join(__dirname, 'contacts.json')

let contacts = {}

if (fs.existsSync(FILE)) {
  try {
    contacts = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch (e) {
    console.error('Failed to load contacts.json:', e)
  }
}

// Debounced save to minimize disk wear
let saveTimer = null
function save() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFile(FILE, JSON.stringify(contacts, null, 2), err => {
      if (err) console.error('Failed to save contacts.json:', err)
    })
  }, 500)
}

function saveContactName(jid, pushName) {
  if (!jid || !pushName) return
  
  let changed = false
  if (contacts[jid] !== pushName) {
    contacts[jid] = pushName
    changed = true
  }

  // Bidirectional storage mapping: if we know the mapped JID/LID, save to both!
  if (jid.endsWith('@lid')) {
    const pn = getPnFromLid(jid)
    if (pn && contacts[pn] !== pushName) {
      contacts[pn] = pushName
      changed = true
    }
  } else if (jid.endsWith('@s.whatsapp.net')) {
    const lid = getLidFromPn(jid)
    if (lid && contacts[lid] !== pushName) {
      contacts[lid] = pushName
      changed = true
    }
  }

  if (changed) {
    save()
  }
}

function getContactName(jid) {
  if (!jid) return 'User'
  
  // Try direct lookup
  if (contacts[jid]) return contacts[jid]

  // Try lookup via LID-to-PN / PN-to-LID mapping
  if (jid.endsWith('@s.whatsapp.net')) {
    const lid = getLidFromPn(jid)
    if (lid && contacts[lid]) return contacts[lid]
  } else if (jid.endsWith('@lid')) {
    const pn = getPnFromLid(jid)
    if (pn && contacts[pn]) return contacts[pn]
  }

  return jid.split('@')[0]
}

module.exports = {
  saveContactName,
  getContactName
}

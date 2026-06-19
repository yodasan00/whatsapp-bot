

const fs = require('fs')
const paths = require('../utils/paths')

const FILE = paths.getXpPath()

let xpStore = {}

if (fs.existsSync(FILE)) {
  xpStore = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
}

// Debounced async save — batches rapid writes into one disk op
let saveTimer = null
function save() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFile(FILE, JSON.stringify(xpStore, null, 2), err => {
      if (err) console.error('Failed to save xpStore.json:', err)
    })
  }, 500)
}

function key(jid, userJid) {
  return `${jid}:${userJid}`
}

function getXP(jid, userJid) {
  return xpStore[key(jid, userJid)] || 0
}

function addXP(jid, userJid, amount) {
  const k = key(jid, userJid)
  xpStore[k] = (xpStore[k] || 0) + amount
  save()
  return xpStore[k]
}

function getLeaderboard(jid) {
  return Object.entries(xpStore)
    .filter(([k]) => k.startsWith(`${jid}:`))
    .map(([k, xp]) => ({
      userJid: k.split(':')[1],
      xp
    }))
    .sort((a, b) => b.xp - a.xp)
}

module.exports = {
  getXP,
  addXP,
  getLeaderboard
}

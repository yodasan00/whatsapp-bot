// const xpStore = new Map()
// // Structure:
// // key: `${jid}:${userJid}`
// // value: number

// function getKey(jid, userJid) {
//   return `${jid}:${userJid}`
// }

// function getXP(jid, userJid) {
//   return xpStore.get(getKey(jid, userJid)) || 0
// }

// function addXP(jid, userJid, amount) {
//   const key = getKey(jid, userJid)
//   const current = getXP(jid, userJid)
//   const updated = current + amount
//   xpStore.set(key, updated)
//   return updated
// }

// function getLeaderboard(jid) {
//   const result = []

//   for (const [key, xp] of xpStore.entries()) {
//     if (key.startsWith(`${jid}:`)) {
//       const userJid = key.split(':')[1]
//       result.push({ userJid, xp })
//     }
//   }

//   return result.sort((a, b) => b.xp - a.xp)
// }

// module.exports = {
//   getXP,
//   addXP,
//   getLeaderboard
// }

const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'xpStore.json')

let xpStore = {}

if (fs.existsSync(FILE)) {
  xpStore = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(xpStore, null, 2))
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

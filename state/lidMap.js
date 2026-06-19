const fs = require('fs')
const paths = require('../utils/paths')

const FILE = paths.getLidMapPath ? paths.getLidMapPath() : require('path').join(__dirname, 'lidMap.json')

let lidMap = {}

if (fs.existsSync(FILE)) {
  try {
    lidMap = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
  } catch (e) {
    console.error('Failed to load lidMap.json:', e)
  }
}

// Debounced save
let saveTimer = null
function save() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    fs.writeFile(FILE, JSON.stringify(lidMap, null, 2), err => {
      if (err) console.error('Failed to save lidMap.json:', err)
    })
  }, 500)
}

function saveLidMapping(lid, pn) {
  if (!lid || !pn) return
  // Normalize LIDs and PNs
  const cleanLid = lid.split('@')[0]
  const cleanPn = pn.split('@')[0]

  if (lidMap[cleanLid] === cleanPn) return
  lidMap[cleanLid] = cleanPn
  save()
}

function getPnFromLid(lid) {
  if (!lid) return null
  const cleanLid = lid.split('@')[0]
  const pn = lidMap[cleanLid]
  return pn ? `${pn}@s.whatsapp.net` : null
}

function getLidFromPn(pn) {
  if (!pn) return null
  const cleanPn = pn.split('@')[0]
  for (const [lid, mappedPn] of Object.entries(lidMap)) {
    if (mappedPn === cleanPn) {
      return `${lid}@lid`
    }
  }
  return null
}

module.exports = {
  saveLidMapping,
  getPnFromLid,
  getLidFromPn
}

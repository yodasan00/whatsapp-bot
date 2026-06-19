const path = require('path')
const fs = require('fs')

// Base directory for storing all state/auth files
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : null

// Create the directory if it doesn't exist
if (dataDir && !fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

function getAuthPath() {
  if (dataDir) {
    const authPath = path.join(dataDir, 'auth')
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true })
    }
    return authPath
  }
  return path.join(__dirname, '../auth')
}

function getXpPath() {
  return dataDir ? path.join(dataDir, 'xpStore.json') : path.join(__dirname, '../state/xpStore.json')
}

function getInventoryPath() {
  return dataDir ? path.join(dataDir, 'inventory.json') : path.join(__dirname, '../state/inventory.json')
}

function getSettingsPath() {
  return dataDir ? path.join(dataDir, 'global_settings.json') : path.join(__dirname, '../state/global_settings.json')
}

function getContactsPath() {
  return dataDir ? path.join(dataDir, 'contacts.json') : path.join(__dirname, '../state/contacts.json')
}

function getLidMapPath() {
  return dataDir ? path.join(dataDir, 'lid_map.json') : path.join(__dirname, '../state/lid_map.json')
}

module.exports = {
  getAuthPath,
  getXpPath,
  getInventoryPath,
  getSettingsPath,
  getContactsPath,
  getLidMapPath
}

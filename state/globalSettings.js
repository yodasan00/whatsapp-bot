const fs = require('fs')
const path = require('path')

const SETTINGS_FILE = path.join(__dirname, 'global_settings.json')

// Default settings
let globalSettings = {
    botEnabled: true,
    customMessage: null
}

// Load settings from disk
function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_FILE)) {
            const data = fs.readFileSync(SETTINGS_FILE, 'utf8')
            globalSettings = { ...globalSettings, ...JSON.parse(data) }
        } else {
            saveSettings()
        }
    } catch (error) {
        console.error('❌ Error loading global settings:', error)
    }
}

// Save settings to disk
function saveSettings() {
    try {
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify(globalSettings, null, 2))
    } catch (error) {
        console.error('❌ Error saving global settings:', error)
    }
}

// Initialize
loadSettings()

module.exports = {
    getSettings: () => globalSettings,
    setBotEnabled: (enabled) => {
        globalSettings.botEnabled = enabled
        saveSettings()
    },
    setCustomMessage: (message) => {
        globalSettings.customMessage = message
        saveSettings()
    }
}

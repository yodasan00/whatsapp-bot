const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'inventory.json')

let inventory = {}

if (fs.existsSync(FILE)) {
    try {
        inventory = JSON.parse(fs.readFileSync(FILE, 'utf-8'))
    } catch (e) {
        console.error('Failed to load inventory.json:', e)
        inventory = {}
    }
}

function save() {
    fs.writeFileSync(FILE, JSON.stringify(inventory, null, 2))
}

function key(jid, userJid) {
    return `${jid}:${userJid}`
}

function getInventory(jid, userJid) {
    return inventory[key(jid, userJid)] || {}
}

function addItem(jid, userJid, itemId, amount = 1) {
    const k = key(jid, userJid)
    if (!inventory[k]) inventory[k] = {}
    
    inventory[k][itemId] = (inventory[k][itemId] || 0) + amount
    save()
    return inventory[k]
}

function removeItem(jid, userJid, itemId, amount = 1) {
    const k = key(jid, userJid)
    if (!inventory[k] || !inventory[k][itemId]) return false
    
    if (inventory[k][itemId] < amount) return false
    
    inventory[k][itemId] -= amount
    if (inventory[k][itemId] <= 0) delete inventory[k][itemId]
    
    save()
    return true
}

module.exports = {
    getInventory,
    addItem,
    removeItem
}

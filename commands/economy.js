const { shopItems, getItem } = require('../state/shop')
const { getInventory, addItem, removeItem } = require('../state/inventory')
const { getXP, addXP } = require('../state/xp')
const { resetCooldown } = require('../state/cooldown')

const commands = {
    shop: async ({ sock, jid, sender }) => {
        let text = '🛒 *XP SHOP* 🛒\n\n'
        shopItems.forEach(item => {
            text += `*${item.name}*\n`
            text += `💰 Price: ${item.price} XP\n`
            text += `📝 ${item.description}\n`
            text += `Usage: .buy ${item.id}\n\n`
        })
        text += 'Earn XP by playing games! (.guess, .rps, .fish, .dig)\n\n'
        
        // Web Shop Link
        // context = jid (group or user), user = sender
        const baseUrl = process.env.WEB_URL || 'http://localhost:3000'
        const link = `${baseUrl}/?user=${encodeURIComponent(sender)}&context=${encodeURIComponent(jid)}`
        
        text += `🌐 *Visit the Web Shop:*\n${link}`

        await sock.sendMessage(jid, { text })
    },

    buy: async ({ sock, jid, sender, args }) => {
        if (!args[0]) {
            await sock.sendMessage(jid, { text: '❌ Usage: .buy <item_id> (e.g. .buy cookie)' })
            return
        }

        const itemId = args[0].toLowerCase()
        const item = getItem(itemId)

        if (!item) {
            await sock.sendMessage(jid, { text: '❌ Item not found. Check .shop' })
            return
        }

        const userXP = getXP(jid, sender)
        
        if (userXP < item.price) {
            await sock.sendMessage(jid, { text: `❌ You need *${item.price} XP* to buy this.\nYou have: ${userXP} XP` })
            return
        }

        // Deduct XP (addXP with negative amount)
        addXP(jid, sender, -item.price)
        
        // Add to inventory
        addItem(jid, sender, item.id)

        await sock.sendMessage(jid, { 
            text: `✅ You bought *${item.name}* for ${item.price} XP!\nUse .inv to check your loot.` 
        })
    },

    inv: async ({ sock, jid, sender }) => {
        const inv = getInventory(jid, sender)
        const itemIds = Object.keys(inv)

        if (itemIds.length === 0) {
            await sock.sendMessage(jid, { text: '🎒 Your inventory is empty.\nGo buy something at the .shop!' })
            return
        }

        let text = '🎒 *YOUR INVENTORY* 🎒\n\n'
        itemIds.forEach(id => {
            const item = getItem(id)
            const count = inv[id]
            if (item) {
                text += `${item.name} x${count}\n`
            }
        })

        await sock.sendMessage(jid, { text })
    },

    inventory: async (ctx) => {
        // Alias for .inv
        await commands.inv(ctx)
    },

    use: async ({ sock, jid, sender, args }) => {
        if (!args[0]) {
            await sock.sendMessage(jid, { text: '❌ Usage: .use <item_id>' })
            return
        }

        const itemId = args[0].toLowerCase()
        const inv = getInventory(jid, sender)
        
        if (!inv[itemId] || inv[itemId] <= 0) {
            await sock.sendMessage(jid, { text: '❌ You don’t have this item.' })
            return
        }

        const item = getItem(itemId)
        
        // Logic for using items
        // For now, most items are just "flex" items, but we can consume them
        
        // Consume the item
        removeItem(jid, sender, itemId)
        
        let response = ''
        
        if (itemId === 'cookie') {
            const xpGain = Math.floor(Math.random() * 41) + 10 // 10-50 XP
            addXP(jid, sender, xpGain)
            response = `🍪 You ate the cookie.\n😋 It was delicious! (+${xpGain} XP)`
            
        } else if (itemId === 'coffee') {
            resetCooldown(jid, sender, 'dig')
            resetCooldown(jid, sender, 'fish')
            // Add other cooldowns here if they exist
            response = `☕ You drank the coffee.\n⚡ You feel energized! Cooldowns reset.`
            
        } else if (itemId === 'diamond' || itemId === 'mvp_badge' || itemId === 'shield') {
             // Permanent items, give them back
             addItem(jid, sender, itemId) 
             response = `✨ You inspected your *${item.name}*.\nIt shines brilliantly. Everyone is jealous.\n(This item is permanent)`
        } else {
             response = `✨ You used *${item.name}*.\n(It didn't do much, but it's gone now.)`
        }

        await sock.sendMessage(jid, { text: response })
    },

    sell: async ({ sock, jid, sender, args }) => {
        if (!args[0]) {
            await sock.sendMessage(jid, { text: '❌ Usage: .sell <item_id> (e.g. .sell fish)' })
            return
        }

        const itemId = args[0].toLowerCase()
        const inv = getInventory(jid, sender)
        
        if (!inv[itemId] || inv[itemId] <= 0) {
            await sock.sendMessage(jid, { text: '❌ You don’t have this item.' })
            return
        }

        const item = getItem(itemId)
        if (!item || !item.sellPrice) {
            await sock.sendMessage(jid, { text: '❌ This item cannot be sold.' })
            return
        }

        // Sell 1 by default, todo: support amount
        const amount = 1
        
        const success = removeItem(jid, sender, itemId, amount)
        if (success) {
            const xpEarned = item.sellPrice * amount
            const totalXP = addXP(jid, sender, xpEarned)
            
            await sock.sendMessage(jid, { 
                text: `💰 Sold *${item.name}* for *${xpEarned} XP*!\nTotal XP: ${totalXP}` 
            })
        } else {
            await sock.sendMessage(jid, { text: '❌ Transaction failed.' })
        }
    }
}

async function handleEconomyCommand({ command, args, sock, jid, sender }) {
    const handler = commands[command]
    if (handler) {
        await handler({ sock, jid, args, sender })
        return true
    }
    return false
}

module.exports = { handleEconomyCommand }

const { shopItems, getItem } = require('../state/shop')
const { getInventory, addItem, removeItem } = require('../state/inventory')
const { getXP, addXP } = require('../state/xp')
const { resetCooldown, isOnCooldown } = require('../state/cooldown')
const { generateToken } = require('../state/tokens')

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
        // Ensure WEB_URL is loaded correctly
        const baseUrl = process.env.WEB_URL || 'http://localhost:3000'
        const token = generateToken(sender)
        const link = `${baseUrl}/?user=${encodeURIComponent(sender)}&context=${encodeURIComponent(jid)}&token=${token}`
        
        // Send DM
        await sock.sendMessage(sender, { 
            text: `🛒 *Your Shop Link:*\n${link}\n\n⏳ Link expires in 15 minutes.` 
        })

        // If in group, notify
        if (jid.endsWith('@g.us')) {
            await sock.sendMessage(jid, { text: '📩 Sent you the shop link via DM!' })
        }
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
            const xpGain = Math.floor(Math.random() * 61) + 10 // 10-70 XP
            addXP(jid, sender, xpGain)
            response = `🍪 You ate the cookie.\n😋 It was delicious! (+${xpGain} XP)`
            
        } else if (itemId === 'coffee') {
            resetCooldown(jid, sender, 'dig')
            resetCooldown(jid, sender, 'fish')
            // Add other cooldowns here if they exist
            response = `☕ You drank the coffee.\n⚡ You feel energized! Cooldowns reset.`

        } else if (itemId === 'energy_drink') {
            resetCooldown(jid, sender, 'dig')
            resetCooldown(jid, sender, 'fish')
            addXP(jid, sender, 50)
            response = `🥤 You chugged the Energy Drink!\n⚡ Cooldowns reset & +50 XP!`
            
        } else if (itemId === 'mystery_box') {
            const roll = Math.random()
            if (roll < 0.5) { // 50% XP
                const xp = Math.floor(Math.random() * 900) + 100
                addXP(jid, sender, xp)
                response = `📦 You opened the box...\n✨ It contained *${xp} XP*!`
            } else if (roll < 0.85) { // 35% Trash
                addItem(jid, sender, 'trash')
                response = `📦 You opened the box...\n🗑️ It was just some *Trash*.`
            } else if (roll < 0.95) { // 10% Gold Coin
                addItem(jid, sender, 'golden_coin')
                response = `📦 You opened the box...\n🪙 WOW! A *Golden Coin*!`
            } else { // 5% Diamond
                addItem(jid, sender, 'diamond')
                response = `📦 You opened the box...\n💎 JACKPOT! You found a *Diamond*!`
            }

        } else if (itemId === 'diamond' || itemId === 'mvp_badge' || itemId === 'shield' || itemId === 'fishing_rod' || itemId === 'ban_hammer' || itemId === 'golden_shovel' || itemId === 'car_keys' || itemId === 'mansion_deed') {
             // Permanent items, give them back
             addItem(jid, sender, itemId) 
             response = `✨ You inspected your *${item.name}*.\n${item.description}\n(This item is permanent)`
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
    },

    beg: async ({ sock, jid, sender }) => {
        // Cooldown: 30 minutes (1800s)
        const wait = isOnCooldown(jid, sender, 'beg', 1800)
        
        if (wait > 0) {
            await sock.sendMessage(jid, { text: `⏳ You already begged recently. Wait *${wait}s*.` })
            return
        }

        const xp = Math.floor(Math.random() * 21) + 5 // 5-25 XP
        const total = addXP(jid, sender, xp)

        await sock.sendMessage(jid, { 
            text: `🥺 You begged on the streets...\n🙏 A kind stranger gave you *${xp} XP*.\nTotal: ${total} XP` 
        })
    },

    donate: async ({ sock, jid, sender, args, msg }) => {
        const amount = parseInt(args[0])
        
        // Target: Check reply first, then mentionedJid, then args
        let target = msg.message?.extendedTextMessage?.contextInfo?.participant
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
        
        if (!target && mentioned.length > 0) {
            target = mentioned[0]
        }
        
        if (!target && args[1]) {
             // Handle raw number if no mention
             target = args[1].replace('@', '').replace(/[^0-9]/g, '') + '@s.whatsapp.net'
        }

        if (!amount || isNaN(amount) || amount <= 0) {
             await sock.sendMessage(jid, { text: '❌ Usage: .donate <amount> <@tag_user>' })
             return
        }

        if (!target) {
            await sock.sendMessage(jid, { text: '❌ You must tag someone or reply to their message to donate.' })
            return
        }

        if (target === sender) {
            await sock.sendMessage(jid, { text: '❌ You can’t donate to yourself.' })
            return
        }

        const userXP = getXP(jid, sender)
        if (userXP < amount) {
            await sock.sendMessage(jid, { text: `❌ You don't have enough XP. You have: ${userXP}` })
            return
        }

        // Transfer
        addXP(jid, sender, -amount)
        addXP(jid, target, amount)

        await sock.sendMessage(jid, { 
            text: `💸 *Donation Successful!*\nSent *${amount} XP* to @${target.split('@')[0]}`,
            mentions: [target]
        })
    },

    rob: async ({ sock, jid, sender, args, msg }) => {
         // Cooldown: 2 hours (7200s)
         const wait = isOnCooldown(jid, sender, 'rob', 7200)
        
         if (wait > 0) {
             await sock.sendMessage(jid, { text: `⏳ You are lying low. Wait *${wait}s* to rob again.` })
             return
         }

         const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
         const target = msg.message?.extendedTextMessage?.contextInfo?.participant || 
                        mentioned[0] ||
                        (args[0] ? args[0].replace('@', '').replace(/[^0-9]/g, '') + '@s.whatsapp.net' : null)

         if (!target) {
             await sock.sendMessage(jid, { text: '❌ Reply to a message or tag someone to rob them.' })
             return
         }

         if (target === sender) {
             await sock.sendMessage(jid, { text: '❌ You can\'t rob yourself.' })
             return
         }

         // ✅ Check target wealth BEFORE rolling or consuming shield
         const targetXP = getXP(jid, target)
         if (targetXP < 20) {
             await sock.sendMessage(jid, { text: '❌ Target is too poor to rob. (Has < 20 XP)' })
             return
         }

         // Roll for success
         const success = Math.random() < 0.40 // 40% Success

         if (success) {
             // ✅ Only check/consume shield when rob WOULD have succeeded
             const targetInv = getInventory(jid, target)
             if (targetInv.shield && targetInv.shield > 0) {
                 removeItem(jid, target, 'shield')
                 await sock.sendMessage(jid, { 
                     text: `🛡️ ROBBERY FOILED!\n@${target.split('@')[0]} had a *Rob Shield*! It shattered protecting them. Close one!`,
                     mentions: [target]
                 })
                 return
             }

             // Steal 5-15%
             const percent = (Math.random() * 0.10) + 0.05
             const stealAmount = Math.floor(targetXP * percent)
             
             addXP(jid, target, -stealAmount)
             addXP(jid, sender, stealAmount)
             
             await sock.sendMessage(jid, { 
                 text: `🔫 HANDS UP! You robbed @${target.split('@')[0]} and got *${stealAmount} XP*!`,
                 mentions: [target]
             })

         } else {
             // Fail - Pay fine 10-200 XP
             const fine = Math.floor(Math.random() * 191) + 10
             const userXP = getXP(jid, sender)
             const actualFine = Math.min(userXP, fine)

             addXP(jid, sender, -actualFine)
             
             await sock.sendMessage(jid, { 
                 text: `🚓 POLICE! You got caught.\nYou paid a fine of *${actualFine} XP*.`
             })
         }
    }
}

async function handleEconomyCommand({ command, args, sock, jid, sender, msg }) {
    const handler = commands[command]
    if (handler) {
        await handler({ sock, jid, args, sender, msg })
        return true
    }
    return false
}

module.exports = { handleEconomyCommand }

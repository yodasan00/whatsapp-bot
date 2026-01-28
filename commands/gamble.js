const { getXP, addXP } = require('../state/xp')

const commands = {
    flip: async ({ sock, jid, sender, args }) => {
        // Usage: .flip <heads/tails> <amount>
        // Aliases: .flip h 100
        
        if (args.length < 2) {
            await sock.sendMessage(jid, { text: '❌ Usage: .flip <heads/tails> <amount>' })
            return
        }

        let choice = args[0].toLowerCase()
        let amount = parseInt(args[1])

        if (choice === 'h' || choice === 'head') choice = 'heads'
        if (choice === 't' || choice === 'tail') choice = 'tails'

        if (choice !== 'heads' && choice !== 'tails') {
            await sock.sendMessage(jid, { text: '❌ Choose *heads* or *tails*.' })
            return
        }

        if (isNaN(amount) || amount <= 0) {
            await sock.sendMessage(jid, { text: '❌ Invalid bet amount.' })
            return
        }

        const userXP = getXP(jid, sender)
        if (userXP < amount) {
            await sock.sendMessage(jid, { text: `❌ You don't have enough XP. You have: ${userXP}` })
            return
        }

        // Deduct bet
        addXP(jid, sender, -amount)

        // House edge: 40% win chance for user
        const win = Math.random() < 0.4 
        const result = win ? choice : (choice === 'heads' ? 'tails' : 'heads')

        let text = `🪙 *Coin Flip*\nYou chose: *${choice}*\nResult: *${result}*\n\n`
        
        if (win) {
            const winnings = amount * 2
            addXP(jid, sender, winnings)
            text += `🎉 YOU WON! +${winnings} XP`
        } else {
            text += `💀 You lost ${amount} XP.`
        }

        await sock.sendMessage(jid, { text })
    },

    slots: async ({ sock, jid, sender, args }) => {
        // Usage: .slots <amount>
        if (!args[0]) {
            await sock.sendMessage(jid, { text: '❌ Usage: .slots <amount>' })
            return
        }

        const amount = parseInt(args[0])
        if (isNaN(amount) || amount <= 0) {
            await sock.sendMessage(jid, { text: '❌ Invalid bet amount.' })
            return
        }

        const userXP = getXP(jid, sender)
        if (userXP < amount) {
            await sock.sendMessage(jid, { text: `❌ You don't have enough XP. You have: ${userXP}` })
            return
        }
        
        // Deduct bet
        addXP(jid, sender, -amount)

        const reels = ['🍒', '🍋', '🍇', '💎', '7️⃣']
        // Randomize
        const r1 = reels[Math.floor(Math.random() * reels.length)]
        const r2 = reels[Math.floor(Math.random() * reels.length)]
        const r3 = reels[Math.floor(Math.random() * reels.length)]

        let multiplier = 0
        let resultText = ''

        // Check Win
        if (r1 === r2 && r2 === r3) {
            if (r1 === '7️⃣') multiplier = 10 // Jackpot
            else if (r1 === '💎') multiplier = 5 // Big Win
            else multiplier = 3 // Standard Triple
        } else if (r1 === r2 || r2 === r3 || r1 === r3) {
            multiplier = 1.5 // Pair
        }

        // Send animation (fake)
        // Actually just send result for speed in WA
        
        let text = `🎰 *SLOTS* 🎰\n\n[ ${r1} | ${r2} | ${r3} ]\n\n`
        
        if (multiplier > 0) {
            const winnings = Math.floor(amount * multiplier)
            addXP(jid, sender, winnings)
            text += `🎉 WIN! (x${multiplier})\nYou won *${winnings} XP*!`
        } else {
            text += `💀 You lost ${amount} XP.`
        }

        await sock.sendMessage(jid, { text })
    }
}

async function handleGambleCommand({ command, args, sock, jid, sender }) {
  const handler = commands[command]
  if (handler) {
      // Small delay for suspense? Nah.
      await handler({ sock, jid, sender, args })
      return true
  }
  return false
}

module.exports = { handleGambleCommand }

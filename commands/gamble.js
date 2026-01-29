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

        // House edge: 50% win chance for user
        const win = Math.random() < 0.5 
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
    },
    dice: async ({ sock, jid, sender, args }) => {
        // Usage: .dice <amount> <side>
        if (args.length < 2) {
            await sock.sendMessage(jid, { text: '❌ Usage: .dice <amount> <1-6>' })
            return
        }

        const amount = parseInt(args[0])
        const choice = parseInt(args[1])

        if (isNaN(amount) || amount <= 0) {
            await sock.sendMessage(jid, { text: '❌ Invalid bet amount.' })
            return
        }

        if (isNaN(choice) || choice < 1 || choice > 6) {
            await sock.sendMessage(jid, { text: '❌ Choose a number between 1 and 6.' })
            return
        }

        const userXP = getXP(jid, sender)
        if (userXP < amount) {
            await sock.sendMessage(jid, { text: `❌ You don't have enough XP. You have: ${userXP}` })
            return
        }

        addXP(jid, sender, -amount)

        const roll = Math.floor(Math.random() * 6) + 1
        let text = `🎲 *DICE ROLL* 🎲\n\nYou chose: *${choice}*\nDice rolled: *${roll}*\n\n`

        if (roll === choice) {
            const winnings = amount * 5
            addXP(jid, sender, winnings)
            text += `🎉 JACKPOT! You won +${winnings} XP!`
        } else {
            text += `💀 You lost ${amount} XP.`
        }

        await sock.sendMessage(jid, { text })
    },

    roulette: async ({ sock, jid, sender, args }) => {
        // Usage: .roulette <amount> <bet>
        // Bet: red, black, 0-36
        if (args.length < 2) {
            await sock.sendMessage(jid, { text: '❌ Usage: .roulette <amount> <bet>\nExamples:\n.roulette 100 red\n.roulette 100 black\n.roulette 50 17' })
            return
        }

        const amount = parseInt(args[0])
        const bet = args[1].toLowerCase()

        if (isNaN(amount) || amount <= 0) {
            await sock.sendMessage(jid, { text: '❌ Invalid bet amount.' })
            return
        }

        const userXP = getXP(jid, sender)
        if (userXP < amount) {
            await sock.sendMessage(jid, { text: `❌ You don't have enough XP. You have: ${userXP}` })
            return
        }

        const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
        const blackNumbers = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]

        let win = false
        let multiplier = 0

        addXP(jid, sender, -amount)

        const resultNumber = Math.floor(Math.random() * 37) // 0-36
        let resultColor = 'green'
        
        if (redNumbers.includes(resultNumber)) resultColor = 'red'
        else if (blackNumbers.includes(resultNumber)) resultColor = 'black'

        // Check Win
        if (bet === 'red' && resultColor === 'red') {
            win = true
            multiplier = 2
        } else if (bet === 'black' && resultColor === 'black') {
            win = true
            multiplier = 2
        } else if (parseInt(bet) === resultNumber) {
            win = true
            multiplier = 36
        }

        let resultEmoji = resultColor === 'red' ? '🔴' : (resultColor === 'black' ? '⚫' : '🟢')
        
        let text = `🎡 *ROULETTE* 🎡\n\nResult: ${resultEmoji} *${resultNumber}*\n\n`

        if (win) {
            const winnings = amount * multiplier
            addXP(jid, sender, winnings)
            text += `🎉 YOU WON! +${winnings} XP`
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

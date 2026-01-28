const { addXP } = require('../state/xp')

// Store active math games
// key: jid, value: { answer: number, timestamp: number }
const activeMathGames = new Map()

async function startMathGame({ sock, jid }) {
    if (activeMathGames.has(jid)) {
        await sock.sendMessage(jid, { text: '❌ A math game is already running!' })
        return
    }

    // Generate problem
    const ops = ['+', '-', '*']
    const op = ops[Math.floor(Math.random() * ops.length)]
    let a = Math.floor(Math.random() * 20) + 1
    let b = Math.floor(Math.random() * 20) + 1
    let answer

    if (op === '+') answer = a + b
    else if (op === '-') answer = a - b
    else if (op === '*') {
        // Keep multiplication simple
        a = Math.floor(Math.random() * 12) + 1
        b = Math.floor(Math.random() * 10) + 1
        answer = a * b
    }

    activeMathGames.set(jid, {
        answer,
        timestamp: Date.now()
    })

    // Auto-expire after 30 seconds
    setTimeout(() => {
        if (activeMathGames.has(jid)) {
            activeMathGames.delete(jid)
            sock.sendMessage(jid, { text: `⏰ Time's up! The answer was *${answer}*.` })
        }
    }, 30000)

    await sock.sendMessage(jid, { 
        text: `🧮 *MATH CHALLENGE* 🧮\n\nCalculate: *${a} ${op} ${b}*\n\nFirst to reply with the correct number wins *50 XP*!` 
    })
}

async function handleMathReply({ sock, msg, jid, sender }) {
    if (!activeMathGames.has(jid)) return false

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text
    if (!text) return false

    const guess = parseInt(text.trim())
    if (isNaN(guess)) return false

    const game = activeMathGames.get(jid)
    
    if (guess === game.answer) {
        addXP(jid, sender, 50)
        await sock.sendMessage(jid, { 
            text: `🎉 Correct! <@${sender.split('@')[0]}> wins *50 XP*!`,
            mentions: [sender]
        })
        activeMathGames.delete(jid)
        return true
    }

    // Wrong answer? Ignore or penalize? Let's ignore to allow spam guessing.
    return false
}

module.exports = { startMathGame, handleMathReply }

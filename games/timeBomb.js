const { addXP } = require('../state/xp')

// Map<jid, { holder: string, timer: NodeJS.Timeout, endTime: number }>
const activeBombs = new Map()

async function explode(sock, jid) {
    const game = activeBombs.get(jid)
    if (!game) return

    activeBombs.delete(jid)
    const victim = game.holder

    // Penalty
    addXP(jid, victim, -100)

    await sock.sendMessage(jid, {
        text: `💥 *BOOM!* The bomb exploded on @${victim.split('@')[0]}!\n\n💀 You lost *100 XP*. RIP.`,
        mentions: [victim]
    })
}

async function startTimeBomb({ sock, jid, sender }) {
    if (activeBombs.has(jid)) {
        await sock.sendMessage(jid, { text: '💣 A bomb is already ticking! Check who has it!' })
        return
    }

    // 60 seconds fuse
    const duration = 60 * 1000
    const endTime = Date.now() + duration

    const timer = setTimeout(() => explode(sock, jid), duration)

    activeBombs.set(jid, {
        holder: sender,
        timer,
        endTime
    })

    await sock.sendMessage(jid, {
        text: `💣 *TIMEBOMB PLANTED!* 💣\n\n@${sender.split('@')[0]} has the bomb!\nTick tock... 60 seconds!\n\nReply with *.pass @user* to save yourself!`,
        mentions: [sender]
    })
}

async function passBomb({ sock, jid, sender, mentions }) {
    const game = activeBombs.get(jid)
    if (!game) {
        await sock.sendMessage(jid, { text: '😴 No bomb is currently active.' })
        return false 
    }

    if (game.holder !== sender) {
        await sock.sendMessage(jid, { text: '❌ You don’t have the bomb!' })
        return false
    }

    if (!mentions || mentions.length === 0) {
        await sock.sendMessage(jid, { text: '⚠️ You must tag someone to pass the bomb!' })
        return true
    }

    const target = mentions[0]
    
    // Prevent passing to self or bot?
    // passing to self is dumb but allowed (suicide).
    // passing to bot... let's block passing to bot?
    // Actually simplicity first.
    
    game.holder = target
    // We don't reset timer, it keeps ticking!
    
    await sock.sendMessage(jid, {
        text: `💨 Bomb passed to @${target.split('@')[0]}! Run!`,
        mentions: [target]
    })

    return true
}

module.exports = {
    startTimeBomb,
    passBomb
}

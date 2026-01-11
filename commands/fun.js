const { startGuessGame } = require('../games/guessNumber')
const { getXP, getLeaderboard } = require('../state/xp')
const { addXP } = require('../state/xp')
const { isOnCooldown } = require('../state/cooldown')


const commands = {
  dice: async ({ sock, jid }) => {
    const roll = Math.floor(Math.random() * 6) + 1
    await sock.sendMessage(jid, { text: `🎲 ${roll}` })
  },

  coin: async ({ sock, jid }) => {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails'
    await sock.sendMessage(jid, { text: `🪙 ${result}` })
  },

  '8ball': async ({ sock, jid }) => {
    const replies = [
      'Yes.',
      'No.',
      'Maybe.',
      'Absolutely.',
      'Ask again later.',
      'Highly doubtful.',
      'The vibes say yes.',
      'The vibes say no.'
    ]

    const reply = replies[Math.floor(Math.random() * replies.length)]
    await sock.sendMessage(jid, { text: `🎱 ${reply}` })
  },

  numguess: async ({ sock, jid }) => {
    await startGuessGame({ sock, jid })
  },

  iqtest: async ({ sock, jid }) => {
  const iq = Math.floor(Math.random() * 101) + 50
  await sock.sendMessage(jid, {
    text: `🧠 Estimated IQ: *${iq}*\n(Results may vary wildly)`
  })
  },

  rps: async ({ sock, jid, sender, args }) => {
  if (!args[0]) {
    await sock.sendMessage(jid, {
      text: '❓ Usage: *.rps rock | paper | scissors*'
    })
    return
  }

  const userChoice = args[0].toLowerCase()
  const choices = ['rock', 'paper', 'scissors']

  if (!choices.includes(userChoice)) {
    await sock.sendMessage(jid, {
      text: '❌ Invalid choice. Use: rock, paper, or scissors.'
    })
    return
  }

  const botChoice = choices[Math.floor(Math.random() * choices.length)]

  let resultText = ''
  let xpGained = 0

  if (userChoice === botChoice) {
    resultText = '🤝 It’s a draw!'
    xpGained = 1
  } else if (
    (userChoice === 'rock' && botChoice === 'scissors') ||
    (userChoice === 'paper' && botChoice === 'rock') ||
    (userChoice === 'scissors' && botChoice === 'paper')
  ) {
    resultText = '🎉 You win!'
    xpGained = 3
  } else {
    resultText = '💀 You lose!'
    xpGained = 0
  }

  let xpLine = 'No XP gained.'
  let totalXP = null

  if (xpGained > 0) {
    totalXP = addXP(jid, sender, xpGained)
    xpLine = `+${xpGained} XP (Total: ${totalXP})`
  }

  await sock.sendMessage(jid, {
    text:
`🪨📄✂️ *Rock Paper Scissors*

You: *${userChoice}*
Bot: *${botChoice}*

${resultText}
${xpLine}`
  })
},


  truthmeter: async ({ sock, jid }) => {
  const percent = Math.floor(Math.random() * 101)
  await sock.sendMessage(jid, {
    text: `🧪 Truth level: *${percent}%*`
  })
  },

  xp: async ({ sock, jid, sender }) => {
  const xp = getXP(jid, sender)

  await sock.sendMessage(jid, {
    text: `🧠 Your XP: *${xp}*`
  })
},


leaderboard: async ({ sock, jid }) => {
  const board = getLeaderboard(jid).slice(0, 5)

  if (board.length === 0) {
    await sock.sendMessage(jid, {
      text: '🏆 No XP yet. Play some games 👀'
    })
    return
  }

  let text = '🏆 *XP Leaderboard*\n\n'
  const mentions = []

  board.forEach((entry, i) => {
    const user = entry.userJid.split('@')[0]
    text += `${i + 1}. @${user} — *${entry.xp} XP*\n`
    mentions.push(entry.userJid)
  })

  await sock.sendMessage(jid, {
    text,
    mentions
  })
  },

  dig: async ({ sock, jid, sender }) => {
  const wait = isOnCooldown(jid, sender, 'dig', 1800)

  if (wait > 0) {
    await sock.sendMessage(jid, {
      text: `⏳ You’re tired. Try digging again in *${wait}s*.`
    })
    return
  }

  const found = Math.random() < 0.7 // 70% chance

  if (!found) {
    await sock.sendMessage(jid, {
      text: `🪨 You dig and dig...\n😔 Nothing but dirt this time.`
    })
    return
  }

  const xp = Math.floor(Math.random() * 6) + 1
  const total = addXP(jid, sender, xp)

  await sock.sendMessage(jid, {
    text: `🪨 You dig the ground...\n✨ Found *${xp} XP*\nTotal XP: *${total}*`
  })
},


fish: async ({ sock, jid, sender }) => {
  const wait = isOnCooldown(jid, sender, 'fish', 600)

  if (wait > 0) {
    await sock.sendMessage(jid, {
      text: `⏳ The fish aren’t biting. Try again in *${wait}s*.`
    })
    return
  }

  const caught = Math.random() < 0.6 // 60% chance

  if (!caught) {
    await sock.sendMessage(jid, {
      text: `🎣 You wait patiently...\n🌊 The fish got away.`
    })
    return
  }

  const xp = Math.floor(Math.random() * 7) + 2
  const total = addXP(jid, sender, xp)

  await sock.sendMessage(jid, {
    text: `🎣 You cast your line...\n🐟 Caught *${xp} XP*\nTotal XP: *${total}*`
  })
},







  




  menu: async ({ sock, jid }) => {
    await sock.sendMessage(jid, {
      text:
  `🤖 *Yaadobot MENU*
  created by @yaaad

  ━━━━━━━━━━
  🎲 *FUN Stuffs*
  ━━━━━━━━━━
  .dice
  .coin
  .8ball <question>
  .dadjoke
  .rate
  .explainlikeim5
  .judge
  .roast
  .iqtest
  .truthmeter
  .xp
  .leaderboard

  ━━━━━━━━━━
  🎮 *GAMES*
  ━━━━━━━━━━
  .truth
  .dare
  .guess
  .numguess
  .rps <rock|paper|scissors>
  .dig
  .fish
  .unscramble

  ━━━━━━━━━━
  🛡️ *ADMIN (GROUP ONLY)*
  ━━━━━━━━━━
  .admins
  .disable
  .enable
  .kick <user>
  .mute <user>
  .unmute <user>
  .adminonly
  .adminall
  .tagall

  ━━━━━━━━━━
  ℹ️ Type *.help* to learn how to use commands
  `
    })
  },

  help: async ({ sock, jid }) => {
    await sock.sendMessage(jid, {
      text:
  `ℹ️ *HOW TO USE THE BOT*

  • Commands start with a dot (.)
    Example: .dice

  • Some commands need extra input
    Example:
    .rate my sleep schedule
    .explainlikeim5 blockchain

  • Some commands must be used as a reply
    – .roast
    – .judge

  • Guessing games
    – .guess or .numguess starts a game
    – Reply with guesses in chat
    – Bot pauses other replies during game

  • Admin commands work only in groups
    – You must be a group admin

  • If something doesn’t work:
    – Check spelling
    – Try replying correctly
    – Use .menu to see available commands

  Keep it fun. Don’t spam. 😌
  `
    })
  }



}

async function handleFunCommand({ command, args, sock, jid, sender }) {
  const handler = commands[command]

  if (!handler) {
    await sock.sendMessage(jid, {
      text: `Unknown command 🤔\nTry .help`
    })
    return true
  }

  await handler({ sock, jid, args, sender })
  return true
}

module.exports = { handleFunCommand }

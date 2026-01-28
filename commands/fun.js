const axios = require('axios')
const fs = require('fs')
const path = require('path')
const gis = require('g-i-s')
const { startGuessGame } = require('../games/guessNumber')
const { getXP, getLeaderboard } = require('../state/xp')
const { addXP } = require('../state/xp')
const { addItem, getInventory } = require('../state/inventory')
const { isOnCooldown } = require('../state/cooldown')
const { enqueue } = require('../handlers/playQueue')



const commands = {
  dice: async ({ sock, jid }) => {
    const roll = Math.floor(Math.random() * 6) + 1
    await sock.sendMessage(jid, { text: `🎲 ${roll}` })
  },

  coin: async ({ sock, jid }) => {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails'
    await sock.sendMessage(jid, { text: `🪙 ${result}` })
  },

  pic: async ({ sock, jid, args }) => {
    if (!args.length) {
      await sock.sendMessage(jid, { text: '🎨 Usage: .pic <description>' })
      return
    }

    const prompt = args.join(' ')
    const searchPrompt = `${prompt} aesthetic`
    await sock.sendMessage(jid, { text: `🔍 Sending Images for: *${prompt}*...` })

    try {
        const results = await new Promise((resolve, reject) => {
            gis(searchPrompt, (error, results) => {
                if (error) reject(error)
                else resolve(results)
            })
        })

        if (!results || !results.length) {
            await sock.sendMessage(jid, { text: '⚠️ No images found.' })
            return
        }

        // Pick 4 random images from the top 15 to ensure relevance but variety
        const topResults = results.slice(0, 15)
        const selected = []
        for (let i = 0; i < 4; i++) {
            if (topResults.length === 0) break
            const randomIndex = Math.floor(Math.random() * topResults.length)
            selected.push(topResults[randomIndex])
            topResults.splice(randomIndex, 1)
        }

        const tempDir = path.join(__dirname, '../temp')
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true })
        }

        const promises = selected.map(async (imgData, i) => {
            const url = imgData.url
            const uniqueId = `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`
            const filePath = path.join(tempDir, `img_${uniqueId}.jpg`)
            
            try {
                const res = await axios.get(url, { 
                    responseType: 'arraybuffer',
                    timeout: 20000,
                    headers: { 'User-Agent': 'Mozilla/5.0' } 
                })
                fs.writeFileSync(filePath, res.data)
                
                await sock.sendMessage(jid, { 
                    image: { url: filePath }
                })

                // Delete immediately after send
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
                return true

            } catch (e) {
                console.error(`Failed to image ${i}:`, e.message)
                // Try to cleanup if file was created
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
                return false
            }
        })

        const sentResults = await Promise.all(promises)
        const sentCount = sentResults.filter(s => s).length

        if (sentCount === 0) {
            await sock.sendMessage(jid, { text: '⚠️ Failed to grab any of the images. Try again.' })
        }

    } catch (e) {
        console.error('GIS Error:', e)
        await sock.sendMessage(jid, { text: '⚠️ Error searching for images.' })
    }
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

  const found = Math.random() < 0.7 // 70% chance to find something

  if (!found) {
    await sock.sendMessage(jid, {
      text: `🪨 You dig and dig...\n😔 Nothing but dirt this time.`
    })
    return
  }

  // Drop logic
  const roll = Math.random()
  if (roll < 0.1) { // 10% chance for Golden Coin
      addItem(jid, sender, 'golden_coin')
      await sock.sendMessage(jid, {
          text: `🪨 You hit something hard...\n✨ It's a *Golden Coin*! 🪙\n(Use .sell golden_coin to get XP)`
      })
      return
  }
  
  if (roll < 0.25) { // 15% chance (0.1 to 0.25) for Trash
      addItem(jid, sender, 'trash')
      await sock.sendMessage(jid, {
          text: `🪨 You dig up...\n🗑️ Some *Trash*.\n(Maybe you can sell it?)`
      })
      return
  }


  // Normal XP
  const inv = getInventory(jid, sender)
  const hasMultiplier = inv.diamond || inv.mvp_badge
  
  let xp = Math.floor(Math.random() * 6) + 1
  let multiplierText = ''
  
  if (hasMultiplier) {
      xp = Math.ceil(xp * 1.5)
      multiplierText = '\n💎 *XP Boost Active!*'
  }

  const total = addXP(jid, sender, xp)

  await sock.sendMessage(jid, {
    text: `🪨 You dig the ground...\n✨ Found *${xp} XP*${multiplierText}\nTotal XP: *${total}*`
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

  // Drop logic
  const roll = Math.random()
  if (roll < 0.05) { // 5% chance for Treasure Chest
      addItem(jid, sender, 'treasure_chest')
      await sock.sendMessage(jid, {
          text: `🎣 You feel a heavy tug...\n💰 HOLY MOLY! You caught a *Treasure Chest*!\n(Use .sell treasure_chest for major XP!)`
      })
      return
  }
  
  if (roll < 0.25) { // 20% chance (0.05 to 0.25) for Old Boot
      addItem(jid, sender, 'old_boot')
      await sock.sendMessage(jid, {
          text: `🎣 You reel it in...\n👢 It's just an *Old Boot*.\n(Better than nothing?)`
      })
      return
  }


  const inv = getInventory(jid, sender)
  const hasMultiplier = inv.diamond || inv.mvp_badge
  
  let xp = Math.floor(Math.random() * 7) + 2
  let multiplierText = ''
  
  if (hasMultiplier) {
      xp = Math.ceil(xp * 1.5)
      multiplierText = '\n💎 *XP Boost Active!*'
  }
  
  const total = addXP(jid, sender, xp)

  await sock.sendMessage(jid, {
    text: `🎣 You cast your line...\n🐟 Caught *${xp} XP*${multiplierText}\nTotal XP: *${total}*`
  })
},

plays: async ({ sock, jid, args }) => {
  if (!args.length) {
    await sock.sendMessage(jid, {
      text: '❌ Usage: *.play <song name>*'
    })
    return
  }

  const query = args.join(' ')
  const API_BASE = 'https://music.yaadosan.in'

  const position = await enqueue(jid, async () => {
    let song

    /* SEARCH */
    const res = await axios.post(`${API_BASE}/search`, { query })
    song = res.data

    await sock.sendMessage(jid, {
      text:
`🎵 *Now Playing:*
  *Title:* ${song.title}
  *Artist:* ${song.artist}`
    })

    /* DOWNLOAD OGG */
    const audioRes = await axios.post(
      `${API_BASE}/download/voice`,
      { query },
      { responseType: 'arraybuffer', timeout: 120000 }
    )

    const audioBuffer = Buffer.from(audioRes.data)

    await sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/ogg; codecs=opus',
      ptt: true
    })
  })

  if (position > 1) {
    await sock.sendMessage(jid, {
      text: `⏳ Added to queue (position ${position})`
    })
  }
},

play: async ({ sock, jid, args }) => {
  if (!args.length) {
    await sock.sendMessage(jid, {
      text: '❌ Usage: *.plays <song name>*'
    })
    return
  }

  const query = args.join(' ')
  const API_BASE = 'https://music.yaadosan.in'

  const position = await enqueue(jid, async () => {
    let song

    /* SEARCH */
    const res = await axios.post(`${API_BASE}/search`, { query })
    song = res.data

    await sock.sendMessage(jid, {
      text:
`🎵 *Now Playing:*
  *Title:* ${song.title}
  *Artist:* ${song.artist}`
    })

    /* DOWNLOAD M4A */
    const audioRes = await axios.post(
      `${API_BASE}/download/m4a`,
      { query },
      { responseType: 'arraybuffer', timeout: 180000 }
    )

    const audioBuffer = Buffer.from(audioRes.data)

    await sock.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/mp4',
      ptt: false
    })
  })

  if (position > 1) {
    await sock.sendMessage(jid, {
      text: `⏳ Added to queue (position ${position})`
    })
  }
},

lyrics: async ({ sock, jid, args }) => {
  if (!args.length) {
    await sock.sendMessage(jid, {
      text: '❌ Usage: *.lyrics <song name> <artist optional>*'
    })
    return
  }

  const query = args.join(' ')
  const API_BASE = 'https://lyrics.yaadosan.in'

  try {
    const res = await axios.get(`${API_BASE}/api/v2/lyrics`, {
      params: {
        platform: 'youtube',
        title: query
      },
      timeout: 15000
    })

    const data = res.data?.data

    if (!data || !data.lyrics) {
      await sock.sendMessage(jid, {
        text: '😔 Lyrics not found.'
      })
      return
    }

    // WhatsApp safe length
    const lyrics = data.lyrics.slice(0, 3500)

    await sock.sendMessage(jid, {
      text:
`🎵 *${data.trackName}*
👤 ${data.artistName}

${lyrics}`
    })

  } catch (err) {
    console.error('Lyrics error:', err.message)
    await sock.sendMessage(jid, {
      text: '⚠️ Lyrics service failed.'
    })
  }
},


  menu: async ({ sock, jid }) => {
    await sock.sendMessage(jid, {
      text:
  `🤖 *Yaadobot MENU*
  created by @yaad v1.2
  Still in development
  It is Hosted in a crappy Home Server. Sometimes the bot maybe be down.
  Who cares lol!
---------~~~~~~~~------~~~~~-------~~~~~~~------~~~~~~~---
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
  .play <song_name> <Artist optional> (universal)
  .plays <song_name> <Artist optional> (Android only)
  .lyrics <song_name> <Artist optional>
  .pic <description>

  ━━━━━━━━━━
  🎮 *GAMES* (provides xp)
  ━━━━━━━━━━
  .xp
  .leaderboard
  .truth
  .dare
  .guess
  .numguess
  .rps <rock|paper|scissors>
  .dig
  .fish
  .unscramble
  ━━━━━━━━━━
  💰 *ECONOMY*
  ━━━━━━━━━━
  .shop
  .buy <item>
  .sell <item>
  .inv / .inventory
  .use <item>
  ━━━━━━━━━━
  ℹ️ Type *.help* to learn how to use commands.
  .admin for admin commands in groups.(make the bot admin first)
  ━━━━━━━━━━
  😌update Log: Added .play command for cross compatible music playback.
  .plays is still available(faster) but .play is recommended now.
  `
    })
  },

  admin: async ({ sock, jid }) => {
    await sock.sendMessage(jid, {
      text: 
  `🛡️ *ADMIN COMMANDS*
  .admins
  .disable
  .enable
  .kick <user>
  .mute <user>
  .unmute <user>
  .adminonly
  .adminall
  .tagall`
    })
  },

  help: async ({ sock, jid }) => {
    await sock.sendMessage(jid, {
      text:
  `ℹ️ *HOW TO USE THE BOT*

  – Use .menu to see available commands.
  • Commands start with a dot (.)
    Example: .dice

  • Some commands need extra input
    Example:
    .rate my sleep schedule
    .rps rock

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

  Keep it fun. Don’t spam. 😌
  `
    })
  },



}

async function handleFunCommand({ command, args, sock, jid, sender }) {
  const handler = commands[command]

  if (!handler) {
    await sock.sendMessage(jid, {
      text: `Unknown command 🤔\nTry .menu`
    })
    return true
  }

  await handler({ sock, jid, args, sender })
  return true
}

module.exports = { handleFunCommand }

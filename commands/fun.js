const axios = require('axios')
const fs = require('fs')
const path = require('path')
const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const { exec } = require('child_process')
const gis = require('g-i-s')
const yts = require('yt-search')
const play = require('play-dl')
const { startGuessGame } = require('../games/guessNumber')
const { startMathGame } = require('../games/mathGame') // ⭐ Added this
const { startTimeBomb, passBomb } = require('../games/timeBomb') // ⭐ Added this
const { getXP, getLeaderboard } = require('../state/xp')
const { addXP } = require('../state/xp')
const { addItem, getInventory } = require('../state/inventory')
const { isOnCooldown } = require('../state/cooldown')
const { enqueue } = require('../handlers/playQueue')

async function processAudioRequest({ sock, jid, args, ptt }) {
  const commandName = ptt ? 'plays' : 'play';
  if (!args.length) {
    await sock.sendMessage(jid, {
      text: `❌ Usage: *.${commandName} <song name>*`
    })
    return
  }

  const query = args.join(' ')

  const result = await enqueue(jid, async () => {
    try {
      let searchQuery = query
      if (!query.startsWith('http') && !/\b(lyrics|video|official|live|cover|remix|audio)\b/i.test(query)) {
        searchQuery = query + ' audio'
      }

      const searchResult = await yts(searchQuery)
      const video = searchResult.videos.length > 0 ? searchResult.videos[0] : null

      if (!video) {
        throw new Error('Song not found')
      }

      // Check duration limit (20 minutes = 1200 seconds)
      const limitSeconds = 20 * 60
      const durationSeconds = video.seconds || (video.duration ? video.duration.seconds : 0)
      if (durationSeconds > limitSeconds) {
        throw new Error(`Video is too long! Limit is 20 minutes (requested: ${video.timestamp || 'unknown'}).`)
      }

      const artist = video.author.name.replace(/\s*-\s*Topic$/i, '')
      await sock.sendMessage(jid, {
        text: `🎵 *Now Playing:* \n*Title:* ${video.title}\n*Artist:* ${artist}`
      })

      // Fetch the audio buffer from the Flask microservice
      const codec = ptt ? 'opus' : 'mp3'
      const flaskUrl = `http://127.0.0.1:5005/download?url=${encodeURIComponent(video.url)}&codec=${codec}`
      console.log(`[MUSIC] Fetching audio (${codec}) from Flask microservice: ${flaskUrl}`)
      
      const response = await axios.get(flaskUrl, {
        responseType: 'arraybuffer',
        timeout: 120000 // 2 minutes timeout
      })

      const audioBuffer = Buffer.from(response.data)
      const mimetype = ptt ? 'audio/ogg; codecs=opus' : 'audio/mp4'

      await sock.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: mimetype,
        ptt: ptt
      })

    } catch (err) {
      console.error(`[${commandName.toUpperCase()}] error:`, err.message)
      if (err.response && err.response.data) {
        try {
          const errStr = Buffer.from(err.response.data).toString('utf-8')
          console.error(`[${commandName.toUpperCase()}] Flask error response:`, errStr)
        } catch (parseErr) {
          // ignore
        }
      }
      let msg = `⚠️ Failed to play music.`
      if (err.message === 'Song not found') {
        msg = '❌ Song not found. Try a different name.'
      } else if (err.message.includes('too long')) {
        msg = `❌ ${err.message}`
      } else {
        msg = `❌ Error: ${err.message || 'Server timeout or connection failed.'}`
      }
      await sock.sendMessage(jid, { text: msg })
    }
  })

  if (result.queued) {
    await sock.sendMessage(jid, {
      text: `⏳ Added to queue (position ${result.position})`
    })
  }
}

const commands = {
  roll: async ({ sock, jid }) => {
    const result = Math.floor(Math.random() * 6) + 1
    await sock.sendMessage(jid, { text: `🎲 You rolled a *${result}*!` })
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
    await sock.sendMessage(jid, { text: `🔍 Searching images for: *${prompt}*...` })

    try {
      const url = `https://www.bing.com/images/search?q=${encodeURIComponent(prompt + ' HD')}&qft=+filterui:imagesize-large&adlt=off&cc=US&setmkt=en-us&form=HDRSC2&first=1`
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'SRCHHPGUSR=ADLT=OFF&NRSLT=-1; SRCHUSR=DOB=20200101; _EDGE_S=F=1&mkt=en-us'
        }
      })

      const cheerio = require('cheerio')
      const $ = cheerio.load(response.data)
      const images = []

      $('.iusc').each((i, elem) => {
        const m = $(elem).attr('m')
        if (m) {
          try {
            const data = JSON.parse(m)
            if (data.murl) {
              images.push(data.murl)
            }
          } catch (e) {}
        }
      })

      if (!images.length) {
        await sock.sendMessage(jid, { text: '⚠️ No images found.' })
        return
      }

      // Pick 4 random images from the top 15 results
      const topResults = images.slice(0, 15)
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

      const promises = selected.map(async (imageUrl, i) => {
        const uniqueId = `${Date.now()}_${i}_${Math.random().toString(36).substring(7)}`
        const filePath = path.join(tempDir, `img_${uniqueId}.jpg`)

        try {
          const res = await axios.get(imageUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          })
          fs.writeFileSync(filePath, res.data)

          await sock.sendMessage(jid, {
            image: { url: filePath }
          })

          // Delete immediately after send
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          return true

        } catch (e) {
          console.error(`Failed to download/send image ${i}:`, e.message)
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
      console.error('Bing Scraper Error:', e)
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

  math: async ({ sock, jid }) => { // ⭐ Added `.math`
      await startMathGame({ sock, jid })
  },

  iqtest: async ({ sock, jid }) => {
  const iq = Math.floor(Math.random() * 101) + 50
  await sock.sendMessage(jid, {
    text: `🧠 Estimated IQ: *${iq}*\n(Results may vary wildly)`
  })
  },

  timebomb: async ({ sock, jid, sender }) => {
      await startTimeBomb({ sock, jid, sender })
  },

  pass: async ({ sock, jid, sender, msg }) => {
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || []
      await passBomb({ sock, jid, sender, mentions })
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
    xpGained = 5
  } else if (
    (userChoice === 'rock' && botChoice === 'scissors') ||
    (userChoice === 'paper' && botChoice === 'rock') ||
    (userChoice === 'scissors' && botChoice === 'paper')
  ) {
    resultText = '🎉 You win!'
    xpGained = 20
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
  const hasShovel = inv.golden_shovel
  
  let xp = Math.floor(Math.random() * 16) + 15 // 15-30 XP
  let multiplierText = ''
  
  if (hasShovel) {
      xp = Math.floor(Math.random() * 41) + 30 // 30-70 XP with shovel
      multiplierText = '\n🌟 *Golden Shovel Power!*'
  }
  
  if (hasMultiplier) {
      xp = Math.ceil(xp * 1.5)
      multiplierText += ' (Diamond Boost)'
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
  const inv = getInventory(jid, sender)
  const hasRod = inv.fishing_rod

  const roll = Math.random()
  
  // Base Rates
  let chestRate = 0.05 // 5%
  let bootRate = 0.25 // 20% (minus chest rate)
  let rodText = ''

  if (hasRod) {
      chestRate = 0.15 // 15% with rod
      bootRate = 0.10 // Less boot chance
      rodText = '\n🎣 *Rod Luck!*'
  }

  if (roll < chestRate) { 
      addItem(jid, sender, 'treasure_chest')
      await sock.sendMessage(jid, {
          text: `🎣 You feel a heavy tug...${rodText}\n💰 HOLY MOLY! You caught a *Treasure Chest*!\n(Use .sell treasure_chest for major XP!)`
      })
      return
  }
  
  // Boot range: [chestRate, chestRate + bootRate]
  // if bootRate is 0.20, and chestRate is 0.05, boots are 0.05 to 0.25
  // if rod: chest 0.15. Boots 0.10. range 0.15 to 0.25. (Reduced boot chance effectively)
  
  if (roll < (chestRate + bootRate) && roll >= chestRate) { 
      addItem(jid, sender, 'old_boot')
      await sock.sendMessage(jid, {
          text: `🎣 You reel it in...${rodText}\n👢 It's just an *Old Boot*.\n(Better than nothing?)`
      })
      return
  }


  // Re-use inv from above
  //  const inv = getInventory(jid, sender)
  const hasMultiplier = inv.diamond || inv.mvp_badge
  
  let xp = Math.floor(Math.random() * 21) + 20 // 20-40 XP
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
    await processAudioRequest({ sock, jid, args, ptt: true })
  },

  play: async ({ sock, jid, args }) => {
    await processAudioRequest({ sock, jid, args, ptt: false })
  },

lyrics: async ({ sock, jid, args }) => {
  if (!args.length) {
    await sock.sendMessage(jid, {
      text: '❌ Usage: *.lyrics <song name> <artist optional>*'
    })
    return
  }

  const query = args.join(' ')
  await sock.sendMessage(jid, { text: `🔍 Searching lyrics for: *${query}*...` })

  try {
    const res = await axios.get(`https://lrclib.net/api/search`, {
      params: { q: query },
      headers: { 'User-Agent': 'Yaadobot/1.0.0 (contact@yaadosan.in)' },
      timeout: 25000,
      family: 4
    })

    const results = res.data

    if (!results || results.length === 0 || !results[0].plainLyrics) {
      await sock.sendMessage(jid, {
        text: '😔 Lyrics not found.'
      })
      return
    }

    const data = results[0]
    // WhatsApp safe length
    const lyrics = data.plainLyrics.slice(0, 3500)

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

video: async ({ sock, jid, args }) => {
  if (!args.length) {
    await sock.sendMessage(jid, { text: '❌ Usage: *.video <song/video name>*' })
    return
  }

  const query = args.join(' ')
  await sock.sendMessage(jid, { text: `🔍 Searching video for: *${query}*...` })

  try {
    const searchResult = await yts(query)
    const video = searchResult.videos.length > 0 ? searchResult.videos[0] : null

    if (!video) {
      await sock.sendMessage(jid, { text: '❌ Video not found. Try a different name.' })
      return
    }

    // Check duration limit (5 minutes = 300 seconds to prevent massive files)
    const limitSeconds = 5 * 60
    const durationSeconds = video.seconds || (video.duration ? video.duration.seconds : 0)
    if (durationSeconds > limitSeconds) {
      await sock.sendMessage(jid, { 
        text: `❌ Video is too long! Limit is 5 minutes (requested: ${video.timestamp || 'unknown'}).` 
      })
      return
    }

    await sock.sendMessage(jid, {
      text: `📥 *Downloading video:* \n*Title:* ${video.title}\n*Channel:* ${video.author.name}\n*Duration:* ${video.timestamp}`
    })

    // Fetch the video buffer from the Flask microservice
    const flaskUrl = `http://127.0.0.1:5005/download_video?url=${encodeURIComponent(video.url)}`
    console.log(`[VIDEO] Fetching video from Flask microservice: ${flaskUrl}`)
    
    const response = await axios.get(flaskUrl, {
      responseType: 'arraybuffer',
      timeout: 180000 // 3 minutes timeout
    })

    const videoBuffer = Buffer.from(response.data)

    await sock.sendMessage(jid, {
      video: videoBuffer,
      mimetype: 'video/mp4',
      caption: `📹 *${video.title}*\nChannel: ${video.author.name}`
    })

  } catch (err) {
    console.error(`[VIDEO] error:`, err.message)
    if (err.response && err.response.data) {
      try {
        const errStr = Buffer.from(err.response.data).toString('utf-8')
        console.error(`[VIDEO] Flask error response:`, errStr)
      } catch (parseErr) {
        // ignore
      }
    }
    await sock.sendMessage(jid, { 
      text: `❌ Error downloading video: ${err.message || 'Server timeout or connection failed.'}` 
    })
  }
},

sticker: async ({ sock, jid, msg, args }) => {
  const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
  const isDirectImage = msg.message?.imageMessage
  const isQuotedImage = quoted?.imageMessage

  // Helper to wrap text
  const wrapText = (text, maxChars = 20) => {
    const words = text.split(' ')
    let currentLine = ''
    const lines = []
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxChars) {
        currentLine = (currentLine + ' ' + word).trim()
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)
    return lines.join('\n')
  }

  // Case 1: Image media sticker (with optional background removal)
  if (isDirectImage || isQuotedImage) {
    const opt = args?.[0]?.toLowerCase()
    const removeBg = opt === 'edge' || opt === 'nobg'

    await sock.sendMessage(jid, { text: removeBg ? '⏳ Isolating subject & creating sticker...' : '⏳ Creating sticker...' })

    const tempInput = path.join(__dirname, `../temp/input_${Date.now()}.png`).replace(/\\/g, '/')
    const tempNoBg = path.join(__dirname, `../temp/nobg_${Date.now()}.png`).replace(/\\/g, '/')
    const tempOutput = path.join(__dirname, `../temp/output_${Date.now()}.webp`).replace(/\\/g, '/')

    try {
      const mediaMsg = isDirectImage ? msg : { key: msg.key, message: quoted }
      const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {}, { rekey: false })
      fs.writeFileSync(tempInput, buffer)

      if (removeBg) {
        // Resolve python executable path (check virtual env first)
        let pythonExe = 'python'
        const winVenv = path.join(__dirname, '../music-service/.venv/Scripts/python.exe')
        const nixVenv = path.join(__dirname, '../music-service/.venv/bin/python')
        if (fs.existsSync(winVenv)) {
          pythonExe = `"${winVenv}"`
        } else if (fs.existsSync(nixVenv)) {
          pythonExe = `"${nixVenv}"`
        }

        // Run python rembg u2netp
        const pythonCmd = `${pythonExe} -c "from rembg import remove, new_session; from PIL import Image; remove(Image.open(r'${tempInput}'), session=new_session('u2netp')).save(r'${tempNoBg}')"`
        
        exec(pythonCmd, (pyErr, stdout, stderr) => {
          let finalInput = tempNoBg
          if (pyErr) {
            console.error('[STICKER-BG] Background removal failed, falling back to original image. Error:', pyErr)
            console.error('[STICKER-BG] Python stderr:', stderr)
            finalInput = tempInput
          }

          const filter = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=white@0'
          const ffmpegCmd = `ffmpeg -i "${finalInput}" -vcodec libwebp -vf "${filter}" -y "${tempOutput}"`
          
          exec(ffmpegCmd, async (err) => {
            if (err) {
              console.error('[STICKER] ffmpeg error:', err)
              await sock.sendMessage(jid, { text: '❌ Failed to process image.' })
              cleanup()
              return
            }
            sendOutputAndCleanup()
          })
        })
      } else {
        const filter = 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=white@0'
        const ffmpegCmd = `ffmpeg -i "${tempInput}" -vcodec libwebp -vf "${filter}" -y "${tempOutput}"`
        
        exec(ffmpegCmd, async (err) => {
          if (err) {
            console.error('[STICKER] ffmpeg error:', err)
            await sock.sendMessage(jid, { text: '❌ Failed to process image.' })
            cleanup()
            return
          }
          sendOutputAndCleanup()
        })
      }

      async function sendOutputAndCleanup() {
        try {
          const webpBuffer = fs.readFileSync(tempOutput)
          await sock.sendMessage(jid, { sticker: webpBuffer })
        } catch (readErr) {
          console.error('[STICKER] Read error:', readErr)
          await sock.sendMessage(jid, { text: '❌ Failed to read processed sticker.' })
        }
        cleanup()
      }

    } catch (err) {
      console.error('[STICKER] error:', err.message)
      await sock.sendMessage(jid, { text: '❌ Error: Could not download media.' })
      cleanup()
    }

    function cleanup() {
      try { if (fs.existsSync(tempInput)) fs.unlinkSync(tempInput) } catch (e) {}
      try { if (fs.existsSync(tempNoBg)) fs.unlinkSync(tempNoBg) } catch (e) {}
      try { if (fs.existsSync(tempOutput)) fs.unlinkSync(tempOutput) } catch (e) {}
    }
    return
  }

  // Case 2: Quoted text message (WhatsApp chat bubble sticker)
  const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || quoted?.imageMessage?.caption || quoted?.videoMessage?.caption
  if (quoted && quotedText) {
    await sock.sendMessage(jid, { text: '⏳ Creating chat bubble sticker...' })

    const participant = msg.message?.extendedTextMessage?.contextInfo?.participant || msg.message?.extendedTextMessage?.contextInfo?.sender
    const { getContactName, saveContactName } = require('../state/contacts')
    const { saveLidMapping } = require('../state/lidMap')
    let username = getContactName(participant)
    
    // If username is still the phone number, look up in group metadata or Baileys contact store
    if (username === participant.split('@')[0] || username === 'User') {
      // 1. Try Baileys' native lid-mapping database lookup
      if (participant.endsWith('@s.whatsapp.net')) {
        const pnUser = participant.split('@')[0]
        try {
          const stored = await sock.authState?.keys?.get('lid-mapping', [pnUser])
          const lidUser = stored?.[pnUser]
          if (lidUser) {
            const lidJid = `${lidUser}@lid`
            const name = getContactName(lidJid)
            if (name && name !== lidUser) {
              username = name
              saveContactName(participant, name)
              saveLidMapping(lidJid, participant)
            }
          }
        } catch (e) {
          console.error('[STICKER-BUBBLE] Failed to query lid-mapping from keys:', e)
        }
      } else if (participant.endsWith('@lid')) {
        const lidUser = participant.split('@')[0]
        try {
          const stored = await sock.authState?.keys?.get('lid-mapping', [`${lidUser}_reverse`])
          const pnUser = stored?.[`${lidUser}_reverse`]
          if (pnUser) {
            const pnJid = `${pnUser}@s.whatsapp.net`
            const name = getContactName(pnJid)
            if (name && name !== pnUser) {
              username = name
              saveContactName(participant, name)
              saveLidMapping(participant, pnJid)
            }
          }
        } catch (e) {
          console.error('[STICKER-BUBBLE] Failed to query reverse lid-mapping from keys:', e)
        }
      }

      // 2. Try Group Metadata Lookup (if in a group and still unresolved)
      if ((username === participant.split('@')[0] || username === 'User') && jid.endsWith('@g.us')) {
        try {
          const groupMeta = await sock.groupMetadata(jid)
          const cleanPart = participant.split('@')[0]
          const found = groupMeta.participants.find(p => {
            const cleanP = p.id.split('@')[0]
            const cleanPhone = p.phoneNumber ? p.phoneNumber.split('@')[0] : ''
            return cleanP === cleanPart || cleanPhone === cleanPart
          })
          if (found) {
            const name = found.name || found.verifiedName || found.notify
            if (name) {
              username = name
              saveContactName(participant, name)
              if (found.id && found.phoneNumber) {
                const pnJid = found.phoneNumber.endsWith('@s.whatsapp.net') ? found.phoneNumber : `${found.phoneNumber}@s.whatsapp.net`
                saveLidMapping(found.id, pnJid)
                saveContactName(found.id, name)
                saveContactName(pnJid, name)
              }
            }
          }
        } catch (e) {
          console.error('[STICKER-BUBBLE] Failed to fetch group metadata for name resolution:', e)
        }
      }

      // 3. Secondary check: look up in Baileys in-memory contact store
      if (username === participant.split('@')[0] && sock.contacts?.[participant]) {
        const contactInfo = sock.contacts[participant]
        username = contactInfo.name || contactInfo.verifiedName || contactInfo.notify || username
      }
    }

    const cleanUsername = username.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'User'
    console.log(`[STICKER-BUBBLE] Resolved username: "${username}" -> Sanitized: "${cleanUsername}" for participant JID: "${participant}"`)

    const wrappedText = wrapText(quotedText, 24)
    const linesCount = wrappedText.split('\n').length

    // Dynamic layout sizing and centering
    const bubbleHeight = 40 + (linesCount * 30) + 20
    const bubbleY = Math.max(20, Math.floor((512 - bubbleHeight) / 2))
    const usernameY = bubbleY + 20
    const textY = bubbleY + 60

    const tempTextFile = `./temp_bubble_${Date.now()}.txt`
    const tempOutputFile = `./temp_bubble_sticker_${Date.now()}.webp`

    try {
      fs.writeFileSync(tempTextFile, wrappedText, 'utf-8')

      // Render dark grey background box with cyan username and white message text
      const ffmpegCmd = `ffmpeg -f lavfi -i color=c=black@0:s=512x512:d=1 -vf "drawbox=x=20:y=${bubbleY}:w=472:h=${bubbleHeight}:color=0x202C33:t=fill,drawtext=text='@${cleanUsername}':fontcolor=0x53bdeb:fontsize=28:x=40:y=${usernameY},drawtext=textfile='${tempTextFile}':fontcolor=white:fontsize=24:x=40:y=${textY}" -vframes 1 -y "${tempOutputFile}"`

      exec(ffmpegCmd, async (err) => {
        if (err) {
          console.error('[STICKER-BUBBLE] ffmpeg error:', err)
          await sock.sendMessage(jid, { text: '❌ Failed to generate chat bubble sticker.' })
          cleanup()
          return
        }

        try {
          const webpBuffer = fs.readFileSync(tempOutputFile)
          await sock.sendMessage(jid, { sticker: webpBuffer })
        } catch (readErr) {
          console.error('[STICKER-BUBBLE] Read error:', readErr)
          await sock.sendMessage(jid, { text: '❌ Failed to read generated bubble sticker.' })
        }
        cleanup()
      })

    } catch (err) {
      console.error('[STICKER-BUBBLE] error:', err.message)
      await sock.sendMessage(jid, { text: '❌ Error: Could not render bubble sticker.' })
      cleanup()
    }

    function cleanup() {
      try { if (fs.existsSync(tempTextFile)) fs.unlinkSync(tempTextFile) } catch (e) {}
      try { if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile) } catch (e) {}
    }
    return
  }

  // Case 3: Text to sticker
  if (args && args.length > 0) {
    await sock.sendMessage(jid, { text: '⏳ Creating text sticker...' })

    const textToRender = args.join(' ')
    const wrappedText = wrapText(textToRender, 18)

    const tempTextFile = `./temp_text_${Date.now()}.txt`
    const tempOutputFile = `./temp_sticker_${Date.now()}.webp`

    try {
      fs.writeFileSync(tempTextFile, wrappedText, 'utf-8')

      // Render white text with 3px black border, centered on a 512x512 transparent canvas
      const ffmpegCmd = `ffmpeg -f lavfi -i color=c=black@0:s=512x512:d=1 -vf "drawtext=textfile='${tempTextFile}':fontcolor=white:fontsize=40:borderw=3:bordercolor=black:x=(w-text_w)/2:y=(h-text_h)/2" -vframes 1 -y "${tempOutputFile}"`

      exec(ffmpegCmd, async (err) => {
        if (err) {
          console.error('[STICKER-TEXT] ffmpeg error:', err)
          await sock.sendMessage(jid, { text: '❌ Failed to generate text sticker.' })
          cleanup()
          return
        }

        try {
          const webpBuffer = fs.readFileSync(tempOutputFile)
          await sock.sendMessage(jid, { sticker: webpBuffer })
        } catch (readErr) {
          console.error('[STICKER-TEXT] Read error:', readErr)
          await sock.sendMessage(jid, { text: '❌ Failed to read generated sticker.' })
        }
        cleanup()
      })

    } catch (err) {
      console.error('[STICKER-TEXT] error:', err.message)
      await sock.sendMessage(jid, { text: '❌ Error: Could not render text sticker.' })
      cleanup()
    }

    function cleanup() {
      try { if (fs.existsSync(tempTextFile)) fs.unlinkSync(tempTextFile) } catch (e) {}
      try { if (fs.existsSync(tempOutputFile)) fs.unlinkSync(tempOutputFile) } catch (e) {}
    }
    return
  }

  // Case 4: No args and no image quoted
  await sock.sendMessage(jid, {
    text: `🖼️ *Sticker Creator Usage:*

• *Image to Sticker:* Reply to an image with *.sticker*
• *Transparent Sticker:* Reply to an image with *.sticker edge* or *.sticker nobg* (removes background)
• *Chat Bubble Sticker:* Reply to a text message with *.sticker*
• *Text Sticker:* Type *.sticker <your text>*`
  })
},

weather: async ({ sock, jid, args }) => {
  if (!args.length) {
    await sock.sendMessage(jid, { text: '❌ Usage: *.weather <city name>*' })
    return
  }

  const city = args.join(' ')
  await sock.sendMessage(jid, { text: `🔍 Getting weather for *${city}*...` })

  try {
    const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 15000
    })

    const current = res.data.current_condition?.[0]
    const area = res.data.nearest_area?.[0]

    if (!current || !area) {
      await sock.sendMessage(jid, { text: '😔 City not found or weather service unavailable.' })
      return
    }

    const temp = current.temp_C
    const feelsLike = current.FeelsLikeC
    const humidity = current.humidity
    const desc = current.weatherDesc?.[0]?.value || 'Unknown'
    const windSpeed = current.windspeedKmph
    const cityName = area.areaName?.[0]?.value || city
    const country = area.country?.[0]?.value || ''

    let emoji = '🌤️'
    const lowerDesc = desc.toLowerCase()
    if (lowerDesc.includes('sun') || lowerDesc.includes('clear')) emoji = '☀️'
    else if (lowerDesc.includes('cloud') || lowerDesc.includes('overcast')) emoji = '☁️'
    else if (lowerDesc.includes('rain') || lowerDesc.includes('drizzle')) emoji = '🌧️'
    else if (lowerDesc.includes('snow') || lowerDesc.includes('freeze')) emoji = '❄️'
    else if (lowerDesc.includes('thunder') || lowerDesc.includes('storm')) emoji = '⚡'
    else if (lowerDesc.includes('fog') || lowerDesc.includes('mist')) emoji = '🌫️'

    const weatherMsg = `🌦️ *Weather in ${cityName}, ${country}*

🌡️ *Temperature:* ${temp}°C
🤔 *Feels Like:* ${feelsLike}°C
${emoji} *Condition:* ${desc}
💧 *Humidity:* ${humidity}%
💨 *Wind Speed:* ${windSpeed} km/h`

    await sock.sendMessage(jid, { text: weatherMsg })

  } catch (err) {
    console.error('[WEATHER] error:', err.message)
    await sock.sendMessage(jid, { text: '⚠️ Weather service is currently offline. Please try again later.' })
  }
},


  menu: async ({ sock, jid }) => {
    await sock.sendMessage(jid, {
      text:
`🤖 *Yaadobot v2.3*
_Created by @yaad_

━━━━━━━━━━━━
🎲 *GAMBLING ZONE*
━━━━━━━━━━━━
.dice <amount> <1-6>
.roulette <amount> <bet>
.slots <amount>
.flip <heads/tails> <amount>

━━━━━━━━━━━━
🎮 *ARCADE & GAMES*
━━━━━━━━━━━━
.leaderboard :: Top XP Players
.math       
.guess      
.numguess   
.roll       :: 🎲 Free Dice Roll
.timebomb   :: 💣 60s Fuse!
.unscramble 
.iqtest     
.truthmeter
.coin       
.rps <choice>       
.truth 
.dare
.8ball <question>
.rate (reply to message)
.judge (reply to message)
.roast (reply to message)

━━━━━━━━━━━━
🛠️ *TOOLS & UTILITIES*
━━━━━━━━━━━━
.watch <movie/show> :: Stream Movies
.pic <text>   :: Image search
.play <song>  :: Download MP3
.plays <song> :: Download Voice Note
.video <song> :: Download Video MP4
.sticker      :: Convert Image to Sticker
.weather <city> :: Get Weather Status
.lyrics <song>:: Get Lyrics
.explain <topic>
.explainlikeim5 <topic>
.dadjoke

━━━━━━━━━━━━
💰 *ECONOMY*
━━━━━━━━━━━━
.xp
.shop
.inv
.buy <item>
.sell <item>
.use <item>
.donate <amount> <user>
.rob <user>
.beg
.dig        
.fish 

_Type .help for details._
_Just chat with me to use AI!_`
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
`🤖 *Yaadobot HELP*
_Guide to the galaxy... or just this bot._

━━━━━━━━━━━━
🎛️ *THE BASICS*
━━━━━━━━━━━━
• *Commands*: Start with a dot (e.g., .menu, .xp)
• *Arguments*: Some need info (e.g., .pic cat)
• *Replies*: Some need you to reply to a message (.roast, .judge)

━━━━━━━━━━━━
🧠 *TIPS & TRICKS*
━━━━━━━━━━━━
• Chat naturally with me to use AI.
• Use *.shop* to buy items (coming soon).
• Type *.leaderboard* to see top players.

_Have fun and don't spam! 🫡_`
    })
  },
}

async function handleFunCommand({ command, args, sock, jid, sender, msg }) {
  const handler = commands[command]

  if (!handler) {
    await sock.sendMessage(jid, {
      text: `Unknown command 🤔\nTry .menu`
    })
    return true
  }

  await handler({ sock, jid, args, sender, msg })
  return true
}

module.exports = { handleFunCommand }

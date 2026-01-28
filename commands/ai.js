const { aiCommand } = require('../ai/commandAI')
const { getUserHistory } = require('../state/userHistory')
const { startGame } = require('../state/guessGame')
const { startUnscramble } = require('../games/unscramble')


function parseAIResponse(text) {
  if (!text) return null
  try {
    // 1. Try direct parse
    return JSON.parse(text)
  } catch (e) {
    // 2. Try extracting from markdown code blocks
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
       try { return JSON.parse(jsonMatch[1]) } catch (e2) {}
    }

    // 3. Try finding first { and last } (brute force extraction)
    const firstOpen = text.indexOf('{')
    const lastClose = text.lastIndexOf('}')
    if (firstOpen !== -1 && lastClose !== -1) {
      try {
        return JSON.parse(text.slice(firstOpen, lastClose + 1))
      } catch (e3) {}
    }
    
    return null
  }
}

async function handleAICommand({ command, args, sock, jid, msg }) {
  switch (command) {
    case 'dadjoke': {
      const reply = await aiCommand(
        jid,
        'Tell a clever, nerdy dad joke. Keep it short.'
      )
      if (reply) await sock.sendMessage(jid, { text: reply })
      else await sock.sendMessage(jid, { text: '😴 AI is sleeping. Try again later.' })
      return true
    }

    case 'rate': {
      if (args.length === 0) {
        await sock.sendMessage(jid, { text: 'Rate *what* exactly?' })
        return true
      }

      const thing = args.join(' ')
      const reply = await aiCommand(
        jid,
        `Rate "${thing}" from 1 to 10 with a funny, sarcastic explanation.`
      )

      if (reply) await sock.sendMessage(jid, { text: reply })
      else await sock.sendMessage(jid, { text: '😴 AI is sleeping. Try again later.' })
      return true
    }

    case 'roast': {
        const ctx = msg.message?.extendedTextMessage?.contextInfo

        if (!ctx?.quotedMessage || !ctx?.participant) {
            await sock.sendMessage(jid, {
            text: 'Reply to someone’s message with `.roast`.'
            })
            return true
        }

        const targetJid = ctx.participant
        const history = getUserHistory(jid, targetJid)

        const contextText =
            history.length > 0
            ? `Recent messages from this person:\n- ${history.join('\n- ')}`
            : 'No recent messages available.'

        const reply = await aiCommand(
            jid,
            `
        Lightly roast this person based on their recent messages.
        Be playful, nerdy, and dad-joke style.
        Do not be mean, personal, or reference sensitive traits.

        ${contextText}
            `.trim()
        )

        if (reply) {
            await sock.sendMessage(
            jid,
            {
                text: reply,
                mentions: [targetJid]
            },
            { quoted: msg }
            )
        } else {
             await sock.sendMessage(jid, { text: '😴 AI is too nice to roast right now.' })
        }

        return true
    }


    case 'explainlikeim5': {
      if (args.length === 0) {
        await sock.sendMessage(jid, {
          text: 'Explain *what* like I am 5?'
        })
        return true
      }

      const topic = args.join(' ')
      const reply = await aiCommand(
        jid,
        `Explain "${topic}" like I am 5 years old, using humor.`
      )

      if (reply) await sock.sendMessage(jid, { text: reply })
      else await sock.sendMessage(jid, { text: '😴 AI is napping. Shhh.' })
      return true
    }

    case 'truth': {
        const reply = await aiCommand(
            jid,
            `
        Generate a Truth question for a group chat game.
        Make it fun, light, and safe for all ages.
        Keep it short to medium length.
            `.trim()
        )

        if (reply) {
            await sock.sendMessage(
            jid,
            { text: `🟦 TRUTH:\n${reply}` },
            { quoted: msg }
            )
        } else {
            await sock.sendMessage(jid, { text: '⚠️ Failed to get a Truth question.' })
        }
        return true
    }

    case 'dare': {
        const reply = await aiCommand(
            jid,
            `
        Generate a Dare for a group chat game.
        The dare must be harmless, safe, and doable in a chat.
        Keep it short to medium length.
            `.trim()
        )

        if (reply) {
            await sock.sendMessage(
            jid,
            { text: `🟥 DARE:\n${reply}` },
            { quoted: msg }
            )
        } else {
             await sock.sendMessage(jid, { text: '⚠️ Failed to get a Dare.' })
        }
        return true
    }

    case 'judge': {
        const ctx = msg.message?.extendedTextMessage?.contextInfo

        if (!ctx?.quotedMessage) {
            await sock.sendMessage(jid, {
            text: 'Reply to a message with `.judge`.'
            })
            return true
        }

        const quotedText =
            ctx.quotedMessage?.conversation ||
            ctx.quotedMessage?.extendedTextMessage?.text ||
            ''

        const reply = await aiCommand(
            jid,
            `
        You are a humorous judge.
        Give a funny verdict on the following message.
        Be playful, nerdy, dad-joke style.
        Short to medium length.

        Message:
        "${quotedText}"
            `.trim()
        )

        if (reply) {
            await sock.sendMessage(
            jid,
            { text: `⚖️ VERDICT:\n${reply}` },
            { quoted: msg }
            )
        } else {
             await sock.sendMessage(jid, { text: '😴 The Judge is on a coffee break.' })
        }
        return true
    }

    case 'guess': {
        const categories = [
          'Animal', 'Object', 'Food', 'Place', 'Famous Person',
          'Movie', 'Book', 'Sport', 'Science', 'Technology'
        ]
        const randomCategory = categories[Math.floor(Math.random() * categories.length)]

        const reply = await aiCommand(
            jid,
            `
        Generate a guessing game.
        Category: ${randomCategory}
        Respond in STRICT JSON only.
        No extra text.

        {
        "hint": "<short hint>",
        "answers": ["answer1", "answer2"]
        }

        Rules:
        - Answers must be simple nouns
        - Provide 1–2 acceptable answers
        - No emojis
            `.trim()
        )


        const data = parseAIResponse(reply)
        
        if (!data) {
            console.error('Failed to parse AI response:', reply)
            await sock.sendMessage(jid, { text: 'Game failed (bad AI data). Try again.' })
            return true
        }



        const { hint, answers } = data
        if (!hint || !answers?.length) {
            await sock.sendMessage(jid, { text: 'Game failed. Try again.' })
            return true
        }

        startGame(
            jid,
            answers.map(a => a.toLowerCase()),
            hint
        )

        await sock.sendMessage(jid, {
            text: `🎯 GUESSING GAME STARTED!\nCategory: *${randomCategory}*\nHint: ${hint}\nReply with your guess.`
        })

        return true
        }


    case 'unscramble': {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
        const randomLetter = letters[Math.floor(Math.random() * letters.length)]

        const reply = await aiCommand(
            jid,
            `
        Generate a word unscramble game using a word that starts with the letter "${randomLetter}".
        Respond in STRICT JSON only.

        {
        "word": "<word>",
        "scrambled": "<scrambled_version>"
        }

        Rules:
        - Common English noun
        - 5–8 letters
        - No emojis
            `.trim()
        )


        const data = parseAIResponse(reply)

        if (!data) {
            console.error('Failed to parse AI response:', reply)
            await sock.sendMessage(jid, { text: 'Game failed (bad AI data). Try again.' })
            return true
        }



        const { word, scrambled } = data
        if (!word || !scrambled) {
            await sock.sendMessage(jid, { text: 'Game failed. Try again.' })
            return true
        }

        startUnscramble(jid, word)

        // ✅ SIMPLE, INLINE HINT
        const hint = `💡Hint: Starts with *${word[0].toUpperCase()}* and has *${word.length}* letters`

        await sock.sendMessage(jid, {
            text:
        `🧩 *UNSCRAMBLE THIS WORD*
        ${scrambled}
${hint}
        Reply with your answer!`
        })

        return true
        }




  }

  return false
}

module.exports = { handleAICommand }

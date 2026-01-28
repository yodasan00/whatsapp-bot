
const systemPrompt = require('./systemPrompt')
const { addToMemory, getMemory } = require('../state/aiMemory')

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

const MODELS = [
  'arcee-ai/trinity-large-preview:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
]

async function aiReply(jid, userText) {
  const history = getMemory(jid)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userText }
  ]

  for (const model of MODELS) {
    try {
      console.log(`🤖 Trying model: ${model}`)
      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost',
          'X-Title': 'WhatsApp Fun Bot'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.8,
          max_tokens: 200
        })
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Status ${res.status}: ${errText}`)
      }

      const data = await res.json()
      const reply = data.choices[0].message.content.trim()

      addToMemory(jid, 'user', userText)
      addToMemory(jid, 'assistant', reply)

      return reply
      
    } catch (err) {
      console.error(`❌ Model ${model} failed:`, err.message)
      // Continue to next model...
    }
  }

  console.error('All AI models failed.')
  return null
}

module.exports = { aiReply }

// const { GoogleGenerativeAI } = require('@google/generative-ai')
// const systemPrompt = require('./systemPrompt')
// const { addToMemory, getMemory } = require('../state/aiMemory')

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// const model = genAI.getGenerativeModel({
//   model: 'gemini-2.5-flash-lite'
// })

// async function aiReply(jid, userText) {
//   const history = getMemory(jid)

//   // Convert memory to Gemini-friendly text
//   const context = [
//     systemPrompt,
//     ...history.map(m => `${m.role}: ${m.content}`),
//     `user: ${userText}`
//   ].join('\n')

//   const result = await model.generateContent(context)
//   const response = result.response.text().trim()

//   // store memory
//   addToMemory(jid, 'user', userText)
//   addToMemory(jid, 'assistant', response)

//   return response
// }

// module.exports = { aiReply }

const systemPrompt = require('./systemPrompt')
const { addToMemory, getMemory } = require('../state/aiMemory')

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

async function aiReply(jid, userText) {
  const history = getMemory(jid)

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userText }
  ]

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      // Optional but recommended by OpenRouter
      'HTTP-Referer': 'http://localhost',
      'X-Title': 'WhatsApp Fun Bot'
    },
    body: JSON.stringify({
      model: 'xiaomi/mimo-v2-flash:free',
      messages,
      temperature: 0.8,
      max_tokens: 200
    })
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error('OpenRouter error:', errText)
    return null
  }

  const data = await res.json()
  const reply = data.choices[0].message.content.trim()

  addToMemory(jid, 'user', userText)
  addToMemory(jid, 'assistant', reply)

  return reply
}

module.exports = { aiReply }

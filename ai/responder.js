const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai')
const systemPrompt = require('./systemPrompt')
const { addToMemory, getMemory } = require('../state/aiMemory')

// 1. OpenRouter Models (Default / Primary)
const OPENROUTER_MODELS = [
  'inclusionai/ling-3.0-flash-vl:free',
  'liquid/lfm-2.5-2.6b:free',
  'nex-agi/nex-n2.5-mini:free',
  'cohere/north-mini-code:free',
  'qwen/qwen3.8-27b:free'
]

// 2. Gemini Models (Backup)
const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemma-4-26b-a4b-it',
  'gemma-4-31b-it'
]

// Build the alternating sequence: OpenRouter[0] -> Gemini[0] -> OpenRouter[1] -> Gemini[1]...
function getAlternatingModelList() {
  const sequence = []
  const maxLen = Math.max(OPENROUTER_MODELS.length, GEMINI_MODELS.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < OPENROUTER_MODELS.length) {
      sequence.push({ provider: 'openrouter', model: OPENROUTER_MODELS[i] })
    }
    if (i < GEMINI_MODELS.length) {
      sequence.push({ provider: 'gemini', model: GEMINI_MODELS[i] })
    }
  }
  return sequence
}

const MODEL_TIMEOUT_MS = 5000       // Strict 5s timeout per model
const MODEL_SLEEP_MS = 3 * 60 * 1000 // 3 minutes cooldown when a model fails

// Map<modelName, sleepUntilTimestamp>
const modelCooldowns = new Map()

/**
 * Puts a failing model to sleep so subsequent chats don't waste time on it.
 */
function putModelToSleep(modelName, reason = '') {
  const wakeTime = Date.now() + MODEL_SLEEP_MS
  modelCooldowns.set(modelName, wakeTime)
  console.warn(`💤 [CIRCUIT BREAKER] Put "${modelName}" to sleep for ${MODEL_SLEEP_MS / 1000}s (Reason: ${reason || 'Failed'}).`)
}

/**
 * Checks if a model is currently sleeping. If its cooldown has expired, wakes it up.
 */
function isModelSleeping(modelName) {
  const wakeTime = modelCooldowns.get(modelName)
  if (!wakeTime) return false

  if (Date.now() >= wakeTime) {
    modelCooldowns.delete(modelName)
    console.log(`⏰ [CIRCUIT BREAKER] Model "${modelName}" woke up from sleep and is active again.`)
    return false
  }
  return true
}

// Relaxed safety settings so harmless group banter / roasts are not blocked
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
]

// Support single key or comma-separated keys for Gemini quota rotation
function getGeminiApiKeys() {
  const envVal = process.env.GEMINI_API_KEY || ''
  return envVal
    .split(',')
    .map(k => k.trim())
    .filter(Boolean)
}

let currentKeyIndex = 0

function getNextGenAI() {
  const keys = getGeminiApiKeys()
  if (!keys.length) return null
  const key = keys[currentKeyIndex % keys.length]
  return new GoogleGenerativeAI(key)
}

function rotateApiKey() {
  const keys = getGeminiApiKeys()
  if (keys.length > 1) {
    currentKeyIndex = (currentKeyIndex + 1) % keys.length
    console.log(`[GEMINI] Rotated API key (Index: ${currentKeyIndex})`)
  }
}

// Convert state memory to Gemini-compatible conversation history
function buildGeminiContents(history, userText) {
  const contents = []

  for (const item of history) {
    const role = (item.role === 'assistant' || item.role === 'model') ? 'model' : 'user'
    if (contents.length > 0 && contents[contents.length - 1].role === role) {
      contents[contents.length - 1].parts[0].text += '\n' + item.content
    } else {
      contents.push({
        role,
        parts: [{ text: item.content }]
      })
    }
  }

  while (contents.length > 0 && contents[0].role === 'model') {
    contents.shift()
  }

  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts[0].text += '\n' + userText
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: userText }]
    })
  }

  return contents
}

// Call OpenRouter
async function executeOpenRouter(modelName, history, userText) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured')
  }

  console.log(`🌐 [OPENROUTER] Trying model: ${modelName} (Timeout: ${MODEL_TIMEOUT_MS}ms)`)

  // 1. Build messages with consecutive-role merging
  const messages = [{ role: 'system', content: systemPrompt }]
  for (const h of history) {
    const role = h.role === 'model' ? 'assistant' : h.role
    const last = messages[messages.length - 1]
    if (last && last.role === role) {
      last.content += '\n' + h.content
    } else {
      messages.push({ role, content: h.content })
    }
  }

  const lastMsg = messages[messages.length - 1]
  if (lastMsg && lastMsg.role === 'user') {
    lastMsg.content += '\n' + userText
  } else {
    messages.push({ role: 'user', content: userText })
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.WEB_URL || 'http://localhost:3000',
      'X-Title': 'Yaadobot'
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: 0.8,
      max_tokens: 250
    }),
    signal: AbortSignal.timeout(MODEL_TIMEOUT_MS)
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Status ${res.status}: ${errText}`)
  }

  const data = await res.json()
  const rawReply = data.choices?.[0]?.message?.content || ''

  // 2. Strip internal reasoning/thinking tokens and validate
  const cleanReply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  if (!cleanReply) {
    throw new Error('Model returned an empty or filtered response')
  }

  return cleanReply
}

// Call Gemini
async function executeGemini(modelName, history, userText) {
  const genAI = getNextGenAI()
  if (!genAI) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  console.log(`🤖 [GEMINI] Trying model: ${modelName} (Timeout: ${MODEL_TIMEOUT_MS}ms)`)

  const contents = buildGeminiContents(history, userText)
  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 300
      },
      safetySettings: SAFETY_SETTINGS
    },
    {
      timeout: MODEL_TIMEOUT_MS
    }
  )

  const result = await model.generateContent({ contents })
  const rawReply = result?.response?.text() || ''

  // Strip internal reasoning/thinking tokens and validate
  const cleanReply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  if (!cleanReply) {
    throw new Error('Model returned an empty or filtered response')
  }

  return cleanReply
}

async function aiReply(jid, userText) {
  const history = getMemory(jid)
  const sequence = getAlternatingModelList()

  // Filter out any models currently sleeping
  const available = sequence.filter(entry => !isModelSleeping(entry.model))

  // If every single model is asleep, pick the first OpenRouter model as an emergency attempt
  const candidatesToTry = available.length > 0 ? available : [sequence[0]]

  for (const { provider, model } of candidatesToTry) {
    try {
      let reply = null

      if (provider === 'openrouter') {
        reply = await executeOpenRouter(model, history, userText)
      } else if (provider === 'gemini') {
        reply = await executeGemini(model, history, userText)
      }

      if (reply) {
        addToMemory(jid, 'user', userText)
        addToMemory(jid, 'model', reply)
        return reply
      }
    } catch (err) {
      const isAborted = err.name === 'TimeoutError' || (err.message && (err.message.includes('aborted') || err.message.includes('timeout')))
      const reason = isAborted ? `Timeout (${MODEL_TIMEOUT_MS}ms)` : err.message

      if (isAborted) {
        console.warn(`⏱️ [${provider.toUpperCase()}] Model "${model}" exceeded 5s timeout. Alternating to next provider...`)
      } else {
        console.error(`❌ [${provider.toUpperCase()}] Model "${model}" failed:`, err.message, 'Alternating to next provider...')
      }

      // Put the failing model to sleep so subsequent requests won't block on it
      putModelToSleep(model, reason)

      // Rotate Gemini key on 429 quota exhaustion
      if (provider === 'gemini' && err.message && err.message.includes('429')) {
        rotateApiKey()
      }
    }
  }

  console.error('❌ All AI models across both OpenRouter and Gemini failed or are sleeping.')
  return null
}

module.exports = {
  aiReply,
  OPENROUTER_MODELS,
  GEMINI_MODELS,
  getAlternatingModelList,
  MODEL_TIMEOUT_MS,
  MODEL_SLEEP_MS,
  putModelToSleep,
  isModelSleeping,
  modelCooldowns
}

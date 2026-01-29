const { addXP } = require('../state/xp')
const { addItem } = require('../state/inventory')

// Map<jid, { type: 'math'|'unscramble'|'trivia', answer: string, reward: number }>
const activeEvents = new Map()

// Map<jid, timestamp> - Last time an event ran in this group
const lastEventTime = new Map()

// Set<jid> - All known groups
const knownGroups = new Set()

function addGroup(jid) {
  if (jid.endsWith('@g.us')) {
    knownGroups.add(jid)
  }
}

function getKnownGroups() {
    return Array.from(knownGroups)
}



function getRandomEvent() {
  const types = ['math', 'unscramble', 'trivia', 'mystery_box']
  const type = types[Math.floor(Math.random() * types.length)]
  
  if (type === 'mystery_box') {
      return {
          type: 'mystery_box',
          question: `🎁 *MYSTERY BOX APPEARED!* 🎁\n\nReply *steal* to grab it before it disappears!`,
          answer: 'steal',
          reward: 300 // High reward
      }
  }
  
  if (type === 'math') {
    const operators = ['+', '-', '*']
    const op = operators[Math.floor(Math.random() * operators.length)]
    const a = Math.floor(Math.random() * 50) + 1
    const b = Math.floor(Math.random() * 20) + 1
    const question = `${a} ${op} ${b}`
    // eslint-disable-next-line no-eval
    const answer = eval(question).toString()
    return {
      type: 'math',
      question: `🧮 *Pop Quiz!* Solve this fast:\n\n*${question}* = ?`,
      answer,
      reward: 100
    }
  }
  
  if (type === 'unscramble') {
    const words = [
      'BANANA', 'APPLE', 'ELEPHANT', 'COMPUTER', 'WHATSAPP', 'GAMING', 
      'ROBOT', 'PYTHON', 'JAVASCRIPT', 'UNIVERSE', 'GALAXY', 'DIAMOND',
      'TREASURE', 'VICTORY', 'CHAMPION', 'LIBRARY', 'ADVENTURE'
    ]
    const word = words[Math.floor(Math.random() * words.length)]
    const scrambled = word.split('').sort(() => Math.random() - 0.5).join('')
    return {
      type: 'unscramble',
      question: `🧩 *Unscramble This!* Be the first!\n\n*${scrambled}*`,
      answer: word,
      reward: 120
    }
  }

  if (type === 'trivia') {
    const trivia = [
      { q: 'What is the capital of France?', a: 'Paris' },
      { q: 'What is 2 + 2 * 2?', a: '6' },
      { q: 'Which planet is known as the Red Planet?', a: 'Mars' },
      { q: 'What is the hardest natural substance?', a: 'Diamond' },
      { q: 'How many legs does a spider have?', a: '8' },
      { q: 'Who painted the Mona Lisa?', a: 'Leonardo da Vinci' },
      { q: 'What is the chemical symbol for Gold?', a: 'Au' },
      { q: 'Which animal is the King of the Jungle?', a: 'Lion' }
    ]
    const t = trivia[Math.floor(Math.random() * trivia.length)]
    return {
      type: 'trivia',
      question: `🧠 *Trivia Time!* Answer fast:\n\n*${t.q}*`,
      answer: t.a,
      reward: 150
    }
  }
}

async function startRandomEvents(sock) {
  // Check every known group
  const now = Date.now()
  const COOLDOWN = 3.5 * 60 * 60 * 1000 // 3.5 hours

  for (const jid of knownGroups) {
      // Skip if event running
      if (activeEvents.has(jid)) continue

      // Skip if recently ran
      const last = lastEventTime.get(jid) || 0
      if (now - last < COOLDOWN) continue

      // 10% chance to trigger if cooldown passed, to stagger them?
      // No, let's strictly trigger if cooldown passed.
      // But we run this function periodically.
      
      const event = getRandomEvent()
      activeEvents.set(jid, event)
      lastEventTime.set(jid, now)

      await sock.sendMessage(jid, { text: event.question })

      // Auto-expire event after 5 minutes
      setTimeout(() => {
        if (activeEvents.has(jid) && activeEvents.get(jid) === event) {
          activeEvents.delete(jid)
          sock.sendMessage(jid, { text: `⏰ Time's up! The answer was *${event.answer}*.` })
        }
      }, 5 * 60 * 1000)
  }
}

function handleEventReply(jid, sender, text) {
  const event = activeEvents.get(jid)
  if (!event) return null

  // Check answer (case insensitive)
  if (text.toLowerCase().trim() === event.answer.toLowerCase()) {
    activeEvents.delete(jid)
    addXP(jid, sender, event.reward)
    
    return {
      correct: true,
      reward: event.reward,
      winner: sender,
      type: event.type
    }
  }

  return null
}

module.exports = {
  addGroup,
  getKnownGroups,
  startRandomEvents,
  handleEventReply
}

const { aiReply } = require('./responder')

async function aiCommand(jid, prompt) {
  // Force short-medium answers
  const finalPrompt = `
Respond with a short to medium-length message.
Be funny, nerdy, and dad-joke style.
Do not explain yourself.

Task:
${prompt}
  `.trim()

  return aiReply(jid, finalPrompt)
}

module.exports = { aiCommand }

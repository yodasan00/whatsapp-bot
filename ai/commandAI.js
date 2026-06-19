const { aiReply } = require('./responder')

async function aiCommand(jid, prompt) {
  // Use an isolated context key so command prompts never pollute the real group conversation history
  const cmdContext = `_cmd_${jid}`

  // Force short-medium answers
  const finalPrompt = `
Respond with a short to medium-length message.
Be funny, nerdy, and dad-joke style.
Do not explain yourself.

Task:
${prompt}
  `.trim()

  return aiReply(cmdContext, finalPrompt)
}

module.exports = { aiCommand }

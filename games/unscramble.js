const activeUnscramble = new Map()

function startUnscramble(jid, answer) {
  activeUnscramble.set(jid, answer.toLowerCase())
}

function checkUnscramble(jid, text) {
  const answer = activeUnscramble.get(jid)
  if (!answer) return null

  const guess = text.toLowerCase().trim()

  if (guess === answer) {
    activeUnscramble.delete(jid)
    return { correct: true }
  }

  return { correct: false }
}

function hasUnscramble(jid) {
  return activeUnscramble.has(jid)
}

module.exports = {
  startUnscramble,
  checkUnscramble,
  hasUnscramble
}

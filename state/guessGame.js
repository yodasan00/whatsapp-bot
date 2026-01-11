const games = new Map()

function startGame(jid, answers, hint) {
  games.set(jid, {
    answers,       
    hint,
    active: true
  })
}

function getGame(jid) {
  return games.get(jid)
}

function endGame(jid) {
  games.delete(jid)
}

module.exports = { startGame, getGame, endGame }

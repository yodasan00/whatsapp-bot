const cooldowns = new Map()
// key: `${jid}:${user}:${command}` → timestamp

function isOnCooldown(jid, user, command, seconds) {
  const key = `${jid}:${user}:${command}`
  const now = Date.now()
  const last = cooldowns.get(key)

  if (!last) {
    cooldowns.set(key, now)
    return 0
  }

  const diff = Math.floor((now - last) / 1000)
  if (diff >= seconds) {
    cooldowns.set(key, now)
    return 0
  }

  return seconds - diff
}

module.exports = { isOnCooldown }

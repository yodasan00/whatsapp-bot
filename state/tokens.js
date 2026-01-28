const crypto = require('crypto')

// Map<Jid, { token: string, expires: number }>
// We store one valid token per user at a time to keep it simple.
const tokenStore = new Map()

const TTL = 15 * 60 * 1000 // 15 Minutes

function generateToken(jid) {
    const token = crypto.randomBytes(16).toString('hex')
    const expires = Date.now() + TTL
    
    tokenStore.set(jid, { token, expires })
    return token
}

function verifyToken(jid, token) {
    if (!jid || !token) return false
    
    const record = tokenStore.get(jid)
    if (!record) return false
    
    if (Date.now() > record.expires) {
        tokenStore.delete(jid)
        return false
    }
    
    // Constant time comparison to prevent timing attacks (overkill here but good practice)
    return crypto.timingSafeEqual(Buffer.from(record.token), Buffer.from(token))
}

// Cleanup expired tokens every hour
setInterval(() => {
    const now = Date.now()
    for (const [jid, record] of tokenStore.entries()) {
        if (now > record.expires) {
            tokenStore.delete(jid)
        }
    }
}, 60 * 60 * 1000)

module.exports = { generateToken, verifyToken }

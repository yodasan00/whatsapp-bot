const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const TOKEN_FILE = path.join(__dirname, 'active_tokens.json')
const TTL = 2 * 60 * 60 * 1000 // 2 Hours

// Map<Jid, { token: string, expires: number }>
const tokenStore = new Map()

// Load persisted tokens on startup
try {
    if (fs.existsSync(TOKEN_FILE)) {
        const raw = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'))
        const now = Date.now()
        for (const [jid, record] of Object.entries(raw)) {
            if (record && record.expires > now) {
                tokenStore.set(jid, record)
            }
        }
    }
} catch (e) {
    console.error('Failed to load active_tokens.json:', e.message)
}

function persistTokens() {
    try {
        const obj = Object.fromEntries(tokenStore.entries())
        fs.writeFileSync(TOKEN_FILE, JSON.stringify(obj, null, 2), 'utf-8')
    } catch (e) {
        console.error('Failed to persist active_tokens.json:', e.message)
    }
}

function generateToken(jid) {
    const token = crypto.randomBytes(16).toString('hex')
    const expires = Date.now() + TTL
    
    tokenStore.set(jid, { token, expires })
    persistTokens()
    return token
}

function verifyToken(jid, token) {
    if (!jid || !token) return false
    
    const record = tokenStore.get(jid)
    if (!record) return false
    
    if (Date.now() > record.expires) {
        tokenStore.delete(jid)
        persistTokens()
        return false
    }

    if (typeof token !== 'string' || record.token.length !== token.length) {
        return false
    }
    
    // Constant time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(record.token), Buffer.from(token))
}

// Cleanup expired tokens every hour
setInterval(() => {
    const now = Date.now()
    let changed = false
    for (const [jid, record] of tokenStore.entries()) {
        if (now > record.expires) {
            tokenStore.delete(jid)
            changed = true
        }
    }
    if (changed) persistTokens()
}, 30 * 60 * 1000)

module.exports = { generateToken, verifyToken }

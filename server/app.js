const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const { getInventory, addItem, removeItem } = require('../state/inventory')
const { getXP, addXP } = require('../state/xp')
const { shopItems, getItem } = require('../state/shop')
const { verifyToken } = require('../state/tokens')
const { isOwner } = require('../utils/owner')

const app = express()
const PORT = process.env.PORT || 3000

const ROOT_COOKIES = path.join(__dirname, '../cookies.txt')
const SERVICE_COOKIES = path.join(__dirname, '../music-service/cookies.txt')

app.use(cors())
app.use(bodyParser.json({ limit: '5mb' }))
app.use(express.static(path.join(__dirname, 'public')))

// Route: Cookie Management Web Page
app.get('/cookies', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'cookies.html'))
})

// API: Get User Data
app.get('/api/user', (req, res) => {
    const { jid, context, token } = req.query
    if (!jid) return res.status(400).json({ error: 'Missing jid' })
    if (!verifyToken(jid, token)) return res.status(401).json({ error: 'Unauthorized. Please request a new .shop link.' })

    const targetContext = context || jid
    
    const xpVal = getXP(targetContext, jid)
    const inventory = getInventory(targetContext, jid)
    
    res.json({ jid, context, xp: xpVal, inventory })
})

// API: Get Shop Items
app.get('/api/shop', (req, res) => {
    res.json(shopItems)
})

// API: Buy Item
app.post('/api/buy', (req, res) => {
    const { jid, context, itemId, token } = req.body
    
    if (!jid || !itemId) return res.status(400).json({ error: 'Missing data' })
    if (!verifyToken(jid, token)) return res.status(401).json({ error: 'Unauthorized. Please request a new .shop link.' })

    const targetContext = context || jid
    const item = getItem(itemId)
    
    if (!item) return res.status(404).json({ error: 'Item not found' })
    
    const currentXP = getXP(targetContext, jid)
    if (currentXP < item.price) {
        return res.status(400).json({ error: 'Not enough XP', currentXP, price: item.price })
    }
    
    addXP(targetContext, jid, -item.price)
    addItem(targetContext, jid, item.id)
    
    const newXP = getXP(targetContext, jid)
    const newInv = getInventory(targetContext, jid)
    
    res.json({ success: true, xp: newXP, inventory: newInv, message: `Bought ${item.name}` })
})

// API: Sell Item
app.post('/api/sell', (req, res) => {
    const { jid, context, itemId, amount = 1, token } = req.body
    
    if (!jid || !itemId) return res.status(400).json({ error: 'Missing data' })
    if (!verifyToken(jid, token)) return res.status(401).json({ error: 'Unauthorized. Please request a new .shop link.' })
    
    const targetContext = context || jid
    const item = getItem(itemId)
    
    if (!item || !item.sellPrice) return res.status(400).json({ error: 'Cannot sell this item' })
    
    const success = removeItem(targetContext, jid, itemId, amount)
    
    if (!success) return res.status(400).json({ error: 'You do not have this item' })
    
    const xpEarned = item.sellPrice * amount
    addXP(targetContext, jid, xpEarned)
    
    const newXP = getXP(targetContext, jid)
    const newInv = getInventory(targetContext, jid)
    
    res.json({ success: true, xp: newXP, inventory: newInv, message: `Sold ${item.name} for ${xpEarned} XP` })
})

/* =====================================================
   🍪 COOKIE MANAGEMENT APIS (OWNER ONLY)
   ===================================================== */

// API: Get Current Cookies Status
app.get('/api/cookies/status', (req, res) => {
    const { user, token } = req.query
    if (!user || !verifyToken(user, token) || !isOwner(user)) {
        return res.status(403).json({ error: 'Unauthorized. Owner access required.' })
    }

    const targetPath = fs.existsSync(ROOT_COOKIES) ? ROOT_COOKIES : (fs.existsSync(SERVICE_COOKIES) ? SERVICE_COOKIES : null)

    if (!targetPath) {
        return res.json({
            exists: false,
            message: 'No cookies.txt file currently installed.'
        })
    }

    try {
        const stats = fs.statSync(targetPath)
        const content = fs.readFileSync(targetPath, 'utf8')
        const lines = content.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'))
        const youtubeCookies = lines.filter(l => l.includes('youtube.com') || l.includes('google.com'))
        const uniqueDomains = [...new Set(lines.map(l => l.split('\t')[0]).filter(Boolean))].slice(0, 6)

        res.json({
            exists: true,
            filePath: path.basename(targetPath),
            lastModified: stats.mtime,
            sizeBytes: stats.size,
            totalCookies: lines.length,
            youtubeCookies: youtubeCookies.length,
            sampleDomains: uniqueDomains
        })
    } catch (err) {
        res.status(500).json({ error: 'Failed to inspect cookies: ' + err.message })
    }
})

// API: Test Cookies against YouTube via Python microservice
app.post('/api/cookies/test', async (req, res) => {
    const { user, token } = req.body
    if (!user || !verifyToken(user, token) || !isOwner(user)) {
        return res.status(403).json({ error: 'Unauthorized. Owner access required.' })
    }

    try {
        const response = await axios.get('http://127.0.0.1:5005/test_cookies', { timeout: 15000 })
        res.json(response.data)
    } catch (err) {
        const errMsg = err.response?.data?.error || err.message
        res.status(400).json({
            valid: false,
            error: errMsg
        })
    }
})

// API: Update cookies.txt
app.post('/api/cookies/update', async (req, res) => {
    const { user, token, cookiesContent } = req.body
    if (!user || !verifyToken(user, token) || !isOwner(user)) {
        return res.status(403).json({ error: 'Unauthorized. Owner access required.' })
    }

    if (!cookiesContent || typeof cookiesContent !== 'string' || cookiesContent.trim().length < 40) {
        return res.status(400).json({ error: 'Invalid cookie content. Content is too short or empty.' })
    }

    const cleanContent = cookiesContent.trim()

    // Netscape format check: tab-separated lines or domain keywords
    if (!cleanContent.includes('\t') && !cleanContent.includes('youtube.com')) {
        return res.status(400).json({
            error: 'Invalid format. File must be Netscape/tab-separated cookies.txt.'
        })
    }

    try {
        // Create backup of current file if it exists
        if (fs.existsSync(ROOT_COOKIES)) {
            fs.copyFileSync(ROOT_COOKIES, ROOT_COOKIES + '.bak')
        }

        // Write to root and music-service
        fs.writeFileSync(ROOT_COOKIES, cleanContent + '\n', 'utf8')
        if (fs.existsSync(path.dirname(SERVICE_COOKIES))) {
            fs.writeFileSync(SERVICE_COOKIES, cleanContent + '\n', 'utf8')
        }

        // Auto-verify with Python service
        let verification = { valid: null }
        try {
            const testResp = await axios.get('http://127.0.0.1:5005/test_cookies', { timeout: 15000 })
            verification = testResp.data
        } catch (testErr) {
            verification = {
                valid: false,
                error: testErr.response?.data?.error || testErr.message
            }
        }

        res.json({
            success: true,
            message: 'cookies.txt successfully installed and backed up.',
            verification
        })
    } catch (err) {
        res.status(500).json({ error: 'Failed to update cookies file: ' + err.message })
    }
})

function startServer() {
    app.listen(PORT, () => {
        console.log(`🌍 Web Server running at http://localhost:${PORT}`)
    })
}

module.exports = { startServer }

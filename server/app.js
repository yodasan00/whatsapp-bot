const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const path = require('path')
const { getInventory, addItem, removeItem } = require('../state/inventory')
const { getXP, addXP } = require('../state/xp')
const { shopItems, getItem } = require('../state/shop')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(bodyParser.json())
app.use(express.static(path.join(__dirname, 'public')))

// API: Get User Data
app.get('/api/user', (req, res) => {
    const { jid, context } = req.query
    if (!jid) return res.status(400).json({ error: 'Missing jid' }) 

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
    const { jid, context, itemId } = req.body
    
    if (!jid || !itemId) return res.status(400).json({ error: 'Missing data' })

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
    const { jid, context, itemId, amount = 1 } = req.body
    
    if (!jid || !itemId) return res.status(400).json({ error: 'Missing data' })
    
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

function startServer() {
    app.listen(PORT, () => {
        console.log(`🌍 Web Shop running at http://localhost:${PORT}`)
    })
}

module.exports = { startServer }

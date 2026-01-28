const shopItems = [
    { 
        id: 'cookie', 
        name: '🍪 Cookie', 
        price: 50,
        sellPrice: 25, 
        description: 'A tasty snack. Yum!' 
    },
    { 
        id: 'coffee', 
        name: '☕ Coffee', 
        price: 80, 
        sellPrice: 40,
        description: 'Wake up and code!' 
    },
    { 
        id: 'diamond', 
        name: '💎 Diamond', 
        price: 5000, 
        sellPrice: 2500,
        description: 'The ultimate flex.' 
    },
    { 
        id: 'mvp_badge', 
        name: '👑 MVP Badge', 
        price: 1000, 
        sellPrice: 500,
        description: 'Show everyone you are the best.' 
    },
    { 
        id: 'shield', 
        name: '🛡️ Rob Shield', 
        price: 500, 
        sellPrice: 250,
        description: 'Protects you from being robbed once. (Coming soon)' 
    },
    // LOOT ITEMS (Can be sold)
    {
        id: 'trash',
        name: '🗑️ Trash',
        price: 0,
        sellPrice: 1,
        description: 'One man\'s trash...'
    },
    {
        id: 'old_boot',
        name: '👢 Old Boot',
        price: 0,
        sellPrice: 10,
        description: 'Smells kinda funky.'
    },
    {
        id: 'golden_coin',
        name: '🪙 Golden Coin',
        price: 1000,
        sellPrice: 500,
        description: 'A shiny ancient coin!'
    },
    {
        id: 'treasure_chest',
        name: '💰 Treasure Chest',
        price: 5000,
        sellPrice: 2500,
        description: 'Jackpot! Full of gold.'
    }
]

function getItem(id) {
    return shopItems.find(i => i.id === id)
}

module.exports = {
    shopItems,
    getItem
}

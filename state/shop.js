const shopItems = [
    { 
        id: 'cookie', 
        name: '🍪 Cookie', 
        price: 50,
        sellPrice: 25, 
        description: 'Eat to gain 10-70 XP instantly. (Yummy!)' 
    },
    { 
        id: 'coffee', 
        name: '☕ Coffee', 
        price: 250, 
        sellPrice: 125,
        description: 'Resets all game cooldowns instantly.' 
    },
    {
        id: 'energy_drink',
        name: '🥤 Energy Drink',
        price: 500,
        sellPrice: 250,
        description: 'Resets cooldowns + gives 50 XP boost.'
    },
    { 
        id: 'mystery_box', 
        name: '📦 Mystery Box', 
        price: 750, 
        sellPrice: 0,
        description: 'Random reward! Can be XP, cash, or trash.' 
    },
    { 
        id: 'fishing_rod', 
        name: '🎣 Fishing Rod', 
        price: 2000, 
        sellPrice: 1000,
        description: 'Better chance to catch rare loot while fishing.' 
    },
    { 
        id: 'golden_shovel', 
        name: '🌟 Golden Shovel', 
        price: 3000, 
        sellPrice: 1500,
        description: 'Digs up 3x more XP from the ground.' 
    },
    { 
        id: 'diamond', 
        name: '💎 Diamond', 
        price: 5000, 
        sellPrice: 2500,
        description: '+50% Passive XP Boost for games.' 
    },
    { 
        id: 'car_keys', 
        name: '🏎️ Car Keys', 
        price: 50000, 
        sellPrice: 25000,
        description: 'Vroom vroom! You own a fast car. (Flex)' 
    },
    { 
        id: 'mansion_deed', 
        name: '🏰 Mansion Deed', 
        price: 1000000, 
        sellPrice: 500000,
        description: 'You own the server now. (Ultimate Flex)' 
    },
    { 
        id: 'mvp_badge', 
        name: '👑 MVP Badge', 
        price: 1000, 
        sellPrice: 500,
        description: 'Show everyone you are the best (Passive +50% XP).' 
    },
    { 
        id: 'ban_hammer', 
        name: '🔨 Ban Hammer', 
        price: 99999, 
        sellPrice: 1,
        description: 'The ultimate flex. Does absolutely nothing.' 
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

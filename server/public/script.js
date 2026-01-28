const params = new URLSearchParams(window.location.search);
const userJid = params.get('user');
const context = params.get('context') || userJid;

const API_BASE = ''; // Relative path since served from same origin

// Elements
const userJidEl = document.getElementById('userJid');
const userXpEl = document.getElementById('userXp');
const inventoryGrid = document.getElementById('inventoryGrid');
const shopGrid = document.getElementById('shopGrid');
const toastEl = document.getElementById('toast');

if (!userJid) {
    document.body.innerHTML = '<div style="color:white; text-align:center; padding:50px;">Missing User JID in URL. Please open link from WhatsApp.</div>';
} else {
    init();
}

async function init() {
    await Promise.all([
        fetchUserData(),
        fetchShopItems()
    ]);
}

async function fetchUserData() {
    try {
        const res = await fetch(`${API_BASE}/api/user?jid=${userJid}&context=${context}`);
        const data = await res.json();
        
        userJidEl.textContent = data.jid.split('@')[0];
        userXpEl.textContent = checkNumber(data.xp);
        
        renderInventory(data.inventory);
    } catch (e) {
        console.error('Failed to load user data', e);
        showToast('Failed to load user data', true);
    }
}

async function fetchShopItems() {
    try {
        const res = await fetch(`${API_BASE}/api/shop`);
        const items = await res.json();
        renderShop(items);
    } catch (e) {
        console.error('Failed to load shop', e);
    }
}

function checkNumber(num) {
    return num ? num.toLocaleString() : '0';
}

function renderInventory(inv) {
    inventoryGrid.innerHTML = '';
    const keys = Object.keys(inv);
    
    if (keys.length === 0) {
        inventoryGrid.innerHTML = '<div class="empty-state" style="color:#555">Your inventory is empty.</div>';
        return;
    }

    // We need item details for names, so we might need lookups.
    // Ideally user data would include item details, but let's fetch shop items to map IDs first.
    // For now, names will be fetched from the shop list which we load in parallel.
    // Let's wait for shopItems to be loaded or just use IDs if waiting is hard?
    // Actually simpler: re-render both when data available. 
    // We'll rely on the shop items being available globally or store them.
    
    // Quick hack: fetchShopItems saves to window.shopData
}

let shopData = [];

async function renderShop(items) {
    shopData = items;
    shopGrid.innerHTML = '';
    
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        // Extract icon from name if possible (e.g. "🍪 Cookie")
        const iconMatch = item.name.match(/^(\S+)/);
        const icon = iconMatch ? iconMatch[1] : '📦';
        const cleanName = item.name.replace(/^(\S+)\s/, '');

        card.innerHTML = `
            <div class="card-header">
                <div class="icon">${icon}</div>
                <div class="price-tag">🪙 ${item.price} XP</div>
            </div>
            <div class="item-name">${cleanName}</div>
            <div class="item-desc">${item.description}</div>
            <button class="btn btn-buy" onclick="buyItem('${item.id}')">BUY</button>
        `;
        shopGrid.appendChild(card);
    });
    
    // Now we can render inventory properly since we have item data
    // We need to re-fetch inventory or just trigger it here if we had it stored.
    // Let's just re-call fetchUserData() logic or pass it data.
    // Simpler: Just refresh user data which calls renderInventory
    fetchUserData(); // This is a bit inefficient but safe
}

// Override renderInventory now that we know we have shopData
const _renderInventoryOriginal = renderInventory;
renderInventory = function(inv) {
    inventoryGrid.innerHTML = '';
    const keys = Object.keys(inv);
    
    if (keys.length === 0) {
        inventoryGrid.innerHTML = '<div class="empty-state" style="color:#555">Your inventory is empty.</div>';
        return;
    }

    keys.forEach(key => {
        const amount = inv[key];
        const item = shopData.find(i => i.id === key);
        
        if (!item) return; // Skip unknown items
        
        const iconMatch = item.name.match(/^(\S+)/);
        const icon = iconMatch ? iconMatch[1] : '📦';
        const cleanName = item.name.replace(/^(\S+)\s/, '');

        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = 'rgba(236, 72, 153, 0.3)'; // Accent border for owned
        
        let actionBtn = '';
        if (item.sellPrice) {
            actionBtn = `<button class="btn btn-sell" onclick="sellItem('${item.id}')">SELL (${item.sellPrice} XP)</button>`;
        } else {
            actionBtn = `<button class="btn btn-sell" disabled style="opacity:0.5; cursor: default">Cannot Sell</button>`;
        }

        card.innerHTML = `
            <div class="card-header">
                <div class="icon">${icon}</div>
                <div class="price-tag">x${amount}</div>
            </div>
            <div class="item-name">${cleanName}</div>
            <div class="item-desc">${item.description}</div>
            ${actionBtn}
        `;
        inventoryGrid.appendChild(card);
    });
}


async function buyItem(itemId) {
    try {
        const res = await fetch(`${API_BASE}/api/buy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jid: userJid, context, itemId })
        });
        
        const data = await res.json();
        
        if (data.error) {
            showToast(data.error, true);
        } else {
            showToast(data.message);
            // Update UI locally
            userXpEl.textContent = checkNumber(data.xp);
            renderInventory(data.inventory);
        }
    } catch (e) {
        showToast('Transaction failed', true);
    }
}

async function sellItem(itemId) {
    if (!confirm('Sell this item?')) return;
    
    try {
        const res = await fetch(`${API_BASE}/api/sell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jid: userJid, context, itemId })
        });
        
        const data = await res.json();
        
        if (data.error) {
            showToast(data.error, true);
        } else {
            showToast(data.message);
            userXpEl.textContent = checkNumber(data.xp);
            renderInventory(data.inventory);
        }
    } catch (e) {
        showToast('Transaction failed', true);
    }
}

function showToast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.className = `toast ${isError ? 'error' : ''}`; // visible
    
    setTimeout(() => {
        toastEl.className = 'toast hidden';
    }, 3000);
}

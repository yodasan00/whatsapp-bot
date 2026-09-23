#!/bin/bash
set -e

echo "🚀 Starting WhatsApp Bot Update Deployment..."

# Ensure Node, npm, PM2, and Deno paths are in PATH for non-interactive SSH
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -n 1)/bin:$HOME/.deno/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

# 1. Pull latest changes
echo "📥 Pulling latest code from git..."
git pull origin main

# 2. Ensure log directory exists
mkdir -p logs

# 3. Install Node dependencies (production only, memory friendly)
echo "📦 Installing Node dependencies..."
npm install --omit=dev --no-audit --no-fund

# 4. Setup Python Virtual Environment and dependencies
echo "🐍 Updating Python dependencies..."
if [ ! -d "music-service/.venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv music-service/.venv
fi

source music-service/.venv/bin/activate
pip install --no-cache-dir -r music-service/requirements.txt
deactivate

# 5. Ensure Deno is installed (for yt-dlp signature decryption)
if ! command -v deno &> /dev/null; then
    echo "🦕 Installing Deno..."
    curl -fsSL https://deno.land/x/install/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
fi

# 6. Clean up any orphaned microservice process on port 5005
echo "💀 Freeing microservice port 5005..."
fuser -k 5005/tcp 2>/dev/null || true

# 7. Restart via PM2
echo "🔄 Reloading PM2 process..."
if pm2 list | grep -q "yaadobot"; then
    pm2 reload ecosystem.config.js || pm2 restart ecosystem.config.js
elif pm2 list | grep -q "bot"; then
    pm2 delete bot || true
    pm2 start ecosystem.config.js
else
    pm2 start ecosystem.config.js
fi

pm2 save

echo "✅ Deployment successful! Yaadobot is up and running."

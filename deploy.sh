#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Starting WhatsApp Bot Deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code from git..."
git pull

# 2. Install Node dependencies
echo "📦 Installing Node dependencies..."
npm install

# 3. Setup Python Virtual Environment and dependencies
echo "🐍 Updating Python dependencies..."
if [ ! -d "music-service/.venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv music-service/.venv
fi

# Activate virtual environment
source music-service/.venv/bin/activate

# Install requirements
pip install --upgrade pip
pip install -r music-service/requirements.txt

# Deactivate virtual env
deactivate

# 4. Ensure Deno is installed (for yt-dlp signature decryption)
if ! command -v deno &> /dev/null; then
    echo "🦕 Installing Deno..."
    curl -fsSL https://deno.land/x/install/install.sh | sh
    # Add Deno to local path if not present
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
fi

# 5. Restart PM2 Process
echo "💀 Killing any orphaned python microservice processes on port 5005..."
fuser -k 5005/tcp || true

echo "🔄 Restarting bot via PM2..."
if pm2 list | grep -q "bot"; then
    pm2 restart bot
else
    pm2 start index.js --name "bot"
fi

pm2 save

echo "✅ Deployment successful! Bot is up and running."

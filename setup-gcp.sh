#!/bin/bash
# ==============================================================================
# Yaadobot — Google Cloud Platform (GCP) Free Tier Initializer
# Designed for e2-micro (1 GB RAM, Ubuntu 22.04 / 24.04 LTS)
# ==============================================================================

set -e

echo "🚀 Starting Google Cloud VM setup for Yaadobot..."

# 1. Configure 4GB Swap Space (CRITICAL for e2-micro 1GB RAM)
if [ ! -f /swapfile ]; then
    echo "💾 Creating 4GB Swap file to prevent Out-Of-Memory (OOM) crashes..."
    sudo fallocate -l 4G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=4096
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    # Optimize swappiness for persistent server
    sudo sysctl vm.swappiness=20
    echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
    echo "✅ Swap configured successfully:"
    free -h
else
    echo "✅ Swap file already exists."
fi

# 2. Update System Packages
echo "🔄 Updating apt packages..."
sudo apt update && sudo apt upgrade -y

# 3. Install Core Tools (Python3, venv, ffmpeg, poppler-utils, git, curl)
echo "📦 Installing system dependencies..."
sudo apt install -y curl git python3 python3-pip python3-venv ffmpeg poppler-utils unzip psmisc

# 4. Install Node.js 20 LTS
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 5. Install Deno (required for yt-dlp YouTube challenge solving)
if ! command -v deno &> /dev/null; then
    echo "🦕 Installing Deno..."
    curl -fsSL https://deno.land/x/install/install.sh | sh
    export DENO_INSTALL="$HOME/.deno"
    export PATH="$DENO_INSTALL/bin:$PATH"
    echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
    echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
fi

# 6. Install PM2 Globally
if ! command -v pm2 &> /dev/null; then
    echo "⚡ Installing PM2 Process Manager..."
    sudo npm install -g pm2
fi

# 7. Setup Python Microservice Environment
echo "🐍 Setting up Python Virtual Environment..."
if [ ! -d "music-service/.venv" ]; then
    python3 -m venv music-service/.venv
fi
source music-service/.venv/bin/activate
pip install --upgrade pip
pip install -r music-service/requirements.txt
deactivate

# 8. Install Node Dependencies
echo "📦 Installing Node dependencies..."
npm install

# 9. Create logs directory
mkdir -p logs

echo "=============================================================================="
echo "🎉 Setup complete! Next steps:"
echo "1. Create your .env file:  nano .env"
echo "2. Start the bot:          pm2 start ecosystem.config.js"
echo "3. View QR code:           pm2 logs yaadobot"
echo "4. Enable auto-restart:    pm2 startup && pm2 save"
echo "=============================================================================="

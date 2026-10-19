#!/bin/bash
# ==============================================================================
# Yaadobot — Raspberry Pi 4B Setup Script
# Optimized for Raspberry Pi OS 64-bit / Ubuntu Server (ARM64 / aarch64)
# ==============================================================================

set -e

echo "🍓 Starting Raspberry Pi 4B setup for Yaadobot..."

# 1. Architecture Check (ARM64 / aarch64)
ARCH=$(uname -m)
echo "🔍 Detected architecture: $ARCH"
if [ "$ARCH" != "aarch64" ] && [ "$ARCH" != "arm64" ]; then
    echo "⚠️  WARNING: You are running a 32-bit OS ($ARCH)."
    echo "    Node.js 20, Deno (for YouTube player scripts), and Sharp/rembg work best on 64-bit (aarch64)."
    echo "    If possible, flash 'Raspberry Pi OS (64-bit)' for maximum compatibility."
fi

# 2. Configure Swap Space (Crucial for Pi 4B during media transcoding / rembg)
if command -v dphys-swapfile &> /dev/null && [ -f /etc/dphys-swapfile ]; then
    echo "💾 Adjusting dphys-swapfile to 2048MB..."
    CURRENT_SWAP=$(grep "^CONF_SWAPSIZE=" /etc/dphys-swapfile | cut -d'=' -f2)
    if [ "$CURRENT_SWAP" -lt 2048 ] 2>/dev/null; then
        sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
        sudo /etc/init.d/dphys-swapfile restart || sudo systemctl restart dphys-swapfile
        echo "✅ Swap resized via dphys-swapfile to 2048MB."
    fi
elif [ ! -f /swapfile ] && [ ! -f /etc/dphys-swapfile ]; then
    echo "💾 Creating 2GB swap file to prevent OOM spikes..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    sudo sysctl vm.swappiness=20
    echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
    echo "✅ 2GB swapfile created."
else
    echo "✅ Swap space already configured."
fi
free -h

# 3. Update System Packages
echo "🔄 Updating apt packages..."
sudo apt update && sudo apt upgrade -y

# 4. Install Core Tools & Build Dependencies
echo "📦 Installing system dependencies (ffmpeg, poppler-utils, python3-venv, etc.)..."
sudo apt install -y curl git python3 python3-pip python3-venv ffmpeg poppler-utils unzip psmisc build-essential libvips-dev

# 5. Install Node.js 20 LTS (ARM64 supported)
if ! command -v node &> /dev/null; then
    echo "🟢 Installing Node.js 20.x LTS via NodeSource..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi
echo "Node version: $(node -v)"
echo "NPM version:  $(npm -v)"

# 6. Install Deno (required for yt-dlp YouTube signature deciphering on ARM64)
if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    if ! command -v deno &> /dev/null; then
        echo "🦕 Installing Deno for ARM64..."
        curl -fsSL https://deno.land/x/install/install.sh | sh
        export DENO_INSTALL="$HOME/.deno"
        export PATH="$DENO_INSTALL/bin:$PATH"
        if ! grep -q 'DENO_INSTALL' ~/.bashrc 2>/dev/null; then
            echo 'export DENO_INSTALL="$HOME/.deno"' >> ~/.bashrc
            echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
        fi
    fi
else
    echo "ℹ️  Skipping standard Deno install on 32-bit ($ARCH)."
fi

# 7. Install PM2 Globally
if ! command -v pm2 &> /dev/null; then
    echo "⚡ Installing PM2 Process Manager..."
    sudo npm install -g pm2
fi

# 8. Setup Python Microservice Environment
echo "🐍 Setting up Python Virtual Environment in music-service..."
if [ ! -d "music-service/.venv" ]; then
    python3 -m venv music-service/.venv
fi
source music-service/.venv/bin/activate
pip install --upgrade pip
pip install -r music-service/requirements.txt
deactivate

# 9. Install Node Dependencies
echo "📦 Installing Node dependencies..."
npm install

# 10. Create logs directory
mkdir -p logs

echo "=============================================================================="
echo "🎉 Raspberry Pi 4B setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure .env:        nano .env"
echo "   (Set WEB_URL to your Pi's IP or Cloudflare tunnel, e.g. http://$(hostname -I | awk '{print $1}'):3000)"
echo "2. Start the bot:          pm2 start ecosystem.config.js"
echo "3. Scan WhatsApp QR code:  pm2 logs yaadobot"
echo "4. Enable boot autostart:  pm2 startup && pm2 save"
echo "=============================================================================="

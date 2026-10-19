# 🍓 Raspberry Pi 4B Deployment Guide for Yaadobot

Moving your bot from Google Cloud to a **Raspberry Pi 4B** is a massive upgrade:
- 🚫 **No cloud billing or credit card surprises**
- 🚀 **More RAM**: Pi 4B has 2GB, 4GB, or 8GB of RAM (GCP e2-micro only had 1GB)
- 🔌 **Ultra-low power**: Consumes ~3–5 Watts (~$0.50/month in electricity)
- 🛡️ **Full ownership**: Your WhatsApp credentials and session stay 100% on your own hardware

---

## 📋 Prerequisites & Hardware Checklist

| Requirement | Recommendation | Note |
| :--- | :--- | :--- |
| **Board** | **Raspberry Pi 4 Model B** | 2GB, 4GB, or 8GB RAM |
| **OS** | **Raspberry Pi OS (64-bit)** or **Ubuntu Server 24.04 (64-bit)** | ⚠️ **Must be 64-bit (aarch64)** for Node 20, Sharp, rembg, and Deno |
| **Power Supply** | Official 5.1V / 3.0A USB-C Power Supply | Prevents undervoltage CPU throttling |
| **Storage** | 32GB+ Class 10 / A1 MicroSD or USB 3.0 SSD | SSD over USB 3.0 is even faster and more durable |
| **Cooling** | Aluminum heatsink case or active fan | Keeps CPU cool during video conversions and rembg tasks |

---

## 💽 Step 1: Flash 64-bit OS

1. Download and open [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Choose Device: **Raspberry Pi 4**.
3. Choose OS: **Raspberry Pi OS (other)** ➔ **Raspberry Pi OS (64-bit)** (or Ubuntu Server 24.04 LTS 64-bit).
4. Click **Next** and click **Edit Settings**:
   * Set hostname: `yaadobot` (or `raspberrypi`)
   * Set username and password (e.g. `pi`)
   * Configure your Wi-Fi credentials
   * Under the **Services** tab: Check **Enable SSH** (use password or public key)
5. Flash the SD card and insert it into your Pi 4B. Power it on!

---

## 💻 Step 2: Connect to your Raspberry Pi

Find your Pi's IP address from your home router or connect using the hostname:
```bash
ssh pi@yaadobot.local
# or
ssh pi@<YOUR-PI-LOCAL-IP>
```

---

## 📦 Step 3: Clone Repository & Run Automated Setup

1. Clone your bot repository onto the Pi:
```bash
git clone <YOUR-REPOSITORY-URL>
cd whatsapp-bot
```

2. Run the automated Raspberry Pi setup script:
```bash
chmod +x setup-rpi.sh
./setup-rpi.sh
```

### What `setup-rpi.sh` automatically configures:
- ✅ Checks 64-bit ARM architecture (`aarch64`)
- ✅ Increases swap memory to 2GB to prevent any memory bottlenecks during heavy media processing
- ✅ Installs system packages: `ffmpeg`, `poppler-utils`, `python3-venv`, `build-essential`, `libvips-dev`
- ✅ Installs Node.js 20 LTS (ARM64)
- ✅ Installs Deno (needed by yt-dlp to bypass YouTube cipher challenges)
- ✅ Installs PM2 process manager globally
- ✅ Sets up Python virtual environment in `music-service/.venv` and installs `yt-dlp`, `rembg`, `flask`
- ✅ Installs all Node dependencies cleanly

---

## ⚙️ Step 4: Configure `.env`

Create your `.env` configuration:
```bash
nano .env
```

Paste your configuration:
```env
# AI Keys
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# Web URL: Local IP or Cloudflare Tunnel (see Step 7)
WEB_URL=http://<YOUR-PI-LOCAL-IP>:3000
OWNER_NUMBER=91XXXXXXXXXX
PORT=3000

# Optional SMTP Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
NOTIFICATION_EMAIL=
```
Save with `Ctrl+O`, `Enter`, and exit with `Ctrl+X`.

---

## 🚀 Step 5: Start Yaadobot with PM2

Launch the bot with PM2:
```bash
pm2 start ecosystem.config.js
```

### Scan the WhatsApp QR Code:
```bash
pm2 logs yaadobot
```
1. Open WhatsApp on your phone ➔ **Settings** ➔ **Linked Devices** ➔ **Link a Device**.
2. Scan the QR code displayed right inside your SSH terminal.
3. Once connected, press `Ctrl+C` to exit logs (the bot stays running 24/7 in background).

### Enable Autostart on Boot:
To ensure the bot starts automatically if power blinks or the Pi reboots:
```bash
pm2 startup
```
*(Copy and run the `sudo env PATH=...` command printed on your screen if prompted)*, then run:
```bash
pm2 save
```

---

## 🌐 Step 6: Accessing Web Shop & Cookie Manager from Outside Home

Since your Pi is running on your home network, you have two options to access port `3000`:

### Option A: Cloudflare Tunnel (Recommended — Free & 100% Secure)
You do **not** need to open any ports on your home router, and it gives you a free HTTPS address:

1. Install `cloudflared` on your Pi:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
   sudo dpkg -i cloudflared.deb
   ```
2. Quick test tunnel (instant temporary HTTPS URL):
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
3. Copy the generated `https://<random>.trycloudflare.com` URL into `WEB_URL=` in your `.env` file!

*(Or configure a permanent custom domain via Cloudflare Zero Trust Dashboard for free).*

### Option B: Local Network Only
If you only need the Web Shop while connected to your home Wi-Fi:
- Set `WEB_URL=http://<PI-LOCAL-IP>:3000` (e.g. `http://192.168.1.50:3000`).

---

## 🔄 Step 7: Updating Code in the Future

Whenever you push new code to your Git repository, update your Pi with one command:
```bash
chmod +x deploy.sh
./deploy.sh
```
This pulls new code, refreshes dependencies, and restarts PM2 without losing your WhatsApp login session!

---

## 💡 Pi 4B Tips for Peak Reliability

1. **Keep it cool**: Under video rendering (`ffmpeg`) or background removal (`rembg`), the quad-core CPU will work hard. An inexpensive aluminum case (like the Flirc case or dual-fan armor case) keeps temperatures under 55°C.
2. **Back up your `auth/` directory**: Your WhatsApp credentials live in `./auth/`. Copy this folder to your PC occasionally so you never have to re-scan.
3. **Check status anytime**:
   ```bash
   pm2 status
   pm2 logs yaadobot --lines 100
   ```

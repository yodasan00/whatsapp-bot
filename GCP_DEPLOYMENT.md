# ☁️ Google Cloud Platform (GCP) Free Tier Deployment Guide

This guide walks you through deploying **Yaadobot** permanently on **Google Cloud's "Always Free" Compute Engine** tier ($0/month).

---

## 💎 GCP "Always Free" Eligibility Rules

To ensure your server remains **100% Free** without billing surprises, configure these exact settings:

| Setting | Required Value for Free Tier | Caution |
| :--- | :--- | :--- |
| **Instance Type** | **`e2-micro`** (2 vCPUs, 1 GB RAM) | Other sizes (e.g. `e2-medium`) will be billed! |
| **Region** | **`us-central1`** (Iowa), **`us-east1`** (South Carolina), or **`us-west1`** (Oregon) | Any other region (Asia, Europe) is **NOT** free! |
| **Boot Disk Type**| **Standard Persistent Disk** | Do **NOT** choose SSD or Balanced disk! |
| **Disk Size** | **30 GB** | Up to 30GB standard disk per month is free. |
| **OS** | **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS** (x86/64) | |

---

## 🚀 Step 1: Create the VM Instance

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **Compute Engine** ➔ **VM Instances** ➔ click **Create Instance**.
3. Configure the VM:
   * **Name**: `yaadobot-server`
   * **Region**: `us-central1` (Iowa) | **Zone**: `us-central1-a` (or `b`/`c`/`f`)
   * **Series**: `E2`
   * **Machine type**: `e2-micro` (2 vCPU, 1 GB memory)
4. Under **Boot disk**, click **Change**:
   * **Operating System**: `Ubuntu`
   * **Version**: `Ubuntu 24.04 LTS` (or `22.04 LTS`)
   * **Boot disk type**: Select **Standard persistent disk** (⚠️ Essential for Free Tier)
   * **Size (GB)**: `30`
   * Click **Select**.
5. Under **Firewall**:
   * Check **Allow HTTP traffic**
   * Check **Allow HTTPS traffic**
6. Under **Advanced options** ➔ **Networking** ➔ **Network tags**:
   * Add the tag: `yaadobot`
7. Click **Create**.

---

## 🛡️ Step 2: Open Port 3000 in GCP Firewall

GCP blocks non-standard incoming ports by default. Open port `3000` for the Web Shop and Cookie Manager:

1. In the search bar, type **Firewall** (under *VPC Network* ➔ *Firewall*).
2. Click **Create Firewall Rule**:
   * **Name**: `allow-yaadobot-web`
   * **Targets**: **Specified target tags**
   * **Target tags**: `yaadobot`
   * **Source IPv4 ranges**: `0.0.0.0/0`
   * **Protocols and ports**: Check **Specified protocols and ports** ➔ check **TCP** ➔ enter `3000`
3. Click **Create**.

*(Alternatively, via Cloud Shell / CLI)*:
```bash
gcloud compute firewall-rules create allow-yaadobot-web \
    --direction=INGRESS --priority=1000 --network=default --action=ALLOW \
    --rules=tcp:3000 --source-ranges=0.0.0.0/0 --target-tags=yaadobot
```

---

## 📌 Step 3: Reserve a Static External IP (Recommended)

1. Navigate to **VPC Network** ➔ **IP addresses**.
2. Find your instance's External IP and click **Reserve static address**.
3. Name it `yaadobot-ip`.
*(Note: A reserved static external IP is completely free as long as it remains attached to a running VM instance).*

---

## 💻 Step 4: Connect via SSH and Run Initializer

1. In the **VM Instances** list, click the **SSH** button next to `yaadobot-server`.
2. Clone your repository:
   ```bash
   git clone <YOUR_GIT_REPOSITORY_URL>
   cd whatsapp-bot
   ```
3. Run the automated GCP setup script:
   ```bash
   chmod +x setup-gcp.sh
   ./setup-gcp.sh
   ```
   > [!IMPORTANT]
   > `setup-gcp.sh` automatically configures a **4GB Swap file**. Because the `e2-micro` only has 1GB of physical RAM, swap space is **mandatory** to run Node.js, Baileys, and the Python media service simultaneously without triggering Linux Out-Of-Memory (OOM) crashes.

---

## ⚙️ Step 5: Configure Environment (`.env`)

Create your `.env` file on the server:
```bash
nano .env
```
Paste your configuration (replace `<YOUR-GCP-EXTERNAL-IP>` with your VM's public IP):
```env
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
WEB_URL=http://<YOUR-GCP-EXTERNAL-IP>:3000
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
Press `Ctrl+O`, `Enter` to save, and `Ctrl+X` to exit.

---

## 🚀 Step 6: Start the Bot with PM2

Start the bot using the pre-configured production process manager:
```bash
pm2 start ecosystem.config.js
```

### Scan the WhatsApp QR Code:
To view the QR code in your terminal:
```bash
pm2 logs yaadobot
```
1. Open **WhatsApp** on your phone.
2. Tap **Settings** ➔ **Linked Devices** ➔ **Link a Device**.
3. Scan the terminal QR code.
4. Press `Ctrl+C` to exit the log view (the bot will keep running in the background).

### Enable 24/7 Autostart on Server Reboot:
Run these two commands so PM2 automatically starts Yaadobot if GCP restarts the VM:
```bash
pm2 startup
# (Copy and run the command printed on your screen if prompted)
pm2 save
```

---

## 🔄 How to Push Updates Later

Whenever you make code changes locally and push to Git, update your server cleanly with:
```bash
chmod +x deploy.sh
./deploy.sh
```
The script will pull the latest code, update dependencies, and reload PM2 without losing your WhatsApp login session!

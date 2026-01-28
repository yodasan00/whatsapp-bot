# 🚀 WhatsApp Bot Deployment Guide (AWS)

## Option 1: Quick & Easy (Manual EC2)
Great for starting out. You just run a virtual computer in the cloud and run your bot on it.

1.  **Launch Instance**:
    *   Go to AWS Console -> EC2 -> Launch Instance.
    *   OS: **Ubuntu 24.04** (Free Tier eligible).
    *   Instance Type: **t3.micro** or **t2.micro** (Free Tier).
    *   Security Group: Allow SSH (22) and TCP (3000) for the website.

2.  **Connect**:
    *   SSH into your instance: `ssh -i key.pem ubuntu@<your-ip>`

3.  **Setup Environment**:
    ```bash
    # Update
    sudo apt update && sudo apt upgrade -y
    
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Install Git & Process Manager (PM2)
    sudo apt install -y git
    sudo npm install -g pm2
    ```

4.  **Clone & Run**:
    ```bash
    git clone <your-repo-url>
    cd whatsapp-bot
    npm install
    
    # Create .env file with your variables
    nano .env 
    # (Paste your contents, set WEB_URL=http://<your-ec2-ip>:3000)
    
    # Start with PM2 (keeps it running)
    pm2 start index.js --name "bot"
    pm2 save
    pm2 startup
    ```

## Option 2: Docker (Professional)
Better for stability and scaling.

1.  **Build Image**:
    ```bash
    docker build -t whatsapp-bot .
    ```

2.  **Run Container**:
    ```bash
    docker run -d \
      -p 3000:3000 \
      -v $(pwd)/auth:/usr/src/app/auth \  # Persist login session
      --env-file .env \
      --name my-bot \
      whatsapp-bot
    ```

## ⚠️ Important: Persistent Session
*   **The `auth` folder contains your login session.**
*   If you delete this folder, you will have to scan the QR code again.
*   In Docker, we use `-v $(pwd)/auth:/usr/src/app/auth` to save this folder to your host machine so it survives restarts.

## 🌐 Web Shop
*   Your shop will be running on port `3000`.
*   Ensure your AWS Security Group **allows Inbound traffic on Port 3000**.
*   Update your `.env` file: `WEB_URL=http://<your-public-ip>:3000` (or your domain).

# Yaadobot 🤖

```text
 __     __              _       _           _   
 \ \   / /__ _  __ _  __| | ___ | |__   ___ | |_ 
  \ \ / / _` |/ _` |/ _` |/ _ \| '_ \ / _ \| __|
   \ V / (_| | (_| | (_| | (_) | |_) | (_) | |_ 
    \_/ \__,_|\__,_|\__,_|\___/|_.__/ \___/ \__|
                                                 
   [ DYNAMIC AI CHATBOT & RETRO RPG ECONOMY ]
```

Most WhatsApp bots are **boring** and **spammy**. They only serve basic utility commands, clutter group chats with ugly system text, and offer absolutely zero reasons to keep interacting with them.

This bot is different. **Yaadobot** is an active, slightly chaotic, and highly interactive member of your group chat. It chatters like a real person, hosts a full-blown RPG economy (with a beautiful web dashboard you can access via DM), lets users bet their hard-earned XP on slots, and even lets group members plant a ticking `.timebomb` on each other. It’s built to make chats alive again.

---

## ✨ Features

*   **💬 Casual AI Chats:** Powered by OpenRouter/Gemini, Yaadobot doesn't talk like a formal assistant. It acts like a chill, witty Discord friend. Reply to someone with `.roast` and it will analyze their recent chat history to playfully tease them. Reply with `.judge` for a humorous verdict on a quote.
*   **🎮 Interactive Arcade:** Full simulation games. Try `.slots` (Cherry, Lemon, 7️⃣ Jackpot), `.roulette` (bet colors/numbers), `.dice`, or challenging the bot in `.rps`. 
*   **💣 Timebomb Chaos:** Plant a ticking bomb with `.timebomb`. You have exactly 60 seconds to tag someone else using `.pass @user` before it explodes on you and drains 100 XP from your wallet. Tick tock.
*   **💰 RPG Economy & Web Shop:** Earn XP from daily chat activities, trivia, or by running `.beg`, `.dig`, or `.fish`. Type `.shop` and the bot will DM you a unique tokenized link to a premium, dark-mode shop dashboard where you can buy/sell items or check your collection!
*   **🎁 Group Events:** Spontaneous pop-up quizzes, word unscrambles, math speedruns, and the rare **Mystery Box** drop (type `steal` first to grab it!) that keep active chats competitive.
*   **🎵 Media on Demand:** Stream movies instantly with `.watch` (returns a vidsrc streaming embed link complete with poster art via IMDb suggestions) or request MP3s/Voice Notes using `.play` and `.plays`.

---

## 🛠️ Tech Stack

*   **Core API:** Node.js (v20+), built on the modern `@whiskeysockets/baileys` multi-device library.
*   **AI Models:** OpenRouter API (utilizing free, high-performance LLMs) and Google's Gemini SDK.
*   **Media Processing:** `@distube/ytdl-core`, `play-dl`, `yt-search`, and Google Image Search (`g-i-s`).
*   **Web Dashboard:** Served via Express.js, featuring a clean HTML5/CSS Grid Glassmorphism front-end.

---

## 🚀 Quick Setup

### 1. Configure Environment (`.env`)
Create a `.env` file in the root directory:
```env
OPENROUTER_API_KEY=your_key
GEMINI_API_KEY=your_key
WEB_URL=http://your-ec2-ip:3000
OWNER_NUMBER=91XXXXXXXXXX
PORT=3000
```

### 2. Install & Fire Up
```bash
npm install
npm start
```
*Scan the terminal QR code using WhatsApp -> Linked Devices on your phone to link.*

---

## 🐋 Docker Setup

We containerized this bot so you can deploy it in 20 seconds.

1. **Build Image:**
   ```bash
   docker build -t whatsapp-bot .
   ```
2. **Spin Up Container (Crucial: map the `auth` volume so you don't keep getting logged out on every restart!):**
   ```bash
   docker run -d \
     -p 3000:3000 \
     -v $(pwd)/auth:/usr/src/app/auth \
     --env-file .env \
     --name my-whatsapp-bot \
     whatsapp-bot
   ```

---

## 📜 License
Licensed under the ISC License. Check out [DEPLOYMENT.md](file:///d:/Whatapp_bot/whatsapp-bot/DEPLOYMENT.md) for full AWS EC2 production hosting steps.

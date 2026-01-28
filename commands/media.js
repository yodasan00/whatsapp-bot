const axios = require('axios')

const commands = {
    watch: async ({ sock, jid, args }) => {
        if (!args.length) {
            await sock.sendMessage(jid, { text: '🎬 Usage: .watch <movie/show name>' })
            return
        }

        const query = args.join(' ')
        const cleanQuery = query.toLowerCase().trim()
        const firstChar = cleanQuery.charAt(0).toLowerCase()
        
        // Handle non-alphanumeric first chars (IMDb uses 'x' or 'other' sometimes, but 'other' is safe? 
        // Actually, let's just encoding is easier.
        // IMDb API is sensitive to path.
        // https://v2.sg.media-imdb.com/suggestion/m/matrix.json
        // If it's a number '1917', it uses '1'. 
        // If it's a specific symbol, it might fail. Let's try to stick to safe chars.
        
        if (!/[a-z0-9]/.test(firstChar)) {
             await sock.sendMessage(jid, { text: '❌ Start with a letter or number.' })
             return
        }

        try {
            const url = `https://v2.sg.media-imdb.com/suggestion/${firstChar}/${encodeURIComponent(query)}.json`
            
            const res = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            })

            const suggestions = res.data?.d || []
            
            // Filter for exact matches or fuzzy
            // We select the first "feature" (movie) or "TV series"
            
            const match = suggestions.find(item => item.qid === 'movie' || item.qid === 'tvSeries')

            if (!match) {
                await sock.sendMessage(jid, { text: '😔 No movie or TV show found.' })
                return
            }

            const isMovie = match.qid === 'movie'
            const type = isMovie ? 'movie' : 'tv'
            const id = match.id // tt123456
            const title = match.l
            const year = match.y
            const image = match.i?.imageUrl

            // Construct VidSrc URL
            // https://vidsrc.cc/v2/embed/movie/tt123456
            const streamUrl = `https://vidsrc.cc/v2/embed/${type}/${id}`
            
            let caption = `🎬 *${title}* (${year})\n\n`
            caption += `🍿 *Watch Link:*\n${streamUrl}\n\n`
            caption += `⚠️ _Third-party link. Use an AdBlocker!_`

            if (image) {
                // Send image with caption using a buffer to avoid "url not supported" issues occasionally
                // But generally url works for images
                await sock.sendMessage(jid, { 
                    image: { url: image },
                    caption: caption
                })
            } else {
                await sock.sendMessage(jid, { text: caption })
            }

        } catch (err) {
            console.error('Watch command error:', err.message)
            await sock.sendMessage(jid, { text: '⚠️ Error searching for content.' })
        }
    }
}

async function handleMediaCommand({ command, args, sock, jid, sender }) {
    const handler = commands[command]
    if (handler) {
        await handler({ sock, jid, args, sender })
        return true
    }
    return false
}

module.exports = { handleMediaCommand }

const axios = require('axios');

async function testPinterest(query) {
    const url = `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query)}`;
    console.log(`Fetching ${url}...`);
    try {
        const { data } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        
        // Pinterest stores data in a script tag with id "__PWS_DATA__" or similar
        const scriptMatch = data.match(/<script id="__PWS_DATA__"[^>]*>([\s\S]*?)<\/script>/);
        
        if (scriptMatch && scriptMatch[1]) {
            try {
                const jsonString = scriptMatch[1];
                console.log('JSON String length:', jsonString.length);
                console.log('JSON Start:', jsonString.slice(0, 500)); 

                // Broad regex for ANY pinimg url
                const broadRegex = /https:\/\/i\.pinimg\.com\/[^"]+\.jpg/g;
                const matches = jsonString.match(broadRegex);
                
                if (matches) {
                    // Filter for 'originals' or at least '564x' or '736x' (common high res) to avoid tiny thumbs
                    const niceImages = matches.filter(u => u.includes('originals') || u.includes('736x') || u.includes('564x'));
                    console.log(`Found ${matches.length} total images, ${niceImages.length} nice ones.`);
                    
                    if (niceImages.length > 0) {
                         const unique = [...new Set(niceImages)];
                         console.log('Sample URLs:', unique.slice(0, 5));
                    } else if (matches.length > 0) {
                        console.log('Only found these (maybe thumbs):', matches.slice(0, 5));
                    }
                } else {
                    console.log('Absolutely no pinterest images found in the string.');
                }
                
            } catch (e) {
                console.error('Failed to parse JSON:', e);
            }
        } else {
            console.log('No PWS_DATA script found.');
             // Check if we got a login page or captcha
             if (data.includes('Login')) console.log('Hit Login page');
        }
    } catch (e) {
        console.error('Error fetching Pinterest:', e.message);
    }
}

testPinterest('cyberpunk city');

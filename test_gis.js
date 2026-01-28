const gis = require('g-i-s');

async function testGIS(query) {
    console.log(`Searching Google Images for: ${query}`);
    gis(query, (error, results) => {
        if (error) {
            console.error('GIS Error:', error);
        } else {
            console.log(`Found ${results.length} images.`);
            // Filter for decent sized ones if possible, though results usually just have url, width, height
            console.log('Sample result:', results[0]);
            
            const urls = results.slice(0, 5).map(r => r.url);
            console.log('URLs:', urls);
        }
    });
}

testGIS('cyberpunk city');

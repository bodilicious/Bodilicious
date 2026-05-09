const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const URL = require('url');
const google = require('googlethis');

const ingredients = [
    "Niacinamide 5%", "Titanium Dioxide", "Zinc Oxide", "Retinol", "Rice Water", "Panthenol",
    "Ethyl Ascorbic Acid", "Alpha Arbutin", "Hyaluronic Acid", "Aloe Vera", "Salicylic Acid",
    "Neem", "Green Tea", "Peptides", "Ceramides", "Collagen Complex", "Rose Extract",
    "Cucumber", "Saffron", "Goat Milk", "Shea Butter", "Kokum Butter", "Argireline",
    "Ashwagandha", "Milk Protein", "Wheat Protein", "Rice Extract", "Bhringraj", "Amla",
    "Hibiscus", "Shikakai", "Glycolic Acid", "Centella Asiatica", "Azelaic Acid", "Glycerin",
    "Squalane", "Olive Oil", "Carrot Extract", "Lavender Oil", "Kaolin Clay", "Keratin Protein", "Beetroot Extract"
];

const destDir = path.join(__dirname, 'frontend', 'public', 'ingredients');
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

function downloadImage(urlStr, filepath) {
    return new Promise((resolve, reject) => {
        const parsedUrl = URL.parse(urlStr);
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.path,
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        const req = (parsedUrl.protocol === 'https:' ? https : http).get(options, (res) => {
            if (res.statusCode === 200) {
                let contentType = res.headers['content-type'];
                if (contentType && contentType.startsWith('image/')) {
                    const file = fs.createWriteStream(filepath);
                    res.pipe(file);
                    file.on('finish', () => {
                        file.close(resolve);
                    });
                } else {
                    reject(new Error(`Not an image. Type: ${contentType}`));
                }
            } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                // Handle redirect
                downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
            } else {
                reject(new Error(`Status Code: ${res.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });

        req.setTimeout(5000, () => {
            req.abort();
            reject(new Error("Timeout"));
        });
    });
}

async function main() {
    for (let i = 0; i < ingredients.length; i++) {
        const ing = ingredients[i];
        const fileName = ing.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.jpg';
        const filePath = path.join(destDir, fileName);

        if (fs.existsSync(filePath)) {
            console.log(`Already have ${fileName}`);
            continue;
        }

        try {
            console.log(`Searching for: ${ing}`);
            const images = await google.image(`${ing} aesthetic luxury skincare beauty`, { safe: false });

            let downloaded = false;
            for (let j = 0; j < Math.min(images.length, 5); j++) {
                const url = images[j].url;
                try {
                    await downloadImage(url, filePath);
                    console.log(`Successfully downloaded ${fileName} from ${url}`);
                    downloaded = true;
                    break;
                } catch (e) {
                    console.log(`Failed to download from ${url}: ${e.message}`);
                }
            }

            if (!downloaded) {
                console.log(`Could not download any image for ${ing}`);
            }

            // Delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 1000));
        } catch (e) {
            console.log(`Search failed for ${ing}: ${e.message}`);
        }
    }
}

main();

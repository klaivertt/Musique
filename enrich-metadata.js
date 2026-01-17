const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = 'https://music.apple.com/fr/playlist/one/pl.u-11zBJy3sNDW3q3q';
const PLAYLIST_FILE = path.join(__dirname, 'playlist.json');

// Délais aléatoires
function randomDelay(min = 1000, max = 3000) {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

async function enrichMetadata() {
    console.log('🚀 Enrichissement des métadonnées (genres et années)...');
    
    // Charger la playlist
    const data = JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8'));
    console.log(`📊 Total de pistes: ${data.tracks.length}`);
    
    // Filtrer les pistes à enrichir
    const tracksToEnrich = data.tracks.filter(track => 
        track.genre === 'Non spécifié' || track.year === 2026
    );
    
    console.log(`🔍 Pistes à enrichir: ${tracksToEnrich.length}`);
    
    if (tracksToEnrich.length === 0) {
        console.log('✅ Aucune piste à enrichir!');
        return;
    }

    let browser;
    
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--window-size=1920,1080'
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();
        
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
        await page.setUserAgent(userAgent);
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            window.chrome = { runtime: {} };
        });

        let enrichedCount = 0;

        for (let i = 0; i < Math.min(tracksToEnrich.length, 50); i++) {
            const track = tracksToEnrich[i];
            
            console.log(`\n[${i + 1}/${Math.min(tracksToEnrich.length, 50)}] 🎵 "${track.title}" - ${track.artist}`);
            
            try {
                // Construire une requête de recherche
                const searchQuery = `${track.title} ${track.artist}`.replace(/[^\w\s]/gi, ' ').trim();
                const searchUrl = `https://music.apple.com/fr/search?term=${encodeURIComponent(searchQuery)}`;
                
                console.log(`  🔎 Recherche: ${searchUrl}`);
                
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
                await randomDelay(2000, 3000);

                // Chercher le premier résultat de chanson
                const songLink = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a[href*="/song/"]'));
                    return links.length > 0 ? links[0].href : null;
                });

                if (songLink) {
                    console.log(`  ✅ Chanson trouvée, consultation...`);
                    
                    await page.goto(songLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await randomDelay(1500, 2500);

                    // Extraire métadonnées
                    const metadata = await page.evaluate(() => {
                        let genre = null;
                        let year = null;

                        // Genre - chercher dans plusieurs endroits
                        const genreLink = document.querySelector('a[href*="/genre/"]');
                        if (genreLink) {
                            genre = genreLink.textContent.trim();
                        }

                        // Année - chercher dans le copyright
                        const bodyText = document.body.innerText;
                        
                        // Chercher ℗ YYYY ou © YYYY
                        let yearMatch = bodyText.match(/[℗©]\s*(19|20)\d{2}/);
                        if (yearMatch) {
                            year = parseInt(yearMatch[0].match(/\d{4}/)[0]);
                        } else {
                            // Chercher juste une année de 4 chiffres près de "Released"
                            yearMatch = bodyText.match(/Released.*?(19|20)\d{2}/i);
                            if (yearMatch) {
                                year = parseInt(yearMatch[0].match(/\d{4}/)[0]);
                            }
                        }

                        return { genre, year };
                    });

                    let updated = false;

                    if (metadata.genre && track.genre === 'Non spécifié') {
                        track.genre = metadata.genre;
                        console.log(`  ✅ Genre: ${metadata.genre}`);
                        updated = true;
                    }

                    if (metadata.year && track.year === 2026) {
                        track.year = metadata.year;
                        console.log(`  ✅ Année: ${metadata.year}`);
                        updated = true;
                    }

                    if (updated) {
                        enrichedCount++;
                        
                        // Sauvegarder tous les 5 enrichissements
                        if (enrichedCount % 5 === 0) {
                            fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data, null, 2), 'utf8');
                            console.log(`  💾 Sauvegarde intermédiaire (${enrichedCount} pistes enrichies)`);
                        }
                    } else {
                        console.log(`  ⚠️  Aucune métadonnée trouvée`);
                    }
                } else {
                    console.log(`  ❌ Aucun résultat trouvé`);
                }

                await randomDelay(1000, 2000);

            } catch (e) {
                console.error(`  ❌ Erreur: ${e.message}`);
            }
        }

        // Sauvegarde finale
        fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data, null, 2), 'utf8');

        console.log('\n═══════════════════════════════════════');
        console.log('✅ ENRICHISSEMENT TERMINÉ');
        console.log('═══════════════════════════════════════');
        console.log(`📈 Pistes enrichies: ${enrichedCount}`);
        console.log(`💾 Fichier sauvegardé: ${PLAYLIST_FILE}`);
        console.log('═══════════════════════════════════════');

        await browser.close();

    } catch (error) {
        console.error('\n❌ Erreur:', error.message);
        if (browser) await browser.close();
        throw error;
    }
}

enrichMetadata()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('❌ Script échoué:', err.message);
        process.exit(1);
    });

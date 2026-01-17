const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = 'https://music.apple.com/fr/playlist/one/pl.u-11zBJy3sNDW3q3q';
const OUTPUT_FILE = path.join(__dirname, 'playlist_one.json');
const BACKUP_FILE = path.join(__dirname, 'playlist_one_backup.json');

// Délais aléatoires pour simuler un comportement humain
function randomDelay(min = 1000, max = 3000) {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Charger les données existantes
function loadExistingData() {
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            console.log(`📦 Données existantes chargées: ${data.tracks?. length || 0} pistes`);
            return data;
        } catch (e) {
            console.warn('⚠️  Fichier JSON corrompu, reprise depuis zéro');
        }
    }
    return { name: '', description: '', tracks: [] };
}

// Sauvegarder progressivement
function saveProgress(data) {
    if (fs.existsSync(OUTPUT_FILE)) {
        fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Progression sauvegardée: ${data.tracks. length} pistes`);
}

// Convertir durée MM:SS en secondes
function durationToSeconds(duration) {
    const match = duration.match(/(\d+):(\d+)/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return 0;
}

// Extraire le genre et l'année depuis le HTML de la page
function extractMetadataFromHTML(html, trackTitle) {
    try {
        // Extraire l'année depuis les balises meta
        let year = null;
        
        // Chercher dans music: release_date
        const releaseDateMatch = html.match(/<meta property="music:release_date" content="(\d{4})-/);
        if (releaseDateMatch) {
            year = parseInt(releaseDateMatch[1]);
        }
        
        // Fallback: chercher dans datePublished du JSON-LD
        if (!year) {
            const datePublishedMatch = html.match(/"datePublished":"(\d{4})-/);
            if (datePublishedMatch) {
                year = parseInt(datePublishedMatch[1]);
            }
        }
        
        // Fallback: chercher ℗ YYYY ou © YYYY
        if (!year) {
            const copyrightMatch = html.match(/[℗©]\s*(19|20)\d{2}/);
            if (copyrightMatch) {
                year = parseInt(copyrightMatch[0]. match(/\d{4}/)[0]);
            }
        }
        
        // Extraire le genre depuis le JSON-LD schema
        let genre = 'Non spécifié';
        const schemaMatch = html.match(/<script id="schema: song" type="application\/ld\+json">([\s\S]*?)<\/script>/);
        
        if (schemaMatch) {
            try {
                const schema = JSON.parse(schemaMatch[1]);
                if (schema.audio && schema.audio.genre && Array.isArray(schema.audio. genre)) {
                    // Prendre le premier genre qui n'est pas "Musique"
                    const validGenres = schema.audio.genre.filter(g => g !== 'Musique' && g !== 'Music');
                    if (validGenres.length > 0) {
                        genre = validGenres[0];
                    }
                }
            } catch (e) {
                console.error(`  ⚠️  Erreur parsing JSON-LD pour ${trackTitle}`);
            }
        }
        
        return { genre, year };
    } catch (e) {
        console.error(`  ❌ Erreur extraction métadonnées pour ${trackTitle}:`, e.message);
        return { genre:  'Non spécifié', year: null };
    }
}

async function scrapePlaylist() {
    console.log('🚀 Lancement du scraper Apple Music amélioré...');
    console.log(`📝 URL:  ${PLAYLIST_URL}`);

    const existingData = loadExistingData();
    const startPosition = existingData.tracks.length;
    console.log(`🔄 Reprise depuis la piste ${startPosition + 1}`);

    let browser;
    
    try {
        console.log('🌐 Lancement du navigateur...');
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--window-size=1920,1080',
                '--start-maximized'
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();
        
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];
        await page.setUserAgent(userAgents[Math.floor(Math. random() * userAgents.length)]);
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
            window.chrome = { runtime: {} };
        });
        
        console.log('📄 Chargement de la page Apple Music...');
        await page.goto(PLAYLIST_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });

        await randomDelay(3000, 5000);
        await page.mouse.move(100, 100);
        await randomDelay(500, 1000);
        await page.mouse.move(500, 300);
        
        // Scroll progressif
        console.log('📜 Scroll progressif pour charger toutes les pistes...');
        let previousHeight = 0;
        let stableCount = 0;
        let totalScrolls = 0;
        const maxStable = 5;
        const maxScrolls = 100;

        while (stableCount < maxStable && totalScrolls < maxScrolls) {
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            
            if (currentHeight === previousHeight) {
                stableCount++;
            } else {
                stableCount = 0;
            }
            
            previousHeight = currentHeight;
            totalScrolls++;
            
            const scrollAmount = 250 + Math.random() * 400;
            await page.evaluate((amount) => {
                window.scrollBy({
                    top: amount,
                    behavior: 'smooth'
                });
            }, scrollAmount);
            
            await randomDelay(1200, 2500);
            
            if (totalScrolls % 10 === 0) {
                console.log(`📊 Scroll ${totalScrolls}:  Hauteur ${currentHeight}px (stable: ${stableCount}/${maxStable})`);
            }
            
            if (totalScrolls % 3 === 0) {
                const x = 200 + Math.random() * 800;
                const y = 200 + Math.random() * 400;
                await page.mouse. move(x, y);
            }
        }

        console.log(`✅ Scroll terminé après ${totalScrolls} scrolls`);
        await randomDelay(2000, 3000);

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await randomDelay(1000, 2000);

        console.log('🔍 Extraction des informations de la playlist...');
        
        const playlistInfo = await page.evaluate(() => {
            const titleEl = document.querySelector('h1[data-testid="non-editable-product-title"]') ||
                           document.querySelector('h1[class*="product-header"]') ||
                           document. querySelector('h1');
            
            const descEl = document.querySelector('[data-testid="product-description"]') ||
                          document.querySelector('[class*="product-header__description"]');
            
            return {
                name: titleEl ?  titleEl.textContent.trim() : 'ONE',
                description: descEl ? descEl.textContent.trim() : 'Playlist générée automatiquement'
            };
        });

        console.log(`📝 Playlist:  ${playlistInfo.name}`);

        console.log('🔍 Recherche du sélecteur de pistes...');
        const selectors = [
            'div[role="row"]',
            '[class*="songs-list-row"]',
            '[class*="track-list"] > div',
            'song-cell',
            '[data-testid*="track"]'
        ];

        let foundSelector = null;
        for (const selector of selectors) {
            try {
                await page.waitForSelector(selector, { timeout:  10000 });
                const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
                if (count > 0) {
                    console.log(`✅ Trouvé ${count} éléments avec:  ${selector}`);
                    foundSelector = selector;
                    break;
                }
            } catch (e) {
                console. log(`⏭️  Sélecteur ${selector} non trouvé, essai suivant...`);
            }
        }

        if (!foundSelector) {
            throw new Error('Aucun sélecteur de piste trouvé sur la page');
        }

        console.log('🎵 Extraction des pistes...');
        const basicTracks = await page.evaluate((selector, existingCount) => {
            const tracks = [];
            const elements = document.querySelectorAll(selector);
            
            console.log(`Analyse de ${elements.length} éléments`);

            elements.forEach((el, index) => {
                try {
                    let titleEl = el.querySelector('[class*="song-name"]') ||
                                 el.querySelector('[data-testid="song-name"]') ||
                                 el.querySelector('[class*="track-title"]') ||
                                 el.querySelector('[class*="track-name"]') ||
                                 el.querySelector('div[dir="auto"]');

                    let artistEl = el.querySelector('[class*="by-line"]') ||
                                  el.querySelector('[class*="artist"]') ||
                                  el. querySelector('[data-testid="artist"]') ||
                                  el.querySelector('a[href*="/artist/"]');

                    let durationEl = el.querySelector('[class*="duration"]') ||
                                    el.querySelector('time') ||
                                    el. querySelector('[data-testid="duration"]');

                    // Chercher le lien vers la page du morceau
                    let linkEl = el.querySelector('a[href*="/song/"]');
                    let songUrl = linkEl ? linkEl.href : null;

                    if (titleEl && titleEl.textContent.trim()) {
                        const title = titleEl.textContent. trim();
                        const artist = artistEl ? artistEl.textContent.trim() : 'Artiste inconnu';
                        const duration = durationEl ? durationEl.textContent.trim() : '0:00';

                        const isDuplicate = tracks.some(t => 
                            t.title === title && t.artist === artist
                        );

                        if (! isDuplicate) {
                            tracks.push({
                                position: existingCount + tracks.length + 1,
                                title:  title,
                                artist: artist,
                                duration: duration,
                                durationSec: 0,
                                genre: 'Non spécifié',
                                year: new Date().getFullYear(),
                                songUrl: songUrl
                            });
                        }
                    }
                } catch (e) {
                    console.error(`Erreur extraction piste ${index}:`, e.message);
                }
            });

            return tracks;
        }, foundSelector, existingData. tracks. length);

        console.log(`✅ ${basicTracks.length} pistes extraites`);

        // Calculer durationSec
        basicTracks.forEach(track => {
            track.durationSec = durationToSeconds(track.duration);
        });

        // Enrichir les métadonnées
        if (basicTracks.length > 0) {
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log('🔍 ENRICHISSEMENT DES MÉTADONNÉES');
            console.log('═══════════════════════════════════════');
            console.log(`📊 Nouvelles pistes: ${basicTracks.length}`);
            console.log('');

            let enrichedCount = 0;

            for (let i = 0; i < basicTracks.length; i++) {
                const track = basicTracks[i];
                
                console.log(`[${i + 1}/${basicTracks.length}] 🎵 "${track.title}" - ${track.artist}`);
                
                try {
                    if (track.songUrl) {
                        console.log(`  📄 Consultation de la page détails... `);
                        
                        await page.goto(track.songUrl, { 
                            waitUntil: 'domcontentloaded', 
                            timeout: 30000 
                        });
                        await randomDelay(1000, 2000);

                        // Récupérer le HTML complet de la page
                        const html = await page.content();

                        // Extraire les métadonnées du HTML
                        const metadata = extractMetadataFromHTML(html, track.title);

                        if (metadata.genre && metadata.genre !== 'Non spécifié') {
                            track.genre = metadata.genre;
                        }

                        if (metadata.year) {
                            track.year = metadata.year;
                        }

                        if (metadata.genre !== 'Non spécifié' || metadata.year) {
                            enrichedCount++;
                            console. log(`  ✅ Genre: ${track.genre} | Année: ${track.year}`);
                        } else {
                            console.log(`  ⚠️  Métadonnées non trouvées`);
                        }
                    } else {
                        console.log(`  ❌ Pas d'URL disponible`);
                    }

                    await randomDelay(800, 1500);

                } catch (e) {
                    console.error(`  ❌ Erreur:  ${e.message}`);
                }

                // Sauvegarder tous les 10 pistes
                if ((i + 1) % 10 === 0) {
                    const tempData = {
                        name:  playlistInfo.name,
                        description: playlistInfo.description,
                        tracks: [... existingData.tracks, ...basicTracks. slice(0, i + 1)]
                    };
                    // Nettoyer songUrl avant de sauvegarder
                    tempData.tracks.forEach(t => delete t.songUrl);
                    saveProgress(tempData);
                }
            }
            
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log(`✅ Enrichissement:  ${enrichedCount}/${basicTracks.length} pistes`);
            console.log('═══════════════════════════════════════');
        }

        // Nettoyer songUrl des tracks avant sauvegarde finale
        basicTracks.forEach(track => delete track.songUrl);

        const finalData = {
            name:  playlistInfo.name,
            description: playlistInfo.description,
            tracks: [... existingData.tracks, ...basicTracks]
        };

        saveProgress(finalData);

        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('✅ EXTRACTION TERMINÉE AVEC SUCCÈS');
        console.log('═══════════════════════════════════════');
        console.log(`📝 Playlist: ${finalData.name}`);
        console.log(`📊 Total pistes: ${finalData.tracks. length}`);
        console.log(`🆕 Nouvelles pistes: ${basicTracks.length}`);
        console.log(`💾 Fichier:  ${OUTPUT_FILE}`);
        console.log('═══════════════════════════════════════');

        await randomDelay(2000, 3000);
        await browser.close();

        return finalData;

    } catch (error) {
        console.error('');
        console.error('═══════════════════════════════════════');
        console.error('❌ ERREUR LORS DU SCRAPING');
        console.error('═══════════════════════════════════════');
        console.error(error. message);
        console.error('═══════════════════════════════════════');
        
        if (browser) {
            try {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    const html = await pages[0].content();
                    const screenshot = await pages[0].screenshot();
                    fs.writeFileSync(path.join(__dirname, 'debug_error.html'), html, 'utf8');
                    fs.writeFileSync(path. join(__dirname, 'debug_error.png'), screenshot);
                    console.log('📄 Debug sauvegardé:  debug_error.html et debug_error.png');
                }
            } catch (e) {
                console.error('Impossible de sauvegarder le debug:', e.message);
            }
            
            await browser.close();
        }
        
        throw error;
    }
}

// Lancer le scraper
scrapePlaylist()
    .then(() => {
        console.log('✅ Script terminé avec succès');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Script terminé avec erreur:', err. message);
        process.exit(1);
    });
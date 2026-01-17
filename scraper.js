const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = 'https://music.apple.com/fr/playlist/one/pl.u-11zBJy3sNDW3q3q';
const OUTPUT_FILE = path.join(__dirname, 'playlist.json');
const BACKUP_FILE = path.join(__dirname, 'playlist_backup.json');

// Délais aléatoires pour simuler un comportement humain
function randomDelay(min = 1000, max = 3000) {
    return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Charger les données existantes
function loadExistingData() {
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            console.log(`📦 Données existantes chargées: ${data.tracks?.length || 0} pistes`);
            return data;
        } catch (e) {
            console.warn('⚠️  Fichier JSON corrompu, reprise depuis zéro');
        }
    }
    return { name: '', description: '', tracks: [] };
}

// Sauvegarder progressivement
function saveProgress(data) {
    // Backup avant sauvegarde
    if (fs.existsSync(OUTPUT_FILE)) {
        fs.copyFileSync(OUTPUT_FILE, BACKUP_FILE);
    }
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`💾 Progression sauvegardée: ${data.tracks.length} pistes`);
}

async function scrapePlaylist() {
    console.log('🚀 Lancement du scraper Apple Music amélioré...');
    console.log(`📝 URL: ${PLAYLIST_URL}`);

    const existingData = loadExistingData();
    const startPosition = existingData.tracks.length;
    console.log(`🔄 Reprise depuis la piste ${startPosition + 1}`);

    let browser;
    
    try {
        // Lancement du navigateur en mode visible pour éviter la détection
        console.log('🌐 Lancement du navigateur...');
        browser = await puppeteer.launch({
            headless: false, // Mode visible pour éviter détection
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1920,1080',
                '--start-maximized'
            ],
            defaultViewport: null
        });

        const page = await browser.newPage();
        
        // User agents réalistes
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        ];
        await page.setUserAgent(userAgents[Math.floor(Math.random() * userAgents.length)]);
        
        // Masquer les traces de Puppeteer
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

        // Attendre et simuler comportement humain
        await randomDelay(3000, 5000);
        
        // Mouvement de souris aléatoire
        await page.mouse.move(100, 100);
        await randomDelay(500, 1000);
        await page.mouse.move(500, 300);
        
        // Scroll progressif et naturel pour charger tous les titres
        console.log('📜 Scroll progressif pour charger toutes les pistes...');
        let previousHeight = 0;
        let stableCount = 0;
        let totalScrolls = 0;
        const maxStable = 5; // Arrêter après 5 scrolls sans changement
        const maxScrolls = 100; // Maximum de scrolls

        while (stableCount < maxStable && totalScrolls < maxScrolls) {
            const currentHeight = await page.evaluate(() => document.body.scrollHeight);
            
            if (currentHeight === previousHeight) {
                stableCount++;
            } else {
                stableCount = 0; // Réinitialiser si nouveau contenu
            }
            
            previousHeight = currentHeight;
            totalScrolls++;
            
            // Scroll naturel avec variation
            const scrollAmount = 250 + Math.random() * 400;
            await page.evaluate((amount) => {
                window.scrollBy({
                    top: amount,
                    behavior: 'smooth'
                });
            }, scrollAmount);
            
            // Délai aléatoire entre scrolls (important!)
            await randomDelay(1200, 2500);
            
            // Log périodique
            if (totalScrolls % 10 === 0) {
                console.log(`📊 Scroll ${totalScrolls}: Hauteur ${currentHeight}px (stable: ${stableCount}/${maxStable})`);
            }
            
            // Petits mouvements de souris pendant le scroll
            if (totalScrolls % 3 === 0) {
                const x = 200 + Math.random() * 800;
                const y = 200 + Math.random() * 400;
                await page.mouse.move(x, y);
            }
        }

        console.log(`✅ Scroll terminé après ${totalScrolls} scrolls`);
        await randomDelay(2000, 3000);

        // Scroll vers le haut pour commencer l'extraction
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await randomDelay(1000, 2000);

        console.log('🔍 Extraction des données de la playlist...');
        
        // Essayer plusieurs sélecteurs
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
                await page.waitForSelector(selector, { timeout: 10000 });
                const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
                if (count > 0) {
                    console.log(`✅ Trouvé ${count} éléments avec: ${selector}`);
                    foundSelector = selector;
                    break;
                }
            } catch (e) {
                console.log(`⏭️  Sélecteur ${selector} non trouvé, essai suivant...`);
            }
        }

        if (!foundSelector) {
            throw new Error('Aucun sélecteur de piste trouvé sur la page');
        }

        // Extraction avec reprise depuis la dernière position
        const newTracks = await page.evaluate((selector, existingTracks, startPos) => {
            const tracks = [];
            const elements = document.querySelectorAll(selector);
            
            console.log(`Analyse de ${elements.length} éléments, reprise à partir de ${startPos}`);

            elements.forEach((el, index) => {
                // Ignorer les pistes déjà extraites
                if (index < startPos) return;

                try {
                    // Multiples sélecteurs pour le titre
                    let titleEl = el.querySelector('[class*="song-name"]') ||
                                 el.querySelector('[data-testid="song-name"]') ||
                                 el.querySelector('[class*="track-title"]') ||
                                 el.querySelector('[class*="track-name"]') ||
                                 el.querySelector('div[dir="auto"]');

                    // Multiples sélecteurs pour l'artiste
                    let artistEl = el.querySelector('[class*="by-line"]') ||
                                  el.querySelector('[class*="artist"]') ||
                                  el.querySelector('[data-testid="artist"]') ||
                                  el.querySelector('a[href*="/artist/"]');

                    // Multiples sélecteurs pour la durée
                    let durationEl = el.querySelector('[class*="duration"]') ||
                                    el.querySelector('time') ||
                                    el.querySelector('[data-testid="duration"]');

                    if (titleEl && titleEl.textContent.trim()) {
                        const title = titleEl.textContent.trim();
                        const artist = artistEl ? artistEl.textContent.trim() : 'Artiste inconnu';
                        const duration = durationEl ? durationEl.textContent.trim() : '0:00';

                        // Vérifier que ce n'est pas un doublon avec les pistes existantes
                        const isDuplicate = existingTracks.some(t => 
                            t.title === title && t.artist === artist
                        ) || tracks.some(t => 
                            t.title === title && t.artist === artist
                        );

                        if (!isDuplicate) {
                            const track = {
                                position: existingTracks.length + tracks.length + 1,
                                title: title,
                                artist: artist,
                                duration: duration,
                                durationSec: 0,
                                genre: 'Non spécifié',
                                year: new Date().getFullYear()
                            };

                            // Convertir la durée en secondes
                            const match = duration.match(/(\d+):(\d+)/);
                            if (match) {
                                track.durationSec = parseInt(match[1]) * 60 + parseInt(match[2]);
                            }

                            tracks.push(track);
                        }
                    }
                } catch (e) {
                    console.error(`Erreur extraction piste ${index}:`, e.message);
                }
            });

            return tracks;
        }, foundSelector, existingData.tracks, startPosition);

        console.log(`✅ ${newTracks.length} nouvelles pistes extraites`);

        // Mettre à jour les données
        const playlistData = {
            name: existingData.name || await page.evaluate(() => {
                const titleEl = document.querySelector('h1[data-testid="non-editable-product-title"]') ||
                               document.querySelector('h1[class*="product-header"]') ||
                               document.querySelector('h1');
                return titleEl ? titleEl.textContent.trim() : 'ONE';
            }),
            description: existingData.description || await page.evaluate(() => {
                const descEl = document.querySelector('[data-testid="product-description"]') ||
                              document.querySelector('[class*="product-header__description"]');
                return descEl ? descEl.textContent.trim() : '';
            }),
            tracks: [...existingData.tracks, ...newTracks]
        };

        // Sauvegarder les données
        saveProgress(playlistData);

        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('✅ EXTRACTION TERMINÉE AVEC SUCCÈS');
        console.log('═══════════════════════════════════════');
        console.log(`📝 Playlist: ${playlistData.name}`);
        console.log(`📊 Total pistes: ${playlistData.tracks.length}`);
        console.log(`🆕 Nouvelles pistes: ${newTracks.length}`);
        console.log(`💾 Fichier: ${OUTPUT_FILE}`);
        console.log('═══════════════════════════════════════');

        // Sauvegarder debug HTML
        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'debug_success.html'), html, 'utf8');
        console.log('📄 Page HTML sauvegardée: debug_success.html');

        // Attendre avant de fermer (pour observer)
        await randomDelay(2000, 3000);
        await browser.close();

        return playlistData;

    } catch (error) {
        console.error('');
        console.error('═══════════════════════════════════════');
        console.error('❌ ERREUR LORS DU SCRAPING');
        console.error('═══════════════════════════════════════');
        console.error(error.message);
        console.error('═══════════════════════════════════════');
        
        // Sauvegarder la page pour debug
        if (browser) {
            try {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    const html = await pages[0].content();
                    const screenshot = await pages[0].screenshot();
                    fs.writeFileSync(path.join(__dirname, 'debug_error.html'), html, 'utf8');
                    fs.writeFileSync(path.join(__dirname, 'debug_error.png'), screenshot);
                    console.log('📄 Debug sauvegardé: debug_error.html et debug_error.png');
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
        console.error('❌ Script terminé avec erreur:', err.message);
        process.exit(1);
    });

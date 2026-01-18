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
        let year = null;
        
        const releaseDateMatch = html.match(/<meta property="music:release_date" content="(\d{4})-/);
        if (releaseDateMatch) {
            year = parseInt(releaseDateMatch[1]);
        }
        
        if (!year) {
            const datePublishedMatch = html.match(/"datePublished":"(\d{4})-/);
            if (datePublishedMatch) {
                year = parseInt(datePublishedMatch[1]);
            }
        }
        
        if (!year) {
            const copyrightMatch = html.match(/[℗©]\s*(19|20)\d{2}/);
            if (copyrightMatch) {
                year = parseInt(copyrightMatch[0]. match(/\d{4}/)[0]);
            }
        }
        
        let genre = 'Non spécifié';
        const schemaMatch = html.match(/<script id="schema: song" type="application\/ld\+json">([\s\S]*?)<\/script>/);
        
        if (schemaMatch) {
            try {
                const schema = JSON.parse(schemaMatch[1]);
                if (schema.audio && schema.audio.genre && Array.isArray(schema.audio. genre)) {
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
        return { genre: 'Non spécifié', year: null };
    }
}

// Nettoyer les doublons dans les données existantes
function cleanDuplicates(data) {
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('🧹 NETTOYAGE DES DOUBLONS');
    console.log('═══════════════════════════════════════');
    
    const seen = new Set();
    const uniqueTracks = [];
    let duplicatesCount = 0;

    data.tracks.forEach(track => {
        const key = `${track.title}|||${track.artist}`;
        
        if (! seen.has(key)) {
            seen.add(key);
            uniqueTracks.push(track);
        } else {
            duplicatesCount++;
            if (duplicatesCount <= 5) {
                console. log(`❌ Doublon supprimé: "${track.title}" - ${track.artist}`);
            }
        }
    });

    if (duplicatesCount > 5) {
        console.log(`...  et ${duplicatesCount - 5} autres doublons`);
    }

    // Réassigner les positions
    uniqueTracks.forEach((track, index) => {
        track.position = index + 1;
    });

    console.log(`📊 Pistes avant:  ${data.tracks.length}`);
    console.log(`📊 Pistes après: ${uniqueTracks.length}`);
    console.log(`🗑️  Doublons supprimés: ${duplicatesCount}`);
    console.log('═══════════════════════════════════════');
    console.log('');

    return {
        name: data.name,
        description: data.description,
        tracks: uniqueTracks
    };
}

async function scrapePlaylist() {
    console.log('🚀 Lancement du scraper Apple Music - PLAYLIST 2000+ TITRES');
    console.log('⏱️  MODE SÉCURISÉ :  Délais augmentés pour éviter le blocage');
    console.log(`📝 URL:  ${PLAYLIST_URL}`);

    let existingData = loadExistingData();
    
    // Nettoyer les doublons au démarrage
    if (existingData.tracks.length > 0) {
        const beforeClean = existingData.tracks.length;
        existingData = cleanDuplicates(existingData);
        
        if (existingData.tracks.length < beforeClean) {
            saveProgress(existingData);
        }
    }
    
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
        await page. goto(PLAYLIST_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });

        // ✅ Délai initial plus long pour bien charger la page
        await randomDelay(5000, 8000);
        
        // Mouvement souris naturel
        await page.mouse. move(100, 100);
        await randomDelay(800, 1500);
        await page.mouse.move(500, 300);
        await randomDelay(500, 1000);
        
        // ✅ SCROLL ULTRA SÉCURISÉ POUR 2000+ PISTES
        console.log('📜 Scroll progressif et sécurisé pour charger 2000+ pistes...');
        console.log('⚠️  Cela peut prendre 20-30 minutes, soyez patient ! ');
        console.log('💡 Délais augmentés pour éviter la détection');
        
        let previousElementCount = 0;
        let stableCount = 0;
        let totalScrolls = 0;
        const maxStable = 20; // ✅ Très patient avant de conclure
        const maxScrolls = 800; // ✅ Jusqu'à 800 scrolls max
        const targetTracks = 2000; // ✅ Objectif 2000 pistes

        while (stableCount < maxStable && totalScrolls < maxScrolls) {
            const currentElementCount = await page.evaluate(() => {
                return document.querySelectorAll('div[role="row"]').length;
            });
            
            // Si on a atteint ou dépassé l'objectif
            if (currentElementCount >= targetTracks) {
                console. log(`🎯 Objectif atteint !  ${currentElementCount} pistes chargées`);
                break;
            }
            
            if (currentElementCount === previousElementCount) {
                stableCount++;
            } else {
                stableCount = 0;
            }
            
            previousElementCount = currentElementCount;
            totalScrolls++;
            
            // ✅ Scroll modéré et naturel
            const scrollAmount = 350 + Math.random() * 450; // 350-800px
            await page.evaluate((amount) => {
                window.scrollBy({
                    top: amount,
                    behavior: 'smooth'
                });
            }, scrollAmount);
            
            // ✅ DÉLAI AUGMENTÉ :  2-4 secondes entre chaque scroll
            await randomDelay(2000, 4000);
            
            // Affichage tous les 5 scrolls
            if (totalScrolls % 5 === 0) {
                const progress = ((currentElementCount / targetTracks) * 100).toFixed(1);
                const estimatedMinutes = Math.ceil((targetTracks - currentElementCount) / (currentElementCount / totalScrolls) * 3 / 60);
                console.log(`📊 Scroll ${totalScrolls}:  ${currentElementCount}/${targetTracks} pistes (${progress}%) | Stable: ${stableCount}/${maxStable} | ~${estimatedMinutes}min restantes`);
            }
            
            // ✅ Mouvement souris plus fréquent et naturel
            if (totalScrolls % 3 === 0) {
                const x = 200 + Math.random() * 800;
                const y = 200 + Math.random() * 400;
                await page.mouse. move(x, y);
                await randomDelay(500, 1000);
            }

            // ✅ Pause longue tous les 50 scrolls (simulation d'une vraie personne)
            if (totalScrolls % 50 === 0) {
                console.log(`⏸️  Pause de 10-15 secondes (simulation comportement humain)... `);
                await randomDelay(10000, 15000);
            }

            // ✅ Scroll jusqu'en bas de temps en temps pour forcer le chargement
            if (totalScrolls % 30 === 0) {
                await page.evaluate(() => window.scrollTo(0, document. body.scrollHeight));
                await randomDelay(3000, 5000);
            }
        }

        const finalElementCount = await page.evaluate(() => {
            return document.querySelectorAll('div[role="row"]').length;
        });

        console.log('');
        console.log(`✅ Scroll terminé après ${totalScrolls} scrolls`);
        console.log(`📊 Total éléments chargés: ${finalElementCount}/${targetTracks}`);
        
        if (finalElementCount < targetTracks) {
            console.log(`⚠️  Attention:  seulement ${finalElementCount} pistes chargées sur ${targetTracks} attendues`);
            console.log(`💡 Apple Music peut limiter le chargement.  Relancer le script pour continuer. `);
        }
        
        await randomDelay(3000, 5000);

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await randomDelay(2000, 3000);

        console.log('🔍 Extraction des informations de la playlist...');
        
        const playlistInfo = await page.evaluate(() => {
            const titleEl = document.querySelector('h1[data-testid="non-editable-product-title"]') ||
                           document.querySelector('h1[class*="product-header"]') ||
                           document. querySelector('h1');
            
            const descEl = document.querySelector('[data-testid="product-description"]') ||
                          document.querySelector('[class*="product-header__description"]');
            
            return {
                name: titleEl ?  titleEl.textContent. trim() : 'ONE',
                description: descEl ?  descEl.textContent.trim() : 'Playlist générée automatiquement'
            };
        });

        console.log(`📝 Playlist: ${playlistInfo.name}`);

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

        if (! foundSelector) {
            throw new Error('Aucun sélecteur de piste trouvé sur la page');
        }

        console.log('🎵 Extraction des pistes...');
        console.log(`🔍 DEBUG: Nombre de pistes existantes à skip: ${existingData.tracks. length}`);
        
        const basicTracks = await page.evaluate((selector, existingCount) => {
            const tracks = [];
            const elements = document.querySelectorAll(selector);
            
            console.log(`Analyse de ${elements.length} éléments HTML trouvés`);
            console.log(`Skip des ${existingCount} premières pistes`);

            elements.forEach((el, index) => {
                // Skip des pistes déjà extraites
                if (index < existingCount) {
                    return;
                }

                try {
                    let titleEl = el.querySelector('[class*="song-name"]') ||
                                 el.querySelector('[data-testid="song-name"]') ||
                                 el.querySelector('[class*="track-title"]') ||
                                 el.querySelector('[class*="track-name"]') ||
                                 el.querySelector('div[dir="auto"]');

                    let artistEl = el.querySelector('[class*="by-line"]') ||
                                  el.querySelector('[class*="artist"]') ||
                                  el. querySelector('[data-testid="artist"]') ||
                                  el. querySelector('a[href*="/artist/"]');

                    let durationEl = el.querySelector('[class*="duration"]') ||
                                    el.querySelector('time') ||
                                    el. querySelector('[data-testid="duration"]');

                    let linkEl = el.querySelector('a[href*="/song/"]');
                    let songUrl = linkEl ? linkEl.href : null;

                    if (titleEl && titleEl.textContent.trim()) {
                        const title = titleEl.textContent.trim();
                        const artist = artistEl ? artistEl. textContent.trim() : 'Artiste inconnu';
                        const duration = durationEl ? durationEl. textContent.trim() : '0:00';

                        tracks.push({
                            position: index + 1,
                            title: title,
                            artist: artist,
                            duration: duration,
                            durationSec: 0,
                            genre: 'Non spécifié',
                            year: new Date().getFullYear(),
                            songUrl: songUrl
                        });
                    }
                } catch (e) {
                    console.error(`Erreur extraction piste ${index}:`, e.message);
                }
            });

            console.log(`🎯 Total nouvelles pistes extraites: ${tracks.length}`);
            return tracks;
        }, foundSelector, existingData.tracks. length);

        console.log(`✅ ${basicTracks.length} pistes brutes extraites`);

        // Filtrer les doublons
        const existingTitles = new Set(
            existingData.tracks.map(t => `${t.title}|||${t.artist}`)
        );
        
        const newTracks = basicTracks.filter(track => {
            const key = `${track.title}|||${track.artist}`;
            return !existingTitles.has(key);
        });

        console.log(`✅ ${newTracks.length} pistes réellement nouvelles après déduplication`);

        // Calculer durationSec
        newTracks.forEach(track => {
            track.durationSec = durationToSeconds(track.duration);
        });

        // Enrichir les métadonnées
        if (newTracks.length > 0) {
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log('🔍 ENRICHISSEMENT DES MÉTADONNÉES');
            console.log('═══════════════════════════════════════');
            console.log(`📊 Nouvelles pistes: ${newTracks.length}`);
            console.log('⏱️  MODE SÉCURISÉ : 3-6 secondes entre chaque piste');
            console.log('⚠️  Pour 2000 pistes, cela peut prendre 3-4 heures ! ');
            console.log('💡 Le script sauvegarde tous les 5 pistes');
            console.log('');

            let enrichedCount = 0;
            const startTime = Date.now();

            for (let i = 0; i < newTracks.length; i++) {
                const track = newTracks[i];
                
                console.log(`[${i + 1}/${newTracks.length}] 🎵 "${track.title}" - ${track. artist}`);
                
                try {
                    if (track.songUrl) {
                        console.log(`  📄 Consultation de la page détails... `);
                        
                        await page.goto(track.songUrl, { 
                            waitUntil: 'domcontentloaded', 
                            timeout: 30000 
                        });
                        
                        // ✅ DÉLAI AUGMENTÉ : 2-4 secondes après chargement page
                        await randomDelay(2000, 4000);

                        const html = await page.content();
                        const metadata = extractMetadataFromHTML(html, track.title);

                        if (metadata. genre && metadata.genre !== 'Non spécifié') {
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

                    // ✅ DÉLAI AUGMENTÉ entre chaque piste :  3-6 secondes
                    await randomDelay(3000, 6000);

                    // ✅ Pause longue tous les 20 pistes
                    if ((i + 1) % 20 === 0) {
                        console.log(`⏸️  Pause de 15-20 secondes (protection anti-blocage)...`);
                        await randomDelay(15000, 20000);
                    }

                } catch (e) {
                    console.error(`  ❌ Erreur:  ${e.message}`);
                    // ✅ En cas d'erreur, pause plus longue
                    await randomDelay(5000, 8000);
                }

                // ✅ Sauvegarder tous les 5 pistes (au lieu de 10)
                if ((i + 1) % 5 === 0) {
                    const tempData = {
                        name:  playlistInfo.name,
                        description: playlistInfo.description,
                        tracks: [... existingData.tracks, ...newTracks. slice(0, i + 1)]
                    };
                    tempData.tracks.forEach(t => delete t.songUrl);
                    saveProgress(tempData);
                    
                    // Estimation du temps restant
                    const elapsed = Date.now() - startTime;
                    const avgTimePerTrack = elapsed / (i + 1);
                    const remaining = (newTracks.length - (i + 1)) * avgTimePerTrack;
                    const remainingMinutes = Math.ceil(remaining / 60000);
                    
                    const progress = ((i + 1) / newTracks.length * 100).toFixed(1);
                    console.log(`📊 Progression: ${progress}% | Enrichies: ${enrichedCount}/${i + 1} | ~${remainingMinutes}min restantes`);
                }
            }
            
            console.log('');
            console.log('══════════════════════════��════════════');
            console.log(`✅ Enrichissement:  ${enrichedCount}/${newTracks.length} pistes`);
            console.log('═══════════════════════════════════════');
        } else {
            console.log('');
            console.log('⚠️  AUCUNE NOUVELLE PISTE À ENRICHIR');
            console.log('');
            console.log(`📊 Pistes dans le JSON: ${existingData.tracks. length}`);
            console.log(`📊 Pistes sur la page: ${finalElementCount}`);
            console.log('');
            if (existingData.tracks.length >= finalElementCount) {
                console.log('✅ Toutes les pistes chargées ont été extraites ! ');
                console.log('💡 Si < 2000, relancer pour charger plus de pistes');
            } else {
                console.log('💡 Relancer le script pour continuer l\'extraction');
            }
            console.log('');
        }

        // Nettoyer songUrl
        newTracks.forEach(track => delete track.songUrl);

        const finalData = {
            name: playlistInfo.name,
            description: playlistInfo.description,
            tracks: [... existingData.tracks, ...newTracks]
        };

        saveProgress(finalData);

        console.log('');
        console.log('═���═════════════════════════════════════');
        console.log('✅ EXTRACTION TERMINÉE AVEC SUCCÈS');
        console.log('═══════════════════════════════════════');
        console.log(`📝 Playlist: ${finalData.name}`);
        console.log(`📊 Total pistes:  ${finalData.tracks.length}/2000`);
        console.log(`🆕 Nouvelles pistes: ${newTracks.length}`);
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
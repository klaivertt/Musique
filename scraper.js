const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PLAYLIST_URL = 'https://music.apple.com/fr/playlist/one/pl.u-11zBJy3sNDW3q3q';
const OUTPUT_FILE = path.join(__dirname, 'playlist_one.json');
const BACKUP_FILE = path.join(__dirname, 'playlist_one_backup.json');

// Délais aléatoires
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

// Sauvegarder
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

// Extraire métadonnées
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
        
        if (! year) {
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
                // Ignore
            }
        }
        
        return { genre, year };
    } catch (e) {
        return { genre: 'Non spécifié', year: null };
    }
}

// Nettoyer doublons
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
                console.log(`❌ Doublon supprimé: "${track.title}" - ${track.artist}`);
            }
        }
    });

    if (duplicatesCount > 5) {
        console.log(`...  et ${duplicatesCount - 5} autres doublons`);
    }

    uniqueTracks.forEach((track, index) => {
        track.position = index + 1;
    });

    console.log(`📊 Pistes avant:  ${data.tracks.length}`);
    console.log(`📊 Pistes après:  ${uniqueTracks.length}`);
    console.log(`🗑️  Doublons supprimés:  ${duplicatesCount}`);
    console.log('═══════════════════════════════════════');
    console.log('');

    return {
        name: data.name,
        description: data.description,
        tracks: uniqueTracks
    };
}

async function scrapePlaylist() {
    console.log('🚀 Lancement du scraper Apple Music');
    console.log(`📝 URL: ${PLAYLIST_URL}`);
    console.log('');

    let existingData = loadExistingData();
    
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
        
        // ✅ Lancer Chrome avec puppeteer (méthode standard)
        browser = await puppeteer.launch({
            headless: false, // Afficher le navigateur pour te permettre de te connecter si besoin
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const page = await browser.newPage();
        
        console.log('📄 Chargement de la page Apple Music...');
        console.log('💡 Si nécessaire, connecte-toi manuellement dans le navigateur');
        
        await page.goto(PLAYLIST_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });

        console.log('⏳ Attends 15 secondes pour te connecter si besoin...');
        await randomDelay(15000, 18000);
        
        console.log('📜 Début du scroll forcé...');
        console.log('⚠️  Cela peut prendre 30-40 minutes pour 2000 pistes ! ');
        console.log('');
        
        let iteration = 0;
        let previousCount = 0;
        let noChangeCount = 0;
        const maxNoChange = 30;
        
        while (noChangeCount < maxNoChange) {
            iteration++;
            
            await page.evaluate(() => {
                window.scrollTo(0, document. body.scrollHeight);
            });
            
            await randomDelay(2000, 3000);
            
            const currentCount = await page. evaluate(() => {
                return document.querySelectorAll('div[role="row"]').length;
            });
            
            if (currentCount === previousCount) {
                noChangeCount++;
            } else {
                noChangeCount = 0;
            }
            
            previousCount = currentCount;
            
            if (iteration % 5 === 0) {
                const progress = ((currentCount / 1969) * 100).toFixed(1);
                console.log(`📊 Itération ${iteration}: ${currentCount}/2000 pistes (${progress}%) | Stabilité: ${noChangeCount}/${maxNoChange}`);
            }
            
            if (iteration % 3 === 0) {
                const x = 200 + Math.random() * 800;
                const y = 200 + Math. random() * 400;
                await page.mouse.move(x, y);
            }
            
            if (iteration % 30 === 0) {
                console.log(`⏸️  Pause de 10 secondes... `);
                await randomDelay(10000, 12000);
            }
            
            if (currentCount >= 1969) {
                console.log(`🎯 Objectif atteint !  ${currentCount} pistes chargées`);
                break;
            }
        }

        const finalElementCount = await page.evaluate(() => {
            return document.querySelectorAll('div[role="row"]').length;
        });

        console.log('');
        console.log(`✅ Scroll terminé après ${iteration} itérations`);
        console.log(`📊 Total éléments chargés: ${finalElementCount}`);
        
        if (finalElementCount < 1969) {
            console.log(`⚠️  Limité à ${finalElementCount} pistes`);
        }
        
        await randomDelay(3000, 5000);

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await randomDelay(2000, 3000);

        console.log('🔍 Extraction des informations...');
        
        const playlistInfo = await page.evaluate(() => {
            const titleEl = document.querySelector('h1[data-testid="non-editable-product-title"]') ||
                           document.querySelector('h1');
            
            const descEl = document.querySelector('[data-testid="product-description"]');
            
            return {
                name: titleEl ?  titleEl.textContent. trim() : 'ONE',
                description: descEl ?  descEl.textContent.trim() : 'Playlist générée automatiquement'
            };
        });

        console.log(`📝 Playlist: ${playlistInfo.name}`);

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
                console. log(`⏭️  Sélecteur ${selector} non trouvé`);
            }
        }

        if (! foundSelector) {
            throw new Error('Aucun sélecteur de piste trouvé');
        }

        console.log('🎵 Extraction des pistes...');
        console.log(`🔍 Skip des ${existingData.tracks.length} premières`);
        
        const basicTracks = await page.evaluate((selector, existingCount) => {
            const tracks = [];
            const elements = document.querySelectorAll(selector);
            
            console.log(`Analyse de ${elements.length} éléments`);

            elements.forEach((el, index) => {
                if (index < existingCount) return;

                try {
                    let titleEl = el.querySelector('[class*="song-name"]') ||
                                 el.querySelector('[data-testid="song-name"]') ||
                                 el.querySelector('div[dir="auto"]');

                    let artistEl = el.querySelector('[class*="by-line"]') ||
                                  el.querySelector('[class*="artist"]') ||
                                  el.querySelector('a[href*="/artist/"]');

                    let durationEl = el.querySelector('[class*="duration"]') ||
                                    el.querySelector('time');

                    let linkEl = el.querySelector('a[href*="/song/"]');

                    if (titleEl && titleEl.textContent.trim()) {
                        tracks.push({
                            position: index + 1,
                            title: titleEl.textContent.trim(),
                            artist: artistEl ? artistEl.textContent.trim() : 'Artiste inconnu',
                            duration: durationEl ? durationEl.textContent.trim() : '0:00',
                            songUrl: linkEl ? linkEl.href : null,
                            genre: 'Non spécifié',
                            year: new Date().getFullYear()
                        });
                    }
                } catch (e) {
                    console.error(`Erreur piste ${index}:`, e.message);
                }
            });

            return tracks;
        }, foundSelector, existingData.tracks. length);

        console.log(`✅ ${basicTracks.length} pistes brutes extraites`);

        const existingTitles = new Set(
            existingData.tracks.map(t => `${t.title}|||${t.artist}`)
        );
        
        const newTracks = basicTracks.filter(track => {
            const key = `${track.title}|||${track.artist}`;
            return !existingTitles. has(key);
        });

        console.log(`✅ ${newTracks.length} pistes nouvelles après déduplication`);

        newTracks.forEach(track => {
            track. durationSec = durationToSeconds(track.duration);
        });

        if (newTracks.length > 0) {
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log('🔍 ENRICHISSEMENT DES MÉTADONNÉES');
            console. log('═══════════════════════════════════════');
            console.log(`📊 Nouvelles pistes: ${newTracks.length}`);
            console.log('⏱️  3-6 secondes par piste');
            console.log('');

            let enrichedCount = 0;
            const startTime = Date.now();

            for (let i = 0; i < newTracks.length; i++) {
                const track = newTracks[i];
                
                console.log(`[${i + 1}/${newTracks.length}] 🎵 "${track.title}" - ${track.artist}`);
                
                try {
                    if (track.songUrl) {
                        console.log(`  📄 Consultation... `);
                        
                        await page.goto(track.songUrl, { 
                            waitUntil:  'domcontentloaded', 
                            timeout: 30000 
                        });
                        
                        await randomDelay(2000, 4000);

                        const html = await page.content();
                        const metadata = extractMetadataFromHTML(html, track. title);

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
                        console.log(`  ❌ Pas d'URL`);
                    }

                    await randomDelay(3000, 6000);

                    if ((i + 1) % 20 === 0) {
                        console.log(`⏸️  Pause de 15 secondes...`);
                        await randomDelay(15000, 20000);
                    }

                } catch (e) {
                    console.error(`  ❌ Erreur:  ${e.message}`);
                    await randomDelay(5000, 8000);
                }

                if ((i + 1) % 5 === 0) {
                    const tempData = {
                        name: playlistInfo.name,
                        description: playlistInfo.description,
                        tracks: [... existingData.tracks, ...newTracks. slice(0, i + 1)]
                    };
                    tempData.tracks.forEach(t => delete t.songUrl);
                    saveProgress(tempData);
                    
                    const elapsed = Date.now() - startTime;
                    const avgTime = elapsed / (i + 1);
                    const remaining = (newTracks.length - (i + 1)) * avgTime;
                    const remainingMin = Math.ceil(remaining / 60000);
                    
                    const progress = ((i + 1) / newTracks.length * 100).toFixed(1);
                    console.log(`📊 ${progress}% | Enrichies: ${enrichedCount}/${i + 1} | ~${remainingMin}min restantes`);
                }
            }
            
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log(`✅ Enrichissement:  ${enrichedCount}/${newTracks.length}`);
            console.log('═══════════════════════════════════════');
        } else {
            console.log('');
            console.log('⚠️  AUCUNE NOUVELLE PISTE');
            console.log(`📊 JSON: ${existingData.tracks. length}`);
            console.log(`📊 Page: ${finalElementCount}`);
            console.log('');
        }

        newTracks.forEach(track => delete track.songUrl);

        const finalData = {
            name:  playlistInfo.name,
            description: playlistInfo.description,
            tracks: [... existingData.tracks, ...newTracks]
        };

        saveProgress(finalData);

        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('✅ EXTRACTION TERMINÉE');
        console.log('═══════════════════════════════════════');
        console.log(`📝 Playlist: ${finalData.name}`);
        console.log(`📊 Total pistes: ${finalData.tracks. length}`);
        console.log(`🆕 Nouvelles:  ${newTracks.length}`);
        console.log(`💾 Fichier: ${OUTPUT_FILE}`);
        console.log('═══════════════════════════════════════');

        await randomDelay(2000, 3000);
        await browser.close();

        return finalData;

    } catch (error) {
        console.error('');
        console.error('❌ ERREUR:', error. message);
        
        if (browser) {
            try {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    const html = await pages[0].content();
                    const screenshot = await pages[0].screenshot();
                    fs.writeFileSync(path.join(__dirname, 'debug_error.html'), html, 'utf8');
                    fs.writeFileSync(path. join(__dirname, 'debug_error.png'), screenshot);
                    console.log('📄 Debug sauvegardé');
                }
            } catch (e) {
                // Ignore
            }
            
            await browser.close();
        }
        
        throw error;
    }
}

scrapePlaylist()
    .then(() => {
        console.log('✅ Terminé');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Erreur:', err. message);
        process.exit(1);
    });
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
            console.log(`📦 Données existantes chargées: ${data.tracks?.length || 0} pistes`);
            return data;
        } catch (e) {
            console.warn('⚠️ Fichier JSON corrompu, reprise depuis zéro');
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
    console.log(`💾 Progression sauvegardée: ${data.tracks.length} pistes`);
}

// Convertir durée MM:SS en secondes
function durationToSeconds(duration) {
    const match = duration.match(/(\d+):(\d+)/);
    if (match) {
        return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return 0;
}

// ✅ FONCTION COMBO : Extraire métadonnées depuis la page ALBUM (JSON-LD + Meta Keywords)
function extractMetadataFromAlbumHTML(html, trackTitle) {
    try {
        let year = null;
        let genre = 'Non spécifié';
        let albumName = 'Non spécifié';
        
        // ✅ MÉTHODE 1 : Chercher le JSON-LD de l'album
        const albumSchemaMatch = html.match(/<script id="schema:music-album" type="application\/ld\+json">([\s\S]*?)<\/script>/);
        
        if (albumSchemaMatch) {
            try {
                const schema = JSON.parse(albumSchemaMatch[1]);
                
                // Extraire le nom de l'album
                if (schema.name) {
                    albumName = schema.name;
                }
                
                // Extraire le genre depuis JSON-LD
                if (schema.genre) {
                    if (Array.isArray(schema.genre)) {
                        const validGenres = schema.genre.filter(g => 
                            g && typeof g === 'string' && g !== 'Musique' && g !== 'Music'
                        );
                        if (validGenres.length > 0) {
                            genre = validGenres[0];
                            console.log(`  ✅ Genre trouvé dans JSON-LD: ${genre}`);
                        }
                    } else if (typeof schema.genre === 'string') {
                        if (schema.genre !== 'Musique' && schema.genre !== 'Music') {
                            genre = schema.genre;
                            console.log(`  ✅ Genre trouvé dans JSON-LD: ${genre}`);
                        }
                    }
                }
                
                // Extraire l'année
                if (schema.datePublished) {
                    const yearMatch = schema.datePublished.match(/(\d{4})/);
                    if (yearMatch) {
                        year = parseInt(yearMatch[1]);
                    }
                }
                
            } catch (e) {
                console.error(`  ⚠️ Erreur parsing JSON-LD: ${e.message}`);
            }
        }
        
        // ✅ MÉTHODE 2 : Fallback - Chercher dans les meta keywords si genre non trouvé
        if (genre === 'Non spécifié') {
            const keywordsMatch = html.match(/<meta name="keywords" content="([^"]+)"/);
            if (keywordsMatch) {
                const keywords = keywordsMatch[1].split(',').map(k => k.trim());
                
                // Filtrer les mots-clés pour trouver le genre
                const excludeWords = [
                    'écouter', 'musique', 'singles', 'morceaux', 'streaming', 
                    'apple music', 'album', 'par', 'sur', 'bande originale'
                ];
                
                const possibleGenres = keywords.filter(k => {
                    const lowerK = k.toLowerCase();
                    return !excludeWords.some(word => lowerK.includes(word)) &&
                           k.length > 2 && 
                           k.length < 30;
                });
                
                if (possibleGenres.length > 0) {
                    // Prendre le premier genre valide trouvé
                    genre = possibleGenres[0];
                    console.log(`  ✅ Genre trouvé dans keywords: ${genre}`);
                }
            }
        }
        
        // ✅ MÉTHODE 3 : Fallback - Chercher l'année dans les meta tags
        if (!year) {
            const releaseDateMatch = html.match(/<meta property="music:release_date" content="(\d{4})-/);
            if (releaseDateMatch) {
                year = parseInt(releaseDateMatch[1]);
            }
        }
        
        // ✅ MÉTHODE 4 : Fallback - Chercher l'album dans le titre de la page
        if (albumName === 'Non spécifié') {
            const titleMatch = html.match(/<title>([^<]+)<\/title>/);
            if (titleMatch) {
                // Format typique: "Album Name – Album par Artiste – Apple Music"
                const titleParts = titleMatch[1].split('–');
                if (titleParts.length > 0) {
                    albumName = titleParts[0].trim();
                }
            }
        }
        
        return { genre, year, albumName };
    } catch (e) {
        console.error(`  ❌ Erreur extraction métadonnées: ${e.message}`);
        return { genre: 'Non spécifié', year: null, albumName: 'Non spécifié' };
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
        
        if (!seen.has(key)) {
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
        console.log(`... et ${duplicatesCount - 5} autres doublons`);
    }

    uniqueTracks.forEach((track, index) => {
        track.position = index + 1;
    });

    console.log(`📊 Pistes avant: ${data.tracks.length}`);
    console.log(`📊 Pistes après: ${uniqueTracks.length}`);
    console.log(`🗑️ Doublons supprimés: ${duplicatesCount}`);
    console.log('═══════════════════════════════════════');
    console.log('');

    return {
        name: data.name,
        description: data.description,
        tracks: uniqueTracks
    };
}

async function scrapePlaylist() {
    console.log('🚀 Lancement du scraper Apple Music - VERSION 5');
    console.log('💡 Mode enrichissement: ALBUM (genre + année + nom album)');
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
        
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        const page = await browser.newPage();
        
        console.log('📄 Chargement de la page Apple Music...');
        
        await page.goto(PLAYLIST_URL, { 
            waitUntil: 'domcontentloaded',
            timeout: 90000 
        });

        await randomDelay(3000, 5000);
        
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
        }

        console.log(`✅ Scroll terminé après ${totalScrolls} scrolls`);

        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await randomDelay(2000, 3000);

        console.log('🔍 Extraction des informations de la playlist...');
        
        const playlistInfo = await page.evaluate(() => {
            const titleEl = document.querySelector('h1[data-testid="non-editable-product-title"]') ||
                           document.querySelector('h1');
            
            const descEl = document.querySelector('[data-testid="product-description"]');
            
            return {
                name: titleEl ? titleEl.textContent.trim() : 'ONE',
                description: descEl ? descEl.textContent.trim() : 'Playlist générée automatiquement'
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
                await page.waitForSelector(selector, { timeout: 10000 });
                const count = await page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
                if (count > 0) {
                    console.log(`✅ Trouvé ${count} éléments avec: ${selector}`);
                    foundSelector = selector;
                    break;
                }
            } catch (e) {
                console.log(`⏭️ Sélecteur ${selector} non trouvé`);
            }
        }

        if (!foundSelector) {
            throw new Error('Aucun sélecteur de piste trouvé');
        }

        console.log('🎵 Extraction des pistes...');
        
        const basicTracks = await page.evaluate((selector, existingCount) => {
            const tracks = [];
            const elements = document.querySelectorAll(selector);

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

                    let albumLinkEl = el.querySelector('a[href*="/album/"]');

                    if (titleEl && titleEl.textContent.trim()) {
                        tracks.push({
                            position: index + 1,
                            title: titleEl.textContent.trim(),
                            artist: artistEl ? artistEl.textContent.trim() : 'Artiste inconnu',
                            duration: durationEl ? durationEl.textContent.trim() : '0:00',
                            albumUrl: albumLinkEl ? albumLinkEl.href : null,
                            album: 'Non spécifié',
                            genre: 'Non spécifié',
                            year: new Date().getFullYear(),
                            durationSec: 0
                        });
                    }
                } catch (e) {
                    console.error(`Erreur piste ${index}:`, e.message);
                }
            });

            return tracks;
        }, foundSelector, existingData.tracks.length);

        console.log(`✅ ${basicTracks.length} pistes extraites`);

        // Calculer durationSec
        basicTracks.forEach(track => {
            track.durationSec = durationToSeconds(track.duration);
        });

        if (basicTracks.length > 0) {
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log('🔍 ENRICHISSEMENT DES MÉTADONNÉES (ALBUM)');
            console.log('═══════════════════════════════════════');
            console.log(`📊 Nouvelles pistes: ${basicTracks.length}`);
            console.log('');

            let enrichedCount = 0;

            for (let i = 0; i < basicTracks.length; i++) {
                const track = basicTracks[i];
                
                console.log(`[${i + 1}/${basicTracks.length}] 🎵 "${track.title}" - ${track.artist}`);
                
                try {
                    if (track.albumUrl) {
                        console.log(`  📀 Consultation de la page album...`);
                        
                        await page.goto(track.albumUrl, { 
                            waitUntil: 'domcontentloaded', 
                            timeout: 30000 
                        });
                        
                        await randomDelay(2000, 4000);

                        const html = await page.content();
                        const metadata = extractMetadataFromAlbumHTML(html, track.title);

                        if (metadata.albumName && metadata.albumName !== 'Non spécifié') {
                            track.album = metadata.albumName;
                        }

                        if (metadata.genre && metadata.genre !== 'Non spécifié') {
                            track.genre = metadata.genre;
                        }

                        if (metadata.year) {
                            track.year = metadata.year;
                        }

                        if (metadata.genre !== 'Non spécifié' || metadata.year) {
                            enrichedCount++;
                        }
                        
                        console.log(`  ✅ Album: ${track.album} | Genre: ${track.genre} | Année: ${track.year}`);
                    } else {
                        console.log(`  ❌ Pas d'URL album`);
                    }

                    await randomDelay(3000, 6000);

                    if ((i + 1) % 20 === 0) {
                        console.log(`⏸️ Pause de 15 secondes...`);
                        await randomDelay(15000, 20000);
                    }

                } catch (e) {
                    console.error(`  ❌ Erreur: ${e.message}`);
                    await randomDelay(5000, 8000);
                }

                // Sauvegarder tous les 10 pistes
                if ((i + 1) % 10 === 0) {
                    const tempData = {
                        name: playlistInfo.name,
                        description: playlistInfo.description,
                        tracks: [...existingData.tracks, ...basicTracks.slice(0, i + 1)]
                    };
                    tempData.tracks.forEach(t => delete t.albumUrl);
                    saveProgress(tempData);
                }
            }
            
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log(`✅ Enrichissement: ${enrichedCount}/${basicTracks.length}`);
            console.log('═══════════════════════════════════════');
        }

        // Nettoyer albumUrl des tracks
        basicTracks.forEach(track => delete track.albumUrl);

        const finalData = {
            name: playlistInfo.name,
            description: playlistInfo.description,
            tracks: [...existingData.tracks, ...basicTracks]
        };

        saveProgress(finalData);

        console.log('');
        console.log('═══════════════════════════════════════');
        console.log('✅ EXTRACTION TERMINÉE');
        console.log('═══════════════════════════════════════');
        console.log(`📝 Playlist: ${finalData.name}`);
        console.log(`📊 Total pistes: ${finalData.tracks.length}`);
        console.log(`🆕 Nouvelles pistes: ${basicTracks.length}`);
        console.log(`💾 Fichier: ${OUTPUT_FILE}`);
        console.log('═══════════════════════════════════════');

        await randomDelay(2000, 3000);
        await browser.close();

        return finalData;

    } catch (error) {
        console.error('');
        console.error('❌ ERREUR:', error.message);
        
        if (browser) {
            try {
                const pages = await browser.pages();
                if (pages.length > 0) {
                    const html = await pages[0].content();
                    const screenshot = await pages[0].screenshot();
                    fs.writeFileSync(path.join(__dirname, 'debug_error.html'), html, 'utf8');
                    fs.writeFileSync(path.join(__dirname, 'debug_error.png'), screenshot);
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
        console.error('❌ Erreur:', err.message);
        process.exit(1);
    });

const fs = require('fs');
const path = require('path');

const PLAYLIST_FILE = path.join(__dirname, 'playlist.json');

// Base de données de genres par artiste
const artistGenres = {
    'Katy Perry': 'Pop',
    'Rick Astley': 'Pop',
    'FKJ': 'Electronic',
    'Saavedra Funk': 'Funk',
    'Daniel Caesar': 'R&B',
    'Childish Gambino': 'Hip-hop',
    'Maddie Zahm': 'Pop',
    'Macklemore & Ryan Lewis': 'Hip-hop',
    'mgk': 'Pop-punk',
    'Ludwig Göransson': 'Soundtrack',
    'Loomy': 'Hip-hop',
    'LISA': 'K-pop',
    'Lipps, Inc.': 'Disco',
    'Masego': 'R&B',
    'Lil Wayne · Wiz Khalifa · Imagine Dragons': 'Hip-hop',
    'Lil Nas X': 'Hip-hop',
    'Lil Nas X · Jack Harlow': 'Hip-hop',
    'Leyla Blue': 'Pop',
    'Lawrence Welk and His Orchestra': 'Jazz',
    'KYLE': 'Hip-hop',
    'Kyle Exum': 'Hip-hop',
    'Kid Cudi': 'Hip-hop',
    'Justin Bieber': 'R&B',
    'Julia Alexa · Belfa': 'Pop',
    'JOYCA': 'R&B',
    'Jake Daniels': 'Pop',
    'Imagine Dragons · JID': 'Rock',
    'Imagine Dragons': 'Rock',
    'Hoober · tofû': 'Electronic',
    'Hiboky': 'Electronic',
    'U2': 'Rock',
    'Grover Washington, Jr.': 'Jazz',
    'graves': 'Electronic',
    'grandson': 'Rock',
    'Glass Animals': 'Indie',
    'GIVĒON': 'R&B',
    'Gilbert Montagné': 'Variété française',
    'George Michael': 'Pop',
    'Francis Cabrel': 'Variété française',
    'Farruko': 'Reggaeton',
    'Fran Vasilić': 'Pop',
    'Cradle of Filth': 'Metal',
    'Fox Stevenson': 'Electronic',
    'Florent Pagny': 'Variété française',
    'Eminem': 'Hip-hop',
    'ElyOtto': 'Hyperpop',
    'Elijah Who': 'Indie',
    'Elijah Moon · Solace': 'Electronic',
    'Egzod · Maestro Chives · Neoni': 'Electronic',
    'Echosmith': 'Indie-pop',
    'Dxrk ダーク': 'Phonk',
    'Dwilly · Brandyn Burnette': 'Pop',
    'Duke & Jones · Louis Theroux': 'Hip-hop',
    'Drake': 'Hip-hop',
    'Sam Smith · Kim Petras': 'Pop',
    'Sam Smith': 'Pop',
    'Billie Eilish': 'Alt-pop',
    'Billie Eilish · Khalid': 'Alt-pop',
    'DOMi & JD BECK · Anderson .Paak · Busta Rhymes · Snoop Dogg': 'Jazz-Fusion',
    'Depeche Mode': 'Synth-pop',
    'Street Corner Renaissance': 'Doo-wop',
    'Daft Punk · Julian Casablancas': 'Electronic',
    'Daft Punk · Pharrell Williams': 'Electronic',
    'Daft Punk': 'Electronic',
    'OneRepublic': 'Pop',
    'Pierre de Maere': 'Variété française',
    'Rozen': 'Soundtrack',
    'Masters of Sound': 'Soundtrack',
    'Queen': 'Rock',
    'Game Boys': 'Chiptune',
    'Arctic Monkeys': 'Rock',
    'Varien': 'Electronic',
    'ABBA': 'Pop',
    'Cyndi Lauper': 'Pop',
    'Confetti': 'Indie-pop',
    'Starship': 'Rock',
    'CKay': 'Afrobeat',
    'Chris Webby': 'Hip-hop',
    'Chase Atlantic': 'Alt-pop',
    'CHARLES': 'Pop',
    'Chance Peña': 'Indie',
    'The Chainsmokers · ILLENIUM': 'Electronic',
    'Calvin Harris · Dua Lipa': 'Dance-pop',
    'Bob Marley & The Wailers': 'Reggae',
    'blackbear': 'Hip-hop',
    'Besomorph · Coopex': 'Electronic',
    'poetri': 'Electronic',
    'BEAUZ · Dallas': 'Electronic',
    'The Beatnuts': 'Hip-hop',
    'BabyJake': 'Pop',
    'Arden Jones': 'Pop',
    'Alice Deejay': 'Dance',
    'Alfie Templeman': 'Indie-pop',
    'Carl Douglas': 'Funk',
    'brady': 'Pop',
    'Dwayne Johnson': 'Soundtrack',
    'ZAZ': 'Variété française',
    'Nirvana': 'Grunge',
    'Desireless': 'Synth-pop',
    'Post Malone': 'Hip-hop',
    'Lynyrd Skynyrd': 'Rock',
    'Ikimonogakari': 'J-pop',
    'Roy Orbison': 'Rock',
    'Ben E. King': 'Soul',
    'Lena Raine · Minecraft': 'Soundtrack',
    'Rihanna': 'R&B',
    'Marc Vinyls': 'Electronic',
    'Aaron Cherof': 'Electronic',
    'William Baldé': 'Variété française',
    'Charles Aznavour': 'Chanson française',
    'Édith Piaf': 'Chanson française',
    'Russian Village Boys': 'Electronic',
    'Stromae': 'Pop',
    'Redbone': 'Rock',
    'XXXTENTACION': 'Hip-hop',
    'OutKast': 'Hip-hop',
    'DaBaby': 'Hip-hop',
    'Foreigner': 'Rock',
    'Michael Sembello': 'Pop',
    'Cutting Crew': 'Rock',
    'Placebo': 'Rock',
    'Adele': 'Ballad',
    'Bruno Mars': 'Pop',
    'Luciano Pavarotti · Richard Bonynge · London Symphony Orchestra · Martti Talvela · Sherrill Milnes': 'Opera',
    'Foster the People': 'Indie-pop',
    'Samuel Kim': 'Soundtrack',
    'City Light Symphony Orchestra · Kevin Griffiths': 'Soundtrack',
    'Rilès': 'Hip-hop',
    'Trevor Daniel': 'Pop',
    'Stephen Sanchez': 'Pop',
    'Kordhell': 'Phonk',
    'Muse': 'Rock',
    'Toby Fox': 'Soundtrack',
    "Fool's Garden": 'Pop',
    'Dynoro · Gigi D\'Agostino': 'Electronic',
    'Lil Peep · XXXTENTACION': 'Hip-hop',
    'Freddie Dredd': 'Hip-hop',
    'Remady · Bright Sparks': 'Electronic',
    'The Animals': 'Rock',
    'Orchestre Philharmonique de Londres · David Parry · London Philharmonic Choir · The London Chorus': 'Classique',
    'The Weather Girls': 'Disco',
    'Paul Anka': 'Pop',
    'Coldplay': 'Rock',
    'Connor Price · Zensery': 'Hip-hop',
    'The Killers': 'Rock',
    'The xx': 'Indie',
    'Louis Armstrong': 'Jazz',
    'Dr. Dre': 'Hip-hop',
    'Breakbot': 'Electronic',
    'Green Day': 'Punk',
    'The White Stripes': 'Rock',
    'AnnenMayKantereit · Giant Rooks': 'Indie',
    'Oasis': 'Rock',
    'Joji': 'R&B',
    'Camille': 'Variété française',
    'The Wombats': 'Indie-rock',
    'Randy Newman': 'Soundtrack',
    'Kind Puppy': 'Indie',
    'yourneighborsclassicbeats': 'Lo-fi',
    'Welshly Arms': 'Rock',
    'Lana Del Rey': 'Alt-pop',
    'sapientdream · Slushii': 'Electronic',
    'Kina': 'Electronic',
    'BONES · Eddy Baker': 'Hip-hop',
    'DMX': 'Hip-hop',
    'Auxjack': 'Electronic',
    'Coolio': 'Hip-hop',
    'Vigiland': 'Electronic',
    'MASN': 'Pop',
    'a-ha': 'Synth-pop',
    'Vance Joy': 'Indie',
    'Future': 'Hip-hop',
    'The Temper Trap': 'Indie-rock',
    'Sub Urban': 'Alt-pop',
    'Elvis Presley': 'Rock',
    'SoulChef': 'Lo-fi',
    'Jordan Critz': 'Instrumental',
    'Earth, Wind & Fire': 'Funk'
};

function updateGenres() {
    console.log('📖 Lecture du fichier playlist.json...');
    
    const data = JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8'));
    let updatedCount = 0;
    let notFoundCount = 0;
    const notFoundArtists = new Set();

    console.log(`📊 Total de pistes: ${data.tracks.length}`);
    console.log('🔄 Mise à jour des genres...\n');

    data.tracks.forEach((track, index) => {
        if (track.genre === 'Non spécifié') {
            const genre = artistGenres[track.artist];
            
            if (genre) {
                track.genre = genre;
                updatedCount++;
                console.log(`✅ Piste ${track.position}: "${track.title}" - ${track.artist} → ${genre}`);
            } else {
                notFoundCount++;
                notFoundArtists.add(track.artist);
                console.log(`⚠️  Piste ${track.position}: "${track.title}" - ${track.artist} (genre non trouvé)`);
            }
        }
    });

    // Sauvegarder le fichier mis à jour
    fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(data, null, 2), 'utf8');

    console.log('\n═══════════════════════════════════════');
    console.log('✅ MISE À JOUR TERMINÉE');
    console.log('═══════════════════════════════════════');
    console.log(`📈 Genres mis à jour: ${updatedCount}`);
    console.log(`⚠️  Artistes non trouvés: ${notFoundCount}`);
    console.log('💾 Fichier sauvegardé: playlist.json');
    
    if (notFoundArtists.size > 0) {
        console.log('\n📝 Artistes sans genre assigné:');
        Array.from(notFoundArtists).sort().forEach(artist => {
            console.log(`   - ${artist}`);
        });
    }
}

updateGenres();

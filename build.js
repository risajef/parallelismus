#!/usr/bin/env node
/**
 * Build script for Parallelismus static site.
 *
 * 1. Reads all bible/*.json files and produces a single preprocessed data file
 *    (dist/data/bible.json) containing books, chapters, verses, verseWords, and words.
 * 2. Copies frontend/ assets into dist/.
 * 3. Compiles SCSS to CSS.
 *
 * Usage:  node build.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const BIBLE_DIR = path.join(ROOT, 'bible');
const FRONTEND_DIR = path.join(ROOT, 'frontend');
const DIST_DIR = path.join(ROOT, 'dist');
const DATA_DIR = path.join(DIST_DIR, 'data');

// ── helpers ──────────────────────────────────────────────────────────────────
function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function slugToName(filename) {
    return path.basename(filename, '.json').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── 1. Preprocess bible data ─────────────────────────────────────────────────
function preprocessBible() {
    console.log('Preprocessing bible data…');
    const files = fs.readdirSync(BIBLE_DIR).filter(f => f.endsWith('.json')).sort();

    const books = [];      // { id, name }
    const chapters = [];   // { id, book_id, number }
    const verses = [];     // { id, chapter_id, number }
    const verseWords = []; // { id, verse_id, word_id, original, translation }
    const wordsMap = {};   // strong -> { strong, original: Set, translation: Set }

    let bookId = 0;
    let chapterId = 0;
    let verseId = 0;
    let vwId = 0;

    for (const file of files) {
        bookId++;
        const bookName = slugToName(file);
        books.push({ id: bookId, name: bookName });

        const raw = JSON.parse(fs.readFileSync(path.join(BIBLE_DIR, file), 'utf-8'));

        // group by chapter number (derived from id field: first 2 digits = book, next 3 = chapter, last 3 = verse)
        const byChapter = {};
        for (const entry of raw) {
            const chNum = parseInt(entry.id.substring(2, 5), 10);
            if (!byChapter[chNum]) byChapter[chNum] = [];
            byChapter[chNum].push(entry);
        }

        const chNums = Object.keys(byChapter).map(Number).sort((a, b) => a - b);
        for (const chNum of chNums) {
            chapterId++;
            chapters.push({ id: chapterId, book_id: bookId, number: chNum });

            const chVerses = byChapter[chNum];
            for (let vi = 0; vi < chVerses.length; vi++) {
                verseId++;
                verses.push({ id: verseId, chapter_id: chapterId, number: vi + 1 });

                const words = chVerses[vi].verse;
                if (!Array.isArray(words)) continue;

                // track which strong ids already appeared in this verse to avoid duplicate verseWord rows
                const seenInVerse = new Set();

                for (const w of words) {
                    if (!w || typeof w !== 'object') continue;
                    let strong = w.number;
                    if (typeof strong === 'string') strong = strong.trim();
                    if (!strong) continue;

                    const original = w.word || '';
                    const translation = w.text || '';

                    // update global word
                    if (!wordsMap[strong]) {
                        wordsMap[strong] = { strong, original: new Set(), translation: new Set() };
                    }
                    if (original) wordsMap[strong].original.add(original);
                    if (translation) wordsMap[strong].translation.add(translation);

                    // add verseWord link (one per verse+strong)
                    if (!seenInVerse.has(strong)) {
                        seenInVerse.add(strong);
                        vwId++;
                        verseWords.push({
                            id: vwId,
                            verse_id: verseId,
                            word_id: strong,
                            original: original,
                            translation: translation,
                        });
                    }
                }
            }
        }
    }

    // convert word sets to sorted arrays
    const words = Object.values(wordsMap).map(w => ({
        strong: w.strong,
        original: [...w.original].sort(),
        translation: [...w.translation].sort(),
    }));

    const data = { books, chapters, verses, verseWords, words };

    ensureDir(DATA_DIR);
    const outPath = path.join(DATA_DIR, 'bible.json');
    fs.writeFileSync(outPath, JSON.stringify(data));
    console.log(`  → ${outPath} (${(fs.statSync(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
    console.log(`  ${books.length} books, ${chapters.length} chapters, ${verses.length} verses, ${words.length} words, ${verseWords.length} verseWords`);
}

// ── 2. Copy frontend assets ─────────────────────────────────────────────────
// The static build uses *.static.{js,html} variants which get renamed to the
// non-static filenames in dist/.  Files that have a .static. counterpart are
// skipped so the static version wins.
function copyFrontend() {
    console.log('Copying frontend assets…');
    ensureDir(DIST_DIR);

    const entries = fs.readdirSync(FRONTEND_DIR);

    // Determine which base names have a .static. variant
    const staticVariants = new Set();
    for (const entry of entries) {
        const m = entry.match(/^(.+)\.static\.(js|html)$/);
        if (m) staticVariants.add(`${m[1]}.${m[2]}`);
    }

    for (const entry of entries) {
        // skip TypeScript source files and scss (we compile scss separately)
        if (entry.endsWith('.ts') || entry.endsWith('.scss')) continue;
        // skip the original file if a .static. variant exists
        if (staticVariants.has(entry)) {
            console.log(`  [skip] ${entry} (replaced by static variant)`);
            continue;
        }

        const src = path.join(FRONTEND_DIR, entry);
        // rename .static.{ext} → .{ext}
        const m = entry.match(/^(.+)\.static\.(js|html)$/);
        const destName = m ? `${m[1]}.${m[2]}` : entry;
        const dst = path.join(DIST_DIR, destName);
        fs.copyFileSync(src, dst);
        console.log(`  ${entry} → ${destName}`);
    }
}

// ── 3. Compile SCSS ──────────────────────────────────────────────────────────
function compileScss() {
    const scssFile = path.join(FRONTEND_DIR, 'styles.scss');
    if (fs.existsSync(scssFile)) {
        console.log('Compiling SCSS…');
        execSync(`npx sass "${scssFile}" "${path.join(DIST_DIR, 'styles.css')}" --no-source-map --style=compressed`, {
            cwd: ROOT,
            stdio: 'inherit',
        });
    }
}

// ── Run ──────────────────────────────────────────────────────────────────────
try {
    // clean
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }

    preprocessBible();
    copyFrontend();
    compileScss();

    console.log('\n✅ Build complete. Serve dist/ as a static site.');
} catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
}

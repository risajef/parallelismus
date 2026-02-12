/**
 * Browser-side IndexedDB database for Parallelismus.
 *
 * On first load it fetches the preprocessed bible.json and populates IndexedDB.
 * Relations are stored locally in IndexedDB and can be exported/imported as JSON.
 */

const DB_NAME = 'parallelismus';
const DB_VERSION = 1;

// Resolve DATA_URL relative to the script's own location so it works
// when embedded on a page at a different path.
const _scriptBase = (function() {
    try {
        // When loaded via the embed script, it sets a global base URL
        if (window.__PARALLELISMUS_BASE__) {
            return window.__PARALLELISMUS_BASE__;
        }
        // When loaded as a standalone script, document.currentScript is available
        if (document.currentScript && document.currentScript.src) {
            return new URL('./', document.currentScript.src).href;
        }
    } catch (e) { /* ignore */ }
    // Fallback: resolve relative to page URL
    return '';
})();
const DATA_URL = _scriptBase + 'data/bible.json';

let _db = null;
let _initPromise = null;

// ── Open / create the IndexedDB schema ──────────────────────────────────────
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev) => {
            const db = ev.target.result;
            // books
            if (!db.objectStoreNames.contains('books')) {
                db.createObjectStore('books', { keyPath: 'id' });
            }
            // chapters
            if (!db.objectStoreNames.contains('chapters')) {
                const store = db.createObjectStore('chapters', { keyPath: 'id' });
                store.createIndex('book_id', 'book_id', { unique: false });
            }
            // verses
            if (!db.objectStoreNames.contains('verses')) {
                const store = db.createObjectStore('verses', { keyPath: 'id' });
                store.createIndex('chapter_id', 'chapter_id', { unique: false });
            }
            // verseWords
            if (!db.objectStoreNames.contains('verseWords')) {
                const store = db.createObjectStore('verseWords', { keyPath: 'id' });
                store.createIndex('verse_id', 'verse_id', { unique: false });
                store.createIndex('word_id', 'word_id', { unique: false });
            }
            // words (keyed by strong id)
            if (!db.objectStoreNames.contains('words')) {
                db.createObjectStore('words', { keyPath: 'strong' });
            }
            // relations (autoIncrement id)
            if (!db.objectStoreNames.contains('relations')) {
                const store = db.createObjectStore('relations', { keyPath: 'id', autoIncrement: true });
                store.createIndex('source_id', 'source_id', { unique: false });
                store.createIndex('target_id', 'target_id', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ── Bulk-load helper ────────────────────────────────────────────────────────
function bulkPut(db, storeName, items) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        for (const item of items) store.put(item);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

function countStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ── Clear all object stores ──────────────────────────────────────────────────
function clearStore(db, storeName) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        tx.objectStore(storeName).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ── Seed bible data if empty ────────────────────────────────────────────────
async function seedIfNeeded(db, onProgress) {
    // Check the LAST table that gets loaded — if it's populated, everything is complete.
    // Previous versions only checked books, so a partial load (books+chapters+verses
    // but no words/verseWords) would never be repaired.
    const booksCount = await countStore(db, 'books');
    const vwCount = await countStore(db, 'verseWords');
    const wordsCount = await countStore(db, 'words');

    if (booksCount > 0 && vwCount > 0 && wordsCount > 0) {
        if (onProgress) onProgress('Database already loaded.');
        return;
    }

    // Incomplete data from a previous failed load — wipe everything first
    if (booksCount > 0 || vwCount > 0 || wordsCount > 0) {
        if (onProgress) onProgress('Incomplete database detected, re-downloading…');
        for (const store of ['books', 'chapters', 'verses', 'words', 'verseWords']) {
            await clearStore(db, store);
        }
    }

    if (onProgress) onProgress('Downloading bible data…');
    const resp = await fetch(DATA_URL);
    if (!resp.ok) throw new Error(`Failed to fetch ${DATA_URL}: ${resp.status}`);
    const data = await resp.json();

    if (onProgress) onProgress('Loading books…');
    await bulkPut(db, 'books', data.books);

    if (onProgress) onProgress('Loading chapters…');
    await bulkPut(db, 'chapters', data.chapters);

    if (onProgress) onProgress('Loading verses…');
    await bulkPut(db, 'verses', data.verses);

    if (onProgress) onProgress('Loading words…');
    await bulkPut(db, 'words', data.words);

    if (onProgress) onProgress('Loading verse-words (this may take a moment)…');
    // Split verseWords into chunks to avoid blocking the main thread too long
    const VW = data.verseWords;
    const CHUNK = 20000;
    for (let i = 0; i < VW.length; i += CHUNK) {
        await bulkPut(db, 'verseWords', VW.slice(i, i + CHUNK));
        if (onProgress) onProgress(`Loading verse-words… ${Math.min(i + CHUNK, VW.length)}/${VW.length}`);
    }

    if (onProgress) onProgress('Database ready.');
}

// ── Public init ─────────────────────────────────────────────────────────────
export async function initDB(onProgress) {
    if (_db) return _db;
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
        _db = await openDB();
        await seedIfNeeded(_db, onProgress);
        return _db;
    })();
    return _initPromise;
}

export function getDB() {
    if (!_db) throw new Error('DB not initialised – call initDB() first');
    return _db;
}

// ── Generic query helpers ───────────────────────────────────────────────────
function getAll(storeName) {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getByKey(storeName, key) {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function getAllByIndex(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction(storeName, 'readonly');
        const idx = tx.objectStore(storeName).index(indexName);
        const req = idx.getAll(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ── API matching the old backend endpoints ──────────────────────────────────

export async function fetchBooks() {
    return getAll('books');
}

export async function fetchChapters(bookId) {
    return getAllByIndex('chapters', 'book_id', Number(bookId));
}

export async function fetchVerses(chapterId) {
    return getAllByIndex('verses', 'chapter_id', Number(chapterId));
}

export async function fetchWords(verseId) {
    // Returns WordInVerse-like objects for a given verse
    const vws = await getAllByIndex('verseWords', 'verse_id', Number(verseId));
    // look up the global Word for each verseWord
    const result = [];
    const tx = _db.transaction('words', 'readonly');
    const store = tx.objectStore('words');
    for (const vw of vws) {
        const word = await new Promise((res, rej) => {
            const r = store.get(vw.word_id);
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
        });
        result.push({
            strong: vw.word_id,
            verse_original: vw.original || '',
            verse_translation: vw.translation || '',
            all_originals: word ? word.original : [],
            all_translations: word ? word.translation : [],
        });
    }
    return result;
}

export async function fetchVerse(verseId) {
    return getByKey('verses', Number(verseId));
}

export async function fetchChapter(chapterId) {
    const ch = await getByKey('chapters', Number(chapterId));
    if (!ch) throw new Error('Chapter not found');
    return ch;
}

export async function fetchChapterWords(chapterId) {
    // All verse-words for every verse in a chapter
    const verses = await getAllByIndex('verses', 'chapter_id', Number(chapterId));
    const result = [];
    for (const v of verses) {
        const words = await fetchWords(v.id);
        for (const w of words) {
            result.push({ verse_id: v.id, ...w });
        }
    }
    return result;
}

export async function fetchWordDetail(strong) {
    const word = await getByKey('words', strong);
    if (!word) throw new Error('Word not found');
    // find usages from verseWords
    const vws = await getAllByIndex('verseWords', 'word_id', strong);
    const usages = [];
    for (const vw of vws) {
        const verse = await getByKey('verses', vw.verse_id);
        if (!verse) continue;
        const chapter = await getByKey('chapters', verse.chapter_id);
        if (!chapter) continue;
        const book = await getByKey('books', chapter.book_id);
        if (!book) continue;
        usages.push({
            verse_id: verse.id,
            verse_number: verse.number,
            chapter_id: chapter.id,
            chapter_number: chapter.number,
            book_id: book.id,
            book_name: book.name,
            verse_original: vw.original || '',
            verse_translation: vw.translation || '',
        });
    }
    return {
        strong: word.strong,
        all_originals: word.original,
        all_translations: word.translation,
        usages,
    };
}

// ── Strong search (in-browser substring match) ──────────────────────────────
export async function fetchStrongSearch(query) {
    const term = (query || '').trim().toLowerCase();
    if (!term) return [];
    const allWords = await getAll('words');
    const out = [];
    for (const w of allWords) {
        let matched = false;
        for (const t of (w.translation || [])) {
            if (t && t.toLowerCase().includes(term)) { matched = true; break; }
        }
        if (!matched) {
            for (const o of (w.original || [])) {
                if (o && o.toLowerCase().includes(term)) { matched = true; break; }
            }
        }
        if (matched) {
            out.push({ strong: w.strong, original: w.original, translation: w.translation });
        }
    }
    return out;
}

// ── Relations CRUD ──────────────────────────────────────────────────────────

export async function addRelation(payload) {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        const store = tx.objectStore('relations');
        // omit id so autoIncrement assigns one
        const record = {
            source_id: payload.source_id,
            target_id: payload.target_id,
            relation_type: payload.relation_type,
            source_verse_id: payload.source_verse_id || null,
            notes: payload.notes || null,
        };
        const req = store.add(record);
        req.onsuccess = () => {
            record.id = req.result;
            resolve(record);
        };
        req.onerror = () => reject(req.error);
    });
}

export async function deleteRelation(relationId) {
    const rel = await getByKey('relations', Number(relationId));
    if (!rel) throw new Error('Relation not found');
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        tx.objectStore('relations').delete(Number(relationId));
        tx.oncomplete = () => resolve(rel);
        tx.onerror = () => reject(tx.error);
    });
}

export async function fetchRelations(strong) {
    const all = await getAll('relations');
    return all.filter(r => r.source_id === strong || r.target_id === strong);
}

export async function fetchGroupedRelations(strong) {
    const rels = await fetchRelations(strong);
    const groups = {};
    for (const r of rels) {
        const key = `${r.source_id}|${r.target_id}|${r.relation_type}`;
        if (!groups[key]) groups[key] = { source_id: r.source_id, target_id: r.target_id, relation_type: r.relation_type, source_verse_ids: new Set() };
        if (r.source_verse_id != null) groups[key].source_verse_ids.add(r.source_verse_id);
    }
    return Object.values(groups).map(g => ({
        ...g,
        source_verse_ids: [...g.source_verse_ids].sort((a, b) => a - b),
    }));
}

export async function fetchRelationsBatch(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return {};
    const all = await getAll('relations');
    const out = {};
    for (const id of ids) out[id] = false;
    for (const r of all) {
        if (out.hasOwnProperty(r.source_id)) out[r.source_id] = true;
        if (out.hasOwnProperty(r.target_id)) out[r.target_id] = true;
    }
    return out;
}

export async function fetchRelationsCounts(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return {};
    const all = await getAll('relations');
    const out = {};
    for (const id of ids) out[id] = 0;
    for (const r of all) {
        if (out.hasOwnProperty(r.source_id)) out[r.source_id]++;
        if (out.hasOwnProperty(r.target_id)) out[r.target_id]++;
    }
    return out;
}

export async function fetchRelationTypes() {
    const all = await getAll('relations');
    const types = new Set();
    for (const r of all) if (r.relation_type) types.add(r.relation_type);
    return [...types].sort();
}

export async function fetchAllRelations(limit = 500, relationType = null) {
    let all = await getAll('relations');
    if (relationType) all = all.filter(r => r.relation_type === relationType);
    if (limit) all = all.slice(0, limit);
    // build labels
    const ids = new Set();
    for (const r of all) {
        if (r.source_id) ids.add(r.source_id);
        if (r.target_id) ids.add(r.target_id);
    }
    const wordMap = {};
    const tx = _db.transaction('words', 'readonly');
    const store = tx.objectStore('words');
    for (const id of ids) {
        const w = await new Promise((res, rej) => { const r = store.get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        if (w) wordMap[id] = w;
    }
    function buildLabel(word, fallback) {
        if (!word) return fallback;
        if (Array.isArray(word.translation) && word.translation[0]) return `${fallback} — ${word.translation[0]}`;
        if (Array.isArray(word.original) && word.original[0]) return `${fallback} — ${word.original[0]}`;
        return fallback;
    }
    return all.map(r => ({
        id: r.id,
        source_id: r.source_id,
        target_id: r.target_id,
        relation_type: r.relation_type,
        source_label: buildLabel(wordMap[r.source_id], r.source_id || ''),
        target_label: buildLabel(wordMap[r.target_id], r.target_id || ''),
    }));
}

// ── Export / Import relations ────────────────────────────────────────────────

export async function exportRelations() {
    const all = await getAll('relations');
    return JSON.stringify(all, null, 2);
}

export async function importRelations(jsonString) {
    const records = JSON.parse(jsonString);
    if (!Array.isArray(records)) throw new Error('Expected an array of relation objects');
    // clear existing relations first
    await new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        tx.objectStore('relations').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    // add imported relations
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        const store = tx.objectStore('relations');
        for (const rec of records) {
            // preserve id if present
            store.put(rec);
        }
        tx.oncomplete = () => resolve(records.length);
        tx.onerror = () => reject(tx.error);
    });
}

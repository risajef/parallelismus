/**
 * Browser-side data layer for Parallelismus.
 *
 * Bible data (books, chapters, verses, words) is kept **in memory** and loaded
 * lazily per-chapter from small JSON files produced at build time.  This avoids
 * the old approach of downloading a 44 MB blob and bulk-inserting 380 K rows
 * into IndexedDB on the first visit.
 *
 * Only user-created **relations** are persisted in IndexedDB.
 */

// ── Base URL resolution ─────────────────────────────────────────────────────
const _base = (function () {
    try {
        if (window.__PARALLELISMUS_BASE__) return window.__PARALLELISMUS_BASE__;
        if (document.currentScript && document.currentScript.src)
            return new URL('./', document.currentScript.src).href;
    } catch (_) { /* ignore */ }
    return '';
})();

const INDEX_URL = _base + 'data/bible-index.json';
function chapterUrl(id) { return _base + 'data/chapters/' + id + '.json'; }

// ── In-memory stores (populated from index + lazy chapter files) ────────────
let _books = [];           // { id, name }[]
let _chapters = [];        // { id, book_id, number }[]
let _verses = [];          // { id, chapter_id, number }[]
let _wordsMap = {};        // strong → { strong, original[], translation[] }
let _chapterIdx = {};      // book_id  → chapter[]
let _verseIdx = {};        // chapter_id → verse[]
let _verseToChapter = {};  // verse_id → chapter_id  (fast reverse lookup)

// Per-chapter verse-word cache  chapter_id → { verses: [{ id, number, words: [[strong,orig,trans],...] }] }
const _chapterCache = {};

// ── IndexedDB for relations only ────────────────────────────────────────────
const DB_NAME = 'parallelismus';
const DB_VERSION = 2;      // bumped – old stores will be deleted on upgrade
let _db = null;

function openRelationsDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (ev) => {
            const db = ev.target.result;
            // Remove old bible data stores if present (migration from v1)
            for (const name of ['books', 'chapters', 'verses', 'verseWords', 'words']) {
                if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
            }
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

// ── Public init ─────────────────────────────────────────────────────────────
let _initPromise = null;

export async function initDB(onProgress) {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
        if (onProgress) onProgress('Loading bible index…');
        const resp = await fetch(INDEX_URL);
        if (!resp.ok) throw new Error(`Failed to fetch ${INDEX_URL}: ${resp.status}`);
        const data = await resp.json();

        _books = data.books;
        _chapters = data.chapters;
        _verses = data.verses;

        // Build word dictionary
        _wordsMap = {};
        for (const w of data.words) _wordsMap[w.strong] = w;

        // Build lookup indices
        _chapterIdx = {};
        for (const c of _chapters) {
            if (!_chapterIdx[c.book_id]) _chapterIdx[c.book_id] = [];
            _chapterIdx[c.book_id].push(c);
        }
        _verseIdx = {};
        _verseToChapter = {};
        for (const v of _verses) {
            if (!_verseIdx[v.chapter_id]) _verseIdx[v.chapter_id] = [];
            _verseIdx[v.chapter_id].push(v);
            _verseToChapter[v.id] = v.chapter_id;
        }

        // Open IndexedDB for relations
        _db = await openRelationsDB();
        if (onProgress) onProgress('Ready.');
    })();
    return _initPromise;
}

// ── Lazy chapter loading ────────────────────────────────────────────────────
async function ensureChapter(chapterId) {
    if (_chapterCache[chapterId]) return _chapterCache[chapterId];
    const resp = await fetch(chapterUrl(chapterId));
    if (!resp.ok) throw new Error(`Failed to fetch chapter ${chapterId}: ${resp.status}`);
    const data = await resp.json();
    _chapterCache[chapterId] = data;
    return data;
}

// ── API matching the old interface ──────────────────────────────────────────

export async function fetchBooks() {
    return _books;
}

export async function fetchChapters(bookId) {
    return _chapterIdx[Number(bookId)] || [];
}

export async function fetchVerses(chapterId) {
    return _verseIdx[Number(chapterId)] || [];
}

export async function fetchWords(verseId) {
    const cid = _verseToChapter[Number(verseId)];
    if (cid == null) return [];
    const chData = await ensureChapter(cid);
    const vData = chData.verses.find(v => v.id === Number(verseId));
    if (!vData || !vData.words) return [];

    return vData.words.map(w => {
        // w is [strong, original, translation]
        const strong = w[0];
        const word = _wordsMap[strong];
        return {
            strong,
            verse_original: w[1] || '',
            verse_translation: w[2] || '',
            all_originals: word ? word.original : [],
            all_translations: word ? word.translation : [],
        };
    });
}

export async function fetchVerse(verseId) {
    return _verses.find(v => v.id === Number(verseId)) || null;
}

export async function fetchChapter(chapterId) {
    const ch = _chapters.find(c => c.id === Number(chapterId));
    if (!ch) throw new Error('Chapter not found');
    return ch;
}

export async function fetchChapterWords(chapterId) {
    const chData = await ensureChapter(Number(chapterId));
    const result = [];
    for (const v of chData.verses) {
        for (const w of v.words) {
            const strong = w[0];
            const word = _wordsMap[strong];
            result.push({
                verse_id: v.id,
                strong,
                verse_original: w[1] || '',
                verse_translation: w[2] || '',
                all_originals: word ? word.original : [],
                all_translations: word ? word.translation : [],
            });
        }
    }
    return result;
}

export async function fetchWordDetail(strong) {
    const word = _wordsMap[strong];
    if (!word) throw new Error('Word not found');

    // Scan cached chapters for usages (avoids fetching all 1188 chapters)
    const usages = [];
    for (const [cid, chData] of Object.entries(_chapterCache)) {
        const chapter = _chapters.find(c => c.id === Number(cid));
        if (!chapter) continue;
        const book = _books.find(b => b.id === chapter.book_id);
        for (const v of chData.verses) {
            for (const w of v.words) {
                if (w[0] === strong) {
                    usages.push({
                        verse_id: v.id,
                        verse_number: v.number,
                        chapter_id: chapter.id,
                        chapter_number: chapter.number,
                        book_id: book ? book.id : 0,
                        book_name: book ? book.name : '',
                        verse_original: w[1] || '',
                        verse_translation: w[2] || '',
                    });
                }
            }
        }
    }
    return {
        strong: word.strong,
        all_originals: word.original,
        all_translations: word.translation,
        usages,
    };
}

// ── Strong search (in-memory substring match) ──────────────────────────────
export async function fetchStrongSearch(query) {
    const term = (query || '').trim().toLowerCase();
    if (!term) return [];
    const out = [];
    for (const w of Object.values(_wordsMap)) {
        let matched = false;
        for (const t of (w.translation || [])) {
            if (t && t.toLowerCase().includes(term)) { matched = true; break; }
        }
        if (!matched) {
            for (const o of (w.original || [])) {
                if (o && o.toLowerCase().includes(term)) { matched = true; break; }
            }
        }
        if (!matched && w.strong && w.strong.toLowerCase().includes(term)) {
            matched = true;
        }
        if (matched) {
            out.push({ strong: w.strong, original: w.original, translation: w.translation });
        }
    }
    return out;
}

// ── IndexedDB helpers for relations ─────────────────────────────────────────

function relGetAll() {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readonly');
        const req = tx.objectStore('relations').getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function relGet(id) {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readonly');
        const req = tx.objectStore('relations').get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// ── Relations CRUD ──────────────────────────────────────────────────────────

export async function addRelation(payload) {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        const store = tx.objectStore('relations');
        const record = {
            source_id: payload.source_id,
            target_id: payload.target_id,
            relation_type: payload.relation_type,
            source_verse_id: payload.source_verse_id || null,
            notes: payload.notes || null,
        };
        const req = store.add(record);
        req.onsuccess = () => { record.id = req.result; resolve(record); };
        req.onerror = () => reject(req.error);
    });
}

export async function deleteRelation(relationId) {
    const rel = await relGet(Number(relationId));
    if (!rel) throw new Error('Relation not found');
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        tx.objectStore('relations').delete(Number(relationId));
        tx.oncomplete = () => resolve(rel);
        tx.onerror = () => reject(tx.error);
    });
}

export async function fetchRelations(strong) {
    const all = await relGetAll();
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
    const all = await relGetAll();
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
    const all = await relGetAll();
    const out = {};
    for (const id of ids) out[id] = 0;
    for (const r of all) {
        if (out.hasOwnProperty(r.source_id)) out[r.source_id]++;
        if (out.hasOwnProperty(r.target_id)) out[r.target_id]++;
    }
    return out;
}

export async function fetchRelationTypes() {
    const all = await relGetAll();
    const types = new Set();
    for (const r of all) if (r.relation_type) types.add(r.relation_type);
    return [...types].sort();
}

export async function fetchAllRelations(limit = 500, relationType = null) {
    let all = await relGetAll();
    if (relationType) all = all.filter(r => r.relation_type === relationType);
    if (limit) all = all.slice(0, limit);
    function buildLabel(strong) {
        const w = _wordsMap[strong];
        if (!w) return strong || '';
        if (Array.isArray(w.translation) && w.translation[0]) return `${strong} — ${w.translation[0]}`;
        if (Array.isArray(w.original) && w.original[0]) return `${strong} — ${w.original[0]}`;
        return strong || '';
    }
    return all.map(r => ({
        id: r.id,
        source_id: r.source_id,
        target_id: r.target_id,
        relation_type: r.relation_type,
        source_label: buildLabel(r.source_id),
        target_label: buildLabel(r.target_id),
    }));
}

// ── Export / Import relations ────────────────────────────────────────────────

export async function exportRelations() {
    const all = await relGetAll();
    return JSON.stringify(all, null, 2);
}

export async function importRelations(jsonString) {
    const records = JSON.parse(jsonString);
    if (!Array.isArray(records)) throw new Error('Expected an array of relation objects');
    await new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        tx.objectStore('relations').clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        const store = tx.objectStore('relations');
        for (const rec of records) store.put(rec);
        tx.oncomplete = () => resolve(records.length);
        tx.onerror = () => reject(tx.error);
    });
}

// ── Transliteration ─────────────────────────────────────────────────────────
function stripDiacritics(s) {
    try { return s.normalize('NFD').replace(/\p{M}/gu, ''); } catch { return s; }
}

function transliterateGreek(s) {
    if (!s) return '';
    let t = stripDiacritics(s.toLowerCase());
    const map = {α:'a',β:'b',γ:'g',δ:'d',ε:'e',ζ:'z',η:'e',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'u',φ:'ph',χ:'ch',ψ:'ps',ω:'o'};
    let out = '';
    for (const c of t) out += map[c] !== undefined ? map[c] : (/[a-z0-9]/.test(c) ? c : '');
    return out.replace(/uu/g, 'u').replace(/phh/g, 'ph');
}

function transliterateHebrew(s) {
    if (!s) return '';
    const t = s.normalize('NFD');
    const cmap = {'\u05D0':'','\u05D1':'b','\u05D2':'g','\u05D3':'d','\u05D4':'h','\u05D5':'v','\u05D6':'z','\u05D7':'ch','\u05D8':'t','\u05D9':'y','\u05DB':'k','\u05DA':'k','\u05DC':'l','\u05DE':'m','\u05DD':'m','\u05E0':'n','\u05E1':'s','\u05E2':'','\u05E3':'p','\u05E4':'p','\u05E5':'ts','\u05E6':'ts','\u05E7':'q','\u05E8':'r','\u05E9':'sh','\u05EA':'t'};
    const vmap = {'\u05B0':'e','\u05B1':'e','\u05B2':'a','\u05B3':'a','\u05B4':'i','\u05B5':'e','\u05B6':'e','\u05B7':'a','\u05B8':'a','\u05B9':'o','\u05BB':'u','\u05C7':'o'};
    const shinDot = '\u05C1', sinDot = '\u05C2';
    const parts = []; let last = -1;
    for (let i = 0; i < t.length; i++) {
        const ch = t[i], cp = ch.codePointAt(0);
        if (cp >= 0x05D0 && cp <= 0x05EA) { parts.push(cmap[ch] !== undefined ? cmap[ch] : ''); last = parts.length - 1; continue; }
        if (vmap[ch]) { if (last >= 0) parts[last] += vmap[ch]; else { parts.push(vmap[ch]); last = parts.length - 1; } continue; }
        if (ch === sinDot) { if (last >= 0 && parts[last].endsWith('sh')) parts[last] = parts[last].slice(0, -2) + 's'; continue; }
        if (ch === shinDot) { if (last >= 0 && parts[last].endsWith('s')) parts[last] += 'h'; continue; }
        if (/[A-Za-z0-9]/.test(ch)) { parts.push(ch); last = parts.length - 1; }
    }
    let out = parts.join(' ').replace(/\s+/g, ' ').trim();
    return out.replace(/''/g, "'").toLowerCase();
}

export function transliterate(s) {
    if (!s) return '';
    try {
        if (/\p{Script=Greek}/u.test(s)) return transliterateGreek(s);
        if (/\p{Script=Hebrew}/u.test(s)) return transliterateHebrew(s);
    } catch {
        if (/[\u0370-\u03FF]/.test(s)) return transliterateGreek(s);
        if (/[\u0590-\u05FF]/.test(s)) return transliterateHebrew(s);
    }
    return '';
}

export {transliterate} from './transliterate.js';
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

const RELATION_TYPES = [
    'composes',
    'opposite',
    'similar',
    'element_of',
    'subset_of',
    'attribute_of',
];

// ── In-memory stores (populated from index + lazy chapter files) ────────────
let _corpus;
let _legacyVerseKeys = {};
let _books = [];           // { id, name }[]
let _chapters = [];        // { id, book_id, number }[]
let _verses = [];          // { id, chapter_id, number }[]
let _wordsMap = {};        // strong → { strong, original[], translation[] }
let _chapterIdx = {};      // book_id  → chapter[]
let _verseIdx = {};        // chapter_id → verse[]
let _verseToChapter = {};  // verse_id → chapter_id  (fast reverse lookup)

// Per-chapter verse-word cache  chapter_id → { verses: [{ id, number, words: [[strong,orig,trans],...] }] }
const _chapterCache = {};
const _usageCache = new Map();

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
        req.onsuccess = () => {
            req.result.onversionchange = () => {req.result.close();_db = null;_initPromise = null;};
            resolve(req.result);
        };
        req.onblocked = () => reject(new Error('Close other Parallelismus tabs and retry the database upgrade'));
        req.onerror = () => reject(req.error);
    });
}

function resolveReference(record) {
    const key = record.source_verse_key ?? _legacyVerseKeys[record.source_verse_id];
    if (key == null) {
        throw new Error('Unknown legacy evidence verse; restore a compatible backup');
    }
    const verse = _verses.find(v => v.key === key);
    if (!verse) throw new Error('Evidence verse is absent from this corpus: ' + key);
    return {...record, source_verse_id:verse.id, source_verse_key:key};
}
async function migrateRelationReferences() {
    return new Promise((resolve,reject) => {
        const tx = _db.transaction('relations','readwrite');
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || new Error('Could not migrate evidence references; data preserved'));
        const store = tx.objectStore('relations');
        store.getAll().onsuccess = ev => {
            try { for (const record of ev.target.result) store.put(resolveReference(record)); }
            catch (err) {tx.abort();reject(err);}
        };
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

        if (data.corpus?.id !== 'strong-bible-v1') throw new Error('Incompatible corpus index; rebuild application data');
        _corpus = data.corpus;
        _legacyVerseKeys = data.legacyVerseKeys || {};
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
        await migrateRelationReferences();
        if (onProgress) onProgress('Ready.');
    })().catch(err => { _initPromise = null; throw err; });
    return _initPromise;
}

// ── Lazy chapter loading ────────────────────────────────────────────────────
async function ensureChapter(chapterId) {
    if (!_chapterCache[chapterId]) {
        _chapterCache[chapterId] = fetch(chapterUrl(chapterId)).then(async resp => {
            if (!resp.ok) throw new Error(`Failed to fetch chapter ${chapterId}: ${resp.status}`);
            return resp.json();
        }).catch(err => {delete _chapterCache[chapterId];throw err;});
    }
    return _chapterCache[chapterId];
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

    const shard = encodeURIComponent(strong.slice(0, 2));
    if (!_usageCache.has(shard)) {
        _usageCache.set(shard, fetch(_base + 'data/usages/' + shard + '.json').then(async resp => {
            if (!resp.ok) throw new Error('Failed to fetch word usages');
            return resp.json();
        }).catch(err => { _usageCache.delete(shard); throw err; }));
    }
    const rows = (await _usageCache.get(shard))[strong] || [];
    const usages = rows.map(([verseId, original, translation]) => {
        const verse = _verses.find(v => v.id === verseId);
        const chapter = _chapters.find(c => c.id === verse.chapter_id);
        const book = _books.find(b => b.id === chapter.book_id);
        return { verse_id: verseId, verse_number: verse.number, chapter_id: chapter.id,
            chapter_number: chapter.number, book_id: book.id, book_name: book.name,
            verse_original: original, verse_translation: translation };
    });
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

function validateRelation(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid relation object');
    if (!Object.hasOwn(_wordsMap, payload.source_id) || !Object.hasOwn(_wordsMap, payload.target_id)) throw new Error('Unknown relation endpoint');
    if (!RELATION_TYPES.includes(payload.relation_type)) throw new Error('Unknown relation type');
    if (!Number.isSafeInteger(payload.source_verse_id) || !Object.hasOwn(_verseToChapter, payload.source_verse_id)) throw new Error('Unknown evidence verse');
    if (payload.notes != null && (typeof payload.notes !== 'string' || payload.notes.length > 10000)) throw new Error('Invalid notes');
    if (payload.composition_id != null && (typeof payload.composition_id !== 'string' || !/^[a-zA-Z0-9-]{1,64}$/.test(payload.composition_id))) throw new Error('Invalid composition ID');
    return {source_id:payload.source_id, target_id:payload.target_id, relation_type:payload.relation_type,
        source_verse_id:payload.source_verse_id, source_verse_key: _verses.find(v => v.id === payload.source_verse_id)?.key ?? String(payload.source_verse_id), notes:payload.notes ?? null, composition_id: payload.composition_id ?? null};
}
function relationKey(r) { return JSON.stringify([r.source_id,r.target_id,r.relation_type,r.source_verse_id,r.composition_id ?? null]); }

export async function addRelations(payloads) {
    const records = payloads.map(validateRelation);
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        tx.oncomplete = () => resolve(records);
        tx.onerror = () => {};
        tx.onabort = () => reject(tx.error || new Error('Relation write aborted'));
        const store = tx.objectStore('relations');
        store.getAll().onsuccess = ev => {
            const keys = new Set(ev.target.result.map(relationKey));
            try {
                for (const rec of records) {
                    const key = relationKey(rec);
                    if (keys.has(key)) throw new Error('Relation already exists for this evidence verse');
                    keys.add(key);
                    store.add(rec).onsuccess = ev => { rec.id = ev.target.result; };
                }
            } catch (err) { tx.abort(); reject(err); }
        };
    });
}
export async function addRelation(payload) { return (await addRelations([payload]))[0]; }

export async function addComposition(members, target, evidence) {
    const composition_id = crypto.randomUUID();
    return addRelations(members.map(source_id => ({source_id,target_id:target,relation_type:'composes',source_verse_id:evidence,composition_id})));
}
export async function deleteComposition(id) {
    return new Promise((resolve,reject) => {
        const tx = _db.transaction('relations','readwrite');
        tx.oncomplete = resolve;tx.onabort = () => reject(tx.error || new Error('Composition deletion aborted'));
        const store = tx.objectStore('relations');
        store.getAll().onsuccess = ev => {for (const row of ev.target.result) if (row.composition_id === id) store.delete(row.id);};
    });
}

export async function deleteRelation(relationId) {
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        let record;
        tx.oncomplete = () => resolve(record);
        tx.onabort = () => reject(tx.error || new Error('Delete aborted'));
        const store = tx.objectStore('relations');
        store.get(Number(relationId)).onsuccess = ev => {
            record = ev.target.result;
            if (!record || record.composition_id) { tx.abort(); return; }
            store.delete(Number(relationId));
        };
    });
}

export async function fetchRelations(strong) {
    return new Promise((resolve,reject) => {
        const tx = _db.transaction('relations','readonly');
        const store = tx.objectStore('relations');
        let source = [], target = [];
        tx.onabort = () => reject(tx.error || new Error('Relation query aborted'));
        tx.oncomplete = () => resolve([...new Map([...source,...target].map(r => [r.id,r])).values()]);
        store.index('source_id').getAll(strong).onsuccess = ev => {source = ev.target.result;};
        store.index('target_id').getAll(strong).onsuccess = ev => {target = ev.target.result;};
    });
}

export async function fetchGroupedRelations(strong) {
    const rels = await fetchRelations(strong);
    const groups = {};
    for (const r of rels) {
        const key = `${r.source_id}|${r.target_id}|${r.relation_type}|${r.composition_id || ""}`;
        if (!groups[key]) groups[key] = { source_id: r.source_id, target_id: r.target_id, relation_type: r.relation_type, composition_id: r.composition_id, source_verse_ids: new Set() };
        if (r.source_verse_id != null) groups[key].source_verse_ids.add(r.source_verse_id);
    }
    return Object.values(groups).map(g => ({
        ...g,
        source_verse_ids: [...g.source_verse_ids].sort((a, b) => a - b),
    }));
}

export async function fetchRelationsBatch(ids) {
    const counts = await fetchRelationsCounts(ids);
    return Object.fromEntries(Object.entries(counts).map(([id,count]) => [id,count > 0]));
}
export async function fetchRelationsCounts(ids) {
    const entries = await Promise.all([...new Set(ids || [])].map(async id => [id,(await fetchRelations(id)).length]));
    return Object.fromEntries(entries);
}

export async function fetchRelationTypes() {
    return RELATION_TYPES.slice();
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
    return JSON.stringify({ format: 'parallelismus-relations', version: 1, corpus: _corpus, relations: all }, null, 2);
}

export async function importRelations(jsonString, { mode = 'merge' } = {}) {
    const backup = JSON.parse(jsonString);
    const records = Array.isArray(backup) ? backup : backup.relations;
    if (!Array.isArray(backup) && (backup.format !== 'parallelismus-relations' || backup.version !== 1 || backup.corpus?.id !== _corpus.id)) throw new Error('Incompatible relation backup');
    if (!Array.isArray(records)) throw new Error('Expected an array of relation objects');
    if (!['merge', 'replace'].includes(mode)) throw new Error('Unknown import mode');
    const ids = new Set();
    const validated = records.map((rec) => {
        const clean = validateRelation(resolveReference(rec));
        if (rec.id != null && (!Number.isSafeInteger(rec.id) || rec.id < 1 || ids.has(rec.id))) throw new Error('Invalid or duplicate relation ID');
        ids.add(rec.id);
        const record = clean;
        if (mode === 'replace' && rec.id != null) record.id = rec.id;
        return record;
    });
    return new Promise((resolve, reject) => {
        const tx = _db.transaction('relations', 'readwrite');
        let count = 0;
        tx.oncomplete = () => resolve(count);
        tx.onabort = () => reject(tx.error || new Error('Import aborted; existing relations preserved'));
        tx.onerror = () => {};
        const store = tx.objectStore('relations');
        store.getAll().onsuccess = event => {
            try {
                const existing = new Set(mode === 'merge' ? event.target.result.map(relationKey) : []);
                const seen = new Set();
                for (const record of validated) {
                    const key = relationKey(record);
                    if (seen.has(key)) throw new Error('Duplicate assertion in backup');
                    seen.add(key);
                }
                if (mode === 'replace') store.clear();
                for (const record of validated) {
                    if (existing.has(relationKey(record))) continue;
                    store.add(record);count++;
                }
            } catch (err) { tx.abort();reject(err); }
        };
    });
}


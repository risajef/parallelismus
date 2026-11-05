export function setWriteToken(token) { sessionStorage.setItem('parallelismus-write-token', token); }
function writeHeaders() {
    const token = sessionStorage.getItem('parallelismus-write-token') || '';
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
}
// Compiled JS from app.ts (minimal, ES6)
// Detect API base robustly: if running on localhost/127.0.0.1 or served by the same origin,
// prefer the page origin. Otherwise default to empty which uses relative paths.
let apiBase = '';
try {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
        // assume backend is on same origin/port used to load the page
        apiBase = window.location.origin;
    } else {
        apiBase = window.location.origin;
    }
} catch (e) {
    apiBase = '';
}
export async function fetchBooks() {
    const res = await fetch(`${apiBase}/books`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchBooks failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchBooks returned HTML instead of JSON');
        return res.json();
}
export async function fetchChapters(bookId) {
    const res = await fetch(`${apiBase}/books/${bookId}/chapters`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchChapters failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchChapters returned HTML instead of JSON');
        return res.json();
}
export async function fetchVerses(chapterId) {
    const res = await fetch(`${apiBase}/chapters/${chapterId}/verses`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchVerses failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchVerses returned HTML instead of JSON');
        return res.json();
}
export async function fetchWords(verseId) {
    const res = await fetch(`${apiBase}/verses/${verseId}/words`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchWords failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchWords returned HTML instead of JSON');
        return res.json();
}
export async function addRelation(payload) {
    const res = await fetch(`${apiBase}/relations`, {
        method: 'POST',
        headers: writeHeaders(),
        body: JSON.stringify(payload),
    });
    return res.json();
}

export async function fetchVerse(verseId) {
    const res = await fetch(`${apiBase}/verse/${verseId}`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchVerse failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchVerse returned HTML instead of JSON');
        return res.json();
}

export async function fetchRelations(strong) {
    const res = await fetch(`${apiBase}/words/${encodeURIComponent(strong)}/relations`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchRelations failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchRelations returned HTML instead of JSON');
        return res.json();
}

export async function fetchRelationTypes() {
    const res = await fetch(`${apiBase}/relation_types`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchRelationTypes failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchRelationTypes returned HTML instead of JSON');
        return res.json();
}

export async function fetchGroupedRelations(strong) {
    const res = await fetch(`${apiBase}/relations/grouped/${encodeURIComponent(strong)}`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchGroupedRelations failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchGroupedRelations returned HTML instead of JSON');
        return res.json();
}

export async function fetchRelationsBatch(ids) {
    // ids: array of strong ids
    if (!Array.isArray(ids) || ids.length === 0) return {};
    const q = ids.join(',');
    const res = await fetch(`${apiBase}/relations/batch?ids=${encodeURIComponent(q)}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`fetchRelationsBatch failed: ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) throw new Error('fetchRelationsBatch returned HTML instead of JSON');
    return res.json();
}

export async function fetchRelationsCounts(ids) {
    // ids: array of strong ids
    if (!Array.isArray(ids) || ids.length === 0) return {};
    const q = ids.join(',');
    const res = await fetch(`${apiBase}/relations/counts?ids=${encodeURIComponent(q)}`, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`fetchRelationsCounts failed: ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('text/html')) throw new Error('fetchRelationsCounts returned HTML instead of JSON');
    return res.json();
}

export async function fetchChapter(chapterId) {
    const res = await fetch(`${apiBase}/chapter/${chapterId}`, { headers: { 'Accept': 'application/json' } });
        if (!res.ok) throw new Error(`fetchChapter failed: ${res.status} ${res.statusText}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/html')) throw new Error('fetchChapter returned HTML instead of JSON');
        return res.json();
}

export async function fetchWordDetail(strong) {
    const res = await fetch(`${apiBase}/words/${encodeURIComponent(strong)}/detail`);
    if (!res.ok) throw new Error('Failed to fetch word detail');
    return res.json();
}

export async function deleteRelation(relationId) {
    const res = await fetch(`${apiBase}/relations/${relationId}`, {
        method: 'DELETE',
        headers: writeHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete relation');
    return res.json();
}

export async function fetchStrongSearch(query) {
    // search words by translation/original substring matching (case-insensitive)
    // Send an explicit Accept header to request JSON and avoid HTML fallbacks from content-negotiation
    const res = await fetch(`${apiBase}/strong/search?q=${encodeURIComponent(query)}`, {
        headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
        // try to surface HTML body or status info
        const txt = await res.text().catch(()=>'');
        const headers = Array.from(res.headers.entries()).slice(0,6).map(h=>h.join(': ')).join('; ');
        throw new Error(`Search failed: status=${res.status} ${res.statusText}; headers=${headers}; bodyPreview=${txt.slice(0,300)}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
        const body = await res.text().catch(()=>'<html response>');
        const headers = Array.from(res.headers.entries()).slice(0,6).map(h=>h.join(': ')).join('; ');
        throw new Error(`Search returned HTML (probably wrong route): status=${res.status} ${res.statusText}; headers=${headers}; bodyPreview=${body.slice(0,400)}`);
    }
    return res.json();
}

export {transliterate} from './transliterate.js';

export async function initDB(onProgress) { onProgress?.('Ready.'); }
export const storageMode = 'backend';
export async function fetchAllRelations(limit = 500, relationType = null) {
    const params = new URLSearchParams({limit: String(limit)});
    if (relationType) params.set('relation_type', relationType);
    const response = await fetch(`${apiBase}/relations/all?${params}`);
    if (!response.ok) throw new Error('Failed to fetch relations');
    return response.json();
}

export async function addComposition(members, target, evidence) {
    const response = await fetch(`${apiBase}/compositions`, {method:'POST',headers:writeHeaders(),body:JSON.stringify({members,target_id:target,source_verse_id:evidence})});
    if (!response.ok) throw new Error('Composition write failed: ' + response.status);
    return response.json();
}
export async function deleteComposition(id) {
    const response = await fetch(`${apiBase}/compositions/${encodeURIComponent(id)}`, {method:'DELETE',headers:writeHeaders()});
    if (!response.ok) throw new Error('Composition deletion failed: ' + response.status);
    return response.json();
}

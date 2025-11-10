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
        headers: { 'Content-Type': 'application/json' },
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

// Lightweight transliteration utility (exported for other pages)
function removeCombiningMarks(s) {
    try { return s.normalize('NFD').replace(/\p{M}/gu, ''); } catch (e) { return s; }
}
function transliterateGreek(s) {
    if (!s) return '';
    let t = removeCombiningMarks(s.toLowerCase());
    const map = { 'α':'a','β':'b','γ':'g','δ':'d','ε':'e','ζ':'z','η':'e','θ':'th','ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p','ρ':'r','σ':'s','ς':'s','τ':'t','υ':'u','φ':'ph','χ':'ch','ψ':'ps','ω':'o' };
    let out = '';
    for (const ch of t) out += (map[ch] !== undefined) ? map[ch] : (/[a-z0-9]/.test(ch) ? ch : '');
    out = out.replace(/uu/g, 'u').replace(/phh/g, 'ph');
    return out;
}
function transliterateHebrew(s) {
    if (!s) return '';
    let t = removeCombiningMarks(s);
    const map = { '\u05D0':'','\u05D1':'b','\u05D2':'g','\u05D3':'d','\u05D4':'h','\u05D5':'v','\u05D6':'z','\u05D7':'ch','\u05D8':'t','\u05D9':'y','\u05DB':'k','\u05DA':'k','\u05DC':'l','\u05DE':'m','\u05DD':'m','\u05E0':'n','\u05E1':'s','\u05E2':'','\u05E3':'p','\u05E4':'p','\u05E5':'ts','\u05E6':'ts','\u05E7':'q','\u05E8':'r','\u05E9':'sh','\u05EA':'t' };
    let out = '';
    for (const ch of t) out += (map[ch] !== undefined) ? map[ch] : (/[A-Za-z0-9]/.test(ch) ? ch : '');
    out = out.replace(/''/g, "'").replace(/\s+/g, ' ').trim();
    return out.toLowerCase();
}
export function transliterate(s) {
    if (!s) return '';
    try { if (/\p{Script=Greek}/u.test(s)) return transliterateGreek(s); if (/\p{Script=Hebrew}/u.test(s)) return transliterateHebrew(s); } catch (e) { if (/[\u0370-\u03FF]/.test(s)) return transliterateGreek(s); if (/[\u0590-\u05FF]/.test(s)) return transliterateHebrew(s); }
    return '';
}

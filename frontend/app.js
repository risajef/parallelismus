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
    const res = await fetch(`${apiBase}/books`);
    return res.json();
}
export async function fetchChapters(bookId) {
    const res = await fetch(`${apiBase}/books/${bookId}/chapters`);
    return res.json();
}
export async function fetchVerses(chapterId) {
    const res = await fetch(`${apiBase}/chapters/${chapterId}/verses`);
    return res.json();
}
export async function fetchWords(verseId) {
    const res = await fetch(`${apiBase}/verses/${verseId}/words`);
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
    const res = await fetch(`${apiBase}/verse/${verseId}`);
    return res.json();
}

export async function fetchRelations(strong) {
    const res = await fetch(`${apiBase}/words/${encodeURIComponent(strong)}/relations`);
    return res.json();
}

export async function fetchRelationTypes() {
    const res = await fetch(`${apiBase}/relation_types`);
    return res.json();
}

export async function fetchGroupedRelations(strong) {
    const res = await fetch(`${apiBase}/relations/grouped/${encodeURIComponent(strong)}`);
    return res.json();
}

export async function fetchChapter(chapterId) {
    const res = await fetch(`${apiBase}/chapter/${chapterId}`);
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

export function evidenceVerse(selectedVerseIds, fallback) {
    const ids = [...new Set(selectedVerseIds.map(Number))];
    if (ids.length > 1) throw new Error('Select words from one evidence verse at a time');
    const id = ids.length ? ids[0] : Number(fallback);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Select an evidence verse');
    return id;
}

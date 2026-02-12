/**
 * API adapter – re-exports everything from the IndexedDB-based db.js module.
 * Consumers (index.js, strong_search.js, strong.html, graph.js) import from
 * this file and get the same function signatures as before.
 */
export {
    initDB,
    fetchBooks,
    fetchChapters,
    fetchVerses,
    fetchWords,
    fetchVerse,
    fetchChapter,
    fetchChapterWords,
    fetchWordDetail,
    fetchStrongSearch,
    addRelation,
    deleteRelation,
    fetchRelations,
    fetchGroupedRelations,
    fetchRelationsBatch,
    fetchRelationsCounts,
    fetchRelationTypes,
    fetchAllRelations,
    exportRelations,
    importRelations,
} from './db.js';

// ── Transliteration utilities (kept here for backward-compat imports) ────────

function removeCombiningMarks(s) {
    try { return s.normalize('NFD').replace(/\p{M}/gu, ''); } catch (e) { return s; }
}

function transliterateGreek(s) {
    if (!s) return '';
    let t = removeCombiningMarks(s.toLowerCase());
    const map = { 'α': 'a', 'β': 'b', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'e', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'u', 'φ': 'ph', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o' };
    let out = '';
    for (const ch of t) out += (map[ch] !== undefined) ? map[ch] : (/[a-z0-9]/.test(ch) ? ch : '');
    out = out.replace(/uu/g, 'u').replace(/phh/g, 'ph');
    return out;
}

function transliterateHebrew(s) {
    if (!s) return '';
    const decomp = s.normalize('NFD');
    const letterMap = { '\u05D0': '', '\u05D1': 'b', '\u05D2': 'g', '\u05D3': 'd', '\u05D4': 'h', '\u05D5': 'v', '\u05D6': 'z', '\u05D7': 'ch', '\u05D8': 't', '\u05D9': 'y', '\u05DB': 'k', '\u05DA': 'k', '\u05DC': 'l', '\u05DE': 'm', '\u05DD': 'm', '\u05E0': 'n', '\u05E1': 's', '\u05E2': '', '\u05E3': 'p', '\u05E4': 'p', '\u05E5': 'ts', '\u05E6': 'ts', '\u05E7': 'q', '\u05E8': 'r', '\u05E9': 'sh', '\u05EA': 't' };
    const vowelMap = {
        '\u05B0': 'e', '\u05B1': 'e', '\u05B2': 'a', '\u05B3': 'a',
        '\u05B4': 'i', '\u05B5': 'e', '\u05B6': 'e', '\u05B7': 'a',
        '\u05B8': 'a', '\u05B9': 'o', '\u05BB': 'u', '\u05C7': 'o'
    };
    const SHIN_DOT = '\u05C1';
    const SIN_DOT = '\u05C2';

    const outParts = [];
    let lastBaseIndex = -1;
    for (let i = 0; i < decomp.length; i++) {
        const ch = decomp[i];
        const code = ch.codePointAt(0);
        if (code >= 0x05D0 && code <= 0x05EA) {
            const mapped = (letterMap[ch] !== undefined) ? letterMap[ch] : '';
            outParts.push(mapped);
            lastBaseIndex = outParts.length - 1;
            continue;
        }
        if (vowelMap[ch]) {
            if (lastBaseIndex >= 0) {
                outParts[lastBaseIndex] = outParts[lastBaseIndex] + vowelMap[ch];
            } else {
                outParts.push(vowelMap[ch]);
                lastBaseIndex = outParts.length - 1;
            }
            continue;
        }
        if (ch === SIN_DOT) {
            if (lastBaseIndex >= 0 && outParts[lastBaseIndex].endsWith('sh')) {
                outParts[lastBaseIndex] = outParts[lastBaseIndex].slice(0, -2) + 's';
            }
            continue;
        }
        if (ch === SHIN_DOT) {
            if (lastBaseIndex >= 0 && outParts[lastBaseIndex].endsWith('s')) {
                outParts[lastBaseIndex] = outParts[lastBaseIndex] + 'h';
            }
            continue;
        }
        if (/[A-Za-z0-9]/.test(ch)) {
            outParts.push(ch);
            lastBaseIndex = outParts.length - 1;
        }
    }

    let out = outParts.join(' ').replace(/\s+/g, ' ').trim();
    out = out.replace(/''/g, "'");
    return out.toLowerCase();
}

export function transliterate(s) {
    if (!s) return '';
    try {
        if (/\p{Script=Greek}/u.test(s)) return transliterateGreek(s);
        if (/\p{Script=Hebrew}/u.test(s)) return transliterateHebrew(s);
    } catch (e) {
        if (/[\u0370-\u03FF]/.test(s)) return transliterateGreek(s);
        if (/[\u0590-\u05FF]/.test(s)) return transliterateHebrew(s);
    }
    return '';
}

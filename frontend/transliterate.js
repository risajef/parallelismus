// ── Transliteration ─────────────────────────────────────────────────────────
function stripDiacritics(s) {
    try { return s.normalize('NFD').replace(/\p{M}/gu, ''); } catch { return s; }
}

function transliterateGreek(s) {
    if (!s) return '';
    let t = stripDiacritics(s.toLowerCase());
    const map = { α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'e', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'u', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'o' };
    let out = '';
    for (const c of t) out += map[c] !== undefined ? map[c] : (/[a-z0-9]/.test(c) ? c : '');
    return out.replace(/uu/g, 'u').replace(/phh/g, 'ph');
}

function transliterateHebrew(s) {
    if (!s) return '';
    const t = s.normalize('NFD');
    const cmap = { '\u05D0': '', '\u05D1': 'b', '\u05D2': 'g', '\u05D3': 'd', '\u05D4': 'h', '\u05D5': 'v', '\u05D6': 'z', '\u05D7': 'ch', '\u05D8': 't', '\u05D9': 'y', '\u05DB': 'k', '\u05DA': 'k', '\u05DC': 'l', '\u05DE': 'm', '\u05DD': 'm', '\u05E0': 'n', '\u05E1': 's', '\u05E2': '', '\u05E3': 'p', '\u05E4': 'p', '\u05E5': 'ts', '\u05E6': 'ts', '\u05E7': 'q', '\u05E8': 'r', '\u05E9': 'sh', '\u05EA': 't' };
    const vmap = { '\u05B0': 'e', '\u05B1': 'e', '\u05B2': 'a', '\u05B3': 'a', '\u05B4': 'i', '\u05B5': 'e', '\u05B6': 'e', '\u05B7': 'a', '\u05B8': 'a', '\u05B9': 'o', '\u05BB': 'u', '\u05C7': 'o' };
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

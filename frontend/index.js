import { strongUrl } from './urls.js';
import { evidenceVerse } from './evidence.js';
// Static frontend – all data from IndexedDB, no backend required.
import * as api from './app.js';
import { createOption, setOptions, escapeHtml, sampleRandom } from './dom-utils.js';
import { makeStaticTooltip, buildTranslationGrid, buildShortcutHtml } from './tooltip.js';
import { installShortcuts } from './keyboard.js';

// Scope DOM access to this instance; parent pages may contain the same IDs.
const appRoot = document.querySelector('#parallelismus-root .parallelismus-app') || document.querySelector('.parallelismus-app');
const lifecycle = new AbortController();
appRoot.parallelismusDispose?.();
appRoot.parallelismusDispose = () => lifecycle.abort();
const root = {
    getElementById: id => appRoot.querySelector('#' + CSS.escape(id)),
    querySelectorAll: selector => appRoot.querySelectorAll(selector),
};

// DOM references
const booksEl = root.getElementById('books');
const chaptersEl = root.getElementById('chapters');
const versesEl = root.getElementById('verses');
const wordsEl = root.getElementById('words');
const resultEl = root.getElementById('result');
const nextChapterBtn = root.getElementById('next-chapter');
const nextVerseBtn = root.getElementById('next-verse');
const loadingEl = root.getElementById('loading-status');
const typeEl = root.getElementById('type');
const binaryFields = root.getElementById('binary-fields');
const composeFields = root.getElementById('compose-fields');
const membersList = root.getElementById('members-list');
const memberInput = root.getElementById('member-input');
const addMemberBtn = root.getElementById('add-member');
const composeTargetEl = root.getElementById('compose-target');

let currentChapters = [];
let currentVerses = [];

function getRelationMode() {
    return typeEl ? typeEl.value : '';
}

function isComposeMode() {
    return getRelationMode() === 'composes';
}

function addMemberChip(strong) {
    if (!membersList || !strong) return;
    if (membersList.querySelector(`[data-strong="${CSS.escape(strong)}"]`)) return;

    const chip = document.createElement('span');
    chip.className = 'member-chip';
    chip.dataset.strong = strong;
    chip.appendChild(document.createTextNode(strong));

    const removeBtn = document.createElement('button');
    removeBtn.className = 'chip-remove';
    removeBtn.type = 'button';
    removeBtn.textContent = 'x';
    removeBtn.addEventListener('click', () => {
        chip.remove();
        root.querySelectorAll(`.word-box[data-strong="${CSS.escape(strong)}"]`).forEach((el) => el.classList.remove('selected'));
        syncWordSelection();
    });

    chip.appendChild(removeBtn);
    membersList.appendChild(chip);
}

function getComposeMembers() {
    if (!membersList) return [];
    return Array.from(membersList.querySelectorAll('.member-chip'))
        .map((chip) => chip.dataset.strong)
        .filter(Boolean);
}

function clearRelationSelection() {
    root.querySelectorAll('.word-box.selected').forEach((el) => el.classList.remove('selected'));
    const srcEl = root.getElementById('src');
    const tgtEl = root.getElementById('tgt');
    if (srcEl) srcEl.value = '';
    if (tgtEl) tgtEl.value = '';
    if (membersList) membersList.innerHTML = '';
}

function syncWordSelection() {
    const selected = Array.from(root.querySelectorAll('.word-box.selected'));

    if (isComposeMode()) {
        if (membersList) membersList.innerHTML = '';
        selected.forEach((el) => {
            const strong = el.dataset.strong || '';
            if (strong) addMemberChip(strong);
        });
        return;
    }

    if (selected.length > 2) {
        selected.slice(2).forEach((el) => el.classList.remove('selected'));
    }

    const trimmed = Array.from(root.querySelectorAll('.word-box.selected'));
    const srcEl = root.getElementById('src');
    const tgtEl = root.getElementById('tgt');
    if (srcEl) srcEl.value = trimmed[0]?.dataset.strong || '';
    if (tgtEl) tgtEl.value = trimmed[1]?.dataset.strong || '';
}

if (typeEl) {
    typeEl.addEventListener('change', () => {
        const compose = isComposeMode();
        if (binaryFields) binaryFields.hidden = compose;
        if (composeFields) composeFields.hidden = !compose;
        clearRelationSelection();
        if (composeTargetEl) composeTargetEl.value = '';
    });
}

if (addMemberBtn && memberInput) {
    addMemberBtn.addEventListener('click', () => {
        const strong = memberInput.value.trim();
        if (!strong) return;
        addMemberChip(strong);
        memberInput.value = '';
    });

    memberInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            addMemberBtn.click();
        }
    });
}

// Use transliteration from the shared API module
const transliterate = api.transliterate;

// ── Initialise IndexedDB, then boot the UI ──────────────────────────────────
async function boot() {
    try {
        await api.initDB((msg) => {
            if (loadingEl) loadingEl.textContent = msg;
        });
        if (loadingEl) loadingEl.style.display = 'none';
        await initFromHash();
    } catch (err) {
        console.error('DB init failed', err);
        if (loadingEl) loadingEl.textContent = 'Failed to initialise database: ' + String(err);
        if (resultEl) {
            resultEl.textContent = 'Failed to initialise database: ' + String(err);
            const retry = document.createElement('button');retry.textContent = 'Retry';
            retry.addEventListener('click', () => {retry.remove();boot();});resultEl.appendChild(retry);
        }
    }
}

boot();

// ── Hash-based routing (works on static hosting) ────────────────────────────
// Supported hashes:
//   #/                        → load books, first chapter
//   #/chapter/{chapterId}     → load that chapter
//   #/verse/{verseId}         → load that verse

function currentHash() {
    return window.location.hash.replace(/^#/, '') || '/';
}

function setHash(path) {
    history.pushState(null, '', '#' + path);
}

function parseHash() {
    const parts = currentHash().split('/').filter(Boolean);
    const result = { chapterId: null, verseId: null, bookId: null };
    if (parts.length >= 2 && parts[0] === 'chapter') {
        result.chapterId = Number(parts[1]);
    } else if (parts.length >= 2 && parts[0] === 'verse') {
        result.verseId = Number(parts[1]);
    } else if (parts.length >= 4 && parts[0] === 'book') {
        result.bookId = Number(parts[1]);
        if (parts[2] === 'chapter') result.chapterId = Number(parts[3]);
        if (parts.length >= 6 && parts[4] === 'verse') result.verseId = Number(parts[5]);
    }
    return result;
}

window.addEventListener('hashchange', () => initFromHash(), {signal:lifecycle.signal});

// ── Data loading ────────────────────────────────────────────────────────────

async function loadBooks() {
    const books = await api.fetchBooks();
    booksEl.innerHTML = '';
    books.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id; opt.textContent = b.name;
        booksEl.appendChild(opt);
    });
    if (books[0]) await loadChapters(books[0].id);
}

booksEl.addEventListener('change', async () => {
    const bookId = Number(booksEl.value);
    if (!bookId) return;
    await loadChapters(bookId);
    const firstChap = currentChapters[0];
    if (firstChap) setHash(`/chapter/${firstChap.id}`);
});

async function loadChapters(bookId, {render = true} = {}) {
    const chapters = await api.fetchChapters(bookId);
    currentChapters = Array.isArray(chapters) ? chapters : [];
    chaptersEl.innerHTML = '';
    currentChapters.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.number); opt.textContent = c.number;
        chaptersEl.appendChild(opt);
    });
    if (render && currentChapters[0]) await loadVerses(currentChapters[0].id);
}

async function loadVerses(chapterId, opts = { selectVerseId: null, showWholeChapter: false }) {
    const verses = await api.fetchVerses(chapterId);
    currentVerses = Array.isArray(verses) ? verses : [];
    versesEl.innerHTML = '';
    currentVerses.forEach(v => {
        const opt = document.createElement('option');
        opt.value = String(v.number); opt.textContent = v.number;
        versesEl.appendChild(opt);
    });

    if (opts && opts.selectVerseId) {
        const selected = currentVerses.find(x => Number(x.id) === Number(opts.selectVerseId));
        if (selected) {
            versesEl.value = String(selected.number);
            await loadWords(Number(selected.id));
            return;
        }
    }
    if (opts && opts.selectVerseNumber) {
        const selected = currentVerses.find(x => Number(x.number) === Number(opts.selectVerseNumber));
        if (selected) {
            versesEl.value = String(selected.number);
            await loadWords(Number(selected.id));
            return;
        }
    }

    if (opts.showWholeChapter) {
        wordsEl.innerHTML = '';
        const chapterContainer = document.createElement('div');
        chapterContainer.className = 'chapter-view';
        wordsEl.appendChild(chapterContainer);
        const verseBlocks = verses.map(v => {
            const verseBlock = document.createElement('div');
            verseBlock.className = 'verse-block';
            const header = document.createElement('h4');
            const link = document.createElement('a');
            link.href = `#/verse/${v.id}`;
            link.textContent = `Verse ${v.number}`;
            link.addEventListener('click', async (e) => {
                e.preventDefault();
                await loadVerses(chapterId, { selectVerseId: v.id, showWholeChapter: false });
                setHash(`/verse/${v.id}`);
            });
            header.appendChild(link);
            verseBlock.appendChild(header);
            const wrapper = document.createElement('div');
            wrapper.id = `verse-${v.id}`;
            verseBlock.appendChild(wrapper);
            chapterContainer.appendChild(verseBlock);
            return { id: v.id, wrapper };
        });

        await Promise.all(verseBlocks.map(async vb => {
            const words = await api.fetchWords(vb.id);
            const ul = document.createElement('ul');
            ul.className = 'verse-words';
            words.forEach(w => {
                const li = document.createElement('li');
                const box = buildWordBox(w, vb.id);
                li.appendChild(box);
                ul.appendChild(li);
            });
            vb.wrapper.appendChild(ul);

        }));
        await markWordsWithRelations([...new Set(Array.from(wordsEl.querySelectorAll('[data-strong]')).map(el => el.dataset.strong))]);
        return;
    }
    if (currentVerses[0]) await loadWords(currentVerses[0].id);
}

function buildWordBox(w, verseId) {
    const canonicalOriginal = w.verse_original || '';
    const canonicalTranslation = w.verse_translation || '';
    const box = document.createElement('div');
    box.className = 'word-box word-main selectable';
    box.tabIndex = 0;
    box.setAttribute('role', 'button');
    box.setAttribute('draggable', 'true');
    box.setAttribute('aria-label', (canonicalTranslation || canonicalOriginal || w.strong) + ' — strong ' + (w.strong || ''));
    box.dataset.strong = w.strong || '';
    box.dataset.verseId = String(verseId);
    box.dataset.allOriginals = JSON.stringify(Array.isArray(w.all_originals) ? w.all_originals : []);
    box.dataset.allTranslations = JSON.stringify(Array.isArray(w.all_translations) ? w.all_translations : []);

    const translit = transliterate(canonicalOriginal || '');
    if (translit) {
        const tEl = document.createElement('div');
        tEl.className = 'word-translit';
        tEl.textContent = translit;
        box.appendChild(tEl);
    }

    const top = document.createElement('div');
    top.className = 'word-english';
    top.textContent = canonicalTranslation || '';
    box.appendChild(top);

    const bottom = document.createElement('div');
    bottom.className = 'word-original';
    bottom.textContent = canonicalOriginal || (canonicalTranslation ? '' : w.strong || '(no text)');
    box.appendChild(bottom);

    const strongLink = document.createElement('a');
    strongLink.className = 'strong-link';
    strongLink.href = strongUrl(w.strong);
    strongLink.target = '_blank';
    strongLink.rel = 'noopener noreferrer';
    strongLink.textContent = w.strong || '';
    strongLink.addEventListener('click', (ev) => ev.stopPropagation());
    box.appendChild(strongLink);

    // drag
    box.addEventListener('dragstart', (e) => {
        try { e.dataTransfer.setData('text/plain', w.strong || ''); } catch (err) { }
        box.dataset.draggedAt = String(Date.now());
        box.classList.add('dragging');
    });
    box.addEventListener('dragend', () => {
        setTimeout(() => { box.classList.remove('dragging'); box.dataset.draggedAt = ''; }, 50);
    });

    // keyboard
    box.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
            window.open(strongUrl(w.strong), '_blank');
        } else if (ev.key === ' ') {
            ev.preventDefault();
            box.classList.toggle('selected');
            syncWordSelection();
        }
    });

    box.addEventListener('click', (ev) => {
        const draggedAt = Number(box.dataset.draggedAt || 0);
        if (draggedAt && (Date.now() - draggedAt) < 300) return;
        if (ev.target.closest('.strong-link')) return;
        ev.preventDefault();
        box.classList.toggle('selected');
        syncWordSelection();
    });

    return box;
}

async function loadWords(verseId) {
    const words = await api.fetchWords(verseId);
    wordsEl.innerHTML = '';
    words.forEach(w => {
        const li = document.createElement('li');
        li.appendChild(buildWordBox(w));
        wordsEl.appendChild(li);
    });
    try { await markWordsWithRelations(words.map(x => x.strong).filter(Boolean)); } catch (e) { }
}

async function markWordsWithRelations(strongIds) {
    if (!Array.isArray(strongIds) || strongIds.length === 0) return;
    try {
        const map = await api.fetchRelationsBatch(strongIds);
        let counts = {};
        try { counts = await api.fetchRelationsCounts(strongIds); } catch (e) { counts = {}; }
        for (const id of strongIds) {
            const has = !!map[id];
            const els = root.querySelectorAll(`.word-box[data-strong="${CSS.escape(id)}"]`);
            const c = counts[id] ? Number(counts[id]) : 0;
            els.forEach(el => {
                if (has) el.classList.add('has-relation'); else el.classList.remove('has-relation');
                let badge = el.querySelector('.relation-badge');
                if (c > 0) {
                    if (!badge) { badge = document.createElement('div'); badge.className = 'relation-badge'; el.appendChild(badge); }
                    badge.textContent = String(c);
                } else if (badge) {
                    badge.remove();
                }
            });
        }
    } catch (e) { }
}

// ── Side panels: relations, add-relation, drag-drop ─────────────────────────

const addPanel = root.getElementById('add-relation-panel');
const relationsPanel = root.getElementById('relations-panel');

function allowDrop(ev) { ev.preventDefault(); }
function handleAddDrop(ev) {
    ev.preventDefault();
    const strong = ev.dataTransfer.getData('text/plain');
    if (!strong) return;

    if (isComposeMode()) {
        let handled = false;
        try {
            const el = document.elementFromPoint(ev.clientX, ev.clientY);
            const input = el && el.closest ? el.closest('input') : null;
            if (input === composeTargetEl) {
                composeTargetEl.value = strong;
                handled = true;
            }
        } catch (e) { }
        if (!handled) addMemberChip(strong);
        addPanel.classList.add('drop-target');
        setTimeout(() => addPanel.classList.remove('drop-target'), 350);
        return;
    }

    const srcEl = root.getElementById('src');
    const tgtEl = root.getElementById('tgt');
    let handled = false;
    try {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const inp = el && el.closest ? el.closest('input') : null;
        if (inp === tgtEl) { tgtEl.value = strong; handled = true; }
        else if (inp === srcEl) { srcEl.value = strong; handled = true; }
    } catch (e) { }
    if (!handled) {
        const active = document.activeElement;
        if (active === tgtEl || active === srcEl) active.value = strong;
        else srcEl.value = strong;
    }
    addPanel.classList.add('drop-target');
    setTimeout(() => addPanel.classList.remove('drop-target'), 350);
}

function handleRelationsDrop(ev) {
    ev.preventDefault();
    const strong = ev.dataTransfer.getData('text/plain');
    if (!strong) return;
    root.getElementById('relations-strong').value = strong;
    root.getElementById('showRelations').click();
    relationsPanel.classList.add('drop-target');
    setTimeout(() => relationsPanel.classList.remove('drop-target'), 350);
}

addPanel.addEventListener('dragover', allowDrop);
addPanel.addEventListener('drop', handleAddDrop);
relationsPanel.addEventListener('dragover', allowDrop);
relationsPanel.addEventListener('drop', handleRelationsDrop);

root.getElementById('showRelations').addEventListener('click', async () => {
    const strong = root.getElementById('relations-strong').value.trim();
    if (!strong) return;
    const groups = await api.fetchGroupedRelations(strong);
    const list = root.getElementById('relations-list');
    list.innerHTML = '';
    for (const g of groups) {
        const li = document.createElement('li');
        const header = document.createElement('div');
        let srcLabel = g.source_id;
        let tgtLabel = g.target_id;
        try {
            const [srcDetail, tgtDetail] = await Promise.allSettled([
                api.fetchWordDetail(g.source_id),
                api.fetchWordDetail(g.target_id),
            ]);
            if (srcDetail.status === 'fulfilled' && srcDetail.value) {
                const v = srcDetail.value;
                srcLabel = (Array.isArray(v.all_originals) && v.all_originals[0]) || (Array.isArray(v.all_translations) && v.all_translations[0]) || g.source_id;
            }
            if (tgtDetail.status === 'fulfilled' && tgtDetail.value) {
                const v = tgtDetail.value;
                tgtLabel = (Array.isArray(v.all_originals) && v.all_originals[0]) || (Array.isArray(v.all_translations) && v.all_translations[0]) || g.target_id;
            }
        } catch (e) { }

        header.textContent = `${g.relation_type}: ${srcLabel} (${g.source_id}) → ${tgtLabel} (${g.target_id})`;
        li.appendChild(header);

        if (g.source_verse_ids && g.source_verse_ids.length) {
            const versesContainer = document.createElement('div');
            versesContainer.style.marginTop = '.25rem';
            g.source_verse_ids.forEach(vid => {
                const btn = document.createElement('button');
                btn.textContent = `(Source: Link) ${vid}`;
                btn.style.marginRight = '6px';
                btn.addEventListener('click', async () => {
                    try {
                        const verse = await api.fetchVerse(vid);
                        if (!verse) throw new Error('Source verse not found');
                        const chap = await api.fetchChapter(verse.chapter_id);
                        booksEl.value = String(chap.book_id);
                        await loadChapters(chap.book_id, {render:false});
                        chaptersEl.value = String(chap.number);
                        await loadVerses(chap.id, {selectVerseId:verse.id});
                        setHash(`/verse/${verse.id}`);
                    } catch (err) { resultEl.textContent = 'Navigation failed: ' + err.message; }
                });
                versesContainer.appendChild(btn);
            });
            li.appendChild(versesContainer);
        }

        const removeBtn = document.createElement('button');
        removeBtn.textContent = 'Remove';
        removeBtn.style.marginLeft = '8px';
        removeBtn.addEventListener('click', async () => {
            if (!confirm('Remove this relation group? This will delete matching relations individually.')) return;
            try {
                if (g.composition_id) {
                    await api.deleteComposition(g.composition_id);
                } else {
                    const full = await api.fetchRelations(g.source_id);
                    for (const r of full.filter(r => !r.composition_id && r.source_id === g.source_id && r.target_id === g.target_id && r.relation_type === g.relation_type)) await api.deleteRelation(r.id);
                }
                root.getElementById('showRelations').click();
            } catch (err) {
                alert('Failed to remove relation(s): ' + String(err));
            }
        });
        li.appendChild(removeBtn);
        list.appendChild(li);
    }
});

// ── Tooltip ─────────────────────────────────────────────────────────────────

const addRelPanel = root.getElementById('add-relation-panel');
const tooltipApi = makeStaticTooltip(addRelPanel);

function handleMouseOver(ev) {
    const target = ev.target.closest ? ev.target.closest('.word-main') : ev.target;
    if (target) {
        let originals = [];
        let translations = [];
        try { originals = JSON.parse(target.dataset.allOriginals || '[]'); } catch (e) { }
        try { translations = JSON.parse(target.dataset.allTranslations || '[]'); } catch (e) { }
        const html = buildTranslationGrid(sampleRandom(translations, 10), sampleRandom(originals, 10), escapeHtml);
        tooltipApi.show(html);
    }
}
function handleMouseOut(ev) {
    const from = ev.target;
    const to = ev.relatedTarget;
    const fromRoot = from && from.closest ? from.closest('.word-main') : null;
    const toRoot = to && to.closest ? to.closest('.word-main') : null;
    if (fromRoot && fromRoot === toRoot) return;
    if (fromRoot) tooltipApi.hide();
}
appRoot.addEventListener('mouseover', handleMouseOver);
appRoot.addEventListener('mouseout', handleMouseOut);

installShortcuts(root.getElementById('shortcutInfo'), tooltipApi, buildShortcutHtml, appRoot);

appRoot.addEventListener('focusin', (ev) => {
    const target = ev.target;
    if (target && target.classList && target.classList.contains('word-main')) {
        let originals = [];
        let translations = [];
        try { originals = JSON.parse(target.dataset.allOriginals || '[]'); } catch (e) { }
        try { translations = JSON.parse(target.dataset.allTranslations || '[]'); } catch (e) { }
        const leftList = translations.length ? '<ul>' + translations.map(t => `<li>${escapeHtml(t)}</li>`).join('') + '</ul>' : '<div>-</div>';
        const rightList = originals.length ? '<ul>' + originals.map(o => `<li>${escapeHtml(o)}</li>`).join('') + '</ul>' : '<div>-</div>';
        tooltipApi.show(`<div class="tooltip-grid"><div class="tooltip-col"><h4>Translations</h4>${leftList}</div><div class="tooltip-col"><h4>Originals</h4>${rightList}</div></div>`);
    }
});
appRoot.addEventListener('focusout', (ev) => {
    const target = ev.target;
    if (target && target.classList && target.classList.contains('word-main')) tooltipApi.hide();
});

// ── Chapter / verse selectors ───────────────────────────────────────────────

chaptersEl.addEventListener('change', async () => {
    const selectedNumber = Number(chaptersEl.value);
    const chap = currentChapters.find(c => Number(c.number) === selectedNumber);
    if (!chap) return;
    await loadVerses(chap.id, { selectVerseId: null, showWholeChapter: true });
    setHash(`/chapter/${chap.id}`);
});

async function goToNextChapter() {
    const currentNumber = Number(chaptersEl.value) || 0;
    const next = currentChapters.find(c => Number(c.number) === currentNumber + 1);
    if (!next) return;
    chaptersEl.value = String(next.number);
    await loadVerses(next.id, { selectVerseId: null, showWholeChapter: true });
    setHash(`/chapter/${next.id}`);
}

async function goToNextVerse() {
    const currentNumber = Number(versesEl.value) || 0;
    const next = currentVerses.find(v => Number(v.number) === currentNumber + 1);
    if (!next) return;
    versesEl.value = String(next.number);
    await loadWords(next.id);
    setHash(`/verse/${next.id}`);
}

if (nextChapterBtn) nextChapterBtn.addEventListener('click', async (e) => { e.preventDefault(); await goToNextChapter(); });
if (nextVerseBtn) nextVerseBtn.addEventListener('click', async (e) => { e.preventDefault(); await goToNextVerse(); });

versesEl.addEventListener('change', async () => {
    const selectedNumber = Number(versesEl.value);
    const verse = currentVerses.find(v => Number(v.number) === selectedNumber);
    if (!verse) return;
    await loadWords(verse.id);
    setHash(`/verse/${verse.id}`);
});

// ── Add relation ────────────────────────────────────────────────────────────

root.getElementById('addRel').addEventListener('click', async () => {
    const type = typeEl && typeEl.value ? typeEl.value.trim() : '';
    if (!type) { resultEl.textContent = 'Please select a relation type'; return; }
    const selectedVerseNumber = Number(versesEl.value || 0);
    const selectedVerse = currentVerses.find(v => Number(v.number) === selectedVerseNumber);
    let evidenceId;
    try {
        evidenceId = evidenceVerse(Array.from(root.querySelectorAll('.word-box.selected')).map(el => el.dataset.verseId), selectedVerse?.id);
        const evidence = currentVerses.find(v => v.id === evidenceId);
        if (evidence) versesEl.value = String(evidence.number);
    } catch (err) { resultEl.textContent = err.message; return; }


    if (type === 'composes') {
        const members = getComposeMembers();
        const target = composeTargetEl ? composeTargetEl.value.trim() : '';
        if (members.length === 0) { resultEl.textContent = 'Please select at least one member word'; return; }
        if (!target) { resultEl.textContent = 'Please enter the set / target strong ID'; return; }

        try {
            await api.addComposition(members, target, evidenceId);
            resultEl.textContent = `Added ${members.length} "composes" relation(s) -> ${target}`;
            clearRelationSelection();
            if (composeTargetEl) composeTargetEl.value = '';
        } catch (err) {
            resultEl.textContent = 'Error adding relations: ' + String(err);
        }
        return;
    }

    const srcEl = root.getElementById('src');
    const tgtEl = root.getElementById('tgt');
    const src = srcEl && srcEl.value ? srcEl.value : '';
    const tgt = tgtEl && tgtEl.value ? tgtEl.value : '';
    if (!src || !tgt) { resultEl.textContent = 'Please select source and target words'; return; }

    const payload = { source_id: src, target_id: tgt, relation_type: type };
    payload.source_verse_id = evidenceId;
    try {
        const res = await api.addRelation(payload);
        resultEl.textContent = 'Relation added: ' + JSON.stringify(res);
        clearRelationSelection();
    } catch (err) {
        resultEl.textContent = 'Error adding relation: ' + String(err);
    }
});

// ── Export / Import relations ───────────────────────────────────────────────

root.getElementById('exportRelations').addEventListener('click', async () => {
    try {
        const json = await api.exportRelations();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'parallelismus-relations.json';
        a.click();
        URL.revokeObjectURL(url);
        resultEl.textContent = 'Relations exported.';
    } catch (err) {
        resultEl.textContent = 'Export failed: ' + String(err);
    }
});

root.getElementById('importRelations').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', async () => {
        const file = input.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const mode = root.getElementById('import-mode').value;
            if (mode === 'replace' && !confirm('Replace ALL existing relations with this file? Export a backup first.')) return;
            const count = await api.importRelations(text, { mode });
            resultEl.textContent = `Imported ${count} relations. Reloading…`;
            // re-mark words
            const strongIds = Array.from(root.querySelectorAll('.word-box[data-strong]')).map(el => el.dataset.strong).filter(Boolean);
            await markWordsWithRelations([...new Set(strongIds)]);
        } catch (err) {
            resultEl.textContent = 'Import failed: ' + String(err);
        }
    });
    input.click();
});

// ── Hash-based init ─────────────────────────────────────────────────────────

async function initFromHash() {
    const path = parseHash();
    if (!path.chapterId && !path.verseId) {
        await loadBooks();
        return;
    }
    if (path.chapterId) {
        const chapter = await api.fetchChapter(path.chapterId);
        if (!chapter) { await loadBooks(); return; }
        const books = await api.fetchBooks();
        booksEl.innerHTML = '';
        books.forEach(b => { const opt = document.createElement('option'); opt.value = b.id; opt.textContent = b.name; booksEl.appendChild(opt); });
        booksEl.value = String(chapter.book_id);
        await loadChapters(chapter.book_id);
        const selectedChap = currentChapters.find(c => Number(c.id) === Number(path.chapterId));
        if (selectedChap) {
            chaptersEl.value = String(selectedChap.number);
            await loadVerses(selectedChap.id, { selectVerseId: path.verseId || null, showWholeChapter: !path.verseId });
        }
        return;
    }
    if (path.verseId) {
        const verse = await api.fetchVerse(path.verseId);
        if (!verse) { await loadBooks(); return; }
        const chap = await api.fetchChapter(verse.chapter_id);
        if (!chap) { await loadBooks(); return; }
        const books = await api.fetchBooks();
        booksEl.innerHTML = '';
        books.forEach(b => { const opt = document.createElement('option'); opt.value = b.id; opt.textContent = b.name; booksEl.appendChild(opt); });
        booksEl.value = String(chap.book_id);
        await loadChapters(chap.book_id);
        const selectedChap = currentChapters.find(c => Number(c.id) === Number(chap.id));
        if (selectedChap) {
            chaptersEl.value = String(selectedChap.number);
            await loadVerses(chap.id, { selectVerseId: path.verseId, showWholeChapter: false });
        }
        return;
    }
}

// Global error handlers
window.addEventListener('error', (ev) => {
    console.error('Unhandled error', ev.error || ev.message, ev);
    if (resultEl) resultEl.textContent = 'Runtime error: ' + String(ev.error || ev.message);
}, {signal:lifecycle.signal});
window.addEventListener('unhandledrejection', (ev) => {
    console.error('Unhandled rejection', ev.reason);
    if (resultEl) resultEl.textContent = 'Unhandled promise rejection: ' + String(ev.reason);
}, {signal:lifecycle.signal});

export default {};

root.getElementById('write-token')?.addEventListener('input', e => api.setWriteToken(e.target.value));

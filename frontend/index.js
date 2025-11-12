// Moved from inline script in index.html
import * as api from '/static/app.js';
import { createOption, setOptions, escapeHtml, sampleRandom } from '/static/dom-utils.js';
import { makeStaticTooltip, buildTranslationGrid, buildShortcutHtml } from '/static/tooltip.js';
import { installShortcuts } from '/static/keyboard.js';

// DOM references
const booksEl = document.getElementById('books');
const chaptersEl = document.getElementById('chapters');
const versesEl = document.getElementById('verses');
const wordsEl = document.getElementById('words');
const resultEl = document.getElementById('result');
const nextChapterBtn = document.getElementById('next-chapter');
const nextVerseBtn = document.getElementById('next-verse');

// (createOption, setOptions, escapeHtml, sampleRandom are imported from dom-utils.js)

// Keep the most-recently-loaded chapters/verses in memory so the dropdowns can use
// ordinal numbers (chapter.number / verse.number) as option values while we map
// those numbers to DB ids when performing API calls.
let currentChapters = [];
let currentVerses = [];

async function loadBooks(){
  console.log('loadBooks: fetching books...');
  try {
    const books = await api.fetchBooks();
    booksEl.innerHTML = '';
    books.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id; opt.textContent = b.name;
      booksEl.appendChild(opt);
    });
    if(books[0]) loadChapters(books[0].id);
    return;
  } catch (err) {
    console.error('loadBooks failed', err);
    if (resultEl) resultEl.textContent = 'Failed to load books: ' + String(err);
    throw err;
  }
}

// When the selected book changes we must reload chapters (and verses/words).
booksEl.addEventListener('change', async () => {
  const bookId = Number(booksEl.value);
  if (!bookId) return;
  await loadChapters(bookId);
  // Reset URL to book/chapter root (use the first chapter's DB id if present)
  const firstChap = currentChapters[0];
  if (firstChap) history.pushState({}, '', `/chapter/${firstChap.id}`);
});


// Use transliteration provided by the shared API module for consistency
const transliterate = api.transliterate;

// sampleRandom is imported from dom-utils.js

// Global error handlers to surface runtime issues during development
window.addEventListener('error', (ev) => {
  try {
    console.error('Unhandled error', ev.error || ev.message, ev);
    const r = document.getElementById('result');
    if (r) r.textContent = 'Runtime error: ' + String(ev.error || ev.message);
  } catch (e) {}
});
window.addEventListener('unhandledrejection', (ev) => {
  try {
    console.error('Unhandled rejection', ev.reason);
    const r = document.getElementById('result');
    if (r) r.textContent = 'Unhandled promise rejection: ' + String(ev.reason);
  } catch (e) {}
});

console.log('frontend/index.js initializing');

// Defensive checks
if (!booksEl || !chaptersEl || !versesEl || !wordsEl) {
  console.error('Critical DOM element missing', { booksEl, chaptersEl, versesEl, wordsEl });
  if (resultEl) resultEl.textContent = 'Frontend failed to initialize: missing DOM elements';
  // stop further execution
}

async function loadChapters(bookId){
  const chapters = await api.fetchChapters(bookId);
  currentChapters = Array.isArray(chapters) ? chapters : [];
  chaptersEl.innerHTML = '';
  // Use the chapter's ordinal number as the option value so the UI shows/selects
  // the "5th chapter" meaning rather than a database id. We'll map number -> id
  // using currentChapters when the user selects.
  currentChapters.forEach(c => {
    const opt = document.createElement('option');
    opt.value = String(c.number); opt.textContent = c.number;
    chaptersEl.appendChild(opt);
  });
  if (currentChapters[0]) await loadVerses(currentChapters[0].id);
}

async function loadVerses(chapterId, opts = { selectVerseId: null, showWholeChapter: false }){
  const verses = await api.fetchVerses(chapterId);
  currentVerses = Array.isArray(verses) ? verses : [];
  versesEl.innerHTML = '';
  // Use the verse's ordinal number as the option value; we'll map number -> id
  // when the user selects a verse.
  currentVerses.forEach(v => {
    const opt = document.createElement('option');
    opt.value = String(v.number); opt.textContent = v.number;
    versesEl.appendChild(opt);
  });

  // Support selecting by DB id (opts.selectVerseId) for URL-driven flows and
  // internal links. If an id is provided, find its number and select that entry.
  if (opts && opts.selectVerseId) {
    const selected = currentVerses.find(x => Number(x.id) === Number(opts.selectVerseId));
    if (selected) {
      versesEl.value = String(selected.number);
      await loadWords(Number(selected.id));
      return;
    }
  }
  // Support selecting by ordinal number (opts.selectVerseNumber) if callers use it.
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
      link.href = `/verse/${v.id}`;
      link.textContent = `Verse ${v.number}`;
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        await loadVerses(chapterId, { selectVerseId: v.id, showWholeChapter: false });
        history.pushState({}, '', `/verse/${v.id}`);
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
        const canonicalOriginal = w.verse_original || '';
        const canonicalTranslation = w.verse_translation || '';
        const box = document.createElement('div');
        box.className = 'word-box word-main';
        box.tabIndex = 0;
        box.setAttribute('draggable', 'true');
        box.addEventListener('dragstart', (e) => {
          try { e.dataTransfer.setData('text/plain', w.strong || ''); } catch (err) {}
          box.dataset.draggedAt = String(Date.now());
          box.classList.add('dragging');
        });
        box.addEventListener('dragend', (e) => {
          setTimeout(() => { box.classList.remove('dragging'); box.dataset.draggedAt = ''; }, 50);
        });
        const top = document.createElement('div');
        top.className = 'word-english';
        top.textContent = canonicalTranslation || '';
        const bottom = document.createElement('div');
        bottom.className = 'word-original';
        bottom.textContent = canonicalOriginal || (canonicalTranslation ? '' : w.strong || '(no text)');
        // transliteration (greek/hebrew) shown under original text to help reading
        const translit = transliterate(canonicalOriginal || '');
        if (translit) {
          const tEl = document.createElement('div');
          tEl.className = 'word-translit';
          tEl.textContent = translit;
          box.appendChild(tEl);
        }
        box.dataset.allOriginals = JSON.stringify(Array.isArray(w.all_originals) ? w.all_originals : []);
        box.dataset.allTranslations = JSON.stringify(Array.isArray(w.all_translations) ? w.all_translations : []);
        box.dataset.strong = w.strong || '';
        box.appendChild(top);
        box.appendChild(bottom);
        box.classList.add('selectable', 'word-main');
        box.setAttribute('role', 'button');
        box.setAttribute('aria-label', (canonicalTranslation || canonicalOriginal || w.strong) + ' — strong ' + (w.strong || ''));
        box.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            window.open('/strong/' + encodeURIComponent(w.strong), '_blank');
          } else if (ev.key === ' ') {
            ev.preventDefault();
            box.classList.toggle('selected');
            const selected = Array.from(document.querySelectorAll('.word-box.selected'));
            if (selected.length === 1) {
              document.getElementById('src').value = selected[0].dataset.strong || '';
            } else if (selected.length === 2) {
              document.getElementById('src').value = selected[0].dataset.strong || '';
              document.getElementById('tgt').value = selected[1].dataset.strong || '';
            }
          }
        });
        box.addEventListener('click', (ev) => {
          const draggedAt = Number(box.dataset.draggedAt || 0);
          if (draggedAt && (Date.now() - draggedAt) < 300) return;
          window.open('/strong/' + encodeURIComponent(w.strong), '_blank');
        });
        li.appendChild(box);
        ul.appendChild(li);
      });
      vb.wrapper.appendChild(ul);
      // mark any words in this verse that already have relations
      try { await markWordsWithRelations(words.map(x => x.strong).filter(Boolean)); } catch (e) { /* ignore marking errors */ }
    }));
    return;
  }
  if(currentVerses[0]) await loadWords(currentVerses[0].id);
}

async function loadWords(verseId){
  const words = await api.fetchWords(verseId);
  wordsEl.innerHTML = '';
    words.forEach(w => {
    const li = document.createElement('li');
    const canonicalOriginal = w.verse_original || '';
    const canonicalTranslation = w.verse_translation || '';
    const box = document.createElement('div');
    box.className = 'word-box word-main';
    box.tabIndex = 0;
    const top = document.createElement('div');
    top.className = 'word-english';
    top.textContent = canonicalTranslation || '';
    const bottom = document.createElement('div');
    bottom.className = 'word-original';
    bottom.textContent = canonicalOriginal || (canonicalTranslation ? '' : w.strong || '(no text)');
    // transliteration (greek/hebrew) 
      const translit = transliterate(canonicalOriginal || '');
      if (translit) {
        const tEl = document.createElement('div');
        tEl.className = 'word-translit';
        tEl.textContent = translit;
        box.appendChild(tEl);
      }
    const allOriginals = Array.isArray(w.all_originals) ? w.all_originals : [];
    const allTranslations = Array.isArray(w.all_translations) ? w.all_translations : [];
    box.dataset.allOriginals = JSON.stringify(allOriginals);
    box.dataset.allTranslations = JSON.stringify(allTranslations);
    box.dataset.strong = w.strong || '';
    box.appendChild(top);
    box.appendChild(bottom);
    box.classList.add('selectable', 'word-main');
    box.setAttribute('role', 'button');
    box.setAttribute('aria-label', (canonicalTranslation || canonicalOriginal || w.strong) + ' — strong ' + (w.strong || ''));
    box.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        window.open('/strong/' + encodeURIComponent(w.strong), '_blank');
      } else if (ev.key === ' ') {
        ev.preventDefault();
        box.classList.toggle('selected');
        const selected = Array.from(document.querySelectorAll('.word-box.selected'));
        if (selected.length === 1) {
          document.getElementById('src').value = selected[0].dataset.strong || '';
        } else if (selected.length === 2) {
          document.getElementById('src').value = selected[0].dataset.strong || '';
          document.getElementById('tgt').value = selected[1].dataset.strong || '';
        }
      }
    });
    box.setAttribute('draggable', 'true');
    box.addEventListener('dragstart', (e) => {
      try { e.dataTransfer.setData('text/plain', w.strong || ''); } catch (err) {}
      box.dataset.draggedAt = String(Date.now());
      box.classList.add('dragging');
    });
    box.addEventListener('dragend', (e) => {
      setTimeout(() => { box.classList.remove('dragging'); box.dataset.draggedAt = ''; }, 50);
    });
    box.addEventListener('click', (ev) => {
      const draggedAt = Number(box.dataset.draggedAt || 0);
      if (draggedAt && (Date.now() - draggedAt) < 300) return;
      window.open('/strong/' + encodeURIComponent(w.strong), '_blank');
    });
    li.appendChild(box);
    wordsEl.appendChild(li);
  });
    // mark words that have relations (call once for this verse)
    try { await markWordsWithRelations(words.map(x => x.strong).filter(Boolean)); } catch (e) { /* ignore marking errors */ }
}

// Given an array of strong ids, query the backend for relations for each and mark
// the corresponding word-box elements with a CSS class when any relation exists.
async function markWordsWithRelations(strongIds){
  if (!Array.isArray(strongIds) || strongIds.length === 0) return;
  // Use a single batch request to determine which ids have relations
  try {
    const map = await api.fetchRelationsBatch(strongIds);
    console.debug('relationsBatch result', map);
    // Try counts if available to show badges
    let counts = {};
    try { counts = await api.fetchRelationsCounts(strongIds).catch(()=>({})); } catch(e) { counts = {}; }
    for (const id of strongIds){
      let has = false;
      if (Object.prototype.hasOwnProperty.call(map, id)) {
        has = !!map[id];
      }
      const els = document.querySelectorAll(`.word-box[data-strong="${CSS.escape(id)}"]`);
      const c = counts && counts[id] ? Number(counts[id]) : 0;
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
  } catch (e) {
    // fallback: do nothing on failure
  }
}

const addPanel = document.getElementById('add-relation-panel');
const relationsPanel = document.getElementById('relations-panel');

function allowDrop(ev){ ev.preventDefault(); }
function handleAddDrop(ev){
  ev.preventDefault();
  const strong = ev.dataTransfer.getData('text/plain');
  if (!strong) return;
  const srcEl = document.getElementById('src');
  const tgtEl = document.getElementById('tgt');
  let handled = false;
  try {
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    const inp = el && el.closest ? el.closest('input') : null;
    if (inp === tgtEl) { tgtEl.value = strong; handled = true; }
    else if (inp === srcEl) { srcEl.value = strong; handled = true; }
  } catch (e) {}
  if (!handled) {
    const active = document.activeElement;
    if (active === tgtEl || active === srcEl) {
      active.value = strong;
    } else {
      srcEl.value = strong;
    }
  }
  addPanel.classList.add('drop-target');
  setTimeout(()=>addPanel.classList.remove('drop-target'), 350);
}

function handleRelationsDrop(ev){
  ev.preventDefault();
  const strong = ev.dataTransfer.getData('text/plain');
  if (!strong) return;
  document.getElementById('relations-strong').value = strong;
  document.getElementById('showRelations').click();
  relationsPanel.classList.add('drop-target');
  setTimeout(()=>relationsPanel.classList.remove('drop-target'), 350);
}

addPanel.addEventListener('dragover', allowDrop);
addPanel.addEventListener('drop', handleAddDrop);
relationsPanel.addEventListener('dragover', allowDrop);
relationsPanel.addEventListener('drop', handleRelationsDrop);

document.getElementById('showRelations').addEventListener('click', async ()=>{
  const strong = document.getElementById('relations-strong').value.trim();
  if (!strong) return;
  const groups = await api.fetchGroupedRelations(strong);
  const list = document.getElementById('relations-list');
  list.innerHTML = '';
  for (const g of groups) {
    const li = document.createElement('li');
    const header = document.createElement('div');
    // fetch a short display label for source and target (prefer original, then translation)
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
    } catch (e) {
      // ignore fetch errors, fall back to ids
    }

    header.textContent = `${g.relation_type}: ${srcLabel} (${g.source_id}) → ${tgtLabel} (${g.target_id})`;
    li.appendChild(header);

    if (g.source_verse_ids && g.source_verse_ids.length) {
      const versesContainer = document.createElement('div');
      versesContainer.style.marginTop = '.25rem';
      g.source_verse_ids.forEach(vid => {
        const btn = document.createElement('button');
        btn.textContent = `(Source: Link) ${vid}`;
        btn.style.marginRight = '6px';
        btn.addEventListener('click', async ()=>{
          const verse = await api.fetchVerse(vid);
          const chap = await api.fetchChapter(verse.chapter_id);
          await loadChapters(chap.book_id);
          setTimeout(async ()=>{
            // chaptersEl uses ordinal numbers as values; find the chapter number for chap.id
            const chapEntry = currentChapters.find(c => Number(c.id) === Number(chap.id));
            if (chapEntry) {
              chaptersEl.value = String(chapEntry.number);
              await loadVerses(chap.id);
              const verseEntry = currentVerses.find(v => Number(v.id) === Number(verse.id));
              if (verseEntry) versesEl.value = String(verseEntry.number);
            }
          }, 150);
        });
        versesContainer.appendChild(btn);
      });
      li.appendChild(versesContainer);
    }

    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.style.marginLeft = '8px';
    removeBtn.addEventListener('click', async ()=>{
      if (!confirm('Remove this relation group? This will delete matching relations individually.')) return;
      try {
        const full = await api.fetchRelations(g.source_id);
        const toDelete = full.filter(r => r.source_id === g.source_id && r.target_id === g.target_id && r.relation_type === g.relation_type);
        for (const r of toDelete) {
          await api.deleteRelation(r.id);
        }
        document.getElementById('showRelations').click();
        await populateRelationTypes();
      } catch (err) {
        alert('Failed to remove relation(s): ' + String(err));
      }
    });
    li.appendChild(removeBtn);

    list.appendChild(li);
  }
});

const addRelPanel = document.getElementById('add-relation-panel');
const tooltipApi = makeStaticTooltip(addRelPanel);

let activeTarget = null;
function handleMouseOver(ev) {
  const target = ev.target.closest ? ev.target.closest('.word-main') : ev.target;
  if (target) {
    activeTarget = target;
    let originals = [];
    let translations = [];
    try { originals = JSON.parse(target.dataset.allOriginals || '[]'); } catch(e) {}
    try { translations = JSON.parse(target.dataset.allTranslations || '[]'); } catch(e) {}
    const sampledTranslations = sampleRandom(translations, 10);
    const sampledOriginals = sampleRandom(originals, 10);
    const html = buildTranslationGrid(sampledTranslations, sampledOriginals, escapeHtml);
    tooltipApi.show(html);
  }
}
function handleMouseOut(ev) {
  const from = ev.target;
  const to = ev.relatedTarget;
  const fromRoot = from && from.closest ? from.closest('.word-main') : null;
  const toRoot = to && to.closest ? to.closest('.word-main') : null;
  if (fromRoot && fromRoot === toRoot) return;
  if (fromRoot) {
    activeTarget = null;
    tooltipApi.hide();
  }
}
document.body.addEventListener('mouseover', handleMouseOver);
document.body.addEventListener('mouseout', handleMouseOut);

// install shortcuts with the keyboard module
installShortcuts(document.getElementById('shortcutInfo'), tooltipApi, buildShortcutHtml);

document.body.addEventListener('focusin', (ev) => {
  const target = ev.target;
  if (target && target.classList && target.classList.contains('word-main')) {
    let originals = [];
    let translations = [];
    try { originals = JSON.parse(target.dataset.allOriginals || '[]'); } catch(e) {}
    try { translations = JSON.parse(target.dataset.allTranslations || '[]'); } catch(e) {}
    const leftList = translations.length ? '<ul>' + translations.map(t => `<li>${escapeHtml(t)}</li>`).join('') + '</ul>' : '<div>-</div>';
    const rightList = originals.length ? '<ul>' + originals.map(o => `<li>${escapeHtml(o)}</li>`).join('') + '</ul>' : '<div>-</div>';
  tooltip.innerHTML = `<div class="tooltip-grid"><div class="tooltip-col"><h4>Translations</h4>${leftList}</div><div class="tooltip-col"><h4>Originals</h4>${rightList}</div></div>`;
  tooltip.classList.add('show');
  }
});
document.body.addEventListener('focusout', (ev) => {
  const target = ev.target;
  if (target && target.classList && target.classList.contains('word-main')) {
    tooltip.classList.remove('show');
  }
});

chaptersEl.addEventListener('change', async ()=> {
  // chaptersEl.value holds the ordinal chapter.number; map to DB id via currentChapters
  const selectedNumber = Number(chaptersEl.value);
  const chap = currentChapters.find(c => Number(c.number) === selectedNumber);
  if (!chap) return;
  await loadVerses(chap.id, { selectVerseId: null, showWholeChapter: true });
  const newUrl = `/chapter/${chap.id}`;
  history.pushState({}, '', newUrl);
});

// Advance to the next chapter (by ordinal) for the currently selected book
async function goToNextChapter(){
  const currentNumber = Number(chaptersEl.value) || 0;
  // find the chapter with the next higher ordinal
  const next = currentChapters.find(c => Number(c.number) === currentNumber + 1);
  if (!next) {
    // nothing to do — maybe alert or wrap; keep it simple and do nothing
    return;
  }
  chaptersEl.value = String(next.number);
  await loadVerses(next.id, { selectVerseId: null, showWholeChapter: true });
  history.pushState({}, '', `/chapter/${next.id}`);
}

// Advance to the next verse (by ordinal) in the currently selected chapter
async function goToNextVerse(){
  const currentNumber = Number(versesEl.value) || 0;
  const next = currentVerses.find(v => Number(v.number) === currentNumber + 1);
  if (!next) return;
  versesEl.value = String(next.number);
  await loadWords(next.id);
  history.pushState({}, '', `/verse/${next.id}`);
}

if (nextChapterBtn) nextChapterBtn.addEventListener('click', async (e)=>{ e.preventDefault(); await goToNextChapter(); });
if (nextVerseBtn) nextVerseBtn.addEventListener('click', async (e)=>{ e.preventDefault(); await goToNextVerse(); });

versesEl.addEventListener('change', async ()=> {
  // versesEl.value holds the ordinal verse.number; map to DB id via currentVerses
  const selectedNumber = Number(versesEl.value);
  const verse = currentVerses.find(v => Number(v.number) === selectedNumber);
  if (!verse) return;
  await loadWords(verse.id);
  const newUrl = `/verse/${verse.id}`;
  history.pushState({}, '', newUrl);
});

window.addEventListener('popstate', (ev) => { initFromPath(); });

document.getElementById('addRel').addEventListener('click', async ()=>{
  const srcEl = document.getElementById('src');
  const tgtEl = document.getElementById('tgt');
  const typeEl = document.getElementById('type');
  const src = srcEl && srcEl.value ? srcEl.value : '';
  const tgt = tgtEl && tgtEl.value ? tgtEl.value : '';
  const type = typeEl && typeEl.value ? typeEl.value.trim() : '';
  if (!src || !tgt) {
    resultEl.textContent = 'Please select source and target words (two chips)';
    return;
  }
  if (!type) {
    resultEl.textContent = 'Please enter or select a relation type';
    return;
  }
  const payload = { source_id: src, target_id: tgt, relation_type: type };
  // versesEl.value contains the ordinal (verse.number); map to DB id for payload
  const selectedVerseNumber = Number(versesEl && versesEl.value ? versesEl.value : 0);
  const selectedVerse = currentVerses.find(v => Number(v.number) === selectedVerseNumber);
  if (selectedVerse) payload.source_verse_id = selectedVerse.id;
  try {
    const res = await api.addRelation(payload);
    resultEl.textContent = 'Relation added: ' + JSON.stringify(res);
    await populateRelationTypes();
    document.querySelectorAll('.word-box.selected').forEach(el => el.classList.remove('selected'));
    srcEl.value = '';
    tgtEl.value = '';
  } catch (err) {
    resultEl.textContent = 'Error adding relation: ' + String(err);
  }
});

function parsePath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  const result = { chapterId: null, verseId: null };
  if (parts.length >= 2 && parts[0] === 'chapter') {
    result.chapterId = Number(parts[1]);
  } else if (parts.length >= 2 && parts[0] === 'verse') {
    result.verseId = Number(parts[1]);
  }
  return result;
}

async function initFromPath() {
  const path = parsePath();
  if (!path.chapterId && !path.verseId) {
    try {
      await loadBooks();
    } catch (err) {
      resultEl.textContent = 'Initialization error loading books: ' + String(err);
      console.error('initFromPath loadBooks error', err);
    }
    return;
  }
  if (path.chapterId) {
    let chapter;
    try { chapter = await api.fetchChapter(path.chapterId); } catch (err) { resultEl.textContent = 'Initialization error fetching chapter: ' + String(err); console.error(err); return; }
    let books;
    try { books = await api.fetchBooks(); } catch (err) { resultEl.textContent = 'Initialization error fetching books: ' + String(err); console.error(err); return; }
    booksEl.innerHTML = '';
    books.forEach(b => { const opt = document.createElement('option'); opt.value = b.id; opt.textContent = b.name; booksEl.appendChild(opt); });
    booksEl.value = String(chapter.book_id);
    // populate chapters using the shared loader so currentChapters gets set
    try { await loadChapters(chapter.book_id); } catch (err) { resultEl.textContent = 'Initialization error loading chapters: ' + String(err); console.error(err); return; }
    // select by chapter DB id -> map to ordinal number
    const selectedChap = currentChapters.find(c => Number(c.id) === Number(path.chapterId));
    if (selectedChap) {
      chaptersEl.value = String(selectedChap.number);
      try { await loadVerses(selectedChap.id, { selectVerseId: null, showWholeChapter: true }); } catch (err) { resultEl.textContent = 'Initialization error loading verses: ' + String(err); console.error(err); }
    }
    return;
  }
  if (path.verseId) {
    let verse;
    try { verse = await api.fetchVerse(path.verseId); } catch (err) { resultEl.textContent = 'Initialization error fetching verse: ' + String(err); console.error(err); return; }
    let chap;
    try { chap = await api.fetchChapter(verse.chapter_id); } catch (err) { resultEl.textContent = 'Initialization error fetching chapter: ' + String(err); console.error(err); return; }
    let books;
    try { books = await api.fetchBooks(); } catch (err) { resultEl.textContent = 'Initialization error fetching books: ' + String(err); console.error(err); return; }
    booksEl.innerHTML = '';
    books.forEach(b => { const opt = document.createElement('option'); opt.value = b.id; opt.textContent = b.name; booksEl.appendChild(opt); });
    booksEl.value = String(chap.book_id);
    // populate chapters via loader so currentChapters is set
    try { await loadChapters(chap.book_id); } catch (err) { resultEl.textContent = 'Initialization error loading chapters: ' + String(err); console.error(err); return; }
    const selectedChap = currentChapters.find(c => Number(c.id) === Number(chap.id));
    if (selectedChap) {
      chaptersEl.value = String(selectedChap.number);
      try { await loadVerses(chap.id, { selectVerseId: path.verseId, showWholeChapter: false }); } catch (err) { resultEl.textContent = 'Initialization error loading verses: ' + String(err); console.error(err); }
    }
    return;
  }
}

initFromPath();
async function populateRelationTypes(){
  const types = await api.fetchRelationTypes();
  const data = document.getElementById('relation-types');
  data.innerHTML = types.map(t=>`<option value="${t}"></option>`).join('');
}
populateRelationTypes();

export default {};

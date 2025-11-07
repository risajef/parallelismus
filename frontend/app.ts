// Minimal TypeScript frontend (kept simple for demonstration)
type Book = { id: number; name: string };
type Chapter = { id: number; book_id: number; number: number };
type Verse = { id: number; chapter_id: number; number: number };
type Word = { id: number; verse_id: number; strong: string; original?: string; translation?: string };

let apiBase = '';
try {
  const host = window.location.hostname;
  // prefer current origin for local dev (localhost / 127.0.0.1) or same-origin hosting
  if (host === 'localhost' || host === '127.0.0.1') {
    apiBase = window.location.origin;
  } else {
    apiBase = window.location.origin;
  }
} catch (e) {
  apiBase = '';
}

export async function fetchBooks(): Promise<Book[]> {
  const res = await fetch(`${apiBase}/books`);
  return res.json();
}

export async function fetchChapters(bookId: number): Promise<Chapter[]> {
  const res = await fetch(`${apiBase}/books/${bookId}/chapters`);
  return res.json();
}

export async function fetchVerses(chapterId: number): Promise<Verse[]> {
  const res = await fetch(`${apiBase}/chapters/${chapterId}/verses`);
  return res.json();
}

export async function fetchWords(verseId: number): Promise<Word[]> {
  const res = await fetch(`${apiBase}/verses/${verseId}/words`);
  return res.json();
}

// small helper to create relation via POST
export async function addRelation(payload: any) {
  const res = await fetch(`${apiBase}/relations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

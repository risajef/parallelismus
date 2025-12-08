from fastapi import FastAPI, HTTPException, Request
import logging
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlmodel import select
from typing import List
from pydantic import BaseModel

from .database import create_db_and_tables, engine
from .models import Book, Chapter, Verse, Word, Relation, VerseWord


class WordInVerse(BaseModel):
    """Word with verse-specific original and translation from VerseWord association."""
    strong: str
    # verse-specific canonical original and translation (from VerseWord)
    verse_original: str
    verse_translation: str
    # all variants (from Word.original and Word.translation lists)
    all_originals: list[str]
    all_translations: list[str]


class RelationGroup(BaseModel):
    source_id: str
    target_id: str
    relation_type: str
    source_verse_ids: list[int]


class WordUsage(BaseModel):
    verse_id: int
    verse_number: int
    chapter_id: int
    chapter_number: int
    book_id: int
    book_name: str
    verse_original: str
    verse_translation: str


class WordDetail(BaseModel):
    strong: str
    all_originals: list[str]
    all_translations: list[str]
    usages: list[WordUsage]


class WordInChapter(BaseModel):
    verse_id: int
    strong: str
    verse_original: str
    verse_translation: str
    all_originals: list[str]
    all_translations: list[str]


app = FastAPI(title="Parallelismus API")

# basic logging to stdout for debugging incoming requests
logging.basicConfig(level=logging.INFO)

# serve the frontend static files from the frontend/ directory at /static

app.mount("/static", StaticFiles(directory="frontend"), name="frontend-static")


@app.get("/", include_in_schema=False)
def root() -> FileResponse:
    return FileResponse("frontend/index.html")

# allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000", "http://localhost:8001", "http://127.0.0.1:8001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/books", response_model=List[Book])
def list_books(request: Request):
    from sqlmodel import Session
    with Session(engine) as session:
        return session.exec(select(Book)).all()


@app.get("/books/{book_id}/chapters", response_model=List[Chapter])
def list_chapters(book_id: int, request: Request):
    from sqlmodel import Session
    with Session(engine) as session:
        return session.exec(select(Chapter).where(Chapter.book_id == book_id)).all()


@app.get("/chapters/{chapter_id}/verses", response_model=List[Verse])
def list_verses(chapter_id: int, request: Request):
    from sqlmodel import Session
    with Session(engine) as session:
        return session.exec(select(Verse).where(Verse.chapter_id == chapter_id)).all()


@app.get("/verses/{verse_id}/words", response_model=List[WordInVerse])
def list_words(verse_id: int, request: Request):
    from sqlmodel import Session
    from sqlmodel import select as _select
    with Session(engine) as session:
        # join Word and VerseWord to get both the global word data and verse-specific original/translation
        stmt = _select(Word, VerseWord).join(VerseWord, Word.strong == VerseWord.word_id).where(VerseWord.verse_id == verse_id)
        results = session.exec(stmt).all()
        return [
            WordInVerse(
                strong=word.strong,
                verse_original=vw.original,
                verse_translation=vw.translation,
                all_originals=word.original,
                all_translations=word.translation
            )
            for word, vw in results
        ]


@app.get("/words/{word_id}/relations", response_model=List[Relation])
def get_relations(word_id: str):
    from sqlmodel import Session
    with Session(engine) as session:
        return session.exec(select(Relation).where((Relation.source_id == word_id) | (Relation.target_id == word_id))).all()


@app.get("/relations/batch")
def relations_batch(ids: str):
    """Return a mapping of strong id -> boolean indicating whether any relation exists for that id.
    Expects a comma-separated list of ids in the `ids` query parameter.
    """
    ids_list = [i for i in ids.split(',') if i]
    if not ids_list:
        return {}
    from sqlmodel import Session
    with Session(engine) as session:
        rows = session.exec(select(Relation).where((Relation.source_id.in_(ids_list)) | (Relation.target_id.in_(ids_list)))).all()
        out = {i: False for i in ids_list}
        for r in rows:
            if r.source_id in out:
                out[r.source_id] = True
            if r.target_id in out:
                out[r.target_id] = True
        return out


@app.get("/relations/counts")
def relations_counts(ids: str):
    """Return a mapping of strong id -> integer count of relations involving that id.
    Expects a comma-separated list of ids in the `ids` query parameter.
    """
    ids_list = [i for i in ids.split(',') if i]
    if not ids_list:
        return {}
    from sqlmodel import Session
    with Session(engine) as session:
        rows = session.exec(select(Relation).where((Relation.source_id.in_(ids_list)) | (Relation.target_id.in_(ids_list)))).all()
        out = {i: 0 for i in ids_list}
        for r in rows:
            if r.source_id in out:
                out[r.source_id] += 1
            if r.target_id in out:
                out[r.target_id] += 1
        return out


@app.get("/relations/all")
def relations_all(limit: int = 500, relation_type: str | None = None):
    """Return a list of relations with basic labels for graph visualization."""
    from sqlmodel import Session
    from .models import Word

    with Session(engine) as session:
        stmt = select(Relation)
        if relation_type:
            stmt = stmt.where(Relation.relation_type == relation_type)
        stmt = stmt.order_by(Relation.id)
        if limit:
            stmt = stmt.limit(limit)
        relations = session.exec(stmt).all()
        if not relations:
            return []
        ids: set[str] = set()
        for rel in relations:
            if rel.source_id:
                ids.add(rel.source_id)
            if rel.target_id:
                ids.add(rel.target_id)
        word_map: dict[str, Word] = {}
        if ids:
            words = session.exec(select(Word).where(Word.strong.in_(list(ids)))).all()  # type: ignore[attr-defined]
            for w in words:
                word_map[w.strong] = w

        def build_label(word: Word | None, fallback: str) -> str:
            if not word:
                return fallback
            primary = None
            if isinstance(word.translation, list) and word.translation:
                primary = word.translation[0]
            elif isinstance(word.original, list) and word.original:
                primary = word.original[0]
            if primary:
                return f"{fallback} — {primary}"
            return fallback

        response = []
        for rel in relations:
            response.append({
                "id": rel.id,
                "source_id": rel.source_id,
                "target_id": rel.target_id,
                "relation_type": rel.relation_type,
                "source_label": build_label(word_map.get(rel.source_id), rel.source_id or ""),
                "target_label": build_label(word_map.get(rel.target_id), rel.target_id or ""),
            })
        return response


@app.get("/words/{strong}/detail", response_model=WordDetail)
def get_word_detail(strong: str):
    """Return word variants and list of usages (which verse/chapter/book and the verse-canonical original/translation)."""
    from sqlmodel import Session
    from sqlmodel import select as _select
    with Session(engine) as session:
        word = session.get(Word, strong)
        if not word:
            raise HTTPException(status_code=404, detail="Word not found")
        # find usages from VerseWord join Verse->Chapter->Book
        stmt = _select(VerseWord, Verse, Chapter, Book).join(Verse, Verse.id == VerseWord.verse_id).join(Chapter, Chapter.id == Verse.chapter_id).join(Book, Book.id == Chapter.book_id).where(VerseWord.word_id == strong)
        rows = session.exec(stmt).all()
        usages: list[WordUsage] = []
        for vw, verse, chap, book in rows:
            usages.append(WordUsage(
                verse_id=(vw.verse_id if vw.verse_id is not None else 0),
                verse_number=(verse.number if verse.number is not None else 0),
                chapter_id=(chap.id if chap.id is not None else 0),
                chapter_number=(chap.number if chap.number is not None else 0),
                book_id=(book.id if book.id is not None else 0),
                book_name=book.name,
                verse_original=vw.original or '',
                verse_translation=vw.translation or ''
            ))
        return WordDetail(strong=word.strong, all_originals=word.original, all_translations=word.translation, usages=usages)


@app.get("/relation_types", response_model=List[str])
def list_relation_types():
    from sqlmodel import Session
    from sqlmodel import select as _select
    with Session(engine) as session:
        rows = session.exec(_select(Relation.relation_type).distinct()).all()
        # rows will be a list of strings
        return rows


@app.get("/verse/{verse_id}", response_model=Verse)
def get_verse(verse_id: int, request: Request):
    """Return verse JSON for API clients; when accessed by a browser (Accept: text/html) return the SPA HTML so deep links load the app."""
    accept = request.headers.get('accept', '')
    from sqlmodel import Session
    # if the client accepts HTML, serve the SPA so users can deep-link to /verse/{id}
    if 'text/html' in accept:
        return FileResponse("frontend/index.html")
    with Session(engine) as session:
        verse = session.get(Verse, verse_id)
        if not verse:
            raise HTTPException(status_code=404, detail="Verse not found")
        return verse


@app.get("/strong", include_in_schema=False)
def strong_search_page():
    """Serve the Strong search frontend page."""
    return FileResponse("frontend/strong_search.html")


@app.get("/strong/search")
@app.get("/strong/search/")
def strong_search(q: str, request: Request):
    """Search Word rows by substring match across translations and originals (case-insensitive).
    Returns a list of Word objects (strong, original[], translation[]).
    """
    from sqlmodel import Session
    from sqlmodel import select as _select
    term = q.strip().lower()
    if not term:
        return []
    with Session(engine) as session:
        # SQLite stores JSON as text; simplest robust approach is to load all words and filter in Python.
        # This is acceptable for a small dataset like a bible wordlist.
        rows = session.exec(_select(Word)).all()
        out = []
        for w in rows:
            matched = False
            # check translations
            for t in (w.translation or []):
                if t and term in t.lower():
                    matched = True
                    break
            if not matched:
                for o in (w.original or []):
                    if o and term in o.lower():
                        matched = True
                        break
            if matched:
                out.append({"strong": w.strong, "original": w.original, "translation": w.translation})
    # return explicit JSON response to avoid content negotiation returning HTML
    return JSONResponse(content=out)


@app.get("/strong/{strong}", include_in_schema=False)
def strong_page(strong: str):
    # serves a small frontend page that shows information about a strong and its relations
    return FileResponse("frontend/strong.html")


@app.get("/graph", include_in_schema=False)
def relations_graph_page():
    """Serve the interactive relations graph frontend."""
    return FileResponse("frontend/graph.html")


@app.get("/book/{book_id}/chapter/{chapter_id}", include_in_schema=False)
def book_chapter_page(book_id: int, chapter_id: int):
    """Serve the SPA for direct navigation to a chapter."""
    return FileResponse("frontend/index.html")


@app.get("/book/{book_id}/chapter/{chapter_id}/verse/{verse_id}", include_in_schema=False)
def book_chapter_verse_page(book_id: int, chapter_id: int, verse_id: int):
    """Serve the SPA for direct navigation to a verse."""
    return FileResponse("frontend/index.html")


@app.get("/debug/headers")
def debug_headers(request: Request):
    """Return the received request headers and client host for debugging proxies/service-workers."""
    try:
        client = request.client.host if request.client else 'unknown'
    except Exception:
        client = 'unknown'
    headers = {k: v for k, v in request.headers.items()}
    return JSONResponse(content={"client": client, "headers": headers})


@app.get("/chapter/{chapter_id}", response_model=Chapter)
def get_chapter(chapter_id: int, request: Request):
    """Return chapter JSON for API clients; when accessed by a browser (Accept: text/html) return the SPA HTML so deep links load the app."""
    accept = request.headers.get('accept', '')
    from sqlmodel import Session
    # if the client accepts HTML, serve the SPA so users can deep-link to /chapter/{id}
    if 'text/html' in accept:
        return FileResponse("frontend/index.html")
    with Session(engine) as session:
        chap = session.get(Chapter, chapter_id)
        if not chap:
            raise HTTPException(status_code=404, detail="Chapter not found")
        return chap


@app.get("/chapter/{chapter_id}/words", response_model=List[WordInChapter])
def list_chapter_words(chapter_id: int):
    """Return all WordInVerse-like rows for every verse in a chapter in a single query."""
    from sqlmodel import Session
    from sqlmodel import select as _select
    with Session(engine) as session:
        # join Verse -> VerseWord -> Word, filter by Verse.chapter_id
        stmt = _select(VerseWord, Word, Verse).join(Verse, Verse.id == VerseWord.verse_id).join(Word, Word.strong == VerseWord.word_id).where(Verse.chapter_id == chapter_id)
        rows = session.exec(stmt).all()
        out: list[WordInChapter] = []
        for vw, word, verse in rows:
            out.append(WordInChapter(
                verse_id=(vw.verse_id or 0),
                strong=word.strong,
                verse_original=vw.original or '',
                verse_translation=vw.translation or '',
                all_originals=word.original,
                all_translations=word.translation
            ))
        return out


@app.get("/relations/grouped/{word_id}", response_model=List[RelationGroup])
def get_grouped_relations(word_id: str):
    """Return relations involving word_id, grouped by (source,target,type) with all source_verse_ids."""
    from sqlmodel import Session
    with Session(engine) as session:
        rows = session.exec(select(Relation).where((Relation.source_id == word_id) | (Relation.target_id == word_id))).all()
        groups: dict[tuple[str, str, str], set[int]] = {}
        for r in rows:
            key = (r.source_id, r.target_id, r.relation_type)
            groups.setdefault(key, set())
            if r.source_verse_id is not None:
                groups[key].add(r.source_verse_id)

        result: list[RelationGroup] = []
        for (s, t, typ), verses in groups.items():
            result.append(RelationGroup(source_id=s, target_id=t, relation_type=typ, source_verse_ids=sorted(list(verses))))
        return result


@app.post("/relations", response_model=Relation)
def add_relation(relation: Relation):
    from sqlmodel import Session
    with Session(engine) as session:
        session.add(relation)
        session.commit()
        session.refresh(relation)
        return relation


@app.delete("/relations/{relation_id}", response_model=Relation)
def delete_relation(relation_id: int):
    """Delete a relation by id and return the deleted relation."""
    from sqlmodel import Session
    with Session(engine) as session:
        rel = session.get(Relation, relation_id)
        if not rel:
            raise HTTPException(status_code=404, detail="Relation not found")
        # store a copy to return after deletion
        out = Relation.from_orm(rel)
        session.delete(rel)
        session.commit()
        return out


@app.get("/{path:path}", include_in_schema=False)
def catch_all(path: str, request: Request):
    """Catch-all route: serve index.html for HTML requests, 404 for others."""
    accept = request.headers.get('accept', '')
    if 'text/html' in accept:
        print("catch-all serving index.html for path:", path)
        return FileResponse("frontend/index.html")
    raise HTTPException(status_code=404, detail="Not found")

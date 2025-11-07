from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlmodel import select
from typing import List
from pydantic import BaseModel

from .database import create_db_and_tables, get_session, engine
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


app = FastAPI(title="Parallelismus API")

# serve the frontend static files from the frontend/ directory at /static
app.mount("/static", StaticFiles(directory="frontend"), name="frontend-static")

from fastapi.responses import FileResponse


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
def list_books():
    from sqlmodel import Session
    with Session(engine) as session:
        return session.exec(select(Book)).all()


@app.get("/books/{book_id}/chapters", response_model=List[Chapter])
def list_chapters(book_id: int):
    from sqlmodel import Session
    with Session(engine) as session:
        return session.exec(select(Chapter).where(Chapter.book_id == book_id)).all()


@app.get("/chapters/{chapter_id}/verses", response_model=List[Verse])
def list_verses(chapter_id: int):
    from sqlmodel import Session
    with Session(engine) as session:
        return session.exec(select(Verse).where(Verse.chapter_id == chapter_id)).all()


@app.get("/verses/{verse_id}/words", response_model=List[WordInVerse])
def list_words(verse_id: int):
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


@app.post("/relations", response_model=Relation)
def add_relation(relation: Relation):
    from sqlmodel import Session
    with Session(engine) as session:
        session.add(relation)
        session.commit()
        session.refresh(relation)
        return relation

"""Idempotent corpus import with one transaction per complete book."""
import json
from pathlib import Path
from sqlmodel import Session, SQLModel, select
from .database import engine
from .models import Book, Chapter, Verse, Word, VerseWord

BASE = Path(__file__).resolve().parents[1] / 'bible'

def slug_to_name(filename: str) -> str:
    return Path(filename).stem.replace('_', ' ').title()

def read_book(file):
    raw = json.loads(Path(file).read_text(encoding='utf-8'))
    if not isinstance(raw, list):
        raise ValueError('A book must contain a verse array')
    seen = set()
    for entry in raw:
        key = entry.get('id', '')
        if not isinstance(key, str) or len(key) != 8 or not key.isdigit() or key in seen:
            raise ValueError('Invalid or duplicate source verse key')
        seen.add(key)
        if entry.get('verse') is not None and not isinstance(entry['verse'], list):
            raise ValueError('Invalid verse tokens')
    return sorted(raw, key=lambda entry: entry['id'])

def merge_word(session, words, strong, original, translation):
    word = words.get(strong)
    if word is None:
        word = Word(strong=strong, original=[], translation=[])
        words[strong] = word
    word.original = sorted(set(word.original) | ({original} if original else set()))
    word.translation = sorted(set(word.translation) | ({translation} if translation else set()))
    session.add(word)

def import_book(file, db_engine=engine):
    entries = read_book(file)  # validate before the first database mutation
    with Session(db_engine) as session, session.begin():
        name = slug_to_name(str(file))
        book = session.exec(select(Book).where(Book.name == name)).one_or_none()
        if book is None:
            book = Book(name=name); session.add(book); session.flush()
        chapters = {c.number:c for c in session.exec(select(Chapter).where(Chapter.book_id == book.id))}
        words = {w.strong:w for w in session.exec(select(Word))}
        for entry in entries:
            chapter_no, verse_no = int(entry['id'][2:5]), int(entry['id'][5:])
            chapter = chapters.get(chapter_no)
            if chapter is None:
                chapter = Chapter(book_id=book.id, number=chapter_no)
                session.add(chapter); session.flush(); chapters[chapter_no] = chapter
            verse = session.exec(select(Verse).where(Verse.chapter_id == chapter.id, Verse.number == verse_no)).one_or_none()
            if verse is None:
                verse = Verse(chapter_id=chapter.id, number=verse_no); session.add(verse); session.flush()
            links = {w.position:w for w in session.exec(select(VerseWord).where(VerseWord.verse_id == verse.id))}
            for position, token in enumerate(entry.get('verse') or []):
                if not isinstance(token, dict):
                    continue
                strong = token.get('number')
                if not strong:
                    continue
                if not isinstance(strong, str):
                    raise ValueError('Strong IDs must be strings')
                strong = strong.strip()
                if not strong:
                    continue
                original, translation = token.get('word') or '', token.get('text') or ''
                if not isinstance(original, str) or not isinstance(translation, str):
                    raise ValueError('Token text must be a string')
                merge_word(session, words, strong, original, translation)
                session.flush()  # persist new words before association foreign keys
                link = links.get(position)
                if link is None:
                    link = VerseWord(verse_id=verse.id, word_id=strong, position=position)
                link.word_id, link.original, link.translation = strong, original, translation
                session.add(link); links[position] = link
            session.flush()

def import_all(base=BASE, db_engine=engine):
    SQLModel.metadata.create_all(db_engine)
    for file in sorted(Path(base).glob('*.json')):
        print('Importing', file.name)
        import_book(file, db_engine)

if __name__ == '__main__':
    import_all()

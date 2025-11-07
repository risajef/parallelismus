import json
from sqlmodel import Session, select
from pathlib import Path

from .database import engine, create_db_and_tables
from .models import Book, Chapter, Verse, Word, VerseWord


BASE = Path(__file__).resolve().parents[1] / 'bible'


def slug_to_name(filename: str) -> str:
    name = Path(filename).stem
    return name.replace('_', ' ').title()


def import_all():
    create_db_and_tables()
    files = sorted(BASE.glob('*.json'))

    with Session(engine) as session:
        for f in files:
            print('Importing', f.name)
            book_name = slug_to_name(f.name)

            # skip if book already present
            existing = session.exec(select(Book).where(Book.name == book_name)).first()
            if existing:
                print('  exists, skipping')
                continue

            book = Book(name=book_name)
            session.add(book)
            session.commit()
            session.refresh(book)

            with open(f, 'r', encoding='utf-8') as fh:
                data = json.load(fh)
            
            data = [{"verse": v["verse"], "book_nr": int(v["id"][:2]), "chapter_nr": int(v["id"][2:5]), "verse_nr": int(v["id"][5:])} for v in data]
            data = {chapter_nr: [verse for verse in data if verse["chapter_nr"] == chapter_nr] for chapter_nr in set([verse["chapter_nr"] for verse in data])}

            # data is a list of chapters
            for chapter_nr in sorted(data.keys()):
                print(f'  Importing chapter {chapter_nr}')
                verses = data[chapter_nr]
                chapter = Chapter(book_id=book.id, number=chapter_nr)
                session.add(chapter)
                session.commit()
                session.refresh(chapter)

                for verse_idx, verse in enumerate(verses, start=1):
                    v = Verse(chapter_id=chapter.id, number=verse_idx)
                    session.add(v)
                    session.commit()
                    session.refresh(v)
                    # ensure we have an id to reference (type-checker and runtime safety)
                    assert v.id is not None

                    verse = verse.get('verse')

                    if not isinstance(verse, list):
                        continue

                    # For each token in the verse, ensure there's at most one Word row per (verse_id, strong).
                    # If a Word exists, merge the original/translation into its JSON lists and update it.
                    for w in verse:
                        if not isinstance(w, dict):
                            continue
                        strong = w.get('number')
                        if isinstance(strong, str):
                            strong = strong.strip()
                        if not strong:
                            continue
                        original = w.get('word')
                        translation = w.get('text')

                        # lookup global Word for this strong
                        existing = session.exec(select(Word).where(Word.strong == strong)).first()
                        if existing:
                            # normalize existing fields to sets
                            def to_set(val):
                                if val is None:
                                    return set()
                                if isinstance(val, list):
                                    return set(val)
                                return {val}

                            origs = to_set(existing.original)
                            trans = to_set(existing.translation)
                            if original:
                                origs.add(original)
                            if translation:
                                trans.add(translation)

                            existing.original = sorted(origs)
                            existing.translation = sorted(trans)
                            session.add(existing)
                            # make sure updated values are visible to subsequent selects
                            session.flush()
                        else:
                            originals = [original] if original else []
                            translations = [translation] if translation else []
                            existing = Word(strong=strong, original=originals, translation=translations)
                            session.add(existing)
                            # flush so the new row is visible to subsequent selects in this session
                            session.flush()

                        # ensure VerseWord association exists linking this verse and the (global) word
                        # store the canonical original and translation for this verse context
                        link = session.exec(select(VerseWord).where(VerseWord.verse_id == v.id, VerseWord.word_id == strong)).first()
                        if not link:
                            link = VerseWord(
                                verse_id=v.id,
                                word_id=strong,
                                original=original or "",
                                translation=translation or ""
                            )
                            session.add(link)
                            session.flush()

                    session.commit()


if __name__ == '__main__':
    import_all()

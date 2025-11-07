from backend.database import create_db_and_tables, engine
from backend.models import Book, Chapter, Verse, Word, VerseWord
from sqlmodel import Session, select

# create tables
create_db_and_tables()

with Session(engine) as session:
    # create a test book/chapter/verse
    book = Book(name='Test Book')
    session.add(book)
    session.commit()
    session.refresh(book)

    chapter = Chapter(book_id=book.id, number=1)
    session.add(chapter)
    session.commit()
    session.refresh(chapter)

    verse = Verse(chapter_id=chapter.id, number=1)
    session.add(verse)
    session.commit()
    session.refresh(verse)
    # simulate importer behavior: two tokens with same strong but different originals/translations
    tokens = [
        {'number': 'G0001', 'word': 'alpha', 'text': 'one'},
        {'number': 'G0001', 'word': 'beta', 'text': 'uno'},
    ]

    # run the same logic the importer now uses (global Word + VerseWord association)
    for t in tokens:
        strong = t['number']
        original = t.get('word')
        translation = t.get('text')

        existing = session.exec(select(Word).where(Word.strong == strong)).first()
        if existing:
            origs = set(existing.original)
            trans = set(existing.translation)
            if original:
                origs.add(original)
            if translation:
                trans.add(translation)
            existing.original = sorted(origs)
            existing.translation = sorted(trans)
            session.add(existing)
            session.flush()
        else:
            existing = Word(strong=strong, original=[original] if original else [], translation=[translation] if translation else [])
            session.add(existing)
            session.flush()

        # ensure association
        link = session.exec(select(VerseWord).where(VerseWord.verse_id == verse.id, VerseWord.word_id == strong)).first()
        if not link:
            assert verse.id is not None
            link = VerseWord(verse_id=verse.id, word_id=strong)
            session.add(link)
            session.flush()

        session.commit()

    fetched = session.exec(select(Word).where(Word.strong == 'G0001')).first()
    if not fetched:
        print('No Word row found for G0001')
    else:
        row = fetched
        assert row is not None
        print('fetched strong:', row.strong)
        print('original type:', type(row.original), 'value:', row.original)
        print('translation type:', type(row.translation), 'value:', row.translation)
        assert set(row.original or []) == {'alpha', 'beta'}
        assert set(row.translation or []) == {'one', 'uno'}

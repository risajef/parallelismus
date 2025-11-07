from sqlmodel import Session
from .database import engine, create_db_and_tables
from .models import Book, Chapter, Verse, Word, Relation


def seed():
    create_db_and_tables()
    with Session(engine) as session:
        # small sample: Book "Sample" with 1 chapter, 2 verses
        b = Book(name="Sample")
        session.add(b)
        session.commit()
        session.refresh(b)

        c = Chapter(book_id=b.id, number=1)
        session.add(c)
        session.commit()
        session.refresh(c)

        v1 = Verse(chapter_id=c.id, number=1)
        v2 = Verse(chapter_id=c.id, number=2)
        session.add_all([v1, v2])
        session.commit()
        session.refresh(v1)
        session.refresh(v2)

        w1 = Word(verse_id=v1.id, strong="H001", original="ברא", translation="create")
        w2 = Word(verse_id=v1.id, strong="H002", original="אדם", translation="man")
        w3 = Word(verse_id=v2.id, strong="H003", original="אדמה", translation="earth")
        session.add_all([w1, w2, w3])
        session.commit()

        rel = Relation(source_id=w1.id, target_id=w2.id, relation_type="similar", source_verse_id=v1.id, notes="example")
        session.add(rel)
        session.commit()


if __name__ == "__main__":
    seed()

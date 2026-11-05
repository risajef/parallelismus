"""Create a repeatable sample through the current corpus importer."""
import json
from tempfile import TemporaryDirectory
from pathlib import Path
from sqlmodel import Session, SQLModel, select
from .database import engine, create_db_and_tables
from .models import Relation, Verse, Chapter, Book
from .import_strong import import_book

def seed(db_engine=engine):
    create_db_and_tables(db_engine)
    with TemporaryDirectory() as tmp:
        file = Path(tmp) / 'sample.json'
        file.write_text(json.dumps([
            {'id':'99001001','verse':[{'number':'h1','word':'ברא','text':'create'}, {'number':'h2','word':'אדם','text':'man'}]},
            {'id':'99001002','verse':[{'number':'h3','word':'אדמה','text':'earth'}]}
        ]), encoding='utf-8')
        import_book(file, db_engine)
    with Session(db_engine) as session, session.begin():
        book = session.exec(select(Book).where(Book.name == 'Sample')).one()
        chapter = session.exec(select(Chapter).where(Chapter.book_id == book.id, Chapter.number == 1)).one()
        verse = session.exec(select(Verse).where(Verse.chapter_id == chapter.id, Verse.number == 1)).one()
        existing = session.exec(select(Relation).where(Relation.source_id == 'h1', Relation.target_id == 'h2', Relation.relation_type == 'similar', Relation.source_verse_id == verse.id)).first()
        if existing is None:
            session.add(Relation(source_id='h1', target_id='h2', relation_type='similar', source_verse_id=verse.id, notes='example'))

if __name__ == '__main__':
    seed()

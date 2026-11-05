import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import event
from backend import main
from backend.database import create_db_and_tables
from backend.models import Book, Chapter, Verse, Word

@pytest.fixture
def database(tmp_path, monkeypatch):
    engine = create_engine('sqlite:///' + str(tmp_path / 'test.db'), connect_args={'check_same_thread':False})
    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
    create_db_and_tables(engine)
    monkeypatch.setattr(main, 'engine', engine)
    monkeypatch.setenv('PARALLELISMUS_WRITE_TOKEN', 'test-secret')
    with Session(engine) as session:
        b=Book(name='Test');session.add(b);session.flush()
        c=Chapter(book_id=b.id,number=1);session.add(c);session.flush()
        session.add(Verse(chapter_id=c.id,number=1))
        session.add_all([Word(strong=s,original=[s],translation=[s]) for s in ['a','b','c']]);session.commit()
    yield engine
    engine.dispose()

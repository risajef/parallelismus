import os
from pathlib import Path
from sqlalchemy import event
from sqlmodel import create_engine, Session
from sqlmodel import SQLModel
from typing import Generator

DATABASE_URL = os.getenv('PARALLELISMUS_DATABASE_URL', 'sqlite:///' + str(Path(__file__).resolve().parents[1] / 'parallelismus.db'))

engine = create_engine(DATABASE_URL, echo=False, connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite:') else {})
if DATABASE_URL.startswith('sqlite:'):
    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

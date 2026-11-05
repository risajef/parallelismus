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


def create_db_and_tables(db_engine=engine):
    SQLModel.metadata.create_all(db_engine)
    if db_engine.dialect.name == 'sqlite':
        with db_engine.begin() as connection:
            verse_columns = {row[1] for row in connection.exec_driver_sql('PRAGMA table_info(verseword)')}
            if 'position' not in verse_columns:
                connection.exec_driver_sql('ALTER TABLE verseword ADD COLUMN position INTEGER NOT NULL DEFAULT 0')
            columns = {row[1] for row in connection.exec_driver_sql('PRAGMA table_info(relation)')}
            if 'composition_id' not in columns:
                connection.exec_driver_sql('ALTER TABLE relation ADD COLUMN composition_id VARCHAR')
            # The original four-column UNIQUE constraint prevented overlapping
            # n-ary assertions. Rebuild only that legacy table, preserving every row.
            legacy_unique = False
            for index in connection.exec_driver_sql('PRAGMA index_list(relation)').fetchall():
                if index[2]:
                    columns = [row[2] for row in connection.exec_driver_sql('PRAGMA index_info("' + index[1] + '")')]
                    if columns == ['source_id','target_id','relation_type','source_verse_id']:
                        legacy_unique = True
            if legacy_unique:
                connection.exec_driver_sql('CREATE TABLE relation_upgrade (id INTEGER PRIMARY KEY, source_id VARCHAR NOT NULL REFERENCES word(strong), target_id VARCHAR NOT NULL REFERENCES word(strong), relation_type VARCHAR NOT NULL, source_verse_id INTEGER REFERENCES verse(id), notes VARCHAR, composition_id VARCHAR)')
                connection.exec_driver_sql('INSERT INTO relation_upgrade SELECT id,source_id,target_id,relation_type,source_verse_id,notes,composition_id FROM relation')
                connection.exec_driver_sql('DROP TABLE relation')
                connection.exec_driver_sql('ALTER TABLE relation_upgrade RENAME TO relation')
            connection.exec_driver_sql('CREATE UNIQUE INDEX IF NOT EXISTS relation_plain_evidence ON relation(source_id,target_id,relation_type,source_verse_id) WHERE composition_id IS NULL')
            connection.exec_driver_sql('CREATE UNIQUE INDEX IF NOT EXISTS relation_composition_member ON relation(composition_id,source_id) WHERE composition_id IS NOT NULL')



def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

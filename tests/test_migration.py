import json
from sqlalchemy import create_engine
from sqlmodel import Session, select
from backend.database import create_db_and_tables
from backend.import_strong import import_all
from backend.models import VerseWord

def test_legacy_schema_and_unpositioned_tokens_upgrade_without_starting_server(tmp_path):
    engine=create_engine('sqlite:///'+str(tmp_path/'old.db'))
    with engine.begin() as connection:
        connection.exec_driver_sql('CREATE TABLE verseword (id INTEGER PRIMARY KEY,verse_id INTEGER,word_id VARCHAR,original VARCHAR NOT NULL,translation VARCHAR NOT NULL)')
        connection.exec_driver_sql('CREATE TABLE relation (id INTEGER PRIMARY KEY,source_id VARCHAR,target_id VARCHAR,relation_type VARCHAR,source_verse_id INTEGER,notes VARCHAR)')
    file=tmp_path/'sample.json'
    file.write_text(json.dumps([{'id':'99001001','verse':[{'number':'a','word':'one'},{'number':'b','word':'two'}]}]))
    import_all(tmp_path,engine)
    with engine.begin() as connection:
        # Simulate old associations, all assigned the migration's default position 0.
        connection.exec_driver_sql('UPDATE verseword SET position=0')
    import_all(tmp_path,engine)
    with Session(engine) as session:
        rows=session.exec(select(VerseWord).order_by(VerseWord.position)).all()
        assert [(r.position,r.word_id) for r in rows]==[(0,'a'),(1,'b')]
    create_db_and_tables(engine)
    engine.dispose()

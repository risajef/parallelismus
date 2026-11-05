import json
from sqlmodel import Session, select
from backend.import_strong import import_book
from backend.models import VerseWord

def test_repeated_strong_tokens_survive_import_and_retry(database,tmp_path):
    file=tmp_path/'tokens.json'
    file.write_text(json.dumps([{'id':'01001001','verse':[{'number':'a','word':'first'}, {'number':'a','word':'second'}]}]))
    import_book(file,database);import_book(file,database)
    with Session(database) as session:
        rows=session.exec(select(VerseWord).order_by(VerseWord.position)).all()
        assert [(r.position,r.original) for r in rows]==[(0,'first'),(1,'second')]

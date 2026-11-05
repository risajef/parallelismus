import json
import pytest
from sqlmodel import Session, select
from backend import import_strong as importer
from backend.models import Book, Verse, VerseWord

def test_interruption_rolls_back_and_retry_completes(database,tmp_path,monkeypatch):
    file=tmp_path/'new_book.json'
    file.write_text(json.dumps([{'id':'01001001','verse':[{'number':'a','word':'first'}]}, {'id':'01001002','verse':[{'number':'b','word':'second'}]}]))
    merge=importer.merge_word
    def fail(session,words,strong,original,translation):
        if strong=='b': raise RuntimeError('interrupted')
        return merge(session,words,strong,original,translation)
    monkeypatch.setattr(importer,'merge_word',fail)
    with pytest.raises(RuntimeError): importer.import_book(file,database)
    with Session(database) as session:
        assert session.exec(select(Book).where(Book.name=='New Book')).first() is None
    monkeypatch.setattr(importer,'merge_word',merge)
    importer.import_book(file,database); importer.import_book(file,database)
    with Session(database) as session:
        assert len(session.exec(select(Book).where(Book.name=='New Book')).all())==1
        assert len(session.exec(select(VerseWord)).all())==2

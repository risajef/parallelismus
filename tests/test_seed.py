from sqlmodel import Session, select
from backend.seed import seed
from backend.models import Word, VerseWord, Relation

def test_seed_matches_current_schema_and_is_repeatable(database):
    seed(database); seed(database)
    with Session(database) as session:
        assert len(session.exec(select(VerseWord)).all())==3
        relations=session.exec(select(Relation)).all()
        assert len(relations)==1
        assert relations[0].source_id=='h1'
        assert session.get(Word,'h1').translation==['create']

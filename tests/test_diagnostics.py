import importlib
from sqlmodel import Session, select
from backend.models import Book

def test_diagnostic_import_has_no_database_side_effects(database):
    with Session(database) as session: before=len(session.exec(select(Book)).all())
    importlib.import_module('backend.test_import_quick')
    with Session(database) as session: assert len(session.exec(select(Book)).all())==before

def test_graph_preserves_parallel_assertions():
    from tools.visualize_relations import build_graph
    graph=build_graph([('a','b','similar'),('a','b','opposite')],{})
    assert graph.number_of_edges()==2

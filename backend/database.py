from sqlmodel import create_engine, Session
from sqlmodel import SQLModel
from typing import Generator

DATABASE_URL = "sqlite:///./parallelismus.db"

engine = create_engine(DATABASE_URL, echo=False)


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session

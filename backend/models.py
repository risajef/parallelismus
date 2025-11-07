from typing import Optional
from sqlmodel import SQLModel, Field, Relationship
from sqlalchemy import Column
from sqlalchemy.types import JSON


class VerseWord(SQLModel, table=True):
    """Association table linking Verse and Word for many-to-many relationship.
    Stores the canonical original and translation from the bible JSON for this specific verse context.
    """
    id: Optional[int] = Field(default=None, primary_key=True)
    verse_id: int = Field(foreign_key="verse.id")
    word_id: str = Field(foreign_key="word.strong")
    # canonical original and translation for this word in this verse (from the bible JSON)
    original: str = Field(default="")
    translation: str = Field(default="")


class Book(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    chapters: list["Chapter"] = Relationship(back_populates="book")


class Chapter(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    book_id: int = Field(foreign_key="book.id")
    number: int
    verses: list["Verse"] = Relationship(back_populates="chapter")
    book: Optional["Book"] = Relationship(back_populates="chapters")


class Verse(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    chapter_id: int = Field(foreign_key="chapter.id")
    number: int
    words: list["Word"] = Relationship(back_populates="verses", link_model=VerseWord)
    chapter: Optional["Chapter"] = Relationship(back_populates="verses")


class Word(SQLModel, table=True):
    strong: str = Field(primary_key=True)
    # store possible original spellings and translations as JSON lists
    original: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    translation: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    # a Word can be used in many verses
    verses: list["Verse"] = Relationship(back_populates="words", link_model=VerseWord)
    relations_from: list["Relation"] = Relationship(back_populates="source_word", sa_relationship_kwargs={"primaryjoin": "Word.strong==Relation.source_id"})
    relations_to: list["Relation"] = Relationship(back_populates="target_word", sa_relationship_kwargs={"primaryjoin": "Word.strong==Relation.target_id"})


class Relation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    source_id: str = Field(foreign_key="word.strong")
    target_id: str = Field(foreign_key="word.strong")
    relation_type: str
    source_verse_id: Optional[int] = Field(default=None, foreign_key="verse.id")
    notes: Optional[str] = None
    source_word: Optional["Word"] = Relationship(back_populates="relations_from", sa_relationship_kwargs={"primaryjoin": "Relation.source_id==Word.strong"})
    target_word: Optional["Word"] = Relationship(back_populates="relations_to", sa_relationship_kwargs={"primaryjoin": "Relation.target_id==Word.strong"})



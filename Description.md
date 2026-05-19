# Display

## Main view
You can navigate the bible by selecting a book and a chapter with a dropdown.
This application has a Web-GUI that displays one chapter of the bible.
The chapter is divided into verses. And each verse consists of multiple "words" according to the `Strong` concordance.
It displays on top the hebrew or greek word, has a url to the strong definition of the word.
It displays on the bottom an english translation of the word.
You see which relations were defined in this chapter.

## Relations
A view exists where you can select a "word" according to `Strong` and see the relations it has.
You can also jump to the verses where the relation was added.

# Workflow
It optimizes the workflow of defining relations between two or more words.
So one can select a "word" and add a relation to the selected words.
The fixed set of relations is:
- **composes**: a, b, c ... x make up together the set A (n-ary: select multiple members + one target set)
- **opposite**: a is the opposite of b
- **similar**: a is similar to b
- **element_of**: a is an element of A
- **subset_of**: a is a subset of A
- **attribute_of**: a is an attribute of A

More of these relations might be defined in the future.

Clicking/tapping a word toggles selection. A small strong-ID link on each word opens the detail page.
For binary relations (opposite, similar, element_of, subset_of, attribute_of): select 2 words → source and target are auto-filled.
For composes: select multiple words → they appear as member chips. Then specify the target set.


# Storage
As a database sqlite is chosen.
A relation between words has always a source (the verse where it was defined).
It might have multiple sources, as the same relation might be noted at multiple verses.

# Tech-Stack
Backend: Python FastAPI
Database: SQLite
Frontend: Typescript with some framework

# Out of scope
A relation between a word of one chapter with the next is not yet supported in the GUI.
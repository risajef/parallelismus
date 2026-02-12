/**
 * API adapter – re-exports everything from the IndexedDB-based db.js module.
 * Consumers (index.js, strong_search.js, strong.html, graph.js) import from
 * this file and get the same function signatures as before.
 */
export {
    initDB,
    fetchBooks,
    fetchChapters,
    fetchVerses,
    fetchWords,
    fetchVerse,
    fetchChapter,
    fetchChapterWords,
    fetchWordDetail,
    fetchStrongSearch,
    addRelation,
    deleteRelation,
    fetchRelations,
    fetchGroupedRelations,
    fetchRelationsBatch,
    fetchRelationsCounts,
    fetchRelationTypes,
    fetchAllRelations,
    exportRelations,
    importRelations,
    transliterate,
} from './db.js';

import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as backend from '../frontend/app.js';
import * as browser from '../frontend/app.static.js';
test('both adapters expose the shared UI contract',()=>{
    for(const name of ['initDB','fetchBooks','fetchChapters','fetchVerses','fetchWords','fetchVerse','fetchChapter','fetchWordDetail','fetchRelations','fetchGroupedRelations','fetchRelationTypes','fetchAllRelations','fetchStrongSearch','addRelation','deleteRelation','transliterate']) {
        assert.equal(typeof backend[name],'function',name+' backend');
        assert.equal(typeof browser[name],'function',name+' browser');
    }
    assert.equal(backend.transliterate('λόγος'),browser.transliterate('λόγος'));
});

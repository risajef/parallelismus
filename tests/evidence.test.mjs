import {test} from 'node:test';
import assert from 'node:assert/strict';
import { evidenceVerse } from '../frontend/evidence.js';
test('word context takes precedence over the first-verse dropdown',()=>{
    assert.equal(evidenceVerse(['2','2'],1),2);
    assert.throws(()=>evidenceVerse(['1','2'],1),/one evidence/);
    assert.equal(evidenceVerse([],2),2);
    assert.throws(()=>evidenceVerse([],undefined),/Select an evidence/);
});

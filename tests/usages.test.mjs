import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshDB,corpus} from './helpers.mjs';
test('word details include complete usages without visiting chapters',async()=>{
    const calls=[];
    const api=await freshDB(async url=>{calls.push(url);return new Response(JSON.stringify(url.includes('usages')?{a:[[2,'second','usage']]}:corpus));});
    const detail=await api.fetchWordDetail('a');
    assert.equal(detail.usages[0].verse_number,2);
    assert.equal(detail.usages[0].verse_translation,'usage');
    await api.fetchWordDetail('a');
    assert.equal(calls.filter(x=>x.includes('usages')).length,1);
    assert.equal(calls.filter(x=>x.includes('chapters/')).length,0);
});

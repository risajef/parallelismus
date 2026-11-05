import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshDB,corpus,relation} from './helpers.mjs';
test('concurrent chapter reads share a request and failed loads can retry',async()=>{
    let calls=0,fail=true;
    const api=await freshDB(async url=>{
        if(!url.includes('chapters/')) return new Response(JSON.stringify(corpus));
        calls++;await new Promise(r=>setTimeout(r,5));
        if(fail) return new Response('',{status:503});
        return new Response(JSON.stringify({verses:[{id:1,words:[['a','a','a']]}]}));
    });
    await Promise.all([assert.rejects(api.fetchWords(1)),assert.rejects(api.fetchWords(1))]);
    assert.equal(calls,1);fail=false;
    const rows=await Promise.all([api.fetchWords(1),api.fetchWords(1)]);
    assert.equal(calls,2);assert.equal(rows[0][0].strong,'a');
});
test('indexed queries count a self-edge once',async()=>{
    const api=await freshDB();await api.addRelation({...relation,target_id:'a'});
    assert.deepEqual(await api.fetchRelationsCounts(['a','b']),{a:1,b:0});
    assert.deepEqual(await api.fetchRelationsBatch(['a','b']),{a:true,b:false});
});

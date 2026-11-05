import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshDB,relation} from './helpers.mjs';
import {IDBObjectStore} from 'fake-indexeddb';
test('storage validates references and rejects duplicates atomically',async()=>{
    const api=await freshDB();
    await assert.rejects(api.addRelation({...relation,source_id:'unknown'}));
    await assert.rejects(api.addRelation({...relation,source_verse_id:null}));
    await assert.rejects(api.addRelation({...relation,relation_type:'invented'}));
    await api.addRelation(relation);
    await assert.rejects(api.addRelations([{...relation,target_id:'c'},relation]),/already exists/);
    assert.equal(JSON.parse(await api.exportRelations()).length,1);
});
test('a successful request followed by transaction abort does not report success',async()=>{
    const api=await freshDB();const add=IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add=function(...args){const req=add.apply(this,args);req.addEventListener('success',()=>this.transaction.abort());return req;};
    try {await assert.rejects(api.addRelation(relation),/abort/i);} finally {IDBObjectStore.prototype.add=add;}
    assert.equal(JSON.parse(await api.exportRelations()).length,0);
});

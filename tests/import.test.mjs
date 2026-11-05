import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBObjectStore } from 'fake-indexeddb';
import { freshDB, relation } from './helpers.mjs';
test('invalid replacement and failed writes preserve annotations', async()=>{
    const api=await freshDB(); await api.addRelation(relation);
    await assert.rejects(api.importRelations('[3]',{mode:'replace'}));
    assert.equal(JSON.parse(await api.exportRelations()).length,1);
    const add=IDBObjectStore.prototype.add;
    let calls=0;
    IDBObjectStore.prototype.add=function(...args){if(++calls===2) throw new Error('quota'); return add.apply(this,args)};
    try { await assert.rejects(api.importRelations(JSON.stringify([relation,relation]),{mode:'replace'}),/quota/); }
    finally {IDBObjectStore.prototype.add=add;}
    assert.equal(JSON.parse(await api.exportRelations()).length,1);
});
test('merge is default and empty replacement is explicit',async()=>{
    const api=await freshDB();await api.addRelation(relation);
    await api.importRelations(JSON.stringify([relation]));
    assert.equal(JSON.parse(await api.exportRelations()).length,2);
    await api.importRelations('[]',{mode:'replace'});
    assert.deepEqual(JSON.parse(await api.exportRelations()),[]);
});

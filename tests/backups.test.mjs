import {IDBFactory} from 'fake-indexeddb';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshDB,corpus,relation} from './helpers.mjs';
test('backup canonical keys survive numeric ID changes and reject incompatible data',async()=>{
    const data={...corpus,corpus:{id:'strong-bible-v1',revision:'changed'},legacyVerseKeys:{1:'01001001'},verses:[{id:20,key:'01001001',chapter_id:1,number:1}]};
    const api=await freshDB(async()=>new Response(JSON.stringify(data)));
    await api.importRelations(JSON.stringify([relation]));
    let backup=JSON.parse(await api.exportRelations());
    assert.equal(backup.relations[0].source_verse_id,20);
    assert.equal(backup.relations[0].source_verse_key,'01001001');
    backup.relations[0].source_verse_id=999;
    await api.importRelations(JSON.stringify(backup),{mode:'replace'});
    assert.equal(JSON.parse(await api.exportRelations()).relations[0].source_verse_id,20);
    backup.corpus.id='different';
    await assert.rejects(api.importRelations(JSON.stringify(backup)),/Incompatible/);
    assert.equal(JSON.parse(await api.exportRelations()).relations.length,1);
});

test('existing browser records migrate atomically using canonical source keys',async()=>{
    globalThis.indexedDB=new IDBFactory();globalThis.window={};globalThis.document={};
    const database=await new Promise((resolve,reject)=>{
        const request=indexedDB.open('parallelismus',2);
        request.onupgradeneeded=()=>{
            const store=request.result.createObjectStore('relations',{keyPath:'id',autoIncrement:true});
            store.createIndex('source_id','source_id');store.createIndex('target_id','target_id');
            store.add({...relation,id:1});
        };
        request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
    database.close();
    const data={...corpus,corpus:{id:'strong-bible-v1',revision:'new'},legacyVerseKeys:{1:'01001001'},verses:[{id:40,key:'01001001',chapter_id:1,number:1}]};
    globalThis.fetch=async()=>new Response(JSON.stringify(data));
    const api=await import('../frontend/db.js?legacy-records');await api.initDB();
    const rows=JSON.parse(await api.exportRelations()).relations;
    assert.equal(rows[0].source_verse_key,'01001001');assert.equal(rows[0].source_verse_id,40);
});

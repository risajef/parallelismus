import {test} from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {corpus} from './helpers.mjs';
import * as http from '../frontend/app.js';
test('HTTP errors and HTML never become successful writes',async()=>{
    globalThis.window={location:{origin:'https://example.test'}};
    globalThis.sessionStorage={getItem:()=>''};
    for (const response of [new Response('{}',{status:422,headers:{'content-type':'application/json'}}),new Response('<html>',{headers:{'content-type':'text/html'}})]) {
        globalThis.fetch=async()=>response;
        await assert.rejects(http.addRelation({}));
    }
});
test('initialization can retry after a transient fetch failure',async()=>{
    globalThis.window={};globalThis.document={};globalThis.indexedDB=new IDBFactory();
    const api=await import('../frontend/db.js?retry');
    globalThis.fetch=async()=>new Response('',{status:503});
    await assert.rejects(api.initDB());
    globalThis.fetch=async()=>new Response(JSON.stringify(corpus));
    await api.initDB();assert.equal((await api.fetchBooks()).length,1);
});

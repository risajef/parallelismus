import { IDBFactory } from 'fake-indexeddb';
import { pathToFileURL } from 'node:url';
export const corpus = { corpus:{id:'strong-bible-v1',revision:'fixture'},legacyVerseKeys:{1:'01001001',2:'01001002'}, books: [{id:1,name:'Sample'}], chapters:[{id:1,book_id:1,number:1}],
    verses:[{id:1,key:'01001001',chapter_id:1,number:1},{id:2,key:'01001002',chapter_id:1,number:2}],
    words:['a','b','c'].map(strong=>({strong,original:[strong],translation:[strong]})) };
export const relation = {source_id:'a',target_id:'b',relation_type:'similar',source_verse_id:1};
export async function freshDB(fetcher) {
    globalThis.indexedDB = new IDBFactory();
    globalThis.window = {}; globalThis.document = {};
    globalThis.fetch = fetcher || (async()=>new Response(JSON.stringify(corpus)));
    const api = await import(pathToFileURL(new URL('../frontend/db.js', import.meta.url).pathname).href+'?test='+Math.random());
    await api.initDB(); return api;
}

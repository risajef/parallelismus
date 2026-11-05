export {transliterate} from './transliterate.js';
export const storageMode = 'backend';
export function setWriteToken(token) { sessionStorage.setItem('parallelismus-write-token', token); }
export async function initDB(onProgress) { onProgress?.('Ready.'); }
async function request(path, {method = 'GET', body} = {}) {
    const headers = {Accept:'application/json'};
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        headers.Authorization = 'Bearer ' + (sessionStorage.getItem('parallelismus-write-token') || '');
    }
    const response = await fetch(new URL(path, window.location.origin), {method,headers,body:body == null ? undefined : JSON.stringify(body)});
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Expected JSON response');
    return response.json();
}
export const fetchBooks = () => request('/books');
export const fetchChapters = id => request(`/books/${Number(id)}/chapters`);
export const fetchVerses = id => request(`/chapters/${Number(id)}/verses`);
export const fetchWords = id => request(`/verses/${Number(id)}/words`);
export const fetchVerse = id => request(`/verse/${Number(id)}`);
export const fetchChapter = id => request(`/chapter/${Number(id)}`);
export const fetchChapterWords = id => request(`/chapter/${Number(id)}/words`);
export const fetchWordDetail = id => request(`/words/${encodeURIComponent(id)}/detail`);
export const fetchRelations = id => request(`/words/${encodeURIComponent(id)}/relations`);
export const fetchGroupedRelations = id => request(`/relations/grouped/${encodeURIComponent(id)}`);
export const fetchRelationTypes = () => request('/relation_types');
export const fetchRelationsBatch = ids => request('/relations/batch?'+new URLSearchParams({ids:ids.join(',')}));
export const fetchRelationsCounts = ids => request('/relations/counts?'+new URLSearchParams({ids:ids.join(',')}));
export const fetchStrongSearch = q => request('/strong/search?'+new URLSearchParams({q}));
export const fetchAllRelations = (limit=500,type=null) => request('/relations/all?'+new URLSearchParams({limit:String(limit),...(type?{relation_type:type}:{})}));
export const addRelation = body => request('/relations',{method:'POST',body});
export const deleteRelation = id => request(`/relations/${Number(id)}`,{method:'DELETE'});
export const addComposition = (members,target,evidence) => request('/compositions',{method:'POST',body:{members,target_id:target,source_verse_id:evidence}});
export const deleteComposition = id => request('/compositions/'+encodeURIComponent(id),{method:'DELETE'});

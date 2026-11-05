import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshDB} from './helpers.mjs';
test('composition members share identity and save or delete together',async()=>{
    const api=await freshDB();
    await assert.rejects(api.addComposition(['a','missing'],'c',1));
    assert.equal(JSON.parse(await api.exportRelations()).relations.length,0);
    const rows=await api.addComposition(['a','b'],'c',1);
    assert.equal(rows[0].composition_id,rows[1].composition_id);
    await assert.rejects(api.deleteRelation(rows[0].id));
    await api.deleteComposition(rows[0].composition_id);
    assert.equal(JSON.parse(await api.exportRelations()).relations.length,0);
});

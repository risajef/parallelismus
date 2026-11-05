import {test} from 'node:test';
import assert from 'node:assert/strict';
test('generated page URLs use configured application base instead of host route',async()=>{
    globalThis.window={__PARALLELISMUS_BASE__:'https://example.test/assets/apps/parallelismus/dist/'};
    const {strongUrl}=await import('../frontend/urls.js?embed');
    assert.equal(strongUrl('g1'),'https://example.test/assets/apps/parallelismus/dist/strong.html#g1');
    delete globalThis.window.__PARALLELISMUS_BASE__;
});

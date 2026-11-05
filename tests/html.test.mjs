import {test} from 'node:test';
import assert from 'node:assert/strict';
import {escapeHtml} from '../frontend/dom-utils.js';
test('escaping preserves adjacent special characters',()=>{
    assert.equal(escapeHtml('a&&b <> c'), 'a&amp;&amp;b &lt;&gt; c');
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

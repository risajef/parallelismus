const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
const server = http.createServer((req,res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/host/tool/') {
        res.setHeader('content-type','text/html');
        res.end(`<html><head><style>header{color:rgb(12,34,56);display:block}</style><link rel="stylesheet" href="/dist/styles.css"></head><body><header id="host-header">Host header</header><input id="src" value="host"><select id="books"><option>host</option></select><div id="parallelismus-root">${body}</div><script>window.__PARALLELISMUS_BASE__=location.origin+'/dist/'</script><script src="/dist/index.js"></script></body></html>`);
        return;
    }
    const file = path.resolve(root, '.' + decodeURIComponent(pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {res.writeHead(404);res.end();return;}
    res.setHeader('content-type', file.endsWith('.js')?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':'text/html');
    res.end(fs.readFileSync(file));
});
(async () => {
    assert.ok(process.env.CHROME_BIN, 'Set CHROME_BIN to a Chromium executable');
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    let backend;
    const temp = fs.mkdtempSync(path.join(os.tmpdir(),'parallelismus-browser-'));
    const browser = await puppeteer.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox']});
    try {
        const page=await browser.newPage(); const errors=[];
        await page.setRequestInterception(true);
        page.on('request',req => req.url().startsWith('http://127.0.0.1:') ? req.continue() : req.abort());
        page.on('pageerror',error=>errors.push(error.message));
        await page.goto(origin+'/dist/index.html#/chapter/1');
        await page.waitForSelector('#verse-2 .word-box');
        await page.select('#type','similar');
        const strong=await page.evaluate(()=>{
            const boxes=document.querySelectorAll('#verse-2 .word-box');boxes[0].click();boxes[1].click();return boxes[0].dataset.strong;
        });
        await page.click('#addRel');
        await page.waitForFunction(()=>document.getElementById('result').textContent.startsWith('Relation added:'));
        const result=await page.$eval('#result',el=>el.textContent);
        assert.match(result,/"source_verse_id":2/);
        await page.type('#relations-strong',strong);await page.click('#showRelations');
        await page.waitForSelector('#relations-list button');
        await page.click('#relations-list button');
        await page.waitForFunction(()=>document.querySelectorAll('.word-box').length>0 && [...document.querySelectorAll('.word-box')].every(el=>el.dataset.verseId==='2'));
        assert.equal(await page.$eval('#verses',el=>el.value),'2');
        const link=await page.$eval('.strong-link',el=>el.href);
        assert.ok(link.startsWith(origin+'/dist/strong.html#'));
        await page.goto(link);await page.waitForSelector('#usages li');
        assert.ok(await page.$$eval('#usages li',els=>els.length)>0);
        await page.goto(origin+'/host/tool/#/chapter/1');await page.waitForSelector('#parallelismus-root .word-box');
        assert.equal(await page.$eval('#host-header',el=>getComputedStyle(el).color),'rgb(12, 34, 56)');
        assert.equal(await page.$eval('#host-header',el=>getComputedStyle(el).display),'block');
        assert.equal(await page.$eval('#books',el=>el.textContent),'host');
        assert.equal(await page.$eval('#src',el=>el.value),'host');
        assert.ok((await page.$eval('.strong-link',el=>el.href)).startsWith(origin+'/dist/strong.html#'));
        if (process.env.PYTHON_BIN) {
            const port = server.address().port + 1;
            backend = spawn(process.env.PYTHON_BIN, ['-c', `from backend.seed import seed; seed(); import uvicorn; uvicorn.run('backend.main:app',host='127.0.0.1',port=${port})`], {
                cwd:root, env:{...process.env,PARALLELISMUS_DATABASE_URL:'sqlite:///'+path.join(temp,'test.db'),PARALLELISMUS_WRITE_TOKEN:'browser-test',PARALLELISMUS_ORIGINS:`http://127.0.0.1:${port}`}
            });
            let logs='';backend.stderr.on('data',data=>{logs+=data;});
            const base=`http://127.0.0.1:${port}`;
            let ready=false;
            for(let i=0;i<100;i++) {
                try {if((await fetch(base+'/books')).ok){ready=true;break;}}catch{}
                await new Promise(resolve=>setTimeout(resolve,100));
            }
            assert.ok(ready,'Backend startup failed: '+logs);
            await page.goto(base+'/');await page.waitForSelector('.word-box');
            await page.type('#write-token','browser-test');await page.select('#type','opposite');
            await page.evaluate(()=>{const boxes=document.querySelectorAll('.word-box');boxes[0].click();boxes[1].click();});
            await page.click('#addRel');
            await page.waitForFunction(()=>document.getElementById('result').textContent.length>0);
            assert.match(await page.$eval('#result',el=>el.textContent),/^Relation added:/,logs);
            const detail=await page.$eval('.strong-link',el=>el.href);
            await page.goto(detail);await page.waitForSelector('#usages li');
            console.log('Backend browser checks passed: seed startup, authenticated write, Strong detail.');
        }
        assert.deepEqual(errors,[]);
        console.log('Browser checks passed: verse evidence, source navigation, cold usages, standalone and embedded links, host DOM/style isolation.');
    } finally { if(backend){backend.kill();await new Promise(resolve=>backend.once('exit',resolve));} await browser.close();server.close();fs.rmSync(temp,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});

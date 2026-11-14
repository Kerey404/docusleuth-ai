import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const pw=process.env.DOCUSLEUTH_PLAYWRIGHT||'playwright';
const {chromium}=require(pw);
const base=process.env.DOCUSLEUTH_URL||'http://127.0.0.1:4317/';
const browser=await chromium.launch({executablePath:process.env.DOCUSLEUTH_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--no-first-run']});
const output=resolve('qa','screens');
await mkdir(output,{recursive:true});
const errors=[], external=[], timings=[];
function norm(s){return [...s.normalize('NFC').replace(/\s+/gu,' ').trim().toLowerCase()];}
function distance(a,b){
 let prev=Int32Array.from({length:b.length+1},(_,i)=>i);
 for(let i=0;i<a.length;i++){
  const now=new Int32Array(b.length+1);now[0]=i+1;
  for(let j=0;j<b.length;j++)now[j+1]=Math.min(now[j]+1,prev[j+1]+1,prev[j]+(a[i]===b[j]?0:1));
  prev=now;
 }return prev[b.length];
}
try{
 const context=await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});
 await context.route('**/*',r=>{
  const u=new URL(r.request().url());
  if(u.origin!==new URL(base).origin&&['https:','http:'].includes(u.protocol)){external.push(u.href);return r.abort();}
  return r.continue();
 });
 const page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404 (Not Found)')&&!/^Estimating resolution as \d+$/.test(m.text()))errors.push(m.text());});
 await page.goto(base);
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:join(output,'desktop.png'),fullPage:true});
 assert.match(await page.title(),/DocuSleuth/);
 if(process.argv.includes('--ocr')){
   const scans=JSON.parse(await readFile('qa/scans/manifest.json','utf8'));
   for(const s of scans){
    await page.selectOption('#upload-lang',s.lang);
    const start=performance.now();
    await page.locator('#file').setInputFiles(resolve('qa','scans',s.file));
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:95000});
    if(s.turn){
     await page.click('#rotate');await page.click('#recognize');
     await page.locator('#ocr-box').waitFor({state:'hidden',timeout:95000});
    }
    const text=await page.inputValue('#editor'), truth=norm(s.text), got=norm(text);
    const accuracy=1-distance(truth,got)/truth.length;
    timings.push({file:s.file,language:s.lang,accuracy,seconds:(performance.now()-start)/1000});
    console.log(timings.at(-1), (await page.locator('#review-error').innerText()).slice(0,200));
    if(s.lang==='kk'&&s.file==='kk-0.png')await page.screenshot({path:join(output,'review.png'),fullPage:true});
    if(s.file==='en-0.png'||s.file==='ru-0.png'||s.file==='kk-0.png'){
     await page.click('#analyze');await page.locator('#report-view').waitFor({state:'visible',timeout:15000});
     await page.click('#edit-again');
    }
    await page.locator('#review-view [data-reset]').click();
   }
   await writeFile('qa/ocr-results.json',JSON.stringify(timings,null,2));
   assert(timings.every(x=>x.accuracy>.90),'All synthetic scans must clear 90% character accuracy');
 }
 await page.locator('#file').setInputFiles({name:'wrong.png',mimeType:'image/png',buffer:Buffer.from('wrong')});
 await page.locator('#upload-error').waitFor({state:'visible'});
 await page.locator('#file').setInputFiles({name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(10_000_001)});
 assert.match(await page.locator('#upload-error').innerText(),/10 МБ/);
 await page.click('#paste');await page.fill('#editor','A test.');
 await page.click('#analyze');assert.match(await page.locator('#review-error').innerText(),/200/);
 await page.fill('#editor','word '.repeat(2001));
 await page.click('#analyze');assert.match(await page.locator('#review-error').innerText(),/2000/);
 await page.fill('#editor',await readFile('dist/examples/ru.txt','utf8'));
 await page.selectOption('#review-lang','en');await page.click('#analyze');
 assert.match(await page.locator('#review-error').innerText(),/выбранный язык/);
 await page.locator('#review-view [data-reset]').click();
 for(const lang of ['en','ru','kk']){
  await page.selectOption('#ui-language',lang);
  await page.selectOption('#upload-lang',lang);
  await page.click('#sample');await page.locator('#review-view').waitFor({state:'visible'});
  await page.locator('#ocr-box').waitFor({state:'hidden',timeout:95000});
  assert((await page.inputValue('#editor')).length>500);
  await page.click('#analyze');await page.locator('#report-view').waitFor({state:'visible'});
  assert.match(await page.locator('.score-number').innerText(),/^\d+%$/);
  assert(await page.locator('.segment').count()>0);
  if(lang==='ru')await page.screenshot({path:join(output,'report.png'),fullPage:true});
  const event=page.waitForEvent('download');
  await page.click('#download');
  const download=await event;
  await download.saveAs(resolve('qa','sample-report-'+lang+'.pdf'));
  const bytes=await readFile(resolve('qa','sample-report-'+lang+'.pdf'));
  assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  await page.click('#edit-again');
  await page.locator('#editor').press('End');await page.locator('#editor').press('Space');
  assert(await page.locator('[data-step="3"]').isDisabled());
  await page.locator('#review-view [data-reset]').click();
 }
 await page.locator('[data-open-method]').first().click();
 await page.locator('#method-content tbody tr').first().waitFor();
 assert((await page.locator('#method-content tbody tr').count())>=3);
 await page.keyboard.press('Escape');
 assert(!(await page.locator('#method-dialog').isVisible()));
 const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const mobile=await phone.newPage();await mobile.goto(base);
 await mobile.evaluate(()=>document.fonts.ready);
 await mobile.screenshot({path:join(output,'mobile.png'),fullPage:true});
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
 assert(await mobile.locator('#camera').isVisible());
 await mobile.selectOption('#ui-language','kk');
 await mobile.selectOption('#upload-lang','kk');await mobile.tap('#sample');
 await mobile.locator('#review-view').waitFor({state:'visible'});
 await mobile.locator('#ocr-box').waitFor({state:'hidden',timeout:95000});
 await mobile.tap('#analyze');await mobile.locator('#report-view').waitFor({state:'visible'});
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
 await mobile.screenshot({path:join(output,'mobile-report.png'),fullPage:true});
 for(const width of [320,360,650,768]){
  await page.setViewportSize({width,height:850});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
 }
 if(process.env.DOCUSLEUTH_HOSTED!=='1'){
  for(const path of ['/package.json','/data/aina-human.jsonl','/..%5Cpackage.json','/server.mjs','/.git/config']){
   assert.equal((await fetch(new URL(path,base))).status,404);
  }
  assert.equal((await fetch(base,{method:'POST',body:'x'})).status,405);
 }
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log('Browser flows, mobile, PDF, validation and same-origin requests passed.'+(process.env.DOCUSLEUTH_HOSTED==='1'?'':' Local server file isolation passed.'));
} finally {
 console.log('Captured errors:',errors);console.log('External requests:',external);
 await browser.close();
}


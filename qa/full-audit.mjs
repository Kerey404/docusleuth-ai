import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {createRequire} from 'node:module';
import {words, scoreText} from '../dist/model.mjs';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.DOCUSLEUTH_PLAYWRIGHT || 'playwright');
const base = process.env.DOCUSLEUTH_URL || 'http://127.0.0.1:4318/';
const output = resolve(process.env.DOCUSLEUTH_AUDIT_DIR||'qa/audit-2026-11-14');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({
  executablePath: process.env.DOCUSLEUTH_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless:true
});
const outcomes = [];
const examples = Object.fromEntries(await Promise.all(['en','ru','kk'].map(async lang => [
  lang, await readFile('dist/examples/'+lang+'.txt','utf8')
])));
const context = await browser.newContext({viewport:{width:1440,height:960},acceptDownloads:true});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.setDefaultTimeout(8000);
const test = async (name, action) => {
  if(process.env.DOCUSLEUTH_TEST_FILTER&&!name.match(process.env.DOCUSLEUTH_TEST_FILTER))return;
  try { await action(); outcomes.push({name,passed:true}); console.log('PASS',name); }
  catch(error) { outcomes.push({name,passed:false,error:error.message.slice(0,1000)}); console.log('FAIL',name,error.message.slice(0,300)); }
};
async function fresh() {
  await page.unrouteAll({behavior:'wait'});
  await context.unrouteAll({behavior:'wait'});
  await page.goto(base);
  await page.selectOption('#ui-language','ru');
}
async function paste(text=examples.en, lang='en') {
  await page.selectOption('#upload-lang',lang);
  await page.click('#paste');
  await page.fill('#editor',text);
}
async function analyze() {
  await page.click('#analyze');
  await page.locator('#report-view').waitFor({state:'visible'});
}
async function reset() { await page.locator('[data-step="1"]').click(); }
async function imageFile(file='en') {
  await page.locator('#file').setInputFiles(resolve('dist/examples/'+file+'.png'));
  await page.locator('#review-view').waitFor({state:'visible'});
  await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
}
async function exportPdf(name) {
  const event = page.waitForEvent('download');
  await page.click('#download');
  const download = await event;
  await download.saveAs(join(output,name+'.pdf'));
}
try {
  await test('Text at 199, 200, 2000, 2001 words',async()=>{
    await fresh();
    const original=words(examples.en);
    for(const count of [199,200,2000,2001]){
      const text=Array.from({length:count},(_,i)=>original[i%original.length]).join(' ');
      await paste(text);
      await page.click('#analyze');
      if(count===199||count===2001){
        await page.locator('#review-error').waitFor({state:'visible'});
        assert(!(await page.locator('#report-view').isVisible()));
      }else await page.locator('#report-view').waitFor({state:'visible'});
      await reset();
    }
  });
  await test('Long words preserved without silent truncation',async()=>{
    await fresh();await paste('');
    const text='internationalization '.repeat(1500).trim();
    await page.locator('#editor').focus();
    await page.keyboard.insertText(text);
    assert.equal(await page.inputValue('#editor'),text);
    await analyze();
  });
  await test('No lost editor changes during model loading',async()=>{
    await fresh();
    await page.route('**/models/en.json',async route=>{
      await new Promise(resolve=>setTimeout(resolve,700));await route.continue().catch(()=>{});
    });
    await paste();await page.click('#analyze');
    assert(await page.locator('#editor').evaluate(e=>e.readOnly));
    await page.locator('#review-view [data-reset]').click();
    await paste(examples.ru,'ru');await analyze();
    assert.match(await page.locator('#report-meta').innerText(),/Русский/);
    await page.unroute('**/models/en.json');
  });
  await test('Model download failure can be retried',async()=>{
    await fresh();
    await page.route('**/models/en.json',route=>route.fulfill({status:503,body:'Unavailable'}));
    await paste();await page.click('#analyze');
    await page.locator('#review-error').waitFor({state:'visible'});
    assert.equal(await page.inputValue('#editor'),examples.en);
    await page.unroute('**/models/en.json');await analyze();
  });
  await test('New OCR invalidates previous report immediately',async()=>{
    await fresh();await imageFile();await analyze();await page.click('#edit-again');
    await page.click('#recognize');
    assert(await page.locator('[data-step="3"]').isDisabled());
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
  });
  await test('Blank scan leaves an editable recovery screen',async()=>{
    await fresh();
    const bytes=await page.evaluate(()=>{
      const canvas=document.createElement('canvas');canvas.width=800;canvas.height=1000;
      const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,800,1000);
      return canvas.toDataURL().split(',')[1];
    });
    await page.locator('#file').setInputFiles({name:'blank.png',mimeType:'image/png',buffer:Buffer.from(bytes,'base64')});
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
    assert.equal(await page.inputValue('#editor'),'');
    assert(await page.locator('#review-error').isVisible());
    await page.fill('#editor',examples.en);await analyze();
  });
  await test('OCR language fetch failure recovers promptly',async()=>{
    await fresh();
    const before=pageErrors.length;
    await context.route('**/vendor/lang/eng.traineddata.gz',r=>r.fulfill({status:503,body:'Unavailable'}));
    await page.locator('#file').setInputFiles(resolve('dist/examples/en.png'));
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#review-error').waitFor({state:'visible',timeout:12000});
    assert.equal(pageErrors.length,before,'OCR raised an uncaught browser exception');
    assert(await page.locator('#ocr-box').isHidden());
    await context.unroute('**/vendor/lang/eng.traineddata.gz');
    await page.click('#recognize');await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
    assert(words(await page.inputValue('#editor')).length>=200);
  });
  await context.unroute('**/vendor/lang/eng.traineddata.gz');
  await test('Cancel during OCR initialization then analyze another language',async()=>{
    await fresh();
    await context.route('**/vendor/lang/eng.traineddata.gz',async route=>{
      await new Promise(resolve=>setTimeout(resolve,500));await route.continue().catch(()=>{});
    });
    await page.locator('#file').setInputFiles(resolve('dist/examples/en.png'));
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#review-view [data-reset]').click();
    await paste(examples.ru,'ru');await analyze();
    await page.waitForTimeout(1000);
    assert.match(await page.locator('#report-meta').innerText(),/Русский/);
    await context.unroute('**/vendor/lang/eng.traineddata.gz');
  });
  await test('Edit confirmation preserves text when OCR is dismissed',async()=>{
    await fresh();await imageFile();
    await page.fill('#editor',examples.en+' My own correction.');
    page.once('dialog',dialog=>dialog.dismiss());await page.click('#recognize');
    assert((await page.inputValue('#editor')).endsWith('My own correction.'));
    page.once('dialog',dialog=>dialog.accept());await page.click('#recognize');
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
    assert(!(await page.inputValue('#editor')).endsWith('My own correction.'));
  });
  await test('Malformed images and oversized dimensions fail safely',async()=>{
    await fresh();
    const signature=Buffer.from([137,80,78,71,13,10,26,10]);
    const oversized=Buffer.alloc(33);signature.copy(oversized);oversized.writeUInt32BE(100000,16);oversized.writeUInt32BE(100000,20);
    for(const payload of [signature,Buffer.from([255,216,255,192,0,20]),oversized]){
      await page.locator('#file').setInputFiles({name:'malformed.png',mimeType:'image/png',buffer:payload});
      await page.locator('#upload-error').waitFor({state:'visible'});
      assert(await page.locator('#upload-view').isVisible());
    }
    await imageFile();
  });
  await test('Markup in text and filenames remains inert',async()=>{
    await fresh();
    const text=examples.en+' <img src=x onerror="globalThis.unexpectedExecution=1"> </textarea><script>globalThis.unexpectedExecution=1</script>';
    await paste(text);await analyze();
    assert.equal(await page.evaluate(()=>globalThis.unexpectedExecution),undefined);
    assert.equal(await page.locator('#segments script, #segments img').count(),0);
  });
  await test('PDF failure preserves report and retry works',async()=>{
    await fresh();await paste();await analyze();
    await page.route('**/fonts/NotoSans-Regular.ttf',r=>r.fulfill({status:503,body:'Unavailable'}));
    await page.click('#download');
    await page.locator('#report-error').waitFor({state:'visible'});
    await page.unroute('**/fonts/NotoSans-Regular.ttf');
    await exportPdf('retry');
  });
  await test('PDF with 2000 words includes the ending',async()=>{
    await fresh();
    const tokens=words(examples.ru);
    const text=Array.from({length:1998},(_,i)=>tokens[i%tokens.length]).join(' ')+' ФИНАЛЬНОЕ СЛОВО';
    await paste(text,'ru');await analyze();await exportPdf('long-2000');
  });
  await test('All report verdicts fit Russian and Kazakh PDFs',async()=>{
    await fresh();
    await page.evaluate(async()=>{
      const load=src=>new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.head.append(script);
      });
      await Promise.all([load('./vendor/pdf-lib.min.js'),load('./vendor/fontkit.umd.min.js')]);
    });
    for(const language of ['ru','kk']){
      for(const grade of ['low','uncertain','high']){
        const bytes=await page.evaluate(async({language,grade})=>{
          const {makePdf}=await import('./report.mjs');
          const {dictionary}=await import('./strings.mjs');
          const text=await fetch('./examples/'+language+'.txt').then(r=>r.text());
          const result={lang:language,model:'1.0',grade,score:grade==='uncertain'?50:grade==='high'?95:5,thresholds:[25,70],segments:[{start:1,end:20,text,emphasis:grade==='high'}]};
          return Array.from(await makePdf(result,dictionary[language],[],'PDF layout audit'));
        },{language,grade});
        await writeFile(join(output,language+'-'+grade+'.pdf'),Buffer.from(bytes));
      }
    }
  });
  await test('All languages and states fit desktop and mobile widths',async()=>{
    for(const width of [320,360,390,650,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      for(const language of ['ru','kk','en']){
        await fresh();await page.selectOption('#ui-language',language);
        for(const phase of ['upload','review','report','method']){
          if(phase==='review')await paste(examples[language],language);
          if(phase==='report')await analyze();
          if(phase==='method'){
            await page.locator('[data-open-method]').first().click();
            await page.locator('#method-content table').waitFor();
          }
          const dimensions=await page.evaluate(()=>({viewport:innerWidth,content:document.documentElement.scrollWidth}));
          assert(dimensions.content<=dimensions.viewport+1,JSON.stringify({width,language,phase,...dimensions}));
        }
      }
    }
  });
  await test('Long filename and rotated scan fit a resized screen',async()=>{
    await fresh();
    await page.setViewportSize({width:1440,height:960});
    const filename='длинноеимя'.repeat(20)+'.png';
    await page.locator('#file').setInputFiles({
      name:filename,mimeType:'image/png',buffer:await readFile('dist/examples/en.png')
    });
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
    await page.click('#rotate');
    await page.setViewportSize({width:320,height:850});
    const visible=await page.locator('#preview-img').evaluate(img=>{
      const bounds=img.getBoundingClientRect(),frame=img.parentElement.getBoundingClientRect();
      return bounds.left>=frame.left-2&&bounds.right<=frame.right+2&&bounds.top>=frame.top-2&&bounds.bottom<=frame.bottom+2;
    });
    assert(visible,'Rotated preview clipped after resizing');
    await analyze();
    assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=320);
  });
  await test('Slow method dialog loads once after close and reopen',async()=>{
    await fresh();
    await page.route('**/models/validation.json',async route=>{
      await new Promise(resolve=>setTimeout(resolve,600));await route.continue().catch(()=>{});
    });
    await page.locator('[data-open-method]').first().click();
    await page.keyboard.press('Escape');
    await page.locator('[data-open-method]').first().click();
    await page.locator('#method-content table').first().waitFor();
    assert.equal(await page.locator('#method-content table').count(),1);
    await page.keyboard.press('Escape');
  });
  await test('Full text is preserved above the processing character limit',async()=>{
    await fresh();
    const long='a'.repeat(100001);
    await paste(long);
    assert.equal((await page.inputValue('#editor')).length,long.length);
    await page.click('#analyze');
    await page.locator('#review-error').waitFor({state:'visible'});
    assert.match(await page.locator('#review-error').innerText(),/100 000/);
  });
  await test('Broken model data produces an error, never a NaN score',async()=>{
    await fresh();
    const model=JSON.parse(await readFile('dist/models/en.json','utf8'));
    model.bias='damaged';
    await page.route('**/models/en.json',route=>route.fulfill({json:model}));
    await paste();
    await page.click('#analyze');
    await page.locator('#review-error').waitFor({state:'visible'});
    assert(await page.locator('#report-view').isHidden());
    await page.unroute('**/models/en.json');await analyze();
    assert.match(await page.locator('.score-number').innerText(),/^\d+%$/);
  });
  await test('Cancelled sample does not replace pasted text or disable retry',async()=>{
    await fresh();
    await page.route('**/examples/en.png',async route=>{
      await new Promise(resolve=>setTimeout(resolve,700));await route.continue().catch(()=>{});
    });
    await page.click('#sample');await paste(examples.ru,'ru');
    await page.unrouteAll({behavior:'wait'});
    assert.equal(await page.inputValue('#editor'),examples.ru);
    await analyze();await reset();
    assert(await page.locator('#sample').isEnabled());
    await page.selectOption('#upload-lang','en');await page.click('#sample');
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
    assert((await page.inputValue('#editor')).length>500);
  });
  await test('File picker and drag and drop work with file count validation',async()=>{
    await fresh();
    const picker=page.waitForEvent('filechooser');await page.click('#browse');
    await (await picker).setFiles(resolve('dist/examples/en.png'));
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
    await reset();
    const bytes=Array.from(await readFile('dist/examples/kk.png'));
    const transfer=await page.evaluateHandle(bytes=>{
      const dt=new DataTransfer();
      for(let i=0;i<2;i++)dt.items.add(new File([new Uint8Array(bytes)],'scan'+i+'.png',{type:'image/png'}));
      return dt;
    },bytes);
    await page.dispatchEvent('#dropzone','drop',{dataTransfer:transfer});
    await page.locator('#upload-error').waitFor({state:'visible'});
    await transfer.evaluate(dt=>dt.items.remove(1));
    await page.selectOption('#upload-lang','kk');
    await page.dispatchEvent('#dropzone','drop',{dataTransfer:transfer});
    await page.locator('#review-view').waitFor({state:'visible'});
    await page.locator('#ocr-box').waitFor({state:'hidden',timeout:25000});
    await transfer.dispose();await analyze();
    assert.match(await page.locator('#report-meta').innerText(),/Қазақша/);
  });
} finally {
  await writeFile(join(output,'browser-results.json'),JSON.stringify({browser:browser.version(),outcomes,pageErrors},null,2));
  console.log(JSON.stringify({passed:outcomes.filter(x=>x.passed).length,total:outcomes.length,failures:outcomes.filter(x=>!x.passed)},null,2));
  await browser.close();
}
if(outcomes.some(x=>!x.passed)||pageErrors.length)process.exitCode=1;


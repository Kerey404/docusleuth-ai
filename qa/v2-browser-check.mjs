import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {words} from '../dist/model.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.DOCUSLEUTH_PLAYWRIGHT||'playwright');
const browser=await chromium.launch({executablePath:process.env.DOCUSLEUTH_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const base=process.env.DOCUSLEUTH_URL||'http://127.0.0.1:4318/';
const output=process.env.DOCUSLEUTH_AUDIT_DIR||'qa/audit-v2-2026-11-14';
const page=await browser.newPage({viewport:{width:1440,height:1000}});const timings=[];
try{
 for(const lang of ['ru','kk']){
  await page.goto(base);await page.selectOption('#ui-language','ru');await page.selectOption('#upload-lang',lang);await page.click('#paste');
  const tokens=words(await readFile('dist/examples/'+lang+'.txt','utf8'));
  const text=Array.from({length:2000},(_,i)=>tokens[i%tokens.length]).join(' ');
  for(const phase of ['first','cached']){
   if(phase==='cached')await page.click('#edit-again');
   await page.fill('#editor',text+(phase==='cached'?' ':''));
   const start=performance.now();await page.click('#analyze');await page.locator('#report-view').waitFor({state:'visible'});
   timings.push({lang,phase,words:2000,milliseconds:Math.round(performance.now()-start)});
   assert.match(await page.locator('.score-number').innerText(),/^\d+%$/);
  }
 }
 await page.locator('[data-open-method]').first().click();await page.locator('#method-content tbody tr').first().waitFor();
 assert.equal(await page.locator('#method-content tbody tr').count(),14);
 const body=await page.locator('#method-content').innerText();
 assert(body.includes('17,4%')&&body.includes('12,8%')&&body.includes('80–199'));
 await page.screenshot({path:output+'/method-v2.png',fullPage:true});
 await writeFile(output+'/performance.json',JSON.stringify({browser:browser.version(),timings},null,2));
 console.log(JSON.stringify(timings));
}finally{await browser.close();}

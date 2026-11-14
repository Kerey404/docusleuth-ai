import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {rawScore} from '../dist/model.mjs';
const json=async file=>JSON.parse(await readFile(new URL(file,import.meta.url),'utf8'));
let count=0;
for(const lang of ['en','ru','kk']){
 const model=await json('../dist/models/'+lang+'.json');
 for(const row of await json('./'+lang+'-parity.json')){
  assert(Math.abs(rawScore(model,row.text,lang)-row.expected)<.00005,'Browser and Python score diverged for '+lang);
  count++;
 }
}
console.log('Matched '+count+' Python and browser scores.');


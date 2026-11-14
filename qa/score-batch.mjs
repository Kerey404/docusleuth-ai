import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {rawScore,normalizeText} from '../dist/model.mjs';
const models = Object.fromEntries(await Promise.all(['en','ru','kk'].map(async lang=>[
  lang,JSON.parse(await readFile(new URL('../dist/models/'+lang+'.json',import.meta.url),'utf8'))
])));
for await (const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  const {lang,text,normalizeOnly} = JSON.parse(line);
  console.log(JSON.stringify(normalizeOnly?normalizeText(text):rawScore(models[lang],text,lang)));
}


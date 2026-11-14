import {createInterface} from 'node:readline';
import {features,words,languageMatch} from '../dist/model.mjs';
const input=createInterface({input:process.stdin, crlfDelay:Infinity});
for await (const line of input){
 const [lang,text]=JSON.parse(line);
 process.stdout.write(JSON.stringify({f:features(text,lang).v,n:words(text).length,lang:languageMatch(text,lang)})+'\n');
}


import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {rawScore} from '../dist/model.mjs';
const models=new Map();
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
 const [paths,text,lang]=JSON.parse(line),scores=[];
 for(const path of paths){
  if(!models.has(path))models.set(path,JSON.parse(await readFile(path,'utf8')));
  scores.push(rawScore(models.get(path),text,lang));
 }
 process.stdout.write(JSON.stringify(scores)+'\n');
}

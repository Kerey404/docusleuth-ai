import {createInterface} from 'node:readline';
import {features,words,languageMatch} from '../dist/model.mjs';
import {featuresV2,canonicalize} from '../dist/features-v2.mjs';
for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
 const [lang,raw]=JSON.parse(line),text=canonicalize(raw,lang),f=features(text,lang);
 process.stdout.write(JSON.stringify({canonical:text,f:f.v,f2:featuresV2(text,lang,f.v),n:words(raw).length,lang:languageMatch(raw,lang)})+'\n');
}

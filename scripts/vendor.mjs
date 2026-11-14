import {copyFile,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const root=new URL('../',import.meta.url);
const out=(file)=>new URL('dist/'+file,root);
for(const p of ['vendor','vendor/core','vendor/lang','vendor/licenses','fonts','examples'])await mkdir(out(p),{recursive:true});
const cp=(from,to)=>copyFile(new URL(from,root),out(to));
const np=(from,to)=>cp('node_modules/'+from,to);
for(const file of ['tesseract.min.js','worker.min.js'])await np('tesseract.js/dist/'+file,'vendor/'+file);
for(const file of await readdir(new URL('node_modules/tesseract.js-core/',root))){
 if(file.endsWith('-lstm.wasm.js'))await np('tesseract.js-core/'+file,'vendor/core/'+file);
}
for(const lang of ['eng','rus','kaz'])await np('@tesseract.js-data/'+lang+'/4.0.0_best_int/'+lang+'.traineddata.gz','vendor/lang/'+lang+'.traineddata.gz');
await np('pdf-lib/dist/pdf-lib.min.js','vendor/pdf-lib.min.js');
await np('@pdf-lib/fontkit/dist/fontkit.umd.min.js','vendor/fontkit.umd.min.js');
for(const font of ['inter','manrope']){
 for(const subset of ['latin','cyrillic','cyrillic-ext'])await np('@fontsource-variable/'+font+'/files/'+font+'-'+subset+'-wght-normal.woff2','fonts/'+font+'-'+subset+'.woff2');
 await np('@fontsource-variable/'+font+'/LICENSE','vendor/licenses/'+font+'-OFL.txt');
}
for(const p of ['tesseract.js','tesseract.js-core','pdf-lib','@pdf-lib/fontkit']){
 const license=(await readdir(new URL('node_modules/'+p+'/',root))).find(x=>/^license(\.md|\.txt)?$/i.test(x));
 if(license)await np(join(p,license).replaceAll('\\','/'),'vendor/licenses/'+p.split('/').at(-1)+'.txt');
}
await cp('data/NotoSans-Regular.ttf','fonts/NotoSans-Regular.ttf');
await cp('data/OFL.txt','vendor/licenses/NotoSans-OFL.txt');


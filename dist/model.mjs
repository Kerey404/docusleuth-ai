import {featuresV2,canonicalize} from './features-v2.mjs';
const wordRe = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;
export const words = s => s.match(wordRe) || [];
const sentenceParts = s => s.match(/[^.!?…]+(?:[.!?…]+["'»”)]*|$)/gu)?.map(x=>x.trim()).filter(Boolean) || [];
export const sentences = s => s.trim().split(/\n{2,}/u).flatMap(sentenceParts);
const stop = {
 en:'the a an to and of that is for on in are was were be by with not as from at it this or have has but can which their they will so if more who we would there one about some i you she he them these because than also such should could my our your its his her been do did does into how when what where all only may no now then most very',
 ru:'и в во на не что он она это как а по к ко из за для или от но у о об при со с до я мы вы они быть был была было были так же уже еще ещё только если то все всё его ее её их это такой такая такие этом когда где чем тем более можно надо нужно себя свой нет даже после перед через чтобы',
 kk:'және мен бен пен де да та те бұл сол осы бір әр үшін емес бар жоқ еді екен немесе бірақ алайда егер онда олар біз сіз ол өз өте туралы бойынша арқылы деген деп дейін кейін тағы қана ғана болады болып болған болыпты керек қажет сайын сондықтан сондай сонымен кезінде ішінде бірге көп сондай-ақ яғни әрі'
};
const stopSets=Object.fromEntries(Object.entries(stop).map(([k,v])=>[k,new Set(v.split(' '))]));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
function deviation(a){const m=mean(a);return Math.sqrt(mean(a.map(x=>(x-m)**2)));}
export function features(raw,lang) {
 const s=raw.normalize('NFC').trim(), w=words(s.toLowerCase()), n=Math.max(1,w.length);
 const chars=Array.from(s), c=Math.max(1,chars.length);
 const sw=sentences(s).map(x=>words(x).length).filter(Boolean);
 const wl=w.map(x=>Array.from(x).length);
 const para=s.split(/\n\s*\n/u).filter(x=>x.trim());
 const sc=Math.max(1,sw.length), m=mean(sw);
 const punctuation=['.',',',':',';','?','!','-','—','(',')','"','«','”',"'","’",'…','/'];
 const tally=new Map(); for(const token of w)tally.set(token,(tally.get(token)||0)+1);
 const rolling=[]; for(let i=0;i<w.length;i+=50){const z=w.slice(i,i+50);if(z.length>=15)rolling.push(new Set(z).size/z.length);}
 const rep=(span)=>{const a=w.slice(0,span), key=a.join(' ');return key?Math.max(0,s.toLowerCase().split(key).length-2):0;};
 const stats=[
   mean(wl)/10,deviation(wl)/7,m/40,deviation(sw)/(m||1),Math.min(Math.max(...sw,0),100)/100,
   mean(sw.map(x=>+(x<9))),mean(sw.map(x=>+(x>24))),Math.log1p(n)/8,sc/n,
   mean(rolling),tally.size/n,[...tally.values()].filter(v=>v===1).length/n,
   mean(wl.map(x=>+(x>8))),mean(wl.map(x=>+(x<4))),
   w.filter(x=>stopSets[lang]?.has(x)).length/n,
   w.filter(x=>/\d/u.test(x)).length/n,chars.filter(x=>/\p{Lu}/u.test(x)).length/c,
   Math.min(para.length/n*40,3),rep(3)/n,
   mean(para.map(x=>words(x).length))/n,
   ...punctuation.map(x=>chars.filter(y=>y===x).length/c*10)
 ];
 return {v:stats,words:w.length,sentences:sw.length,mean:m,variation:deviation(sw),diversity:mean(rolling)};
}
export function normalizeText(s) {
 return s.normalize('NFC').toLowerCase().replace(/https?:\/\/\S+/gu,' ').replace(/\p{Nd}+/gu,'0').replace(/\s+/gu,' ').trim();
}
export function grams(s, kind) {
 const t=normalizeText(s), result=[];
 if(kind==='word'){
   const w=words(t); for(let i=0;i<w.length;i++){result.push(w[i]);if(i)result.push(w[i-1]+' '+w[i]);}
 }else if(kind==='charCross'){
   const a=Array.from(t);
   for(let length=3;length<=5;length++)for(let i=0;i+length<=a.length;i++)result.push(a.slice(i,i+length).join(''));
 }else{
   for(const word of t.split(' ')){
     const a=Array.from(' '+word+' ');
     for(let i=0;i<a.length;i++)for(let j=3;j<=5&&i+j<=a.length;j++)result.push(a.slice(i,i+j).join(''));
   }
 }
 return result;
}
const sigmoid=x=>1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));
function linear(m, f, raw, extended) {
 let z=m.bias;
 if(m.kind==='style'){for(let i=0;i<f.v.length;i++)z+=m.weights[i]*f.v[i];return z;}
 if(m.kind==='style2'){for(let i=0;i<extended.length;i++)z+=m.weights[i]*extended[i];return z;}
 if(m.kind==='tree'||m.kind==='forest'){
   const input=m.kind==='forest'?Float32Array.from(extended):extended;
   for(const tree of m.trees){
     let node=tree[0];
     while(!node[5])node=tree[input[node[0]]<=node[1]?node[2]:node[3]];
     z+=node[4];
   }
   if(m.kind==='tree')return z;
   const p=Math.max(1e-9,Math.min(1-1e-9,z/m.trees.length));return Math.log(p/(1-p));
 }
 if(!['char','charCross','word'].includes(m.kind))throw new Error('Unknown model part');
 const counts=new Map();
 for(const g of grams(raw,m.kind))if(Object.hasOwn(m.terms,g))counts.set(g,(counts.get(g)||0)+1);
 let norm=0, dot=0;
 for(const [g,n] of counts){const [idf,w]=m.terms[g];const x=idf*(1+Math.log(n));norm+=x*x;dot+=x*w;}
 return z+(norm?dot/Math.sqrt(norm):0);
}
function run(model,s,stats) {
 if(model.version==='2.0'){s=canonicalize(s,model.language);stats=features(s,model.language);}
 const extended=model.parts.some(m=>['style2','tree','forest'].includes(m.kind))?featuresV2(s,model.language,stats.v):null;
 let z=model.bias;
 const votes=model.parts.map(m=>linear(m,stats,s,extended));
 for(let i=0;i<votes.length;i++)z+=votes[i]*model.mix[i];
 const p=sigmoid(z);
 if(!Number.isFinite(p))throw new Error('Invalid model score');
 return {p,votes:votes.map((x,i)=>sigmoid(x*(model.voteA?.[i]??1)+(model.voteB?.[i]??0)))};
}
export const rawScore=(model,text,lang)=>run(model,text,features(text,lang)).p;
export function languageMatch(s,lang){
 const a=s.match(/\p{L}/gu)||[];
 if(!a.length)return false;
 const lat=a.filter(c=>/\p{Script=Latin}/u.test(c)).length/a.length;
 if(lang==='en')return lat>=.8;
 if(lat>.25 || a.filter(c=>/\p{Script=Cyrillic}/u.test(c)).length/a.length<.75)return false;
 const kk=(s.match(/[әғқңөұүіһ]/giu)||[]).length;
 return lang==='kk'?kk>=Math.max(3,a.length*.005):kk<a.length*.025;
}
export function scoreText(model,raw,lang) {
 const stats=features(raw,lang), r=run(model,raw,stats);
 const grade = r.p>=model.high ? 'high' : r.p<=model.low ? 'low' : 'uncertain';
 const spread=r.votes.length>1?Math.max(...r.votes)-Math.min(...r.votes):0;
 const chunks=sentences(raw), segments=[];
 for(let start=0;start<chunks.length;){
   let end=start, n=0;
   while(end<chunks.length&&(n<100||end-start<2)){n+=words(chunks[end]).length;end++;}
   if(chunks.length>end&&words(chunks.slice(end).join(' ')).length<65)end=chunks.length;
   const excerpt=chunks.slice(start,end).join(' '), local=features(excerpt,lang), size=local.words;
   const q=size>=70?run(model,excerpt,local).p:null;
   segments.push({start:start+1,end,text:excerpt,emphasis:grade==='high'&&q!==null&&q>=Math.max(.85,model.high)});
   start=end;
 }
 return {grade,score:Math.round(r.p*100),stats,segments,spread:Math.round(spread*100), lang};
}


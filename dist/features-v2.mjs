// Versioned deterministic features shared by training and browser inference.
const tokenRe=/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;
const terms={
 ru:'и в во на не что он она это как а по к ко из за для или от но у о об при со с до я мы вы они быть был была было были так же уже еще ещё только если то все всё его ее её их такой такая такие этом когда где чем тем более можно надо нужно себя свой нет даже после перед через чтобы однако поэтому также например кроме между каждый является являются может могут должен должны который которая которые которых благодаря несмотря потому поскольку следовательно именно ведь лишь либо ни есть будет будут имеют имеет очень один два три нас вас мне ему ним них том тому этот этой этих того тогда здесь там всегда иногда никогда часто обычно сегодня теперь прежде снова достаточно менее наиболее своего своей своих друг другой кроме итоге образом целом частности случае стороны времени жизни человека людей'
 ,kk:'және мен бен пен де да та те бұл сол осы бір әр үшін емес бар жоқ еді екен немесе бірақ алайда егер онда олар біз сіз ол өз өте туралы бойынша арқылы деген деп дейін кейін тағы қана ғана болады болып болған болыпты керек қажет сайын сондықтан сондай сонымен кезінде ішінде бірге көп сондай-ақ яғни әрі оның олардың біздің сіздің осының мұндай осындай қалай не қандай кім қай қашан барлық жалпы мысалы алайда әрбір бірнеше сондайдықтан себебі өйткені ретінде байланысты әсіресе мүмкін тек енді бүгін уақыт қазіргі кезде соның оның осы осыған қатар арасында бастап қарай бірге тіпті барлығы біріншіден екіншіден қорытынды айтқанда болып табылады маңызды зор үлкен жаңа өзара басқа артық кем ең бізге оған біздің олардың адамдар адам өмір қоғам білім'
};
const endings='ая ое ый ий ой ые ие ом ем ов ев ам ям ах ях ых их ами ями ого его ому ему ую юю ею ою ся сь ть ет ит ут ют ат ят ла ли ло ость ние тся ться ием иям иях ают яют ный ний ский ская ские ского ение ание тель ств ность ую щий вший ған ген қан кен лар лер дар дер тар тер дың дің тың тің ның нің ға ге қа ке да де та те дан ден тан тен нан нен мен бен пен ны ні ды ді ты ті сы сі ын ін ым ім ың ің мыз міз ңыз ңіз лық лік дық дік тық тік шы ші ғаны гені дығы дігі лары лері дары дері тары тері дың ына іне ында інде лған лген ыл ын іл ға ге'.split(' ');
const letters=Array.from('абвгдеёжзийклмнопрстуфхцчшщъыьэюяәғқңөұүіһ');
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const quantile=(sorted,q)=>sorted.length?sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))]:0;
export function canonicalize(raw,lang){
 const latin='AaBCcEeHKMOoPpTXxyY',cyrillic='АаВСсЕеНКМОоРрТХхуУ';
 const mapping=Object.fromEntries([...latin].map((c,i)=>[c,cyrillic[i]]));
 if(lang==='kk'){mapping.i='і';mapping.I='І';}
 return raw.normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00AD]/gu,'').replace(/\[(?:EMAIL|PHONE|IIN)\]/g,'')
  .replace(/[\p{L}]+/gu,word=>/\p{Script=Cyrillic}/u.test(word)?[...word].map(c=>mapping[c]||c).join(''):word);
}
export function featuresV2(raw,lang,base){
 const text=raw.normalize('NFC'),s=text.toLowerCase(),words=s.match(tokenRe)||[],n=Math.max(1,words.length);
 const counts=new Map(),suffix=new Map();
 for(const w of words){counts.set(w,(counts.get(w)||0)+1);for(let k=2;k<=4&&k<w.length;k++){const end=w.slice(-k);suffix.set(end,(suffix.get(end)||0)+1);}}
 const wl=words.map(w=>Array.from(w).length).sort((a,b)=>a-b);
 const sentences=text.split(/\n{2,}/u).flatMap(x=>x.match(/[^.!?…]+(?:[.!?…]+["'»”)]*|$)/gu)||[]);
 const sl=sentences.map(x=>(x.match(tokenRe)||[]).length).filter(Boolean),sorted=sl.toSorted((a,b)=>a-b);
 const freq=[...counts.values()],out=[...base];
 for(let k=1;k<=16;k++)out.push(wl.filter(x=>k===16?x>=16:x===k).length/n);
 for(const q of [0,.1,.25,.5,.75,.9,1])out.push(quantile(sorted,q)/60,quantile(wl,q)/15);
 out.push(-freq.reduce((a,c)=>a+c/n*Math.log(c/n),0)/Math.log(n+1));
 out.push(freq.filter(x=>x===2).length/n,freq.filter(x=>x>=3).length/n,Math.max(...freq,0)/n);
 const differences=sl.slice(1).map((x,i)=>Math.abs(x-sl[i]));out.push(mean(differences)/Math.max(1,mean(sl)));
 for(const length of [2,3,4]){const grams=new Set();for(let i=0;i<=words.length-length;i++)grams.add(words.slice(i,i+length).join(' '));out.push(1-grams.size/Math.max(1,words.length-length+1));}
 for(const term of terms[lang]?.split(' ')||[])out.push((counts.get(term)||0)/n*20);
 for(const end of endings)out.push((suffix.get(end)||0)/n*10);
 const charCounts=new Map();for(const char of s)charCounts.set(char,(charCounts.get(char)||0)+1);
 for(const letter of letters)out.push((charCounts.get(letter)||0)/Math.max(1,s.length)*10);
 out.push((text.match(/(?<!\p{L})[A-ZА-ЯӘҒҚҢӨҰҮІҺЁ]{2,}(?!\p{L})/gu)||[]).length/n);
 out.push((s.match(/[,:;!?] /gu)||[]).length/n,(s.match(/[.!?][^\s\d]/gu)||[]).length/n);
 out.push((s.match(/\n/gu)||[]).length/n,(s.match(/ {2,}/gu)||[]).length/n);
 return out;
}

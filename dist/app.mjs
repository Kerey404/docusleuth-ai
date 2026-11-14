import {dictionary,docLanguages} from './strings.mjs';
import {words,languageMatch,scoreText} from './model.mjs';
import {recognizeScan} from './ocr.mjs';

const $=id=>document.getElementById(id), editor=$('editor');
const langs={en:'eng',ru:'rus',kk:'kaz'};
const labels={ru:'ru',en:'en',kk:'kk'};
let ui='ru';
try{ui=localStorage.getItem('docusleuth-language')||'ru';}catch{}
if(!dictionary[ui])ui='ru';
let step=1, lang='en', source=null, sourceKind='direct', fileLoading=false, rotation=0, generation=0, busy=false, ocrController=null, result=null;
let ocrScore=null, ocrKey='ocrPrepare', exporting=false, sampleRequest=null, textChanged=false, loadingModel=false;
const models=new Map(), errors=new Map();
const t=k=>dictionary[ui][k]||k;
const url=name=>new URL(name,location.href).href;
const buttonText=(id,key)=>$(id).querySelector('[data-t]').textContent=t(key);
function elt(tag,text,classes=''){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(classes)node.className=classes;return node;}
function setError(where,key,detail=''){
 const node=$(where+'-error');node.hidden=!key;
 if(key){errors.set(where,[key,detail]);node.textContent=t(key)+(detail?' '+detail:'');}
 else{errors.delete(where);node.textContent='';}
}
function updateReview(){
 const n=words(editor.value).length;
 $('word-count').textContent=n.toLocaleString(labels[ui])+' '+t('word');
 $('analyze').disabled=busy||loadingModel;
 $('recognize').disabled=busy||loadingModel;
 $('rotate').disabled=busy||loadingModel;
 $('review-lang').disabled=busy||loadingModel;
 editor.readOnly=busy||loadingModel;
 $('download').disabled=exporting;
 buttonText('analyze',loadingModel?'analyzing':'analyze');
 buttonText('download',exporting?'exporting':'download');
 $('ocr-label').textContent=t(ocrKey);
 const steps=document.querySelectorAll('[data-step]');
 steps.forEach((b,i)=>{
  const current=i+1===step;
  if(current)b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current');
  b.disabled=(i===1&&step===1)||(i===2&&!result);
 });
}
function translate(){
 document.documentElement.lang=ui;
 $('ui-language').value=ui;$('ui-language').setAttribute('aria-label',t('uiLang'));
 document.querySelectorAll('[data-t]').forEach(n=>n.textContent=t(n.dataset.t));
 document.querySelector('.method-open').setAttribute('aria-label',t('method'));
 document.querySelector('#method-dialog .icon-button').setAttribute('aria-label',t('close'));
 $('rotate').setAttribute('aria-label',t('rotate'));
 $('preview-img').alt=t('previewAlt');editor.placeholder=t('placeholder');
 for(const [loc,[k,detail]] of errors)setError(loc,k,detail);
 updateReview();if(result)renderReport();if($('method-dialog').open)renderMethod();
}
function show(next, focus=true){
 step=next;
 $('upload-view').hidden=step!==1;$('review-view').hidden=step!==2;$('report-view').hidden=step!==3;
 document.body.classList.toggle('in-workspace',step!==1);
 updateReview();
 if(focus&&step>1){
  const title=$(step===2?'review-title':'report-title');
  title.focus({preventScroll:true});$('studio').scrollIntoView({block:'start',behavior:'instant'});
 }
}
function clearSession(){
 generation++;
 if(ocrController){ocrController.abort();ocrController=null;}
 if(sampleRequest){sampleRequest.abort();sampleRequest=null;}
 $('sample').disabled=false;
 if(source)URL.revokeObjectURL(source.url);
 source=null;sourceKind='direct';rotation=0;result=null;ocrScore=null;
 busy=false;fileLoading=false;loadingModel=false;exporting=false;textChanged=false;
 editor.value='';$('preview-img').removeAttribute('style');$('file').value='';$('photo').value='';
 $('preview-img').removeAttribute('src');$('file-name').textContent='';
 $('scan-side').hidden=true;$('review-grid').classList.remove('has-scan');$('recognize').hidden=true;
 $('ocr-box').hidden=true;
 $('report-meta').textContent='';
 for(const id of ['score-panel','details-panel','segments'])$(id).replaceChildren();
 for(const loc of ['upload','review','report'])setError(loc,null);
}
function newDoc(){
 clearSession();show(1);$('browse').focus({preventScroll:true});window.scrollTo(0,0);
}
function begin(kind){
 clearSession();sourceKind=kind;lang=$('upload-lang').value;$('review-lang').value=lang;return generation;
}
function invalidate(){result=null;setError('review',null);updateReview();}
function chooseImage(file,kind='scan'){
 return (async()=>{
  if(fileLoading||step!==1||!file)return;
  setError('upload',null);
  if(file.size>10_000_000){setError('upload','largeFile');return;}
  const id=begin(kind);fileLoading=true;
  let objectURL;
  try{
   const head=new Uint8Array(await file.slice(0,33).arrayBuffer());
   if(id!==generation)return;
   const png=[137,80,78,71,13,10,26,10].every((x,i)=>head[i]===x);
   const jpeg=head[0]===255&&head[1]===216&&head[2]===255;
   if(!png&&!jpeg){setError('upload','wrongType');return;}
   if(png){
    const info=new DataView(head.buffer);
    if(head.length<24||info.getUint32(16)*info.getUint32(20)>40_000_000){setError('upload',head.length<24?'badImage':'largeImage');return;}
   }else{
    const dimensions=await jpegSize(file);
    if(dimensions&&dimensions[0]*dimensions[1]>40_000_000){setError('upload','largeImage');return;}
   }
   objectURL=URL.createObjectURL(new Blob([file],{type:png?'image/png':'image/jpeg'}));
   const im=new Image();im.src=objectURL;await im.decode();
   if(id!==generation)return;
   if(im.naturalWidth*im.naturalHeight>40_000_000){setError('upload','largeImage');return;}
   source={url:objectURL,name:file.name,image:im};objectURL=null;
   $('preview-img').src=source.url;$('file-name').textContent=file.name;
   $('scan-side').hidden=false;$('review-grid').classList.add('has-scan');$('recognize').hidden=false;
   show(2);await recognize();
  }catch{if(id===generation)setError('upload','badImage');}
  finally{if(objectURL)URL.revokeObjectURL(objectURL);if(id===generation)fileLoading=false;}
 })();
}
async function jpegSize(file){
 const a=new Uint8Array(await file.arrayBuffer());
 for(let i=2;i<a.length-8;){
  if(a[i++]!==255)return null;
  while(a[i]===255)i++;
  const marker=a[i++];if(marker===0xda||marker===0xd9)return null;
  if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;
  const n=a[i]*256+a[i+1];if(n<2||i+n>a.length)return null;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))
    return [a[i+5]*256+a[i+6],a[i+3]*256+a[i+4]];
  i+=n;
 }
 return null;
}
function processedScan(){
 const {image}=source;const quarter=rotation%180!==0;
 const scale=Math.min(1.5,2300/Math.max(image.naturalWidth,image.naturalHeight));
 const w=Math.max(1,Math.round(image.naturalWidth*scale)),h=Math.max(1,Math.round(image.naturalHeight*scale));
 const canvas=document.createElement('canvas');canvas.width=quarter?h:w;canvas.height=quarter?w:h;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);
 ctx.drawImage(image,-w/2,-h/2,w,h);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height), data=pixels.data;
 const hist=new Uint32Array(256);
 for(let i=0;i<data.length;i+=4){const x=(data[i]*77+data[i+1]*150+data[i+2]*29)>>8;hist[x]++;data[i]=x;}
 let lo=0,hi=255,l=hist[0],r=hist[255],count=data.length/4;
 while(lo<220&&l<count*.008)l+=hist[++lo];
 while(hi>lo&&r<count*.035)r+=hist[--hi];
 const gain=hi-lo>45?255/(hi-lo):1, floor=gain===1?0:lo;
 for(let i=0;i<data.length;i+=4){const x=(data[i]-floor)*gain;data[i]=data[i+1]=data[i+2]=x;}
 ctx.setTransform(1,0,0,1,0,0);ctx.putImageData(pixels,0,0);
 return canvas;
}
const loadedScripts=new Map();
function loadScript(path){
 if(!loadedScripts.has(path)){
  loadedScripts.set(path,new Promise((res,rej)=>{
   const script=document.createElement('script');script.src=url(path);script.onload=res;script.onerror=()=>{script.remove();rej(new Error(path));};
   document.head.append(script);
  }).catch(e=>{loadedScripts.delete(path);throw e;}));
 }
 return loadedScripts.get(path);
}
async function recognize(){
 if(!source||busy||loadingModel)return;
 const id=generation;const docLang=lang;
 const controller=new AbortController();
 ocrController=controller;
 busy=true;result=null;ocrScore=null;ocrKey='ocrPrepare';$('ocr-box').hidden=false;$('ocr-progress').value=0;setError('review',null);updateReview();
 const timer=setTimeout(()=>controller.abort(new Error('OCR timeout')),90000);
 try{
  const reply=await recognizeScan(processedScan(),langs[docLang],{
    signal:controller.signal,
    onProgress:m=>{
     if(id!==generation||controller.signal.aborted)return;
     const read=m.status==='recognizing text';
     ocrKey=read?'ocrReading':'ocrLoading';$('ocr-label').textContent=t(ocrKey);
     $('ocr-progress').value=read?Math.round(m.progress*85)+15:Math.max($('ocr-progress').value,Math.round(m.progress*14));
    }
  });
  if(id!==generation)return;
  const value=reply.text.replace(/(\p{L})-\n(?=\p{Ll})/gu,'$1').replace(/(?<!\n)\n(?!\n)/gu,' ').trim();
  if(!words(value).length){setError('review','ocrEmpty');return;}
  editor.value=value;ocrScore=Math.round(reply.confidence);textChanged=false;
  if(ocrScore<70)setError('review','ocrLow');
 }catch(e){if(id===generation){console.error('OCR:',e.message);setError('review','ocrFail');}}
 finally{
  clearTimeout(timer);
  if(ocrController===controller)ocrController=null;
  if(id===generation){busy=false;$('ocr-box').hidden=true;updateReview();}
 }
}
async function getModel(docLang){
 if(!models.has(docLang))models.set(docLang,fetch(url('models/'+docLang+'.json')).then(r=>{if(!r.ok)throw Error('Missing model');return r.json();}).catch(e=>{models.delete(docLang);throw e;}));
 return models.get(docLang);
}
async function analyze(){
 if(busy||loadingModel)return;
 const text=editor.value.trim(), n=words(text).length;
 if(text.length>100000){setError('review','longCharacters');editor.focus();return;}
 if(n<200){setError('review','short');editor.focus();return;}
 if(n>2000){setError('review','long');editor.focus();return;}
 if(!languageMatch(text,lang)){setError('review','mismatch');return;}
 const id=generation, chosen=lang;
 loadingModel=true;setError('review',null);updateReview();
 try{
  const model=await getModel(chosen);
  if(id!==generation)return;
  if(editor.value.trim()!==text||lang!==chosen)return;
  result=scoreText(model,text,chosen);result.source=sourceKind;result.ocr=ocrScore;result.edited=textChanged;result.filename=source?.name||null;result.model=model.version;result.thresholds=[Math.round(model.low*100),Math.round(model.high*100)];
  renderReport();show(3);
 }catch(e){models.delete(chosen);if(id===generation){result=null;console.error('Model:',e.message);setError('review','modelFail');}}
 finally{if(id===generation){loadingModel=false;updateReview();}}
}
const amount=x=>new Intl.NumberFormat(labels[ui],{maximumFractionDigits:1}).format(x);
const verdictCopy={low:'none',uncertain:'mid',high:'raised'};
function reportData(){
 const {stats}=result;
 return [[t('count'),amount(stats.words)],[t('sentence'),amount(stats.sentences)],[t('avg'),amount(stats.mean)],[t('burst'),amount(stats.variation)],[t('diversity'),amount(stats.diversity*100)+'%'],...(result.ocr===null?[]:[[t('ocrConfidence'),result.ocr+'%']])];
}
function renderReport(){
 const a=result;
 $('report-meta').textContent=[docLanguages[a.lang],t(a.source),a.filename,a.stats.words+' '+t('word')].filter(Boolean).join(' · ');
 const score=elt('section',undefined,'score-card');
 score.append(elt('span',t('score'),'kicker'));
 const main=elt('div',undefined,'score-main');main.append(elt('strong',a.score+'%','score-number'),elt('span',t(a.grade),'status-badge '+a.grade));score.append(main);
 score.append(elt('p',t('scoreDesc'),'muted'));
 const meter=elt('div',undefined,'meter');meter.setAttribute('aria-hidden','true');
 const uncertainty=elt('b',undefined,'meter-band');
 uncertainty.style.left=a.thresholds[0]+'%';uncertainty.style.width=(a.thresholds[1]-a.thresholds[0])+'%';meter.append(uncertainty);
 const mark=elt('i');mark.style.left=a.score+'%';meter.append(mark);
 const ticks=elt('div',undefined,'meter-label');ticks.append(elt('span','0'),elt('span','50'),elt('span','100'));
 score.append(meter,ticks,elt('p',t('thresholds')+' '+a.thresholds.join('–')+'%.','muted'),elt('p',t(verdictCopy[a.grade]),'muted'));
 $('score-panel').replaceChildren(score);
 const detail=elt('section',undefined,'detail-card');detail.append(elt('h3',t('stats')));
 const stats=elt('div',undefined,'stats');
 for(const [label,value] of reportData()){const cell=elt('div');cell.append(elt('span',label),elt('strong',value));stats.append(cell);}
 detail.append(stats);$('details-panel').replaceChildren(detail);
 $('segments').replaceChildren(...a.segments.map(seg=>{
  const div=elt('article',undefined,'segment'+(seg.emphasis?' high':''));
  const head=elt('div',undefined,'section-label');
  head.append(elt('span',t('sentRange')+' '+seg.start+(seg.end!==seg.start?'–'+seg.end:'')));
  if(seg.emphasis)head.append(elt('span',t('look')));
  div.append(head,elt('p',seg.text));return div;
 }));
}
let metricsPromise;
let methodRender=0;
async function renderMethod(){
 const render=++methodRender;
 const now=ui, root=$('method-content');
 root.replaceChildren(elt('p',t('methodA')),elt('p',t('methodB')),elt('p',t('methodC')),elt('p',t('kkTest')));
 try{
  metricsPromise ||= fetch(url('models/validation.json')).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(e=>{metricsPromise=null;throw e;});
  const m=await metricsPromise;if(render!==methodRender||now!==ui||!$('method-dialog').open)return;
  if(m.version==='2.0')root.append(elt('p',t('trainingV2')));
  const sc=elt('div',undefined,'metric-scroll'), table=elt('table'), head=elt('thead'), body=elt('tbody'), row=elt('tr');
  for(const name of ['modelLang','testCount','fpr','fnr','abstain']){const th=elt('th',t(name));th.scope='col';row.append(th);}
  head.append(row);
  for(const code of ['en','ru','kk']){
   const captions={stress:'stressTest',cross:'crossTest','fresh-news':'freshNews','fresh-science':'freshScience','fresh-news-paraphrased':'newsRewrite','fresh-science-paraphrased':'scienceRewrite','gray-MH':'shortRewrite'};
   for(const key of ['test',...Object.keys(captions)]){
    const v=m.languages[code]?.[key];if(!v)continue;
    const line=elt('tr'), pct=x=>x===null?'—':amount(x*100)+'%';
    const label=docLanguages[code]+(key==='test'?'':' · '+t(captions[key]));
    for(const value of [label,v.n,pct(v.fpr),pct(v.fnr),pct(v.abstain)])line.append(elt('td',value));
    body.append(line);
   }
  }
  table.append(head,body);sc.append(table);root.append(sc);
  if(m.languages.kk?.['gray-MH'])root.append(elt('p',t('shortRewriteNote')));
 }catch{if(render===methodRender&&now===ui&&$('method-dialog').open)root.append(elt('p',t('methodUnavailable')));}
}
async function download(){
 if(!result||exporting)return;
 const saved=result,id=generation, copy=dictionary[ui], rows=reportData();
 const meta=$('report-meta').textContent;
 exporting=true;setError('report',null);updateReview();
 try{
  const [module]=await Promise.all([import('./report.mjs'),loadScript('vendor/pdf-lib.min.js'),loadScript('vendor/fontkit.umd.min.js')]);
  const bytes=await module.makePdf(saved,copy,rows,meta);
  if(id!==generation||saved!==result)return;
  const link=elt('a');link.href=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));link.download=copy.reportFile+'-'+saved.lang+'.pdf';
  document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(link.href),15000);
 }catch(e){if(id===generation){console.error('PDF:',e.message);setError('report','pdfFail');}}
 finally{if(id===generation){exporting=false;updateReview();}}
}
$('ui-language').addEventListener('change',e=>{ui=e.target.value;try{localStorage.setItem('docusleuth-language',ui);}catch{}translate();});
$('browse').addEventListener('click',()=>$('file').click());
$('camera').addEventListener('click',()=>$('photo').click());
for(const id of ['file','photo'])$(id).addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)chooseImage(f);});
const drop=$('dropzone');
for(const name of ['dragenter','dragover'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('drag');});
for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();if(name==='drop'||!drop.contains(e.relatedTarget))drop.classList.remove('drag');});
document.addEventListener('dragover',e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();});
document.addEventListener('drop',e=>{if(e.dataTransfer.files.length)e.preventDefault();});
drop.addEventListener('drop',e=>{const files=e.dataTransfer.files;if(files.length>1)setError('upload','oneFile');else chooseImage(files[0]);});
$('paste').addEventListener('click',()=>{begin('direct');show(2);editor.focus({preventScroll:true});});
$('sample').addEventListener('click',async()=>{
 if(sampleRequest||fileLoading)return;
 const controller=new AbortController();
 sampleRequest=controller;
 const id=generation, docLang=$('upload-lang').value;setError('upload',null);
 $('sample').disabled=true;
 try{
  const response=await fetch(url('examples/'+docLang+'.png'),{signal:controller.signal});if(!response.ok)throw Error();
  const blob=await response.blob();if(id!==generation)return;
  $('upload-lang').value=docLang;
  await chooseImage(new File([blob],'demo-'+docLang+'.png',{type:'image/png'}),'example');
 }catch{if(id===generation&&!controller.signal.aborted)setError('upload','modelFail');}
 finally{if(sampleRequest===controller){sampleRequest=null;$('sample').disabled=false;}}
});
$('review-lang').addEventListener('change',e=>{lang=e.target.value;$('upload-lang').value=lang;invalidate();});
function fitPreview(){
 if(!source||$('scan-side').hidden)return;
 const f=source.image,frame=$('preview-img').parentElement;
 if(!frame.clientWidth||!frame.clientHeight)return;
 const angle=rotation%180!==0, w=angle?f.naturalHeight:f.naturalWidth, h=angle?f.naturalWidth:f.naturalHeight;
 const size=Math.min((frame.clientWidth||1)/w,(frame.clientHeight||1)/h);
 Object.assign($('preview-img').style,{width:f.naturalWidth*size+'px',height:f.naturalHeight*size+'px',maxHeight:'none',transform:'rotate('+rotation+'deg)'});
}
new ResizeObserver(fitPreview).observe($('preview-img').parentElement);
$('rotate').addEventListener('click',()=>{
 rotation=(rotation+90)%360;
 fitPreview();
 ocrScore=null;invalidate();setError('review','rotated');
});
$('recognize').addEventListener('click',()=>{if(!textChanged||confirm(t('confirmOcr')))recognize();});
$('analyze').addEventListener('click',analyze);
$('download').addEventListener('click',download);
$('edit-again').addEventListener('click',()=>show(2));
editor.addEventListener('input',()=>{textChanged=true;invalidate();});
document.querySelectorAll('[data-reset]').forEach(b=>b.addEventListener('click',newDoc));
document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>{
 const target=Number(b.dataset.step);
 if(target===1&&step!==1)newDoc();else if(target!==step)show(target);
}));
document.querySelectorAll('[data-open-method]').forEach(b=>b.addEventListener('click',()=>{$('method-dialog').showModal();renderMethod();}));
$('method-dialog').addEventListener('click',e=>{if(e.target===$('method-dialog')){
 const box=e.target.getBoundingClientRect();if(e.clientX<box.left||e.clientX>box.right||e.clientY<box.top||e.clientY>box.bottom)e.target.close();
}});
translate();


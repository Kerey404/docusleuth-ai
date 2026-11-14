export async function makePdf(result,t,stats,meta){
 const {PDFDocument,rgb}=globalThis.PDFLib;
 const doc=await PDFDocument.create();
 doc.registerFontkit(globalThis.fontkit);
 const response=await fetch(new URL('./fonts/NotoSans-Regular.ttf',import.meta.url));
 if(!response.ok)throw new Error('Report font unavailable');
 const font=await doc.embedFont(await response.arrayBuffer(),{subset:true});
 doc.setTitle('DocuSleuth AI — '+t.reportTitle);
 doc.setCreator('DocuSleuth AI');doc.setLanguage(result.lang);
 const color={ink:rgb(.1,.17,.13),green:rgb(.15,.34,.25),muted:rgb(.29,.37,.32),line:rgb(.85,.89,.84),soft:rgb(.94,.97,.92),amber:rgb(.99,.95,.85),white:rgb(1,1,1)};
 const W=595.28,H=841.89,L=45,R=W-L,BW=W-2*L;
 let page, y, pageNo=0;
 const clean=s=>Array.from(String(s).normalize('NFC').replace(/[\u0000-\u001F\u007F-\u009F]/g,' ')).map(c=>glyphs.has(c.codePointAt(0))?c:'□').join('');
 const glyphs=new Set(font.getCharacterSet());
 function add(){
  page=doc.addPage([W,H]);pageNo++;
  page.drawRectangle({x:0,y:H-12,width:W,height:12,color:color.green});
  draw('DOCUSLEUTH AI  /  SE-2421',L,H-35,9,color.green);
  page.drawLine({start:{x:L,y:39},end:{x:R,y:39},thickness:.65,color:color.line});
  draw('DocuSleuth AI  ·  '+t.noticeTitle,L,24,8,color.muted);
  const n=String(pageNo).padStart(2,'0');draw(n,R-font.widthOfTextAtSize(n,8),24,8,color.muted);
  y=H-57;
 }
 function draw(s,x,base,size,c){page.drawText(clean(s),{x,y:base,font,size,color:c});}
 function wrap(text,size,width){
  const split=clean(text).trim().split(/\s+/u), lines=[];let line='';
  for(let word of split){
   if(line&&font.widthOfTextAtSize(line+' '+word,size)>width){lines.push(line);line='';}
   while(word&&font.widthOfTextAtSize(word,size)>width){
    const chars=Array.from(word);let i=1;
    while(i<chars.length&&font.widthOfTextAtSize(chars.slice(0,i+1).join(''),size)<=width)i++;
    lines.push(chars.slice(0,i).join(''));word=chars.slice(i).join('');
   }
   if(word)line+=(line?' ':'')+word;
  }
  if(line)lines.push(line);return lines;
 }
 function need(height){if(y-height<56)add();}
 function line(s,size=10,c=color.ink){need(size+6);draw(s,L,y-size,size,c);y-=size+6;}
 function paragraph(s,size=10,c=color.ink){
  for(const item of wrap(s,size,BW))line(item,size,c);
 }
 function panel(title,description,shade=color.soft){
  const titleLines=wrap(title,12,BW-24);
  const lines=wrap(description,10,BW-24);
  const h=25+titleLines.length*16+lines.length*15;
  need(h);
  page.drawRectangle({x:L,y:y-h,width:BW,height:h,color:shade});
  titleLines.forEach((text,i)=>draw(text,L+12,y-20-i*16,12,color.green));
  lines.forEach((text,i)=>draw(text,L+12,y-24-titleLines.length*16-i*15,10,color.ink));
  y-=h+13;
 }
 add();
 line(t.reportTitle,27,color.green);
 paragraph(meta,10,color.muted);
 line(new Intl.DateTimeFormat('en-GB',{dateStyle:'medium'}).format(new Date())+'  ·  Model '+result.model,9,color.muted);y-=6;
 panel(t.noticeTitle,t.notice);
 panel(t.score+'  '+result.score+'%  ·  '+t[result.grade],t.scoreDesc+' '+t.thresholds+' '+result.thresholds.join('–')+'%. '+t[{low:'none',uncertain:'mid',high:'raised'}[result.grade]],result.grade==='high'?color.amber:color.soft);
 line(t.stats,15,color.green);
 for(let i=0;i<stats.length;i+=2){
  const columns=stats.slice(i,i+2).map(([label,value])=>wrap(label+'  ·  '+value,9.5,(BW-14)/2));
  const h=13*Math.max(...columns.map(c=>c.length));
  need(h);columns.forEach((c,j)=>c.forEach((s,k)=>draw(s,L+j*(BW+14)/2,y-10-k*13,9.5,color.ink)));y-=h;
 }
 y-=6;need(50);line(t.passages,15,color.green);paragraph(t.passagesDesc,9,color.muted);
 for(const seg of result.segments){
  const range=seg.start+(seg.start===seg.end?'':'–'+seg.end);
  need(44);y-=6;
  line(t.sentRange+' '+range+(seg.emphasis?'  ·  '+t.look:''),10,color.green);
  paragraph(seg.text,10);
 }
 return doc.save();
}


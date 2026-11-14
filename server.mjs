import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extname,resolve,relative,isAbsolute} from 'node:path';
import {spawn} from 'node:child_process';

const root=fileURLToPath(new URL('./dist/',import.meta.url));
const args=process.argv.slice(2);
const portOption=args.indexOf('--port');
const port=portOption===-1?4317:Number(args[portOption+1]);
if(!Number.isInteger(port)||port<0||port>65535){console.error('Use --port 0 through 65535.');process.exit(1);}
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.wasm':'application/wasm','.txt':'text/plain; charset=utf-8','.gz':'application/octet-stream','.png':'image/png'};
const policies={
 'Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; worker-src 'self'; connect-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-cache'
};
const host='127.0.0.1';
let expected;
const server=createServer(async(req,res)=>{
 const reply=(status,body)=>{res.writeHead(status,{...policies,'Content-Type':'text/plain; charset=utf-8'});res.end(req.method==='HEAD'?undefined:body);};
 if(![expected,'localhost:'+server.address().port].includes(req.headers.host))return reply(403,'Invalid host.');
 if(req.method!=='GET'&&req.method!=='HEAD')return reply(405,'Method not allowed.');
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://'+expected).pathname);
  if(pathname.includes('\\')||pathname.includes('\0')||pathname.includes(':')||pathname.split('/').some(p=>p.startsWith('.')))return reply(404,'Not found.');
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  const rel=relative(root,file);
  const type=types[extname(file)];
  if(!rel||rel.startsWith('..')||isAbsolute(rel)||!type)return reply(404,'Not found.');
  const entry=await stat(file);
  if(!entry.isFile())return reply(404,'Not found.');
  res.writeHead(200,{...policies,'Content-Type':type,'Content-Length':entry.size});
  if(req.method==='HEAD')return res.end();
  const stream=createReadStream(file);
  stream.on('error',()=>res.destroy());stream.pipe(res);
 }catch{return reply(404,'Not found.');}
});
function open(url){
 if(process.platform==='win32'){
  const child=spawn('rundll32.exe',['url.dll,FileProtocolHandler',url],{windowsHide:true,stdio:'ignore'});
  child.on('error',()=>console.error('Open the address above in a browser.'));
 }else{
  const child=spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});
  child.on('error',()=>console.error('Open the address above in a browser.'));
 }
}
server.on('error',err=>{
 if(err.code==='EADDRINUSE'&&args.includes('--open')){
  server.listen(0,host);return;
 }
 console.error(err.message);process.exitCode=1;
});
server.on('listening',()=>{
 expected=host+':'+server.address().port;const url='http://'+expected+'/';
 console.log('DocuSleuth AI: '+url);
 console.log('Keep this window open while using the app. Ctrl+C stops it.');
 if(args.includes('--open'))open(url);
});
server.listen(port,host);


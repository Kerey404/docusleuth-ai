import assert from 'node:assert/strict';
import {request} from 'node:http';
import {writeFile} from 'node:fs/promises';

const base=new URL(process.env.DOCUSLEUTH_URL||'http://127.0.0.1:4318/');
function raw(path,method='GET',host=base.host){
 return new Promise((resolve,reject)=>{
  const req=request({hostname:base.hostname,port:base.port,path,method,headers:{Host:host}},res=>{
   let body='';res.setEncoding('utf8');res.on('data',c=>body+=c);
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));
  });
  req.on('error',reject);req.end();
 });
}
const outcomes=[];
for(const path of ['/package.json','/server.mjs','/.git/config','/data/aina-human.jsonl','/../package.json','/%2e%2e/package.json','/..%5cpackage.json','/%00index.html','/%E0%A4%A','/index.html::$DATA','/models/','/qa/audit-2026-11-14/model-results.json']){
 const result=await raw(path);assert.equal(result.status,404,path);outcomes.push({path,status:result.status});
}
for(const method of ['POST','PUT','DELETE','OPTIONS','PATCH']){
 assert.equal((await raw('/',method)).status,405);outcomes.push({method,status:405});
}
for(const host of ['malicious.example',base.host+'.malicious.example','127.0.0.1','localhost']){
 assert.equal((await raw('/','GET',host)).status,403);outcomes.push({host,status:403});
}
const head=await raw('/','HEAD');assert.equal(head.status,200);assert.equal(head.body,'');
assert(Number(head.headers['content-length'])>1000);
assert.match(head.headers['content-security-policy'],/connect-src 'self' blob:/);
assert.match(head.headers['content-security-policy'],/frame-ancestors 'none'/);
assert.equal(head.headers['x-content-type-options'],'nosniff');
assert.equal(head.headers['cross-origin-resource-policy'],'same-origin');
assert.equal((await raw('/','GET','localhost:'+base.port)).status,200);
await writeFile('qa/audit-2026-11-14/server-results.json',JSON.stringify({outcomes,headers:head.headers},null,2));
console.log('Passed '+outcomes.length+' request rejection cases, HEAD, local host and response policy checks.');

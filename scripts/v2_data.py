"""Version 2 data: grouped splits, original holdouts, and new untouched stress sets."""
import collections,hashlib,json,subprocess
from pathlib import Path
import train
import pyarrow.parquet as pq
ROOT=train.ROOT
OUT=ROOT/'experiments/v2'
OUT.mkdir(parents=True,exist_ok=True)

def digest(text):return hashlib.sha256(train.normalize(text).encode()).hexdigest()

def new_rows(lang):
 if lang=='ru':
  for stem,y,kind in [('original_essay',0,'human'),('generated_essays',1,'generated'),('paraphrased_essays',1,'paraphrased')]:
   for r in json.loads((ROOT/'data'/f'ru-{stem}.json').read_text(encoding='utf8')):
    group='ru/'+str(r['id']);part=train.split_for(group)
    if part in ['train','val']:
     yield train.clean(r['text']),y,part,'essay-'+kind,group
  for genre in ['news','science']:
   for kind,y in [('human',0),('generated',1),('paraphrased',1)]:
    for r in json.loads((ROOT/'data'/f'ru-{genre}-{kind}.json').read_text(encoding='utf8')):
     group=f'v2/{genre}/'+str(r['id']);part=train.split_for(group)
     if part=='test':part='fresh-'+genre
     yield train.clean(r['text']),y,part,genre+'-'+kind,group
  for batch in pq.ParquetFile(ROOT/'data/ru-train.parquet').iter_batches(batch_size=4096):
   for r in batch.to_pylist():
    u=train.unit('coat/'+str(r['id']))
    if r['label'] not in [0,1] or u>=.60:continue
    # Additional CoAT validation comes only from rows unused by the previous model.
    part='train' if u<.50 else 'val'
    yield train.clean(r['text']),r['label'],part,'CoAT','coat/'+str(r['id'])
 else:
  for source,y in [('human',0),('machine',1)]:
   for line in (ROOT/'data'/f'aina-{source}.jsonl').read_text(encoding='utf8').splitlines():
    r=json.loads(line)
    if r['domain']=='web-ru' or (y and r['label'] not in ['M','MH','HP']):continue
    group=str(r['cluster']) if r.get('cluster') is not None else (r.get('group') or r['id'])
    if r['split']=='train' or (r.get('label')=='MH' and r.get('src_split')=='train'):part='val' if train.unit('kk/'+group)<.28 else 'train'
    elif r.get('label') in ['MH','HP']:part='gray-'+r['label']
    else:continue
    # Neutralize source-specific redaction markers before fitting.
    text=train.clean(r.get('text'))
    for marker in ['[EMAIL]','[PHONE]','[IIN]']:text=text.replace(marker,'')
    yield text,y,part,r['domain']+'-'+(r.get('label') or 'H'),'kk/'+group

def prepare_v2(lang):
 path=OUT/(lang+'-sets.json')
 if path.exists():return json.loads(path.read_text(encoding='utf8'))
 legacy=train.prepare(lang,train.rows_ru() if lang=='ru' else train.rows_kk())
 records=[]
 for part in ['test','stress','cross']:
  for text,y,f,domain in legacy.get(part,[]):
   records.append([text,y,part,'legacy-'+domain,'legacy/'+digest(text)])
 raw=sorted(new_rows(lang),key=lambda r:0 if r[2] not in ['train','val'] else 1 if r[2]=='val' else 2)
 seen={digest(r[0]) for r in records}
 for text,y,part,domain,group in raw:
  n=len(train.TOKEN.findall(text))
  minimum=80 if lang=='kk' and (part in ['train','val'] or part.startswith('gray-')) else 185
  if not minimum<=n<=2010:continue
  key=digest(text)
  if key in seen:continue
  seen.add(key);records.append([text,y,part,domain,group])
 sets=collections.defaultdict(list)
 for start in range(0,len(records),200):
  batch=records[start:start+200]
  proc=subprocess.run(['node',str(ROOT/'scripts/v2-features.mjs')],input=''.join(json.dumps([lang,r[0]])+'\n' for r in batch).encode(),capture_output=True)
  if proc.returncode:raise RuntimeError(proc.stderr.decode())
  for row,f in zip(batch,map(json.loads,proc.stdout.decode('utf8').rstrip('\n').split('\n')),strict=True):
   text,y,part,domain,group=row
   minimum=80 if lang=='kk' and (part in ['train','val'] or part.startswith('gray-')) else 200
   if minimum<=f['n']<=2000 and f['lang']:
    sets[part].append({'text':text,'canonical':f['canonical'],'y':y,'f':f['f'],'f2':f['f2'],'domain':domain,'group':group,'n':f['n']})
  if start%1000==0:print(lang,'features',start,'/',len(records),flush=True)
 # Each train/validation topic belongs to one partition. Legacy heldouts preserve
 # the prior published sample exactly; topic overlap in CoAT remains undocumented.
 assert not ({r['group'] for r in sets['train']} & {r['group'] for r in sets['val']})
 for part in ['test','stress','cross']:
  assert len(sets[part])==len(legacy[part]),(lang,part,len(sets[part]),len(legacy[part]))
 path.write_text(json.dumps(sets,ensure_ascii=False),encoding='utf8')
 return sets

if __name__=='__main__':
 for lang in ['ru','kk']:
  sets=prepare_v2(lang)
  print(lang,{part:dict(collections.Counter(r['y'] for r in rows)) for part,rows in sets.items()},flush=True)

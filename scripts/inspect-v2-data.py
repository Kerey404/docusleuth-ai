import sys,json,collections,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.ml-deps'))
import pyarrow.parquet as pq
import train
for name in ['ru-original_essay','ru-generated_essays','ru-paraphrased_essays']:
 rows=json.loads((ROOT/'data'/f'{name}.json').read_text(encoding='utf8'))
 print(name,len(rows),list(rows[0]),collections.Counter(r.get('paraphrasing_type') for r in rows))
 print('train sample',json.dumps(next(r for r in rows if train.split_for('ru/'+str(r['id']))=='train'),ensure_ascii=True)[:1000])
for name in ['aina-human','aina-machine']:
 rows=[json.loads(line) for line in (ROOT/'data'/f'{name}.jsonl').read_text(encoding='utf8').splitlines()]
 print(name,'columns',list(rows[0]))
 print('domains',collections.Counter((r['domain'],r['split'],r.get('label')) for r in rows))
 buckets=collections.Counter()
 for r in rows:
  n=len(train.TOKEN.findall(r.get('text') or ''))
  buckets[(r['split'],r['domain'],'empty' if n==0 else '<80' if n<80 else '80-199' if n<200 else '200-2000' if n<=2000 else '>2000')]+=1
 print('lengths',buckets)
 print('example fields',json.dumps({k:v for k,v in rows[0].items() if k!='text'},ensure_ascii=True))
for name in ['ru-train','ru-validation','ru-test']:
 table=pq.read_table(ROOT/'data'/f'{name}.parquet')
 print(name,len(table),table.column_names)
 print('sample fields', {k:str(v)[:200] for k,v in table.to_pylist()[0].items() if k!='text'})
for name in ['kk-train.csv','kk-test.csv','kk-ood_test.csv']:
 with (ROOT/'data'/name).open(encoding='utf8') as f: print(name,repr(f.readline()[:350]))
print('optional packages', {name:bool(importlib.util.find_spec(name)) for name in ['torch','transformers','onnxruntime','xgboost','catboost']})

"""Evaluate frozen selections once, using the actual browser inference module."""
import hashlib,json,subprocess,zipfile
import train
from v2_data import OUT,prepare_v2
import numpy as np

def scores(paths,rows,lang):
 payload=''.join(json.dumps([list(map(str,paths)),r['text'],lang])+'\n' for r in rows)
 proc=subprocess.run(['node',str(train.ROOT/'qa/v2-score-batch.mjs')],input=payload.encode(),capture_output=True)
 if proc.returncode:raise RuntimeError(proc.stderr.decode())
 result=np.array([json.loads(line) for line in proc.stdout.decode().splitlines()])
 assert len(result)==len(rows)
 return result

def interval(success,total):
 if not total:return None
 p=success/total;z=1.96;denom=1+z*z/total
 half=z*((p*(1-p)/total+z*z/(4*total**2))**.5)/denom
 center=(p+z*z/(2*total))/denom
 return [max(0,center-half),min(1,center+half)]

def main():
 report={}
 for lang in ['ru','kk']:
  selected=OUT/lang/'selected.json';record=json.loads((OUT/lang/'selection.json').read_text())
  assert hashlib.sha256(selected.read_bytes()).hexdigest()==record['model_sha256']
  parity=json.loads((OUT/lang/'parity.json').read_text(encoding='utf8'))
  values=scores([selected],parity,lang)[:,0]
  error=float(max(abs(values-np.array([r['expected'] for r in parity]))))
  assert error<1e-7,(lang,'Python/browser parity failed',error)
  baseline=OUT/f'baseline-{lang}.json'
  if not baseline.exists():
   with zipfile.ZipFile(OUT/'baseline.zip') as z:
    matches=[name for name in z.namelist() if name.replace('\\','/').endswith('models/'+lang+'.json')]
    assert len(matches)==1,matches
    baseline.write_bytes(z.read(matches[0]))
  models=[json.loads(p.read_text(encoding='utf8')) for p in [baseline,selected]]
  sets=prepare_v2(lang)
  results={}
  for part,rows in sets.items():
   if part in ['train','val']:continue
   pred=scores([baseline,selected],rows,lang);y=np.array([r['y'] for r in rows]);pairs={}
   for i,model in enumerate(models):
    metric=train.evaluate(y,pred[:,i],model['low'],model['high'])
    metric['fpr_95ci']=interval(metric['fp'],metric['human'])
    metric['recall_95ci']=interval(metric['tp'],metric['ai'])
    metric['ai_high_rate']=metric['tp']/metric['ai'] if metric['ai'] else None
    pairs['before' if i==0 else 'after']=metric
   results[part]=pairs
   print(lang,part,json.dumps({k:{x:v[x] for x in ['n','human','ai','fp','tp','fnr','fpr']} for k,v in pairs.items()}),flush=True)
  report[lang]={'selection':record,'parity_max_error':error,'counts':{k:len(v) for k,v in sets.items()},'tests':results}
  (OUT/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf8')
 print('Saved experiments/v2/evaluation.json',flush=True)

if __name__=='__main__':main()

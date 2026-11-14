"""Export validated models with a monotonic presentation index (25/70 thresholds)."""
import hashlib,json,math
from pathlib import Path
import train
from v2_data import OUT
from scipy.special import expit
DEST=train.ROOT/'dist/models'
evaluation=json.loads((OUT/'evaluation.json').read_text())
report=json.loads((DEST/'validation.json').read_text(encoding='utf8'))
metric_keys=['n','human','ai','tp','fp','tn','fn','fpr','fnr','abstain','covered_accuracy']
logit=lambda p:math.log(p/(1-p))
for lang in ['ru','kk']:
 source=OUT/lang/'selected.json';model=json.loads(source.read_text(encoding='utf8'));choice=evaluation[lang]['selection']
 assert hashlib.sha256(source.read_bytes()).hexdigest()==choice['model_sha256']
 original_low,original_high=model['low'],model['high']
 a=(logit(.70)-logit(.25))/(logit(original_high)-logit(original_low));b=logit(.25)-a*logit(original_low)
 model['indexMapping']={'kind':'monotonic logit scale','sourceLow':original_low,'sourceHigh':original_high,'a':a,'b':b,'sourceSha256':choice['model_sha256']}
 model['mix']=[w*a for w in model['mix']];model['bias']=model['bias']*a+b;model['low']=.25;model['high']=.70
 (DEST/(lang+'.json')).write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf8')
 parity=json.loads((OUT/lang/'parity.json').read_text(encoding='utf8'))
 for row in parity:row['expected']=float(expit(a*logit(min(1-1e-15,max(1e-15,row['expected'])))+b))
 (train.ROOT/'qa'/(lang+'-parity.json')).write_text(json.dumps(parity,ensure_ascii=False),encoding='utf8')
 data={'model_version':'2.0','chosen':choice['name'],'counts':evaluation[lang]['counts'],'train_used':choice['train'],'calibration':choice['calibration'],'selection':choice['selection'],'low':.25,'high':.70,'candidate_count':47 if lang=='ru' else 33,'validation':choice['selected']['validation'],'comparison':{}}
 for part,pair in evaluation[lang]['tests'].items():
  if part=='gray-HP':
   data['ai_edited_human']={'n':pair['after']['n'],'high':pair['after']['tp'],'high_rate':pair['after']['ai_high_rate'],'note':'AI editing of human text is a separate gray zone, not a binary authorship test.'};continue
  data[part]={key:pair['after'][key] for key in metric_keys}
  data['comparison'][part]={side:{key:metric[key] for key in metric_keys} for side,metric in pair.items()}
 if lang=='kk':data['rewrite_note']='gray-MH contains 64 texts of 80–199 words, outside the app’s 200–2000-word range; no long-paraphrase accuracy claim.'
 report['languages'][lang]=data
report['version']='2.0'
(DEST/'validation.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf8')
print('Exported RU/KZ 2.0; classifications unchanged by the presentation scale.',flush=True)

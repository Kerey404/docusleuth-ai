"""Paired-source training cancels topic vocabulary before learning stylistic changes."""
import collections,hashlib,json,shutil
import train
from train_v2 import select_threshold,metric
from v2_data import OUT,prepare_v2
from evaluate_v2 import scores
import numpy as np
from scipy.sparse import vstack
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression

lang='ru';folder=OUT/lang
sets=prepare_v2(lang);training=sets['train'];valid=sets['val']
cal=np.array([train.unit('v2-cal/'+r['group'])<.43 for r in valid]);dev=~cal
selection=[r for r,use in zip(valid,dev) if use];yv=np.array([r['y'] for r in valid])
base=json.loads((folder/'selected.json').read_text(encoding='utf8'))
base_record=json.loads((folder/'selection.json').read_text())
basep=np.clip(scores([folder/'selected.json'],valid,lang)[:,0],1e-13,1-1e-13)
parts={'reference':base};raws={'reference':np.log(basep/(1-basep))}
humans={r['group']:i for i,r in enumerate(training) if r['y']==0}
pairs=[(i,humans[r['group']]) for i,r in enumerate(training) if r['y']==1 and r['group'] in humans]
print('Contrastive source pairs',len(pairs),flush=True)
options=[];report={}
original=base_record['selected']['validation']
options.append(((original['macro_recall']-.5*original['fpr'],original['auc'],-original['abstain']),'reference',base,base_record))
def consider(name,keys):
 raw=np.column_stack([raws[k] for k in keys]);c=LogisticRegression(C=.5,class_weight='balanced',max_iter=600).fit(raw[cal],yv[cal])
 p=c.predict_proba(raw[dev])[:,1];lo,hi=select_threshold(selection,p);m=metric(selection,p,lo,hi)
 model={'version':'2.0','language':lang,'kind':name,'parts':[],'mix':[],'bias':float(c.intercept_[0]),'low':lo,'high':hi}
 for weight,key in zip(c.coef_[0],keys):
  sub=parts[key];model['parts']+=sub['parts'];model['mix'] +=[float(weight*x) for x in sub['mix']];model['bias']+=float(weight*sub['bias'])
 rec={'name':name,'keys':keys,'criterion':base_record['criterion'],'train':len(training),'paired_differences':len(pairs),'calibration':int(cal.sum()),'selection':int(dev.sum()),'feature_count':base_record['feature_count'],'selected':{'keys':keys,'low':lo,'high':hi,'validation':m}}
 options.append(((m['macro_recall']-.5*m['fpr'],m['auc'],-m['abstain']),name,model,rec));report[name]=rec['selected']
 print(name,'macro',round(m['macro_recall'],3),'fpr',round(m['fpr'],3),'paraphrase',round(m['slices']['essay-paraphrased']['fnr'],3),'news',round(m['slices']['news-paraphrased']['fnr'],3),flush=True)
for kind,analyzer in [('char',train.chargrams),('word',train.wordgrams)]:
 vec=TfidfVectorizer(analyzer=analyzer,max_features=70000 if kind=='char' else 45000,min_df=2,sublinear_tf=True)
 X=vec.fit_transform([r['canonical'] for r in training]);V=vec.transform([r['canonical'] for r in valid])
 D=X[[i for i,j in pairs]]-X[[j for i,j in pairs]]
 differences=vstack([D,-D]).tocsr();y=np.r_[np.ones(len(pairs)),np.zeros(len(pairs))]
 pw=np.array([3 if training[i]['domain'].startswith('essay') else 1 for i,j in pairs]);pw=np.r_[pw,pw];pw=pw/pw.mean()
 for strength in [1,8,32]:
  clf=LogisticRegression(C=strength,max_iter=600,fit_intercept=False).fit(differences,y,sample_weight=pw)
  coef=clf.coef_[0];part={'kind':kind,'terms':{g:[float(vec.idf_[i]),float(coef[i])] for g,i in vec.vocabulary_.items()},'bias':0}
  name=f'paired-{kind}-{strength}';parts[name]={'parts':[part],'mix':[1],'bias':0};raws[name]=np.asarray(V@coef).ravel()
  consider(name,[name]);consider('reference+'+name,['reference',name])
best_pair=max([option for option in options if option[1].startswith('paired-')],key=lambda x:x[0])[1]
other_kind='word' if 'char' in best_pair else 'char'
best_other=max([option for option in options if option[1].startswith('paired-'+other_kind)],key=lambda x:x[0])[1]
consider('paired-blend',[best_pair,best_other]);consider('reference+paired-blend',['reference',best_pair,best_other])
# Require a material improvement before adding model size and inference cost.
eligible=[options[0]]+[r for r in options[1:] if r[0][0]>=options[0][0][0]+.002]
_,name,model,record=max(eligible,key=lambda x:x[0])
(folder/'contrastive-development.json').write_text(json.dumps(report,indent=2),encoding='utf8')
if name!='reference':
 for filename in ['selected.json','selection.json','parity.json']:shutil.copy2(folder/filename,folder/('round1-'+filename))
 (folder/'selected.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf8')
 record['model_sha256']=hashlib.sha256((folder/'selected.json').read_bytes()).hexdigest()
 (folder/'selection.json').write_text(json.dumps(record,indent=2),encoding='utf8')
 # Reference model parity was checked separately. New paired coefficients use
 # exactly the same TF-IDF representation; end-to-end scores are additionally
 # compared against the independently computed aggregate development logits.
 selected_keys=record['keys']
 raw=np.column_stack([raws[k] for k in selected_keys]);c=LogisticRegression(C=.5,class_weight='balanced',max_iter=600).fit(raw[cal],yv[cal])
 p=c.predict_proba(raw)[:,1]
 samples=[{'text':r['text'],'expected':float(z)} for r,z in list(zip(valid,p))[::max(1,len(valid)//24)]]
 (folder/'parity.json').write_text(json.dumps(samples,ensure_ascii=False),encoding='utf8')
print('FINAL DEVELOPMENT SELECTION',name,flush=True)

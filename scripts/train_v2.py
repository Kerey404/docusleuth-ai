"""Compare portable models on development data; do not read final-test scores."""
import collections,hashlib,itertools,json,time
from pathlib import Path
import train
from v2_data import prepare_v2,OUT
import numpy as np
from scipy.special import expit
from sklearn.ensemble import HistGradientBoostingClassifier,ExtraTreesClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score

def weights(rows,lang):
 if lang=='ru':
  groups=[(r['domain'].split('-')[0],r['y']) for r in rows]
  counts=collections.Counter(groups)
  mass={'essay':3,'news':1,'science':1,'CoAT':2}
  w=np.array([mass[g[0]]/counts[g] for g in groups])
 else:
  groups=[(r['y'],min(4,r['n']//80)) for r in rows]
  counts=collections.Counter(groups);bins=collections.Counter(g[1] for g in groups)
  w=np.array([bins[g[1]]/counts[g] for g in groups],dtype=float)
  w*=np.array([2 if r['domain'].endswith('-MH') else 1 for r in rows])
 return w/w.mean()

def select_threshold(rows,p,target=.02):
 y=np.array([r['y'] for r in rows]);h=p[y==0]
 high=1.000001
 for candidate in sorted(set([0.0,*[float(x)+1e-10 for x in h]])):
  if (h>=candidate).mean()>target:continue
  valid=True
  for domain in set(r['domain'].split('-')[0] for r in rows):
   mask=np.array([r['y']==0 and r['domain'].split('-')[0]==domain for r in rows])
   if mask.sum()>=20 and (p[mask]>=candidate).mean()>.05:valid=False
  if valid:high=candidate;break
 low=min(float(np.quantile(p[y==1],.08)),high*.55,.30)
 return max(0,low),high

def metric(rows,p,low,high):
 y=np.array([r['y'] for r in rows]);m=train.evaluate(y,p,low,high)
 slices={}
 for domain in sorted(set(r['domain'] for r in rows)):
  mask=np.array([r['domain']==domain for r in rows])
  slices[domain]=train.evaluate(y[mask],p[mask],low,high)
 m['slices']=slices;m['auc']=float(roc_auc_score(y,p))
 recalls=[1-v['fnr'] for v in slices.values() if v['ai']>=6]
 m['macro_recall']=float(np.mean(recalls))
 return m

def tree_part(model,kind):
 if kind=='hgb':
  trees=[]
  for predictors in model._predictors:
   tree=predictors[0].nodes
   trees.append([[int(n['feature_idx']),float(n['num_threshold']),int(n['left']),int(n['right']),float(n['value']),int(n['is_leaf'])] for n in tree])
  return {'kind':'tree','featureSet':'v2','bias':float(model._baseline_prediction[0,0]),'trees':trees}
 trees=[]
 for estimator in model.estimators_:
  t=estimator.tree_
  trees.append([[int(t.feature[i]),float(t.threshold[i]),int(t.children_left[i]),int(t.children_right[i]),float(t.value[i][0][1]/t.value[i][0].sum()),int(t.children_left[i]==-1)] for i in range(t.node_count)])
 return {'kind':'forest','featureSet':'v2','bias':0,'trees':trees}

def fit(lang):
 sets=prepare_v2(lang);training=sets['train'];valid=sets['val']
 cal=np.array([train.unit('v2-cal/'+r['group'])<.43 for r in valid])
 dev=~cal;selection=[r for r,use in zip(valid,dev) if use]
 x=[r['canonical'] for r in training];xv=[r['canonical'] for r in valid]
 y=np.array([r['y'] for r in training]);yv=np.array([r['y'] for r in valid]);sw=weights(training,lang)
 folder=OUT/lang;folder.mkdir(exist_ok=True)
 candidates={};predictions={};summaries={};options=[]
 print(lang,'train',len(training),'cal',cal.sum(),'selection',dev.sum(),flush=True)
 def add(name,part,pred):
  candidates[name]=part;predictions[name]=pred
  (folder/(name+'.json')).write_text(json.dumps(part,ensure_ascii=False,separators=(',',':')),encoding='utf8')
  consider(name,[name])
 def consider(name,keys):
  raw=np.column_stack([predictions[k] for k in keys])
  calibrator=LogisticRegression(C=.5,class_weight='balanced',max_iter=500).fit(raw[cal],yv[cal])
  p=calibrator.predict_proba(raw[dev])[:,1]
  lo,hi=select_threshold(selection,p)
  m=metric(selection,p,lo,hi)
  summaries[name]={'keys':keys,'low':lo,'high':hi,'validation':m}
  # Macro-average difficult source groups so easy generations cannot mask paraphrases.
  rank=(m['macro_recall']-.5*m['fpr'],m['auc'],-m['abstain'])
  options.append((rank,name,keys,calibrator,lo,hi))
  print(lang,name,'recall',round(1-m['fnr'],3),'macro',round(m['macro_recall'],3),'FPR',round(m['fpr'],3),'AUC',round(m['auc'],3),flush=True)
  (folder/'development.json').write_text(json.dumps(summaries,indent=2),encoding='utf8')
 for kind,analyzer in [('char',train.chargrams),('word',train.wordgrams),('charCross','char')]:
  args={'analyzer':analyzer,'max_features':70000 if kind!='word' else 45000,'min_df':2,'sublinear_tf':True}
  if kind=='charCross':args.update(ngram_range=(3,5),preprocessor=train.normalize)
  vec=TfidfVectorizer(**args);X=vec.fit_transform(x);V=vec.transform(xv)
  class_sums=[np.asarray(X[y==k].sum(axis=0)).ravel()+1 for k in [0,1]]
  ratio=np.log(class_sums[1]/class_sums[1].sum())-np.log(class_sums[0]/class_sums[0].sum())
  for method,c in itertools.product(['lr','nb'],[1,8]):
   mult=ratio if method=='nb' else np.ones(X.shape[1]);Xm=X.multiply(mult).tocsr()
   classifier=LogisticRegression(C=c,max_iter=600,random_state=2421).fit(Xm,y,sample_weight=sw)
   coefficients=classifier.coef_[0]*mult
   terms={term:[float(vec.idf_[i]),float(coefficients[i])] for term,i in vec.vocabulary_.items()}
   add(f'{kind}-{method}-{c}',{'kind':kind,'terms':terms,'bias':float(classifier.intercept_[0])},np.asarray(V@coefficients).ravel()+classifier.intercept_[0])
 X=np.array([r['f2'] for r in training]);V=np.array([r['f2'] for r in valid])
 scaler=StandardScaler().fit(X)
 for c in [.1,1]:
  classifier=LogisticRegression(C=c,max_iter=1200,random_state=2421).fit(scaler.transform(X),y,sample_weight=sw)
  w=classifier.coef_[0]/scaler.scale_;bias=float(classifier.intercept_[0]-scaler.mean_@w)
  add(f'style-lr-{c}',{'kind':'style2','weights':w.tolist(),'bias':bias},V@w+bias)
 for leaves,l2 in itertools.product([7,15,31],[3,15]):
  classifier=HistGradientBoostingClassifier(max_iter=280,learning_rate=.07,max_leaf_nodes=leaves,min_samples_leaf=15 if lang=='kk' else 25,l2_regularization=l2,early_stopping=False,random_state=2421).fit(X,y,sample_weight=sw)
  add(f'hgb-{leaves}-{l2}',tree_part(classifier,'hgb'),classifier.decision_function(V))
 for leaf in [2,5]:
  classifier=ExtraTreesClassifier(n_estimators=180,max_features=.7,min_samples_leaf=leaf,max_depth=18,n_jobs=4,random_state=2421).fit(X,y,sample_weight=sw)
  p=np.clip(classifier.predict_proba(V)[:,1],1e-9,1-1e-9)
  add(f'forest-{leaf}',tree_part(classifier,'forest'),np.log(p/(1-p)))
 # Pick constituent candidates on development data, then compare constrained,
 # small combinations; all final tests remain unopened until selection is frozen.
 ranked=sorted(options,key=lambda r:r[0],reverse=True)
 lexical=[r[1] for r in ranked if any(r[1].startswith(k+'-') for k in ['word','char','charCross'])][:3]
 nonlinear=[r[1] for r in ranked if r[1].startswith(('hgb-','forest-'))][:3]
 for a,b in itertools.product(lexical,nonlinear):consider(a+'+'+b,[a,b])
 consider('lexical-vote',lexical)
 consider('mixed-vote',lexical+nonlinear[:2])
 _,name,keys,calibrator,low,high=max(options,key=lambda r:r[0])
 model={'version':'2.0','language':lang,'kind':name,'parts':[candidates[k] for k in keys],'mix':calibrator.coef_[0].tolist(),'bias':float(calibrator.intercept_[0]),'low':low,'high':high}
 model_path=folder/'selected.json';model_path.write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf8')
 selection_record={'name':name,'keys':keys,'model_sha256':hashlib.sha256(model_path.read_bytes()).hexdigest(),'criterion':'macro source recall at <=2% overall and <=5% per-domain observed human flags on selection data','train':len(training),'calibration':int(cal.sum()),'selection':int(dev.sum()),'feature_count':X.shape[1],'selected':summaries[name]}
 (folder/'selection.json').write_text(json.dumps(selection_record,indent=2),encoding='utf8')
 # Export prediction parity on development texts only.
 raw=np.column_stack([predictions[k] for k in keys]);p=calibrator.predict_proba(raw)[:,1]
 samples=[{'text':r['text'],'expected':float(z)} for r,z in list(zip(valid,p))[::max(1,len(valid)//24)]]
 (folder/'parity.json').write_text(json.dumps(samples,ensure_ascii=False),encoding='utf8')
 print('FROZEN',lang,name,selection_record['model_sha256'],flush=True)

if __name__=='__main__':
 import sys
 for lang in sys.argv[1:] or ['ru','kk']:fit(lang)

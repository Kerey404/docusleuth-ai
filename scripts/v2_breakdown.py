import json
import train
from v2_data import OUT,prepare_v2
from evaluate_v2 import scores
import numpy as np
report=json.loads((OUT/'evaluation.json').read_text())
sets=prepare_v2('ru');paths=[OUT/'baseline-ru.json',OUT/'ru/selected.json'];models=[json.loads(p.read_text(encoding='utf8')) for p in paths]
for part in ['fresh-news','fresh-science']:
 rows=[r for r in sets[part] if r['domain'].endswith('paraphrased')]
 predictions=scores(paths,rows,'ru');results={}
 for i,model in enumerate(models):results['before' if i==0 else 'after']=train.evaluate(np.array([r['y'] for r in rows]),predictions[:,i],model['low'],model['high'])
 report['ru']['tests'][part+'-paraphrased']=results
 print(part,results,flush=True)
(OUT/'evaluation.json').write_text(json.dumps(report,indent=2),encoding='utf8')

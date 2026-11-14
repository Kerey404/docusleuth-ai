"""Recalculate all displayed measurements with the shipped JavaScript models."""
import json
from pathlib import Path
import subprocess
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
import train
from v2_data import prepare_v2

report=json.loads((ROOT/"dist/models/validation.json").read_text())
results={}
for lang,loader in [("en",train.rows_en),("ru",train.rows_ru),("kk",train.rows_kk)]:
    print("Auditing",lang,flush=True)
    version2=report['languages'][lang].get('model_version')=='2.0'
    if version2:
        source=prepare_v2(lang)
        sets={p:[(r['text'],r['y'],r['f'],r['domain']) for r in rows] for p,rows in source.items()}
    else: sets=train.prepare(lang,loader())
    assert {k:len(v) for k,v in sets.items()}==report["languages"][lang]["counts"]
    all_texts=[train.normalize(r[0]) for rows in sets.values() for r in rows]
    assert len(all_texts)==len(set(all_texts)), "Repeated text between partitions"
    for rows in sets.values():
        assert all(r[1] in (0,1) for r in rows), "Unlabeled row in evaluation"
    observed={}
    if version2:
        canonical={}
        for part,rows in source.items():
            for row in rows:
                key=train.normalize(row['canonical'])
                assert key not in canonical or canonical[key]==part,'Canonical text leaked between partitions'
                canonical[key]=part
        if lang=='ru':
            for part in ['fresh-news','fresh-science']:
                sets[part+'-paraphrased']=[r for r in sets[part] if r[3].endswith('paraphrased')]
    names=["test","stress","cross"]+(["fresh-news","fresh-science","fresh-news-paraphrased","fresh-science-paraphrased"] if version2 and lang=='ru' else ['gray-MH'] if version2 else [])
    for name in names:
        if not sets[name]:
            continue
        rows=sets[name]
        payload="".join(json.dumps({"lang":lang,"text":r[0]})+"\n" for r in rows)
        reply=subprocess.run(["node",str(ROOT/"qa/score-batch.mjs")],input=payload.encode(),capture_output=True,check=True)
        predictions=train.np.asarray([json.loads(line) for line in reply.stdout.decode().splitlines()])
        assert len(predictions)==len(rows) and train.np.isfinite(predictions).all()
        labels=train.np.asarray([r[1] for r in rows])
        model=report["languages"][lang]
        actual=train.evaluate(labels,predictions,model["low"],model["high"])
        expected=model[name]
        assert {key:actual[key] for key in expected}==expected, (lang,name,actual,expected)
        observed[name]=actual
    results[lang]=observed
    print(lang,"displayed metrics reproduced",flush=True)
cases=["m² and m³","Roman Ⅳ and number ١٢٣","Cyrillic русский Қазақша","Line\nTwo","Year 2026 https://example.com"]
payload="".join(json.dumps({"lang":"en","text":s,"normalizeOnly":True})+"\n" for s in cases)
reply=subprocess.run(["node",str(ROOT/"qa/score-batch.mjs")],input=payload.encode(),capture_output=True,check=True)
actual=[json.loads(line) for line in reply.stdout.decode().splitlines()]
normalization=[{"input":s,"python":train.normalize(s),"browser":v} for s,v in zip(cases,actual) if train.normalize(s)!=v]
out={"metrics":results,"normalization_mismatches":normalization}
(ROOT/"experiments/v2/production-audit.json").write_text(json.dumps(out,indent=2,ensure_ascii=False),encoding="utf-8")
print("Normalization mismatches:",len(normalization),flush=True)
if normalization: sys.exit(1)


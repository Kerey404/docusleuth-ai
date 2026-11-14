"""Train portable linear detectors; use validation for model and threshold choice only."""
import collections
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".ml-deps"))
import numpy as np
import pyarrow.parquet as pq
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

DATA = ROOT / "data"
DEST = ROOT / "dist" / "models"
SEED = 2421
VER = "1.0"
TOKEN = re.compile(r"[^\W_]+(?:[’'-][^\W_]+)*", re.UNICODE)


def clean(s):
    if not isinstance(s, str):
        return ""
    s = unicodedata.normalize("NFC", s).strip()
    s = re.sub(r"(?m)^\s{0,5}(?:#{1,6}|[*>\u2022]+)\s*", "", s)
    s = re.sub(r"\*{1,3}|_{2,3}", "", s)
    return s.strip()


def normalize(s):
    s = unicodedata.normalize("NFC", s).lower()
    s = re.sub(r"https?://\S+", " ", s)
    s = re.sub(r"\d+", "0", s)
    return " ".join(s.split())


def chargrams(s):
    for word in normalize(s).split(" "):
        w = " " + word + " "
        for i in range(len(w)):
            for j in range(3, min(5, len(w) - i) + 1):
                yield w[i:i+j]


def wordgrams(s):
    prev = None
    for w in TOKEN.findall(normalize(s)):
        yield w
        if prev:
            yield prev + " " + w
        prev = w


def unit(key):
    return int.from_bytes(hashlib.sha256(("2421/" + str(key)).encode()).digest()[:4], "big") / 2**32


def split_for(group, train=.64, val=.18):
    u = unit(group)
    return "train" if u < train else "val" if u < train + val else "test"


def rows_en():
    # GPT prompt 2 stays out of base model fitting; exact duplicates are removed.
    for r in pq.read_table(DATA / "en-essay.parquet", columns=["text","model","generated"]).to_pylist():
        model = r["model"] or "human"
        s = clean(r["text"])
        part = split_for(s)
        if model == "gpt_prompt2":
            part = "stress" if part == "test" else "val" if part == "val" else "unused"
            if part == "unused":
                continue
        yield s,int(r["generated"]),part,model
    # HC3 is a different genre (question answers). Keep entire prompts in one
    # partition, and separate the cross-domain holdout from model selection.
    with (DATA / "en-hc3.jsonl").open(encoding="utf-8") as src:
        for line in src:
            row=json.loads(line)
            p=split_for("hc3/"+row["question"])
            part={"train":"train","val":"val","test":"cross"}[p]
            for field,y in [("human_answers",0),("chatgpt_answers",1)]:
                for value in row[field][:2]:
                    yield clean(value),y,part,"hc3-"+field


def rows_ru():
    for name, y in [("original_essay",0),("generated_essays",1),("paraphrased_essays",1)]:
        for r in json.loads((DATA / ("ru-"+name+".json")).read_text(encoding="utf-8")):
            part = split_for("ru/"+str(r["id"]))
            if name == "paraphrased_essays":
                part = "stress" if part == "test" else part
            yield clean(r["text"]),y,part,r.get("model","human")
    # A different Russian dataset provides out-of-domain stress data.
    for split,part in [("train","train"),("validation","cross")]:
        parquet = pq.ParquetFile(DATA / ("ru-"+split+".parquet"))
        for batch in parquet.iter_batches(batch_size=4096, columns=["text","label","id"]):
            for r in batch.to_pylist():
                if r["label"] in (0,1) and unit("coat/"+str(r["id"]))<(.12 if split=="train" else .9):
                    yield clean(r["text"]),int(r["label"]),part,"CoAT"


def rows_kk():
    for file,y in [("human",0),("machine",1)]:
        for line in (DATA / ("aina-"+file+".jsonl")).read_text(encoding="utf-8").splitlines():
            r=json.loads(line)
            if y and r.get("label")!="M":
                continue
            is_essay=r["domain"]=="essay"
            group = str(r["cluster"]) if r.get("cluster") is not None else (r.get("group") or r["id"])
            if r["split"]=="train":
                part="val" if unit("kk/"+group)<.28 else "train"
            elif r["split"]=="test":
                part="test" if is_essay and not r.get("heldout") else "stress" if is_essay else "cross"
            else:
                continue
            if r["domain"]=="web-ru":
                continue
            yield clean(r["text"]),y,part,r.get("generator",r["domain"])


def prepare(lang, rows):
    data = []
    seen = set()
    ordered = sorted(rows, key=lambda x: {"train":4,"val":3,"test":0,"stress":1,"cross":2}[x[2]])
    for text,y,part,domain in ordered:
        if not text or not 185 <= len(TOKEN.findall(text)) <= 2010:
            continue
        key = normalize(text)
        if key in seen:
            continue
        seen.add(key)
        data.append((text,y,part,domain))
    out = []
    for start in range(0,len(data),300):
        request = "".join(json.dumps([lang, row[0]])+"\n" for row in data[start:start+300])
        proc = subprocess.run(["node",str(ROOT/"scripts"/"style-batch.mjs")], input=request.encode(), capture_output=True)
        if proc.returncode:
            raise RuntimeError(proc.stderr.decode(errors="replace"))
        out.extend(map(json.loads,proc.stdout.decode().splitlines()))
    sets=collections.defaultdict(list)
    for row,f in zip(data,out,strict=True):
        if 200<=f["n"]<=2000 and f["lang"]:
            sets[row[2]].append((row[0],row[1],f["f"],row[3]))
    return sets


def evaluate(y,p,low,high):
    h=y==0
    a=~h
    hi=p>=high
    lo=p<=low
    u=~(hi|lo)
    tp=int((hi&a).sum())
    fp=int((hi&h).sum())
    tn=int((lo&h).sum())
    fn=int((lo&a).sum())
    hn,an=int(h.sum()),int(a.sum())
    return dict(n=len(y),human=hn,ai=an,tp=tp,fp=fp,tn=tn,fn=fn,
                fpr=fp/hn if hn else None,fnr=1-tp/an if an else None,
                forced_accuracy=float(((p>=.5)==a).mean()),
                abstain=float(u.mean()), covered_accuracy=(tp+tn)/max(1,int((~u).sum())))


def tune(y,p):
    # Risk objective: maximize AI recall under <= 5% observed human flags;
    # prefer a conservative low threshold with <= 10% missed AI labeled weak.
    h=p[y==0]
    a=p[y==1]
    high=.70
    for q in sorted(set([.70,1.01]+[float(x)+1e-7 for x in h if x>=.70])):
        if float((h>=q).mean())<=.05:
            high=q
            break
    low=.0
    for q in sorted(set([.25]+[float(x)-1e-7 for x in a if x<=.25]),reverse=True):
        if float((a<=q).mean())<=.10:
            low=max(0,q)
            break
    return low,high


def fit_lang(lang, sets):
    train=sets["train"]
    # Reduce the dominance of near-parallel generations in English.
    if lang=="en":
        grouped=collections.defaultdict(list)
        for row in train:
            grouped[row[3]].append(row)
        train=[row for key,g in grouped.items() for row in sorted(g,key=lambda r:unit(r[0]))[:(1500 if key=="human" else 340)]]
    xs,ys,fs,_=zip(*train)
    parts={}
    y_train=np.asarray(ys)
    scaler=StandardScaler().fit(fs)
    lr=LogisticRegression(C=.25,class_weight="balanced",max_iter=400,random_state=SEED).fit(scaler.transform(fs),y_train)
    raw_w=lr.coef_[0]/scaler.scale_
    parts["style"]=(dict(kind="style",weights=raw_w.tolist(),bias=float(lr.intercept_[0]-scaler.mean_@raw_w)),lambda rows: lr.decision_function(scaler.transform([r[2] for r in rows])))
    for kind,fn,cap in [("char",chargrams,28000),("word",wordgrams,18000)]:
        vec=TfidfVectorizer(analyzer=fn,max_features=cap,min_df=2,sublinear_tf=True)
        X=vec.fit_transform(xs)
        model=LogisticRegression(C=5,class_weight="balanced",max_iter=350,random_state=SEED).fit(X,y_train)
        vocab={g:[float(round(vec.idf_[i],7)),float(round(model.coef_[0,i],8))] for g,i in vec.vocabulary_.items()}
        def predict(rows, fitted=model, tfidf=vec):
            return fitted.decision_function(tfidf.transform([r[0] for r in rows]))
        parts[kind]=(dict(kind=kind,terms=vocab,bias=float(model.intercept_[0])),predict)
    valid=sets["val"]
    y=np.asarray([r[1] for r in valid])
    val_by={k:f(valid) for k,(_,f) in parts.items()}
    test_parts={name:{k:f(rows) for k,(_,f) in parts.items()} for name,rows in sets.items() if rows and name not in ["val","train"]}
    scores={}
    options=[]
    for name, keys in [("style",["style"]),("characters",["char"]),("words",["word"]),("ensemble",["style","char","word"]),("lexical blend",["char","word"])]:
        v=np.column_stack([val_by[k] for k in keys])
        # Split the development validation data again for score scaling vs. selection;
        # final test and stress are not used for tuning.
        fit=np.asarray([unit("cal/"+r[0])<.52 for r in valid])
        calibrator=LogisticRegression(C=.25,class_weight="balanced",max_iter=300,random_state=SEED).fit(v[fit],y[fit])
        p=calibrator.predict_proba(v[~fit])[:,1]
        low,high=tune(y[~fit],p)
        metric=evaluate(y[~fit],p,low,high)
        scores[name]=dict(validation=metric,low=low,high=high)
        options.append(((metric["tp"]/metric["ai"]-.20*metric["fpr"],metric["forced_accuracy"],-metric["abstain"]),name,keys,calibrator,low,high))
    _,name,keys,cal,low,high=max(options,key=lambda x:x[0])
    report=dict(chosen=name,counts={k:len(v) for k,v in sets.items()},train_used=len(train),candidates=scores,low=low,high=high)
    # Evaluate all candidates once on each fixed holdout for comparison.
    for test_name, vals in test_parts.items():
        yt=np.asarray([r[1] for r in sets[test_name]])
        for _,opt,optkeys,c,lo,hi in options:
            pred=c.predict_proba(np.column_stack([vals[k] for k in optkeys]))[:,1]
            scores[opt][test_name]=evaluate(yt,pred,lo,hi)
        report[test_name]=scores[name][test_name]
    def roundn(a): return [float(round(x,9)) for x in a]
    model=dict(version=VER,language=lang,kind=name,parts=[parts[k][0] for k in keys],mix=roundn(cal.coef_[0]),bias=float(cal.intercept_[0]),low=low,high=high)
    (DEST/(lang+".json")).write_text(json.dumps(model,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    # Portable parity checks exercise precisely the serialized model used in the app.
    values=[]
    chosen=sets["test"][:8]
    prediction=cal.predict_proba(np.column_stack([parts[k][1](chosen) for k in keys]))[:,1]
    for item,pred in zip(chosen,prediction):
        values.append({"text":item[0],"expected":float(pred)})
    (ROOT/"qa"/(lang+"-parity.json")).write_text(json.dumps(values,ensure_ascii=False),encoding="utf-8")
    return report


def main():
    DEST.mkdir(exist_ok=True)
    (ROOT/"qa").mkdir(exist_ok=True)
    targets = set(sys.argv[1:]) or {"en","ru","kk"}
    report = {"version":VER,"languages":{}}
    if targets!={"en","ru","kk"} and (DEST/"validation.json").exists():
        report=json.loads((DEST/"validation.json").read_text(encoding="utf-8"))
    for lang,loader in [("en",rows_en),("ru",rows_ru),("kk",rows_kk)]:
        if lang not in targets:
            continue
        print("Preparing",lang,flush=True)
        sets=prepare(lang,loader())
        print(lang,{k:dict(collections.Counter(r[1] for r in v)) for k,v in sets.items()},flush=True)
        report["languages"][lang]=fit_lang(lang,sets)
        (DEST/"validation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
        print(lang,report["languages"][lang]["chosen"],report["languages"][lang]["test"],flush=True)


if __name__=="__main__":
    main()


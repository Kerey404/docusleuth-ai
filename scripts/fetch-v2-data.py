"""Download data files only from a pinned public dataset revision."""
from concurrent.futures import ThreadPoolExecutor
import hashlib,json,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'experiments/v2').mkdir(parents=True,exist_ok=True)
REV='2d6477427de88ec8ad86698917fe16f49a556b81'
names={
 'ru-news-human.json':'main/news/original_news.json',
 'ru-news-generated.json':'main/news/generated_news.json',
 'ru-news-paraphrased.json':'main/news/paraphrased_news.json',
 'ru-science-human.json':'main/scientific_texts/orig_scientific.json',
 'ru-science-generated.json':'main/scientific_texts/generated_scientific.json',
 'ru-science-paraphrased.json':'main/scientific_texts/paraphrased_scientific.json',
}
def fetch(item):
 name,path=item
 target=ROOT/'data'/name
 url=f'https://raw.githubusercontent.com/CoffeBank/Ru-hard-detection-dataset/{REV}/{path}'
 if not target.exists():
  with urllib.request.urlopen(url,timeout=90) as response:data=response.read()
  parsed=json.loads(data)
  assert isinstance(parsed,list) and all(isinstance(r.get('text'),str) for r in parsed)
  target.write_bytes(data)
 data=target.read_bytes()
 result={'file':name,'url':url,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
 print(name,len(json.loads(data)),'rows',flush=True)
 return result
with ThreadPoolExecutor(max_workers=3) as pool:records=list(pool.map(fetch,names.items()))
(ROOT/'experiments/v2/new-data.json').write_text(json.dumps(records,indent=2),encoding='utf8')

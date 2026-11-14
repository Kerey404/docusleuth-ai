"""Validate current audit exports and render a contact sheet for visual review."""
from pathlib import Path
import json,os
import re
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

root=Path(os.environ.get('DOCUSLEUTH_AUDIT_DIR',str(Path(__file__).resolve().parent/'audit-2026-11-14'))).resolve()
results=[]
thumbnails=[]
for path in sorted(root.glob('*.pdf')):
    with pdfplumber.open(path) as pdf:
        text='\n'.join(page.extract_text() or '' for page in pdf.pages)
        assert text.strip(), path.name
        assert '□' not in text, f'Missing glyph in {path.name}'
        for page in pdf.pages:
            for char in page.chars:
                assert 43<=char['x0']<=char['x1']<=page.width-43, (path.name,char)
                assert 12<=char['top']<=char['bottom']<=page.height-12, (path.name,char)
        if path.stem=='long-2000':
            assert 'ФИНАЛЬНОЕ СЛОВО' in text
            assert len(pdf.pages)>=3
            original=re.findall(r"[^\W\d_]+(?:[-’'][^\W\d_]+)*",(root.parents[1]/'dist/examples/ru.txt').read_text(encoding='utf8'))
            # Check the complete user text independently of wrapping and pagination.
            expected=' '.join([original[i%len(original)] for i in range(1998)]+['ФИНАЛЬНОЕ','СЛОВО'])
            lines=text.splitlines()
            body=' '.join(line for line in lines if not line.startswith(('DOCUSLEUTH AI','DocuSleuth AI')) and not re.fullmatch(r'\d{2}',line))
            assert expected in re.sub(r'\s+',' ',body), 'Export omitted or changed body text'
        results.append({'file':path.name,'pages':len(pdf.pages),'characters':len(text),'bounds':'passed'})
    rendered=pdfium.PdfDocument(path)
    selected=[0]+([len(rendered)-1] if path.stem=='long-2000' else [])
    for i in selected:
        img=rendered[i].render(scale=.72).to_pil().convert('RGB')
        thumb=Image.new('RGB',(450,645),'#e5e9e3')
        ImageDraw.Draw(thumb).text((12,8),f'{path.name} / page {i+1}',fill='#102319')
        thumb.paste(img,((450-img.width)//2,30));thumbnails.append(thumb)
    rendered.close()
sheet=Image.new('RGB',(450*3,645*((len(thumbnails)+2)//3)),'#d1d8cf')
for i,img in enumerate(thumbnails):sheet.paste(img,((i%3)*450,(i//3)*645))
sheet.save(root/'pdf-contact-sheet.jpg',quality=90)
(root/'pdf-results.json').write_text(json.dumps(results,indent=2),encoding='utf8')
print(json.dumps(results,ensure_ascii=False,indent=2))

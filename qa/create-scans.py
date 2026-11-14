from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json
import math

root = Path(__file__).resolve().parents[1]
out = root / "qa" / "scans"
out.mkdir(exist_ok=True)
font_dir = Path("C:/Windows/Fonts")
fonts = ["arial.ttf", "times.ttf", "calibri.ttf", "georgia.ttf"]
spec = [
    ("en",0,0,False),("en",1,2,False),("en",2,-3,True),("en",3,0,False),
    ("ru",0,0,False),("ru",1,-2,False),("ru",2,2,True),
    ("kk",0,0,False),("kk",1,2,False),("kk",2,-2,True),
]
items=[]
for j, (lang, kind, angle, shadow) in enumerate(spec):
    text=(root/"dist"/"examples"/(lang+".txt")).read_text(encoding="utf-8").strip()
    p=text.split("\n\n")
    if kind:
        p=p[kind%len(p):]+p[:kind%len(p)]
        text="\n\n".join(p)
    w,h=1180,1450
    img=Image.new("RGB",(w,h),(249,248,245))
    d=ImageDraw.Draw(img)
    face=font_dir/fonts[kind]
    font=ImageFont.truetype(str(face if face.exists() else root/"data"/"NotoSans-Regular.ttf"),30+kind%2*2)
    yy=95
    for paragraph in p:
        line=""
        for word in paragraph.split():
            attempt=f"{line} {word}".strip()
            if d.textlength(attempt,font=font)>w-160:
                d.text((80,yy),line,font=font,fill=(22,22,22))
                yy+=47
                line=word
            else:
                line=attempt
        if line:
            d.text((80,yy),line,font=font,fill=(22,22,22))
        yy+=74
    if shadow:
        gradient=Image.new("RGB",(w,h)); pix=gradient.load()
        for x in range(w):
            value=round(194+61*math.sin((x/w)*math.pi*.8))
            for y in range(h):
                pix[x,y]=(value,value,min(255,value+4))
        from PIL import ImageChops
        img=ImageChops.multiply(img,gradient)
    if angle: img=img.rotate(angle,resample=Image.Resampling.BICUBIC,fillcolor=(249,248,245))
    if j==2: img=img.transpose(Image.Transpose.ROTATE_90)
    file=f"{lang}-{kind}."+("png" if kind%2==0 else "jpg")
    if file.endswith("jpg"):img.save(out/file,quality=82)
    else:img.save(out/file)
    if kind==0: img.save(root/"dist"/"examples"/(lang+".png"),optimize=True)
    items.append({"file":file,"lang":lang,"text":text,"turn":j==2,"font":fonts[kind],"angle":angle,"shadow":shadow})
(out/"manifest.json").write_text(json.dumps(items,ensure_ascii=False,indent=2),encoding="utf-8")


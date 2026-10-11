"""Inspect source assets; generate review images without changing originals."""
from pathlib import Path
import json
from PIL import Image, ImageDraw
out=Path("review")
out.mkdir(exist_ok=True)
report={}
for key,name in [("lula","lula-sprites.png"),("bolsonaro","bolsonaro-sprites.png"),("arena","cenário.png")]:
    im=Image.open(name)
    rgba=im.convert("RGBA")
    alpha=rgba.getchannel("A")
    hist=alpha.histogram()
    report[key]={"file":name,"size":list(im.size),"mode":im.mode,"alpha_extrema":list(alpha.getextrema()),"transparent_pixels":hist[0],"partial_alpha_pixels":sum(hist[1:255]),"pixels":im.width*im.height}
    thumb=rgba.copy()
    thumb.thumbnail((1536,1024))
    bg=Image.new("RGB",thumb.size,"#323946")
    bg.paste(thumb,mask=thumb.getchannel("A"))
    bg.save(out/(key+"-source.jpg"),quality=90)
    rgba.resize((min(im.width,900),round(im.height*min(im.width,900)/im.width))).save(out/(key+"-source-small.png"))
(out/"assets.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2))

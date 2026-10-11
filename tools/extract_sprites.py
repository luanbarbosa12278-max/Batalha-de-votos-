"""Extract candidate poses from the original RGBA sheets; never synthesize frames."""
from pathlib import Path
from collections import deque
import json
from PIL import Image, ImageDraw
OUT=Path("assets/fighters"); OUT.mkdir(parents=True,exist_ok=True)
REVIEW=Path("review"); REVIEW.mkdir(exist_ok=True)
# Pixel coordinates in the verified 1536 x 1024 source sheets.
BOXES={
"lula":{"idle":(7,8,109,176),"walk":(699,8,802,177),"attack":(334,365,472,527),"hurt":(7,698,123,837),"victory":(12,840,137,1016),"defeat":(800,755,994,840)},
"bolsonaro":{"idle":(8,5,117,159),"walk":(689,5,800,160),"attack":(452,168,614,314),"hurt":(125,656,245,801),"victory":(8,812,142,1016),"defeat":(764,706,919,795)}
}
report={}
tiles=[]
for who,poses in BOXES.items():
    source=Image.open(who+"-sprites.png").convert("RGBA")
    assert source.size==(1536,1024), "Coordinates require original 1536x1024 sheets"
    idle_height=None
    report[who]={}
    for state,box in poses.items():
        crop=source.crop(box)
        w,h=crop.size
        a=crop.getchannel("A")
        pixels=list(a.getdata())
        seen=bytearray(w*h); components=[]
        for i,value in enumerate(pixels):
            if value<=8 or seen[i]: continue
            seen[i]=1; q=[i]; component=[]
            while q:
                p=q.pop(); component.append(p); x=p%w; y=p//w
                for nx,ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                    n=ny*w+nx
                    if 0<=nx<w and 0<=ny<h and not seen[n] and pixels[n]>8:
                        seen[n]=1; q.append(n)
            components.append(component)
        main=max(components,key=len)
        keep=set(main)
        # Keep disconnected details only inside the principal body's bounds.
        xs=[p%w for p in main]; ys=[p//w for p in main]
        bounds=(min(xs),min(ys),max(xs)+1,max(ys)+1)
        for comp in components:
            if all(bounds[0]<p%w<bounds[2]-1 and bounds[1]<p//w<bounds[3]-1 for p in comp): keep.update(comp)
        mask=Image.new("L",(w,h))
        mask.putdata([pixels[i] if i in keep else 0 for i in range(w*h)])
        crop.putalpha(mask)
        bbox=crop.getbbox()
        touches=bool(bbox[0]==0 or bbox[1]==0 or bbox[2]==w or bbox[3]==h)
        crop=crop.crop(bbox)
        if state=="idle": idle_height=crop.height
        scale=180/idle_height
        resized=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.NEAREST)
        frame=Image.new("RGBA",(280,256))
        foot=240
        frame.alpha_composite(resized,((280-resized.width)//2,foot-resized.height))
        frame.save(OUT/(who+"-"+state+".png"))
        report[who][state]={"source_box":box,"body_bbox":bbox,"source_body_size":list(crop.size),"scale":scale,"touches_crop_edge":touches,"components":len(components),"removed_pixels":sum(len(c) for c in components)-len(keep)}
        tile=Image.new("RGB",(280,292),"#252b38")
        d=ImageDraw.Draw(tile)
        for yy in range(32,288,16):
            for xx in range(0,280,16):
                if (xx//16+yy//16)%2: d.rectangle((xx,yy,xx+15,yy+15),fill="#394154")
        tile.paste(frame,(0,32),frame)
        d.text((8,8),who+" / "+state+(" / EDGE" if touches else ""),fill="white")
        d.line((0,272,279,272),fill="#ffc859")
        tiles.append(tile)
sheet=Image.new("RGB",(280*6,292*2))
for i,tile in enumerate(tiles): sheet.paste(tile,((i%6)*280,(i//6)*292))
sheet.save(REVIEW/"crops.jpg",quality=92)
(REVIEW/"crops.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
print(json.dumps(report,indent=2))

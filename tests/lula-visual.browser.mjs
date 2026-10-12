// Run with a local server on port 8000 and Playwright installed.
// Review hooks exist only in the intercepted response, never in the game.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const output=process.env.REVIEW_OUTPUT || 'review/lula-v159';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})
});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://tiktok-live-servidor.onrender.com/**',r=>
    r.fulfill({json:{'13':0,'22':0,usuario:'@teste',status:'Conectado'}}));
  await page.route('**/src/game.js*',async r=>{
    const response=await r.fetch();
    await r.fulfill({response,body:(await response.text())+`
      window.visualReview={images,normalizeSprite,loadImage,lulaSuitPalette,
        matchBolsaSuit,isBolsaSuitPixel,LULA_BOLSA_BODY_TOP,game,
        getEffect:()=>specialEffects[0]??null,resetLocalFight,
        step(time){previousTime=0;frame(time);}};`});
  });
  await page.clock.install();
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8000/');
  await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
  assert.equal(await page.locator('.arcade-version').textContent(),'v1.6.0');

  const metrics=await page.evaluate(async()=>{
    const api=visualReview;
    const idle=await api.loadImage('./assets/fighters/lula-idle.png');
    const palette=api.lulaSuitPalette(idle);
    const paletteSet=new Set(palette.map(c=>c.join(',')));
    const result=[];
    for(const [key,file] of [['bolsaPrepare','preparo'],['bolsaSummon','invocacao'],['bolsaFinal','final']]){
      const img=await api.loadImage(`./assets/fighters/lula-bolsa-${file}.png`);
      const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
      const original=ctx.getImageData(0,0,c.width,c.height);
      const fixed=new ImageData(new Uint8ClampedArray(original.data),c.width,c.height);
      api.matchBolsaSuit(fixed,palette);
      let changed=0,protectedChanges=0,alphaChanges=0,offPalette=0;
      let minY=c.height,maxY=-1;
      for(let i=0;i<original.data.length;i+=4){
        const before=original.data.subarray(i,i+4),after=fixed.data.subarray(i,i+4);
        const differs=before.some((v,k)=>v!==after[k]);
        if(differs)changed++;
        if(!api.isBolsaSuitPixel(...before)&&differs)protectedChanges++;
        if(before[3]!==after[3])alphaChanges++;
        if(api.isBolsaSuitPixel(...before)&&!paletteSet.has([...after.subarray(0,3)].join(',')))offPalette++;
        if(before[3]>20){const y=Math.floor(i/4/c.width);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
      }
      // Observe actual drawImage arguments: same factor on X/Y, complete
      // bounds, stable crown-to-sole height and the exact same floor anchor.
      const draws=[];
      const draw=CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage=function(...args){draws.push(args);return draw.apply(this,args);};
      let frame;
      try{frame=api.normalizeSprite(img,{bodyTop:api.LULA_BOLSA_BODY_TOP[key],suitPalette:palette});}
      finally{CanvasRenderingContext2D.prototype.drawImage=draw;}
      const args=draws.findLast(a=>a.length===9);
      const [,sx,sy,sw,sh,dx,dy,dw,dh]=args;
      result.push({key,changed,protectedChanges,alphaChanges,offPalette,
        scaleX:dw/sw,scaleY:dh/sh,bodyHeight:(maxY+1-api.LULA_BOLSA_BODY_TOP[key])*dh/sh,
        feet:dy+dh,expectedFeet:frame.height-16,
        complete:sx>=0&&sy===minY&&sy+sh===maxY+1&&dx>=0&&dy>=0&&dx+dw<=frame.width&&dy+dh<=frame.height,
        width:frame.width,height:frame.height});
    }
    return result;
  });
  for(const m of metrics){
    assert.ok(m.changed>10000,`${m.key}: suit recolored`);
    assert.equal(m.protectedChanges,0);assert.equal(m.alphaChanges,0);assert.equal(m.offPalette,0);
    assert.ok(Math.abs(m.scaleX-m.scaleY)<1e-12,`${m.key}: uniform scaling`);
    assert.ok(Math.abs(m.bodyHeight-180)<1e-9,`${m.key}: stable body height`);
    assert.equal(m.feet,m.expectedFeet);assert.ok(m.complete,`${m.key}: no clipping`);
  }
  const hp=()=>page.evaluate(()=>visualReview.game.hp.b);
  assert.equal(await hp(),500);
  await page.locator('#game').click();
  await page.keyboard.press('e');
  const start=await page.evaluate(()=>visualReview.getEffect().start);
  for(const [name,age] of [['preparo',100],['invocacao',400],['antes-impacto',729],['impacto',730],['final',900],['idle',1050]]){
    await page.evaluate(t=>visualReview.step(t),start+age);
    assert.equal(await hp(),age<730?500:475,`${name}: unchanged 25 HP at 730ms`);
    await page.locator('#game').screenshot({path:`${output}/${name}.png`});
  }
  assert.equal(await page.evaluate(()=>visualReview.getEffect()),null);
  await page.evaluate(t=>visualReview.step(t),start+1399);
  assert.ok(await page.locator('#specialL').isDisabled());
  await page.evaluate(t=>visualReview.step(t),start+1400);
  assert.ok(await page.locator('#specialL').isEnabled());

  // Re-run the full real animation using click and the browser clock.
  await page.reload();await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  await page.locator('#specialL').click();
  await page.clock.runFor(1450);
  assert.equal(await hp(),475);
  assert.equal(await page.evaluate(()=>visualReview.getEffect()),null);
  assert.ok(await page.locator('#specialL').isEnabled());
  await page.setViewportSize({width:844,height:390});
  await page.locator('#arcadeFullscreen').click();
  await page.clock.runFor(100);
  await page.locator('.arcade-special').click();
  await page.clock.runFor(400);
  await page.screenshot({path:`${output}/mobile-fullscreen.png`});
  await page.clock.runFor(1050);
  assert.equal(await hp(),450);
  assert.equal(await page.evaluate(()=>visualReview.getEffect()),null);
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/checks.json`,JSON.stringify({passed:true,metrics,
    checks:['selective palette; protected pixels and alpha identical','uniform scale; 180px body height',
      'complete raised arm and feet','keyboard E; button; fullscreen controls at 844x390',
      '25 damage once at 730ms; 1400ms cooldown; return to idle','no JavaScript errors'],
    limitations:['TikTok API mocked','mobile viewport emulated; no physical phone']},null,2));
  console.log('Lula visual/browser regression checks passed.');
}finally{await browser.close();}

import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.REVIEW_OUTPUT||'review/god-mode';
const url=process.env.BASE_URL||'http://127.0.0.1:8000/';
await mkdir(output,{recursive:true});
const browser=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
const errors=[],checks=[];
try{
  for(const [name,width,height,touch,fallback] of [
    ['desktop',1440,1000,false,false],['mobile-landscape',844,390,true,false],
    ['mobile-portrait',390,844,true,true],['mobile-small',667,375,true,true]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:touch});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.route('https://tiktok-live-servidor.onrender.com/**',r=>r.fulfill({json:{'13':0,'22':0,usuario:'@teste',status:'Conectado'}}));
    await page.route('**/src/game.js*',async r=>{
      const response=await r.fetch();await r.fulfill({response,body:(await response.text())+`
        window.godReview={game,setGod,resetLocalFight,effects:()=>specialEffects,
          kb:()=>({l:lulaKnockback,b:bolsonaroKnockback})};`});
    });
    await page.clock.install();await page.goto(url);
    await page.waitForFunction(()=>document.querySelector('#loading').hidden);
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+1000));
    assert.equal(await page.locator('.arcade-version').textContent(),'v1.6.0');
    if(touch){
      if(fallback)await page.evaluate(()=>document.querySelector('#arcadeArena').requestFullscreen=undefined);
      await page.locator('#arcadeFullscreen').tap();await page.clock.runFor(100);
      assert.ok(await page.evaluate(()=>!!document.fullscreenElement||document.querySelector('#arcadeArena').classList.contains('arcade-fallback-fullscreen')));
    }else{
      await page.locator('#usuario').fill('');await page.locator('#usuario').press('r');
      assert.equal(await page.locator('#godL').getAttribute('aria-pressed'),'false');
      await page.locator('#game').click();await page.keyboard.press('r');await page.keyboard.press('u');
    }
    const press=async selector=>{await page.locator(selector)[touch?'tap':'click']();};
    if(touch){await press('#godL');await press('#godB');}
    assert.deepEqual(await page.evaluate(()=>godReview.game.god),{l:true,b:true});
    if(!touch)await page.locator('#arcadeArena').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    const metrics=await page.evaluate(()=>{
      const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
      const buttons=['godL','godB'].map(id=>{const el=document.getElementById(id),r=rect(el);
        return {id,...r,reachable:document.elementFromPoint(r.x+r.w/2,r.y+r.h/2)===el};});
      return {buttons,hud:rect(document.querySelector('.hud')),topbar:rect(document.querySelector('.arcade-topbar'))};
    });

    for(const b of metrics.buttons){assert.ok(b.reachable,`${name}: ${b.id} reachable`);assert.ok(b.h>=44);assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=height);}
    // Exercise actual mouse/touch/keyboard controls; no direct casts through hooks.
    if(touch){
      await press('.arcade-special');await press('.arcade-special');
      await press('#arcadeSwitch');await press('.arcade-special');await press('.arcade-special');
    }else{
      await page.keyboard.press('e');await page.keyboard.press('e');
      await page.keyboard.press('p');await page.keyboard.press('p');
    }
    assert.equal(await page.evaluate(()=>godReview.effects().length),4);
    if(name==='desktop'||name==='mobile-landscape'){
      await page.keyboard.press('d');
      assert.ok(await page.locator('#debateOverlay').isVisible());
      await page.clock.runFor(3000);
      assert.deepEqual(await page.evaluate(()=>godReview.game.hp),{l:500,b:500});
      await press('#debateSkip');
      assert.ok(await page.locator('#debateOverlay').isHidden());
    }
    await page.clock.runFor(800);
    assert.deepEqual(await page.evaluate(()=>godReview.game.hp),{l:450,b:450});
    assert.deepEqual(await page.evaluate(()=>godReview.kb()),{l:null,b:null});
    await page.screenshot({path:`${output}/${name}.png`});
    await press('#godL');assert.deepEqual(await page.evaluate(()=>godReview.game.god),{l:false,b:true});
    if(touch)await press('.arcade-power');else await page.keyboard.press('o');
    await page.clock.runFor(500);assert.equal(await page.evaluate(()=>godReview.game.hp.l),430);
    assert.ok(await page.evaluate(()=>godReview.kb().l));
    if(name==='desktop'||name==='mobile-landscape'){
      await page.evaluate(()=>{godReview.resetLocalFight();godReview.setGod('l',true);godReview.setGod('b',true);});
      await page.keyboard.press('2');await page.keyboard.press('e');await page.keyboard.press('w');
      await page.clock.runFor(800);
      assert.equal(await page.evaluate(()=>godReview.game.hp.b),500);
      await page.clock.runFor(4300);await page.keyboard.press('w');await page.clock.runFor(500);
      assert.equal(await page.evaluate(()=>godReview.game.hp.b),480);
    }
    checks.push({name,passed:true,metrics});await context.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/checks.json`,JSON.stringify({passed:true,checks,errors,limitations:['TikTok mocked','Mobile emulated in Chromium; no physical iOS/Android device']},null,2));
  console.log('GOD controls, damage, stacking, independent stun, desktop and mobile fullscreen passed.');
}finally{await browser.close();}

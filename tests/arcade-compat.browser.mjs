import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const base=process.env.TEST_URL||'http://127.0.0.1:8000', output=process.env.TEST_OUTPUT||'review/menu-v1.7';
const checks=[],errors=[];
await mkdir(output,{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('https://tiktok-live-servidor.onrender.com/**',route=>route.fulfill({json:{'13':0,'22':0,usuario:'@teste',status:'Conectado'}}));
  const source=await readFile(new URL('../src/game.js',import.meta.url),'utf8');
  await context.route('**/src/game.js?*',route=>route.fulfill({contentType:'text/javascript',body:source+
    '\nwindow.__battle={game,receiveLiveCommand,liveQueue,specials:()=>specialEffects.map(effect=>({...effect})),shieldUntil};'}));
  await context.addInitScript(()=>{
    // Exercise the iOS-style fallback path and track the actual combat RAF chain.
    Element.prototype.requestFullscreen=undefined;
    const raf=window.requestAnimationFrame.bind(window);
    let pending=0;window.maxCombatFrames=0;
    window.requestAnimationFrame=callback=>{
      if(callback.name!=='frame')return raf(callback);
      pending++;window.maxCombatFrames=Math.max(window.maxCombatFrames,pending);
      return raf(now=>{pending--;callback(now);});
    };
  });
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForFunction(()=>window.streetVoteArcade.ready);
  await page.locator('[data-menu-action="settings"]').tap();
  await page.locator('#menuFullscreen').tap();
  await page.waitForFunction(()=>document.querySelector('#arcadeArena').classList.contains('arcade-fallback-fullscreen'));
  await page.locator('#menuBack').tap();
  await page.locator('[data-menu-action="play"]').tap();
  await page.waitForFunction(()=>window.streetVoteArcade.mode==='arena');
  await page.locator('.arcade-action[data-action="special"]').tap();
  await page.locator('#openArcadeMenu').tap();
  const paused=await page.evaluate(()=>({hp:window.__battle.game.hp.b,effect:window.__battle.specials()[0]}));
  assert.equal(paused.effect.type,'bolsaPancada');
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(()=>window.__battle.game.hp.b),paused.hp);
  await page.locator('[data-menu-action="play"]').tap();
  await page.waitForFunction(()=>window.streetVoteArcade.mode==='arena');
  await page.waitForFunction(()=>window.__battle.game.hp.b===475);
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(()=>window.__battle.game.hp.b),475);
  checks.push('Touch + fallback fullscreen + mid-special pause/resume causes exactly one hit');
  await page.locator('#arcadeSwitch').tap();
  await page.locator('.arcade-action[data-action="punch"]').tap();
  await page.waitForFunction(()=>window.streetVoteArcade.stats.attacksB===1);
  await page.locator('#openArcadeMenu').tap();
  await page.locator('[data-menu-action="debate"]').tap();
  await page.waitForFunction(()=>window.streetVoteArcade.mode==='debate');
  assert.equal(await page.locator('#debateOverlay button:visible').count(),1);
  await page.locator('#debateSkip').tap();
  await page.waitForFunction(()=>window.streetVoteArcade.mode==='arena');
  assert.equal(await page.locator('#arcadeArena').evaluate(el=>el.classList.contains('arcade-fallback-fullscreen')),true);
  await page.locator('#openArcadeMenu').tap();
  assert.equal(await page.evaluate(()=>window.maxCombatFrames),1);
  checks.push('Touch fighter switch and PULAR retain fullscreen; only one combat animation chain');
  const queue=await page.evaluate(()=>{
    const battle=window.__battle;
    for(let i=0;i<505;i++)battle.receiveLiveCommand({side:'l',action:'shot',count:1});
    const bounded=battle.liveQueue.length;
    battle.liveQueue.forEach(command=>command.expires=performance.now()-1);
    battle.receiveLiveCommand({side:'b',action:'shield',count:1});
    return {bounded,length:battle.liveQueue.length,action:battle.liveQueue[0].action};
  });
  assert.deepEqual(queue,{bounded:500,length:1,action:'shield'});
  checks.push('SSE queue capacity and expiration remain bounded during menu');
  await page.locator('[data-menu-action="settings"]').tap();await page.locator('#menuFullscreen').tap();
  await page.waitForFunction(()=>!document.querySelector('#arcadeArena').classList.contains('arcade-fallback-fullscreen'));
  await page.locator('#menuBack').tap();
  for(const [width,height] of [[320,568],[390,844],[667,375],[844,390]]){
    await page.setViewportSize({width,height});
    assert.equal(await page.locator('[data-menu-action="help"]').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true);
  }
  checks.push('All five options fit small portrait and landscape screens');
  const blocked=await context.newPage();blocked.on('pageerror',error=>errors.push(error.message));
  await blocked.addInitScript(()=>{
    Storage.prototype.getItem=()=>{throw Error('blocked storage');};
    Storage.prototype.setItem=()=>{throw Error('blocked storage');};
  });
  await blocked.goto(base);await blocked.waitForFunction(()=>window.streetVoteArcade.ready);
  await blocked.locator('[data-menu-action="settings"]').tap();
  await blocked.locator('#restoreSettings').tap();
  assert.match(await blocked.locator('#settingsSaved').textContent(),/indisponível/);
  await blocked.locator('#menuBack').tap();await blocked.locator('[data-menu-action="play"]').tap();
  await blocked.waitForFunction(()=>window.streetVoteArcade.mode==='arena');
  checks.push('Blocked localStorage keeps menu/settings/game usable with an honest status');
  assert.deepEqual(errors,[]);
  await writeFile(output+'/compat-results.json',JSON.stringify({passed:true,checks,errors,scope:'Chromium touch emulation and fullscreen API disabled; not physical Android/iPhone or Safari.'},null,2));
  checks.forEach(check=>console.log('PASS '+check));
}finally{await browser.close();}


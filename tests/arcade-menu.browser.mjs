import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
const base=process.env.TEST_URL||'http://127.0.0.1:8000';
const output=process.env.TEST_OUTPUT||'review/menu-v1.7';
await mkdir(output,{recursive:true});
const checks=[],errors=[],failedRequests=[];
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)failedRequests.push(response.url());});
let counts={'13':0,'22':0,usuario:'@teste',status:'Conectado'}, polls=0, configured=false;
await context.route('https://tiktok-live-servidor.onrender.com/**',async route=>{
  if(route.request().url().endsWith('/configurar')){
    assert.equal(route.request().headers()['x-admin-password'],'local-test-only');
    assert.deepEqual(route.request().postDataJSON(),{usuario:'@outra'});
    configured=true;counts={'13':0,'22':0,usuario:'@outra',status:'Conectado'};
    return route.fulfill({json:{usuario:'@outra'}});
  }
  polls++;return route.fulfill({json:counts});
});
const stats=()=>page.evaluate(()=>window.streetVoteArcade.stats);
const hp=()=>page.evaluate(()=>['hpL','hpB'].map(id=>+document.getElementById(id).parentElement.getAttribute('aria-valuenow')));
async function play(){
  await page.locator('[data-menu-action="play"]').click();
  await page.waitForFunction(()=>window.streetVoteArcade.mode==='arena');
}
async function menu(){await page.locator('#openArcadeMenu').click();}
async function back(){await page.locator('#menuBack').click();}
async function panel(action){await page.locator('[data-menu-action="'+action+'"]').click();}
async function setRange(id,value){await page.locator(id).fill(String(value));await page.locator(id).dispatchEvent('input');}
function passed(name){checks.push(name);console.log('PASS '+name);}
try{
  await page.goto(base);
  await page.waitForFunction(()=>window.streetVoteArcade.ready);
  assert.equal(await page.locator('#arcadeMenu').isVisible(),true);
  assert.equal(await page.locator('[data-menu-action="play"]').evaluate(el=>el===document.activeElement),true);
  for(const key of ['q','w','e','i','o','p','1','2','d'])await page.keyboard.press(key);
  assert.deepEqual(await hp(),[500,500]);assert.equal((await stats()).attacks,0);
  assert.equal((await stats()).debates,0);
  passed('First screen, focus and fight/debate keyboard isolation');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.locator('[data-menu-action="debate"]').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('End');await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-menu-screen="help"]').isVisible(),true);
  assert.equal(await page.locator('.help-fighters img').evaluateAll(images=>images.every(image=>image.complete&&image.naturalWidth>0)),true);
  await back();
  await page.screenshot({path:output+'/menu-desktop.png'});
  passed('Keyboard navigation and existing tutorial assets');
  counts['13']=3;
  await page.waitForFunction(()=>document.querySelector('#votesL').textContent==='3');
  assert.deepEqual(await hp(),[500,500]);assert.equal((await stats()).attacks,0);
  assert.ok(polls>=2);
  const transitionStart=Date.now();
  await page.locator('[data-menu-action="play"]').click();
  await page.waitForFunction(()=>!document.querySelector('#roundTransition').hidden);
  await page.screenshot({path:output+'/transition.png'});
  await page.waitForFunction(()=>window.streetVoteArcade.mode==='arena');
  const transitionMs=Date.now()-transitionStart;
  assert.ok(transitionMs>=1000&&transitionMs<2600,transitionMs);
  await page.waitForFunction(()=>window.streetVoteArcade.stats.attacksL===3);
  await page.waitForFunction(()=>document.querySelector('#lifeB').textContent==='HP 470/500');
  passed('Live polling while menu is paused, 1.5s transition and queued votes resumed');
  const before=await stats();
  for(const [key,field] of [['q','attacksL'],['i','attacksB'],['w','attacksL'],['o','attacksB'],['e','attacksL'],['p','attacksB']]){
    const previous=(await stats())[field];
    await page.keyboard.press(key);
    await page.waitForFunction(({field,previous})=>window.streetVoteArcade.stats[field]>previous,{field,previous});
    await page.waitForTimeout(1600);
  }
  assert.equal((await stats()).attacks,before.attacks+6);
  passed('All six keyboard attacks counted only when executed');
  await page.keyboard.press('2');
  await menu();
  const pausedHP=await hp(),pausedStats=await stats();
  await page.waitForTimeout(1200);
  assert.deepEqual(await hp(),pausedHP);assert.equal((await stats()).playMs,pausedStats.playMs);
  await panel('stats');
  assert.equal(await page.locator('#stat-attacks').textContent(),String(pausedStats.attacks));
  await back();await play();
  assert.equal(await page.locator('#shieldB').getAttribute('aria-pressed'),'true');
  assert.deepEqual(await hp(),pausedHP);
  passed('Resume preserves health, shield duration and local counters; menu time excluded');
  await menu();await panel('settings');
  await setRange('#setting-master',35);await setRange('#setting-voices',20);await setRange('#setting-effects',10);
  await page.locator('#setting-animations').uncheck();
  await page.locator('#setting-particles').uncheck();
  assert.ok(Math.abs(await page.evaluate(()=>window.streetVoteArcade.volume('voices'))-.07)<1e-10);
  assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('svf-no-particles')),true);
  // Fullscreen must show the menu within the fullscreen arena.
  await page.locator('#menuFullscreen').click();
  await page.waitForFunction(()=>!!document.fullscreenElement||document.querySelector('#arcadeArena').classList.contains('arcade-fallback-fullscreen'));
  assert.equal(await page.locator('#arcadeMenu').isVisible(),true);
  await page.screenshot({path:output+'/settings-fullscreen.png'});
  await page.locator('#menuFullscreen').click();
  await page.waitForFunction(()=>!document.fullscreenElement&&!document.querySelector('#arcadeArena').classList.contains('arcade-fallback-fullscreen'));
  await page.reload();await page.waitForFunction(()=>window.streetVoteArcade.ready);
  assert.equal(await page.evaluate(()=>window.streetVoteArcade.settings.master),.35);
  assert.equal((await stats()).attacks,pausedStats.attacks);
  await panel('settings');
  assert.equal(await page.locator('#setting-voices').inputValue(),'20');
  await page.locator('#restoreSettings').click();
  assert.equal(await page.locator('#setting-master').inputValue(),'80');
  await back();
  passed('Volumes, motion, particles, fullscreen, persisted settings/statistics and restore defaults');
  const beforeDebate=await stats();
  await panel('debate');
  await page.waitForFunction(()=>!document.querySelector('#debateOverlay').hidden);
  assert.equal(await page.locator('#debateOverlay button:visible').count(),1);
  assert.equal(await page.locator('.arcade-touch-controls').isVisible(),false);
  await page.screenshot({path:output+'/debate.png'});
  const debateHP=await hp();
  for(const key of ['q','p','1','2'])await page.keyboard.press(key);
  assert.deepEqual(await hp(),debateHP);
  // Enter must operate the focused PULAR button.
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#debateOverlay').hidden);
  assert.deepEqual(await hp(),debateHP);
  assert.equal((await stats()).debates,beforeDebate.debates+1);
  passed('Debate original scene, one PULAR control, keyboard skip and no skip hit-kill');
  await menu();await panel('debate');
  // Accelerate the existing MP3 ending events, preserving all real cutscene code.
  await page.evaluate(()=>{
    const active=new Set();
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      const result=play.call(this);
      if(this.src.includes('-debate-')&&!active.has(this)){
        active.add(this);setTimeout(()=>this.dispatchEvent(new Event('ended')),40);
      }
      return result;
    };
  });
  // First clip already started; wait for its natural ending, then the remaining clips accelerate.
  await page.waitForFunction(()=>document.querySelector('#lifeB').textContent==='HP 0/500',{},{timeout:35000});
  assert.equal((await stats()).winsL,beforeDebate.winsL+1);
  assert.equal(await page.locator('#svfObliterator').evaluate(el=>el.classList.contains('active')),true);
  passed('Completed debate preserves lightning, KO and one recorded victory');
  await page.waitForTimeout(2800);
  await menu();await play();
  await page.locator('#usuario').fill('@outra');await page.locator('#senha').fill('local-test-only');
  await page.locator('#connect').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Conta selecionada'));
  assert.ok(configured);assert.equal(await page.locator('#senha').inputValue(),'');
  assert.deepEqual(await hp(),[500,500]);assert.equal((await stats()).winsL,beforeDebate.winsL+1);
  passed('Render configuration contract and local statistics survive fight reset');
  await menu();
  for(const [width,height] of [[390,844],[844,390],[320,568],[667,375]]){
    await page.setViewportSize({width,height});
    await page.screenshot({path:output+'/menu-'+width+'x'+height+'.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('#arcadeMenu').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    for(const action of ['stats','settings','help']){
      await panel(action);
      assert.equal(await page.locator('#arcadeMenu').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
      await back();
    }
  }
  passed('Portrait and landscape menu/panels at 320, 390, 667 and 844 pixels');
  await page.setViewportSize({width:390,height:844});
  await play();
  await page.locator('#arcadeFullscreen').click();
  await page.waitForFunction(()=>!!document.fullscreenElement||document.querySelector('#arcadeArena').classList.contains('arcade-fallback-fullscreen'));
  await page.screenshot({path:output+'/arena-mobile-fullscreen.png'});
  const prev=(await stats()).attacksL;
  await page.locator('.arcade-action[data-action="punch"]').click();
  await page.waitForFunction(prev=>window.streetVoteArcade.stats.attacksL>prev,prev);
  await page.locator('#arcadeSwitch').click();
  const prevB=(await stats()).attacksB;
  await page.locator('.arcade-action[data-action="punch"]').click();
  await page.waitForFunction(prev=>window.streetVoteArcade.stats.attacksB>prev,prevB);
  passed('Mobile buttons and fighter switching still execute attacks');
  // The same-origin live transport is simulated; server SSE/authentication has separate tests.
  const live=await context.newPage();
  live.on('pageerror',error=>errors.push(error.message));
  await live.addInitScript(()=>{
    window.EventSource=class {
      constructor(url){window.testLive={url,send:data=>this.onmessage?.({data:JSON.stringify(data)})};}
    };
  });
  await live.goto(base+'/?live=1');await live.waitForFunction(()=>window.streetVoteArcade.ready);
  assert.equal(await live.evaluate(()=>window.testLive.url),'/live/stream');
  const liveBefore=await live.evaluate(()=>window.streetVoteArcade.stats.attacksB);
  await live.evaluate(()=>{window.testLive.send({side:'b',action:'shot',count:2});window.testLive.send({side:'l',action:'shield',count:1});});
  assert.equal(await live.evaluate(()=>window.streetVoteArcade.stats.attacksB),liveBefore);
  await live.locator('[data-menu-action="play"]').click();
  await live.waitForFunction(()=>window.streetVoteArcade.mode==='arena');
  await live.waitForFunction(()=>document.querySelector('#votesB').textContent==='2');
  await live.waitForFunction(()=>document.querySelector('#lifeL').textContent==='HP 500/500');
  assert.equal(await live.locator('#shieldL').getAttribute('aria-pressed'),'true');
  await live.close();
  passed('SSE receiver queues commands in menu and dispatches after resume');
  assert.deepEqual(errors,[]);
  assert.deepEqual(failedRequests,[]);
  passed('No uncaught JavaScript errors or missing assets');
  await writeFile(output+'/browser-results.json',JSON.stringify({passed:true,checks,transitionMs,errors,failedRequests,tiktok:'Mocked API and simulated EventSource. No real live was configured.'},null,2));
}finally{await browser.close();}


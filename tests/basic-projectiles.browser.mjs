import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://tiktok-live-servidor.onrender.com/**',r=>r.fulfill({json:{'13':0,'22':0,usuario:'@test',status:'Conectado'}}));
 // Test-only observation, never shipped in game.js.
 await page.route('**/src/game.js*',async r=>r.fulfill({contentType:'text/javascript',body:await readFile('src/game.js','utf8')+`\nwindow.testFight={game,basicShots,resetLocalFight,startHadouken,startBolsaPancada,startTaok,activateShield,paint,get effects(){return specialEffects;}};`}));
 await page.goto('http://127.0.0.1:8000/');
 await page.waitForFunction(()=>document.querySelector('#loading').hidden);
 assert.equal(await page.locator('#attackL span').textContent(),'PICANHA');
 assert.equal(await page.locator('#attackB span').textContent(),'BANDEIRA');
 await page.keyboard.press('q');
 await page.waitForFunction(()=>testFight.basicShots.items.length===1);
 assert.equal(await page.evaluate(()=>testFight.game.hp.b),500);
 await page.screenshot({path:'/tmp/svf-projectile.png'});
 await page.waitForFunction(()=>testFight.game.hp.b===490);
 await page.keyboard.press('i');await page.waitForFunction(()=>testFight.game.hp.l===490);
 await page.evaluate(()=>{testFight.resetLocalFight();testFight.activateShield('b');});
 await page.keyboard.press('q');await page.waitForTimeout(500);
 assert.equal(await page.evaluate(()=>testFight.game.hp.b),500);
 assert.equal(await page.evaluate(()=>testFight.basicShots.items.length),0);
 // Pause a projectile mid-flight during Debate Final and resume without time jump.
 await page.evaluate(()=>testFight.resetLocalFight());await page.keyboard.press('q');
 await page.waitForFunction(()=>testFight.basicShots.items.length===1);
 const paused=await page.evaluate(()=>{window.dispatchEvent(new Event('streetvote:debate-start'));return testFight.basicShots.items[0].x;});
 await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>testFight.basicShots.items[0].x),paused);
 await page.evaluate(()=>window.dispatchEvent(new Event('streetvote:debate-end')));
 await page.waitForFunction(()=>testFight.game.hp.b===490);
 // Specials retain their damage, including while basic projectiles are in flight.
 for(const [method,side,target,damage] of [['startHadouken','l','b',20],['startHadouken','b','l',20],['startBolsaPancada',null,'b',25],['startTaok',null,'l',25]]){
   await page.evaluate(([method,side])=>{testFight.resetLocalFight();testFight[method](side);},[method,side]);
   await page.waitForFunction(([target,damage])=>testFight.game.hp[target]===500-damage,[target,damage]);
 }
 await page.evaluate(()=>{testFight.resetLocalFight();testFight.game.hp.b=10;});
 await page.keyboard.press('q');await page.waitForFunction(()=>testFight.game.phase==='ko');
 assert.equal(await page.evaluate(()=>testFight.basicShots.items.length),0);
 await page.keyboard.press('i');assert.equal(await page.evaluate(()=>testFight.game.pending),0);
 await page.waitForFunction(()=>testFight.game.round===2,{},{timeout:9000});
 assert.equal(await page.evaluate(()=>testFight.game.hp.l),500);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>testFight.resetLocalFight());
 await page.locator('#attackL').click();await page.waitForFunction(()=>testFight.game.hp.b===490);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Exercise the mobile fullscreen fallback and the selected fighter's existing action button.
 await page.evaluate(()=>{document.querySelector('#arcadeArena').requestFullscreen=()=>Promise.reject(new Error('test fallback'));});
 await page.locator('#arcadeFullscreen').click();
 await page.setViewportSize({width:844,height:390});
 await page.locator('#arcadeSwitch').click();
 assert.equal(await page.locator('[data-action="punch"] span').textContent(),'BANDEIRA');
 await page.locator('[data-action="punch"]').click();
 await page.waitForFunction(()=>testFight.game.hp.l===490);
 await page.screenshot({path:'/tmp/svf-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('PASS: Q/I, delayed collision, shields, debate pause/resume, four specials, KO/next round, mobile click, fullscreen fallback, fighter switch, no JS errors.');
}finally{await browser.close();}

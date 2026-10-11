import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';

await mkdir('review/bolsa-pancada',{recursive:true});
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://tiktok-live-servidor.onrender.com/**',route=>
    route.fulfill({json:{'13':0,'22':0,usuario:'@teste',status:'Conectado'}}));
  await page.goto('http://127.0.0.1:8000/');
  await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  const hp=side=>page.locator('#hp'+side).evaluate(el=>
    Number(el.parentElement.getAttribute('aria-valuenow')));
  const waitHP=(side,value)=>page.waitForFunction(({side,value})=>
    Number(document.querySelector('#hp'+side).parentElement.getAttribute('aria-valuenow'))===value,
    {side,value});
  const special=page.locator('#specialL');
  assert.equal(await special.isEnabled(),true);
  assert.match(await special.textContent(),/BOLSA PANCADA/);
  await page.locator('#usuario').fill('');
  await page.locator('#usuario').press('e');
  assert.equal(await hp('B'),100);
  assert.equal(await special.isEnabled(),true);
  await page.locator('#game').click();
  await page.keyboard.press('e');
  await page.waitForTimeout(180);
  await page.locator('#game').screenshot({path:'review/bolsa-pancada/invocacao.png'});
  await page.waitForTimeout(320);
  await page.locator('#game').screenshot({path:'review/bolsa-pancada/queda.png'});
  await waitHP('B',75);
  await page.locator('#game').screenshot({path:'review/bolsa-pancada/impacto.png'});
  assert.equal(await special.isDisabled(),true);
  await page.keyboard.press('e');
  await page.waitForTimeout(1100);
  assert.equal(await hp('B'),75);
  for(const value of [50,25,0]){
    await page.waitForFunction(()=>!document.querySelector('#specialL').disabled);
    await special.click();
    await waitHP('B',value);
  }
  assert.match(await page.locator('#message').textContent(),/K.O./);
  assert.equal(await page.locator('#winsL').textContent(),'1 ROUNDS');
  await page.keyboard.press('e');
  assert.equal(await special.isDisabled(),true);
  await page.locator('#game').screenshot({path:'review/bolsa-pancada/vitoria.png'});
  await page.waitForFunction(()=>document.querySelector('#round').textContent==='02');
  assert.equal(await hp('B'),100);
  page.on('dialog',dialog=>dialog.accept());
  await page.locator('#reset').click();
  await page.keyboard.press('q');
  await waitHP('B',90);
  await page.keyboard.press('i');
  await waitHP('L',90);
  await page.waitForTimeout(700);
  await page.keyboard.press('w');
  await page.waitForTimeout(100);
  assert.equal(await special.isDisabled(),true);
  await page.waitForTimeout(850);
  await page.keyboard.press('o');
  await waitHP('L',70);
  await page.locator('#volumeMusica').evaluate(el=>{
    el.value='37';el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await page.locator('#musicaFundo').evaluate(el=>el.volume),.37);
  assert.equal(await page.locator('#volumeValor').textContent(),'37%');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#loading').hidden);
  await special.click();
  await waitHP('B',75);
  assert.deepEqual(errors,[]);
  await page.route('**/assets/fighters/bolsa-pancada-glove.png',route=>route.abort());
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#loading').textContent.includes('Não foi possível'));
  assert.equal(await special.isDisabled(),true);
  console.log('Browser checks passed: sprites, E, KO, rounds, Q/W/I/O, volume, reduced motion and missing asset. TikTok mocked.');
}finally{
  await browser.close();
}

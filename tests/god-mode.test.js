import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Fight,MAX_HP,HIT_MS,ATTACK_MS,KO_MS} from '../src/engine.js';

function setup(){
  let now=1000;
  const listeners={},elements=new Map();
  const ctx=new Proxy({},{get:(o,k)=>o[k]??(o[k]=k==='measureText'?()=>({width:10}):()=>{})});
  class Element{
    constructor(){this.disabled=false;this.textContent='';this.style={};this.label={textContent:''};this.attrs={};this.parentElement={setAttribute(){}};this.classList={toggle(){}};}
    closest(){return null;} addEventListener(){} getContext(){return ctx;}
    querySelector(){return this.label;} setAttribute(k,v){this.attrs[k]=v;}
    click(){if(!this.disabled)this.onclick?.();}
  }
  const document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);},
    addEventListener(k,fn){(listeners[k]??=[]).push(fn);}};
  class Audio{constructor(src){this.src=src;}cloneNode(){return new Audio(this.src);}addEventListener(){}pause(){}play(){return Promise.resolve();}}
  const gameSource=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
  const engineSource=readFileSync(new URL('../src/engine.js',import.meta.url),'utf8');
  const source=engineSource.replace(/export /g,'')+gameSource.slice(0,gameSource.lastIndexOf('// INICIALIZAÇÃO')).replace(/^import .*;\s*/m,'');
  const window={addEventListener(k,fn){(listeners[k]??=[]).push(fn);}};
  const api=new Function('document','Element','Audio','performance','matchMedia','requestAnimationFrame','window',source+`
    ready=true;
    return {game,setGod,startBolsaPancada,startTaok,startHadouken,updateSpecialEffects,resetLocalFight,activateShield,frame,
      effects:()=>specialEffects,kb:()=>({l:lulaKnockback,b:bolsonaroKnockback}),
      positions:()=>({l:lulaX,b:bolsonaroX}),buttons:()=>{updateBolsaButton(performance.now());updateTaokButton(performance.now());}};
  `)(document,Element,Audio,{now:()=>now},()=>({matches:false}),()=>{},window);
  return {...api,el:id=>document.getElementById(id),time(t){now=t;api.updateSpecialEffects(now);api.buttons();},
    clock(t){now=t;},event(type){for(const fn of listeners[type]??[])fn();},
    key(key,extra={}){for(const fn of listeners.keydown??[])fn({key,target:new Element(),preventDefault(){},...extra});}};
}

for(const side of ['l','b']){
  const rival=side==='l'?'b':'l';
  test(`${side}: GOD punches bypass recovery and paused specials, without granting rival immunity`,()=>{
    const f=new Fight();f.setGod(side,true);
    f.enqueue(side==='l'?3:0,side==='b'?3:0,true);
    f.advance(HIT_MS-1,{pauseNormal:true});assert.equal(f.hp[rival],MAX_HP);
    f.advance(1,{pauseNormal:true});assert.equal(f.hp[rival],MAX_HP-30);
    f.enqueue(side==='l'?1:0,side==='b'?1:0);f.advance(HIT_MS,{pauseNormal:true});
    assert.equal(f.hp[rival],MAX_HP-40);assert.equal(f.manual[side],3);assert.equal(f.votes[side],1);
    assert.equal(f.god[rival],false);
  });
  test(`${side}: GOD clears current stun; damage stays normal; disable restores stun and cooldown`,()=>{
    const a=setup();a.startHadouken(rival);a.time(1500);
    assert.equal(a.game.hp[side],480);assert.ok(a.kb()[side]);
    a.setGod(side,true);assert.equal(a.kb()[side],null);
    const position=a.positions()[side];
    a.setGod(rival,true);a.startHadouken(rival);a.time(2000);
    assert.equal(a.game.hp[side],460);assert.equal(a.kb()[side],null);assert.equal(a.positions()[side],position);
    a.startHadouken(side);a.startHadouken(side);
    assert.equal(a.effects().filter(e=>e.side===side).length,2);
    a.setGod(side,false);a.startHadouken(rival);a.time(2500);
    assert.equal(a.game.hp[side],440);assert.ok(a.kb()[side]);
    a.time(4000); // frame clears expired reactions; reset also guarantees clean state.
    a.resetLocalFight();
    const cast=side==='l'?a.startBolsaPancada:a.startTaok;
    cast();a.time(4750);a.time(5399);cast();assert.equal(a.effects().length,0);
    a.time(5400);cast();assert.equal(a.effects().length,1);
  });
}

test('both GOD specials stack; each hit lands once; no cross-player stun',()=>{
  const a=setup();a.setGod('l',true);a.setGod('b',true);
  for(let i=0;i<3;i++){a.startBolsaPancada();a.startTaok();}
  a.startHadouken('l');a.startHadouken('b');
  assert.equal(a.effects().length,8);assert.equal(a.el('specialL').disabled,false);
  a.time(1750);assert.deepEqual(a.game.hp,{l:405,b:405});assert.deepEqual(a.kb(),{l:null,b:null});
  a.time(1800);assert.deepEqual(a.game.hp,{l:405,b:405});
  a.setGod('l',false);assert.equal(a.game.god.b,true);
  a.startHadouken('b');a.time(2300);assert.ok(a.kb().l);assert.equal(a.kb().b,null);
});

test('GOD can act during normal punches and rival specials, without cancelling either',()=>{
  const a=setup();a.startTaok();const first=a.effects()[0];
  a.setGod('l',true);a.startBolsaPancada();a.startHadouken('l');
  assert.equal(a.effects()[0],first);assert.equal(a.effects().length,3);
  a.game.enqueue(1,1);a.game.advance(100,{pauseNormal:true});
  assert.equal(a.game.hp.b,490);assert.equal(a.game.hp.l,500);assert.equal(a.game.pending,1);
  a.time(1750);assert.deepEqual(a.game.hp,{l:475,b:445});assert.equal(a.kb().l,null);assert.ok(a.kb().b);
});

test('GOD still loses by KO, counts victory once and cancels old spells',()=>{
  const a=setup();a.setGod('l',true);a.setGod('b',true);a.game.hp.l=20;
  a.startTaok();a.startTaok();a.startBolsaPancada();a.time(1750);
  assert.equal(a.game.phase,'ko');assert.equal(a.game.wins.b,1);assert.equal(a.game.hp.l,0);
  assert.equal(a.effects().length,0);a.startHadouken('l');assert.equal(a.effects().length,0);
  a.game.advance(KO_MS);assert.equal(a.game.round,2);assert.deepEqual(a.game.hp,{l:500,b:500});
  assert.deepEqual(a.game.god,{l:true,b:true});a.time(5000);assert.equal(a.game.hp.l,500);
  a.resetLocalFight();assert.deepEqual(a.game.god,{l:false,b:false});assert.equal(a.effects().length,0);
});

test('large GOD vote batches survive KO without dropping counts or inflating votes',()=>{
  const f=new Fight();f.setGod('l',true);f.enqueue(1200,0);
  for(let i=0;i<24;i++){f.advance(HIT_MS);f.advance(KO_MS);}
  assert.equal(f.delivered,1200);assert.equal(f.pending,0);assert.equal(f.wins.l,24);assert.equal(f.votes.l,1200);
});

test('enabling GOD releases an existing punch from a special pause without duplicating damage',()=>{
  const f=new Fight();f.enqueue(1,1);f.advance(50);f.setGod('l',true);
  assert.equal(f.attack,'b');f.advance(50,{pauseNormal:true});
  assert.equal(f.hp.b,490);assert.equal(f.hp.l,500);
  f.advance(50);assert.equal(f.hp.l,490);assert.equal(f.delivered,2);
  f.setGod('b',true);f.advance(ATTACK_MS);assert.equal(f.delivered,2);
});

test('both GOD fighters can draw by KO and unlanded normal votes survive a special KO',()=>{
  const f=new Fight();f.setGod('l',true);f.setGod('b',true);f.hp={l:10,b:10};
  f.enqueue(1,1);f.advance(HIT_MS);assert.equal(f.winner,'draw');assert.deepEqual(f.wins,{l:0,b:0});
  f.advance(KO_MS);f.setGod('l',false);f.setGod('b',false);f.enqueue(1,0);f.advance(0);
  f.hp.l=0;f.enterKO();assert.equal(f.pending,1);f.advance(KO_MS+ATTACK_MS);assert.equal(f.delivered,3);
});

test('keyboard R/U toggles independently and ignores repeat, modifiers and text input',()=>{
  const a=setup();a.key('r');assert.deepEqual(a.game.god,{l:true,b:false});
  a.key('R',{repeat:true});a.key('r',{ctrlKey:true});assert.equal(a.game.god.l,true);
  a.key('U');assert.deepEqual(a.game.god,{l:true,b:true});
  a.key('r');assert.deepEqual(a.game.god,{l:false,b:true});
  assert.equal(a.el('godB').attrs['aria-pressed'],'true');
});

test('existing shields block GOD damage independently and GOD does not extend shields',()=>{
  const f=new Fight();f.setGod('l',true);f.shieldActive.b=true;f.enqueue(10,0);f.advance(HIT_MS);
  assert.equal(f.hp.b,500);assert.equal(f.delivered,10);assert.equal(f.godBlockedHits.b,10);
  f.shieldActive.b=false;f.enqueue(1,0);f.advance(HIT_MS);assert.equal(f.hp.b,490);
  const a=setup();a.setGod('l',true);a.setGod('b',true);a.activateShield('b');
  a.startBolsaPancada();a.startTaok();a.startHadouken('l');a.time(1800);
  assert.deepEqual(a.game.hp,{l:475,b:500});assert.deepEqual(a.kb(),{l:null,b:null});
  a.time(6000);a.startHadouken('l');a.time(6500);assert.equal(a.game.hp.b,480);
});

test('debate pauses every GOD special and blocks new casts until resuming',()=>{
  const a=setup();a.setGod('l',true);a.setGod('b',true);
  a.startBolsaPancada();a.startTaok();a.event('streetvote:debate-start');
  a.startHadouken('l');assert.equal(a.effects().length,2);
  a.clock(4000);a.frame(4000);assert.deepEqual(a.game.hp,{l:500,b:500});
  a.event('streetvote:debate-end');
  assert.ok(a.effects().every(sp=>sp.start===4000));
  a.time(4730);assert.deepEqual(a.game.hp,{l:500,b:475});
  a.time(4750);assert.deepEqual(a.game.hp,{l:475,b:475});
  a.startHadouken('l');assert.equal(a.effects().length,3);
});

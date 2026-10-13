import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

function harness(){
  const gameSource=readFileSync(new URL('../src/game.js',import.meta.url),'utf8');
  const engineSource=readFileSync(new URL('../src/engine.js',import.meta.url),'utf8');
  const check=(condition,message)=>{if(!condition) throw new Error(message);};
  let now=0;
  const events={};
  const draws=[];
  const elements=new Map();
  const context=new Proxy({},{
    get(target,key){
      if(key==='createRadialGradient'||key==='createLinearGradient')return ()=>({addColorStop(){}});
      if(key==='measureText') return text=>({width:text.length*9});
      if(key==='drawImage') return (...args)=>draws.push(args);
      if(!(key in target)) target[key]=()=>{};
      return target[key];
    },
    set(target,key,value){target[key]=value;return true;}
  });
  class Element {
    constructor(id){this.id=id;this.disabled=false;this.textContent='';this.value='';
      this.style={};this.classList={toggle(){}};this.attrs={};this.label={textContent:''};
      this.parentElement={setAttribute:(key,value)=>this.attrs[key]=value};
    }
    closest(){return null;}
    addEventListener(){}
    querySelector(){return this.label;}
    getContext(){return context;}
    setAttribute(key,value){this.attrs[key]=value;}
    click(){if(!this.disabled) this.onclick?.();}
  }
  const document={
    getElementById(id){
      if(!elements.has(id)) elements.set(id,new Element(id));
      return elements.get(id);
    },
    addEventListener(type,fn){(events[type]??=[]).push(fn);},
    activeElement:null
  };
  class Audio {constructor(src){this.src=src;this.paused=true;}cloneNode(){return new Audio(this.src);}addEventListener(){}pause(){}play(){return Promise.resolve();}}
  const startup=gameSource.lastIndexOf('// INICIALIZAÇÃO');
  check(startup>0,'Initialization marker missing');
  const source=engineSource.replace(/export /g,'')+'\n'+
    gameSource.slice(0,startup).replace(/^import .*;\s*/m,'');
  const api=new Function('document','Element','Audio','performance','matchMedia',
    'requestAnimationFrame','Image','confirm','window',source+
    '\nreturn {game,images,soundGroups,frame,startBolsaPancada,startHadouken,startTaok,activateShield,basicShots,resetLocalFight,'+
    'updateSpecialEffects,updateBolsaButton,drawBolsaPancada,fighter,'+
    'enable(){ready=true;},effect:()=>specialEffects[0]??null,impact:()=>bolsaImpact};'
  )(document,Element,Audio,{now:()=>now},()=>({matches:false}),()=>{},
    class {},()=>true,{addEventListener(type,fn){(events[type]??=[]).push(fn);}});
  api.enable();
  for(const k of ['bolsaGlove','lulaVictory','bolsonaroVictory','l','b','hadoukenPose','lulaHadoukenPose','bolsaPrepare','bolsaSummon','bolsaFinal','taokPrepare','taokShout','taokFinal','knockback','bolsonaroKnockbackPose'])api.images[k]={width:280,height:256};
  return {...api, tick(t){now=t;api.frame(t);}, key(key){for(const fn of events.keydown??[])fn({key,target:new Element('target'),preventDefault(){}});}, event(type){for(const fn of events[type]??[])fn();}, click(id){document.getElementById(id).click();}};
}
test('actual game Q/I and button handlers fire, collide, block, pause and resume',()=>{
 const a=harness();a.tick(1);a.key('q');a.tick(101);
 assert.equal(a.basicShots.items.length,1);assert.equal(a.game.hp.b,500);
 a.tick(201);assert.equal(a.game.hp.b,500);a.tick(301);assert.equal(a.game.hp.b,490);
 a.click('attackB');a.tick(401);a.tick(501);a.tick(601);assert.equal(a.game.hp.l,490);
 a.resetLocalFight();a.activateShield('b');a.key('q');a.tick(701);a.tick(801);a.tick(901);
 assert.equal(a.game.hp.b,500);assert.equal(a.basicShots.items.length,0);
 a.resetLocalFight();a.key('q');a.tick(1001);a.event('streetvote:debate-start');
 const x=a.basicShots.items[0].x;a.tick(2001);assert.equal(a.basicShots.items[0].x,x);
 a.key('i');assert.equal(a.game.pending,0);a.event('streetvote:debate-end');
 a.tick(2002);a.tick(2102);a.tick(2202);assert.equal(a.game.hp.b,490);
});
test('actual game specials keep damage and KO cancels projectiles without changing victory timing',()=>{
 const a=harness();let now=1;a.tick(now);
 for(const [method,side,target,damage] of [['startHadouken','l','b',20],['startHadouken','b','l',20],['startBolsaPancada',null,'b',25],['startTaok',null,'l',25]]){
  a.resetLocalFight();a[method](side);for(let i=0;i<12;i++)a.tick(now+=100);
  assert.equal(a.game.hp[target],500-damage,method);
 }
 a.resetLocalFight();a.game.hp.b=10;a.key('q');for(let i=0;i<4;i++)a.tick(now+=100);
 assert.equal(a.game.phase,'ko');assert.equal(a.game.wins.l,1);assert.equal(a.basicShots.items.length,0);
 a.key('i');assert.equal(a.game.pending,0);
 for(let i=0;i<66;i++)a.tick(now+=100);
 assert.equal(a.game.round,2);assert.deepEqual(a.game.hp,{l:500,b:500});
});

import test from 'node:test';
import {readFileSync} from 'node:fs';

function verifyBolsa(gameSource,engineSource){
  const check=(condition,message)=>{if(!condition) throw new Error(message);};
  let now=0;
  const events={};
  const draws=[];
  const elements=new Map();
  const context=new Proxy({},{
    get(target,key){
      if(key==='measureText') return text=>({width:text.length*9});
      if(key==='drawImage') return (...args)=>draws.push(args);
      if(!(key in target)) target[key]=()=>{};
      return target[key];
    },
    set(target,key,value){target[key]=value;return true;}
  });
  class Element {
    constructor(id){this.id=id;this.disabled=false;this.textContent='';this.value='';
      this.style={};this.attrs={};this.label={textContent:''};
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
  class Audio {constructor(src){this.src=src;this.paused=true;}pause(){}play(){return Promise.resolve();}}
  const startup=gameSource.lastIndexOf('// INICIALIZAÇÃO');
  check(startup>0,'Initialization marker missing');
  const source=engineSource.replace(/export /g,'')+'\n'+
    gameSource.slice(0,startup).replace(/^import .*;\s*/m,'');
  const api=new Function('document','Element','Audio','performance','matchMedia',
    'requestAnimationFrame','Image','confirm',source+
    '\nreturn {game,images,soundGroups,frame,startBolsaPancada,resetLocalFight,'+
    'updateBolsaPancada,updateBolsaButton,drawBolsaPancada,fighter,'+
    'enable(){ready=true;},effect:()=>specialEffect,impact:()=>bolsaImpact};'
  )(document,Element,Audio,{now:()=>now},()=>({matches:false}),()=>{},
    class {},()=>true);
  api.enable();
  const button=document.getElementById('specialL');
  function tick(time){now=time;api.frame(now);}
  function key(key){
    for(const fn of events.keydown??[]) fn({key,target:new Element('target'),preventDefault(){}});
  }
  function reset(time){now=time;api.resetLocalFight();}
  api.images.bolsaGlove={width:160,height:175};
  api.images.bolsaPose={pose:'bolsa'};

  key('e');
  check(api.effect()?.type==='bolsaPancada','E must start Bolsa Pancada');
  check(button.disabled,'Button disabled during cast');
  api.fighter('l',0);
  check(draws.some(args=>args[0]===api.images.bolsaPose),'Lula must render summoning sprite');
  api.game.enqueue(2,1);
  tick(350);
  tick(600);
  const gloveDraws=draws.filter(args=>args[0]===api.images.bolsaGlove);
  check(gloveDraws.length===2,'Glove rendered during fall');
  check(gloveDraws[0][1]===gloveDraws[1][1],'Glove must keep fixed X');
  check(gloveDraws[1][2]>gloveDraws[0][2],'Glove must fall vertically');
  tick(729);
  check(api.game.hp.b===100,'No damage before impact');
  check(api.game.pending===3,'Votes queued intact during special');
  tick(730);
  check(api.game.hp.b===75,'Impact must deal 25 HP');
  check(!!api.impact(),'Impact particles created');
  tick(800);
  check(api.game.hp.b===75,'Damage only once');
  api.startBolsaPancada();
  check(api.effect().start===0,'Cannot restart active special');
  tick(1050);
  check(api.game.pending===2 && api.game.phase==='attack','Vote queue resumes');
  reset(2000);
  button.click();
  check(api.effect()?.type==='bolsaPancada','Mouse button starts special');
  tick(3100);
  tick(6999);
  check(button.disabled,'Cooldown lasts full 5 seconds');
  api.startBolsaPancada();
  check(api.effect()===null,'Direct call cannot bypass cooldown');
  tick(7000);
  check(!button.disabled,'Cooldown ends at 5 seconds');
  key('E');
  check(api.effect()?.start===7000,'Uppercase E works');

  reset(8000);
  api.game.hp.b=20;
  key('e');
  tick(8730);
  check(api.game.hp.b===0,'Damage clamped to zero');
  check(api.game.phase==='ko' && api.game.winner==='l','Lethal special causes Lula KO win');
  check(api.game.wins.l===1,'Exactly one round win');
  const wins=api.game.wins.l;
  key('e');api.startBolsaPancada();api.updateBolsaPancada(9999);
  check(api.effect()===null && api.game.wins.l===wins,'Special blocked during KO');
  for(let t=8830;t<=11130;t+=100) tick(t);
  check(api.game.round===2 && api.game.hp.b===100,'Automatic next round preserved');
  check(api.impact()===null,'Old effect removed');

  reset(15000);
  key('e');tick(15300);reset(15301);tick(16000);
  check(api.game.hp.b===100 && api.effect()===null,'Reset cancels in-flight damage');
  check(!button.disabled,'Reset clears cooldown');
  key('w');
  check(api.effect()?.type==='shoryuken','W preserves Shoryuken');
  api.startBolsaPancada();
  check(api.effect()?.type==='shoryuken','Cannot interrupt another special');
  reset(17000);key('o');tick(17500);
  check(api.game.hp.l===80,'O preserves Hadouken damage');
  reset(18000);key('q');key('i');
  check(api.game.manual.l===1 && api.game.manual.b===1,'Q and I preserve manual punches');
  tick(18001);
  api.startBolsaPancada();
  check(api.effect()===null,'Cannot interrupt a punch');
  reset(19000);key('e');api.game.round++;api.updateBolsaPancada(20000);
  check(api.effect()===null && api.game.hp.b===100,'Stale special cannot hit a new round');
  const audioCount=Object.values(api.soundGroups).flat().length;
  check(audioCount===28,'All 28 voices preserved, plus background music in HTML');
  return '17 scenarios passed: controls, pose, vertical fall, 25 HP, single hit, queue, cooldown, KO, rounds and reset';
}

test('Bolsa Pancada integrates with the existing Fight engine and controls',()=>{
  verifyBolsa(
    readFileSync(new URL('../src/game.js',import.meta.url),'utf8'),
    readFileSync(new URL('../src/engine.js',import.meta.url),'utf8')
  );
});

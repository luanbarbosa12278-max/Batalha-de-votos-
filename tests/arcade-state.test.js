import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/arcade-state.js',import.meta.url),'utf8');
function setup(initial={},blocked=false){
  let now=0;
  const stored=new Map(Object.entries(initial)),events={},gains=[];
  const document={hidden:false,documentElement:{classList:{toggle(){}}},addEventListener(type,fn){(events[type]??=[]).push(fn);}};
  class AudioContext{
    constructor(){this.currentTime=0;this.state='running';this.destination={};}
    resume(){return Promise.resolve();}
    createMediaElementSource(){return {connect(){},disconnect(){}};}
    createGain(){const gain={value:0,setValueAtTime(value){this.value=value;}};gains.push(gain);return {gain,connect(){},disconnect(){}};}
  }
  const window={matchMedia:()=>({matches:false,addEventListener(){}}),AudioContext,addEventListener(type,fn){(events[type]??=[]).push(fn);},dispatchEvent(event){events[event.type]?.forEach(fn=>fn(event));}};
  vm.runInNewContext(source,{window,document,localStorage:{getItem:key=>stored.get(key)??null,setItem(key,value){if(blocked)throw Error('quota');stored.set(key,value);}},performance:{now:()=>now},Event:class {constructor(type){this.type=type;}}});
  return {api:window.streetVoteArcade,stored,gains,document,time(value){now=value;},event(type){events[type]?.forEach(fn=>fn());}};
}
test('invalid saved preferences and stats are sanitized without preventing startup',()=>{
  const {api}=setup({'svf-arcade-settings-v1':'{"master":7,"voices":"bad","particles":false}','svf-arcade-stats-v1':'{"attacksL":-3,"winsL":2,"playMs":"bad"}'});
  assert.equal(api.settings.master,1);assert.equal(api.settings.voices,1);assert.equal(api.settings.particles,false);
  assert.equal(api.stats.attacks,0);assert.equal(api.stats.winsL,2);assert.equal(api.stats.playMs,0);
  assert.equal(setup({'svf-arcade-settings-v1':'broken json'}).api.settings.master,.8);
});
test('settings restore and storage failures keep controls working',()=>{
  const {api}=setup({},true);
  api.setSettings({master:.3,voices:0,animations:false});
  assert.equal(api.volume('voices'),0);assert.equal(api.reducedMotion,true);assert.equal(api.storageAvailable,false);
  api.restoreSettings();assert.equal(api.settings.master,.8);assert.equal(api.settings.animations,true);
});
test('attacks, debates and victories persist independently from fight resets',()=>{
  const {api,stored}=setup();
  api.attack('l');api.attack('b');api.attack('invalid');api.debate();
  api.observeWins({l:1,b:0});api.observeWins({l:1,b:0});
  api.resetWinBaseline();api.observeWins({l:1,b:2});api.flush();
  const stats=JSON.parse(stored.get('svf-arcade-stats-v1'));
  assert.equal(stats.attacksL,1);assert.equal(stats.attacksB,1);assert.equal(stats.debates,1);
  assert.equal(stats.winsL,2);assert.equal(stats.winsB,2);
  assert.equal(setup(Object.fromEntries(stored)).api.stats.attacks,2);
});
test('play clock excludes menu, transition and hidden tab time',()=>{
  const a=setup();a.api.tick(0);a.time(1000);a.api.tick(1000);
  assert.equal(a.api.stats.playMs,0);
  a.api.setMode('transition');a.time(2500);a.api.tick(2500);assert.equal(a.api.stats.playMs,0);
  a.api.setMode('arena');a.time(4500);a.api.tick(4500);assert.equal(a.api.stats.playMs,2000);
  a.document.hidden=true;a.event('visibilitychange');a.time(20000);a.api.tick(20000);
  assert.equal(a.api.stats.playMs,2000);
  a.document.hidden=false;a.event('visibilitychange');a.time(20001);a.api.tick(20001);
  a.time(21001);a.api.tick(21001);assert.equal(a.api.stats.playMs,3000);
  a.api.setMode('menu');a.time(30000);a.api.tick(30000);assert.equal(a.api.stats.playMs,3000);
});
test('real media gain multiplies master, channel and track levels, including music',()=>{
  const a=setup(),voice={volume:1},music={volume:1};
  a.api.registerAudio(voice,'voices',.5);assert.equal(voice.volume,.4);
  a.api.unlockAudio();assert.equal(voice.volume,1);assert.equal(a.gains[0].value,.4);
  a.api.registerAudio(music,'music',.28);assert.equal(a.gains[1].value,.22400000000000003);
  a.api.setSettings({master:.5,voices:.2,effects:0});
  assert.equal(a.gains[0].value,.05);assert.equal(a.gains[1].value,.14);assert.equal(a.api.volume('effects'),0);
  a.api.setSettings({master:0});assert.equal(a.gains[0].value,0);assert.equal(a.gains[1].value,0);
});
test('state transitions are idempotent and reject unknown modes',()=>{
  const a=setup();let changes=0;
  a.api.subscribe(()=>changes++);
  a.api.setMode('menu');a.api.setMode('missing');assert.equal(changes,0);
  a.api.setMode('arena');assert.equal(changes,1);assert.equal(a.api.paused,false);
  a.api.setMode('debate');assert.equal(a.api.paused,true);
});


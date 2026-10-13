import test from 'node:test';
import assert from 'node:assert/strict';
import {Fight,BasicProjectiles,ATTACK_MS,HIT_MS,DAMAGE,MAX_HP,KO_MS} from '../src/engine.js';
const boxes={l:{x:290,y:205,width:90,height:285},b:{x:670,y:205,width:90,height:285}};
function setup(){const f=new Fight(),p=new BasicProjectiles(f);f.onBasicFire=s=>p.fire(s,s==='l'?368:592);return {f,p};}
test('basic attack preserves cadence but damage waits for real swept collision',()=>{
 const {f,p}=setup();f.enqueue(2,0,true);f.advance(HIT_MS);
 assert.equal(f.hp.b,MAX_HP);assert.equal(p.items.length,1);
 p.advance(0,boxes);p.advance(100,boxes);assert.equal(f.hp.b,MAX_HP);
 p.advance(100,boxes);assert.equal(f.hp.b,MAX_HP-DAMAGE);assert.equal(p.items.length,0);
 p.advance(100,boxes);assert.equal(f.hp.b,MAX_HP-DAMAGE);
 f.advance(ATTACK_MS);assert.equal(p.items.length,1);assert.equal(f.manual.l,2);
});
test('both characters: shield and invulnerability consume the projectile without damage',()=>{
 for(const side of ['l','b'])for(const mode of ['shield','invulnerable']){
  const {f,p}=setup(),target=side==='l'?'b':'l';
  if(mode==='shield')f.shieldActive[target]=true;else f.invulnerable={[target]:true};
  p.fire(side,side==='l'?368:592);p.advance(0,boxes);p.advance(250,boxes);
  assert.equal(f.hp[target],MAX_HP);assert.equal(p.items.length,0);assert.equal(f.delivered,1);
 }
});
test('misses above the hurtbox leave arena; moving target controls collision',()=>{
 const {f,p}=setup();p.fire('l',368,50);p.advance(0,boxes);p.advance(500,boxes);
 assert.equal(p.items.length,0);assert.equal(f.hp.b,MAX_HP);
 p.fire('l',368);p.advance(0,boxes);p.advance(200,{...boxes,b:{...boxes.b,x:860}});
 assert.equal(f.hp.b,MAX_HP);p.advance(100,{...boxes,b:{...boxes.b,x:860}});assert.equal(f.hp.b,490);
});
test('KO and round change cancel stale projectiles; reset cancels flight',()=>{
 const {f,p}=setup();p.fire('b',592);f.hp.b=0;f.enterKO();p.advance(100,boxes);
 assert.equal(p.items.length,0);assert.equal(f.hp.l,MAX_HP);assert.equal(f.wins.l,1);
 f.advance(KO_MS);p.advance(1000,boxes);assert.equal(f.hp.l,MAX_HP);
 p.fire('b',592);f.round++;p.advance(100,boxes);assert.equal(p.items.length,0);
 p.fire('l',368);f.reset();p.clear();p.advance(1000,boxes);assert.equal(f.hp.b,MAX_HP);
});
test('simultaneous lethal shots draw once; queued votes stay available',()=>{
 const {f,p}=setup();f.hp={l:10,b:10};p.fire('l',368);p.fire('b',592);
 f.enqueue(5,6);p.advance(0,boxes);p.advance(200,boxes);
 assert.equal(f.winner,'draw');assert.equal(f.delivered,2);assert.equal(f.pending,11);assert.equal(p.items.length,0);
});

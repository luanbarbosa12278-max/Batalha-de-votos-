import test from 'node:test';
import assert from 'node:assert/strict';
import {Fight,VoteTracker,ATTACK_MS,KO_MS,HIT_MS,MAX_HP,DAMAGE} from '../src/engine.js';
test('repeated comments are independent hits, including more than 500',()=>{
 const f=new Fight();f.enqueue(1200,0);
 f.advance(1200*ATTACK_MS+120*KO_MS);
 assert.equal(f.delivered,1200);assert.equal(f.pending,0);assert.equal(f.wins.l,24);assert.equal(f.round,25);
});
test('comments queued during KO carry into the next round',()=>{
 const f=new Fight();f.enqueue(MAX_HP/DAMAGE,0);f.advance(MAX_HP/DAMAGE*ATTACK_MS);
 assert.equal(f.phase,'ko');f.enqueue(0,4);f.advance(KO_MS+4*ATTACK_MS);
 assert.equal(f.round,2);assert.equal(f.hp.l,MAX_HP-40);assert.equal(f.delivered,MAX_HP/DAMAGE+4);
});
test('both sides in a snapshot alternate fairly',()=>{
 const f=new Fight();f.enqueue(2,2);f.advance(4*ATTACK_MS);
 assert.deepEqual(f.hp,{l:MAX_HP-20,b:MAX_HP-20});assert.equal(f.delivered,4);
});
test('damage occurs at impact, not the beginning of movement',()=>{
 const f=new Fight();f.enqueue(1,0);f.advance(HIT_MS-1);assert.equal(f.hp.b,MAX_HP);
 f.advance(1);assert.equal(f.hp.b,MAX_HP-DAMAGE);f.advance(100);assert.equal(f.hp.b,MAX_HP-DAMAGE);
});
test('first snapshot is a baseline; duplicate snapshot adds no hits',()=>{
 const t=new VoteTracker();assert.equal(t.accept({'13':30,'22':8,usuario:'@a'}).l,0);
 assert.equal(t.accept({'13':33,'22':8,usuario:'@a'}).l,3);
 assert.equal(t.accept({'13':33,'22':8,usuario:'@a'}).l,0);
});
test('account switch establishes a new baseline',()=>{
 const t=new VoteTracker();t.baseline('@a',100,100);
 assert.equal(t.accept({'13':4,'22':8,usuario:'@b'}).changed,true);
 assert.equal(t.accept({'13':6,'22':8,usuario:'@b'}).l,2);
});
test('server counter restart counts the new values without negative deltas',()=>{
 const t=new VoteTracker();t.baseline('@a',100,100);
 const d=t.accept({'13':3,'22':2,usuario:'@a'});
 assert.equal(d.reset,true);assert.equal(d.l,3);assert.equal(d.b,2);
});
test('malformed snapshots do not change the baseline',()=>{
 const t=new VoteTracker();t.baseline('@a',4,4);
 for(const value of [-1,1.5,null,'oops',Infinity])assert.throws(()=>t.accept({'13':value,'22':4,usuario:'@a'}));
 assert.equal(t.accept({'13':5,'22':4,usuario:'@a'}).l,1);
});
test('manual hits do not inflate the live comment counters',()=>{
 const f=new Fight();f.enqueue(1,0,true);f.advance(ATTACK_MS);
 assert.equal(f.votes.l,0);assert.equal(f.manual.l,1);assert.equal(f.hp.b,MAX_HP-DAMAGE);
});
test('reset clears in-flight hit and KO state',()=>{
 const f=new Fight();f.enqueue(20,0);f.advance(10*ATTACK_MS);f.reset();f.advance(KO_MS);
 assert.equal(f.round,1);assert.equal(f.pending,0);assert.equal(f.hp.b,MAX_HP);assert.equal(f.wins.l,0);
});
test('large batches are compressed',()=>{
 const f=new Fight();f.enqueue(1000000,1000000);assert.equal(f.batches.length,1);assert.equal(f.pending,2000000);
});

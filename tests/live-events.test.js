import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveReceiver,giftMap,GIFT_ACTIONS,normalizeTikTok} from '../server/live-events.js';
import {createLiveServer} from '../server/server.js';

test('installed connector v3 protobuf fields normalize without losing IDs',()=>{
  const r=new LiveReceiver({redRose:'100'});
  const id='90071992547409930001';
  assert.equal(r.receive(normalizeTikTok('chat',{common:{msgId:id},content:'13'})).id,id);
  assert.equal(r.receive(normalizeTikTok('gift',{common:{msgId:'gift'},giftId:'100',gift:{type:1},repeatEnd:0,repeatCount:2})),null);
  assert.equal(r.receive(normalizeTikTok('gift',{common:{msgId:'gift'},giftId:'100',gift:{type:1},repeatEnd:1,repeatCount:2})).count,2);
});

test('exact comments, unknown gifts and invalid data',()=>{
  const r=new LiveReceiver();
  assert.deepEqual(r.receive({type:'chat',id:'a',comment:' 13 '}),{id:'a',action:'shot',side:'l',count:1});
  assert.equal(r.receive({type:'chat',id:'a',comment:'13'}),null);
  assert.equal(r.receive({type:'chat',id:'b',comment:'22'}).side,'b');
  for(const comment of ['vote 13','1322','13 22','22!'])assert.equal(r.receive({type:'chat',id:comment,comment}),null);
  assert.equal(r.receive({type:'chat',id:42,comment:'13'}),null);
  assert.throws(()=>giftMap({redRose:'1',whiteRose:'1'}));
  assert.throws(()=>giftMap({unknown:'1'}));
});
test('all six mappings require explicit IDs; streak only executes on final',()=>{
  const config=Object.fromEntries(Object.keys(GIFT_ACTIONS).map((key,i)=>[key,String(i+100)]));
  const r=new LiveReceiver(config);
  for(const [key,giftId] of Object.entries(config)){
    const event={type:'gift',id:key,giftId,giftType:1,repeatEnd:false,repeatCount:3};
    assert.equal(r.receive(event),null);
    assert.deepEqual(r.receive({...event,repeatEnd:true}),{id:key,...GIFT_ACTIONS[key],count:3});
    assert.equal(r.receive({...event,repeatEnd:true}),null);
  }
  const event={type:'gift',id:'x',giftId:'999',giftType:0,repeatEnd:true,repeatCount:1};
  assert.equal(r.receive(event),null);
  assert.equal(r.receive({...event,giftId:'100',repeatCount:101}),null);
});
test('HTTP receiver authentication, validation, SSE delivery and private files',async()=>{
  const token='test-token-with-at-least-24-chars';
  const {server}=createLiveServer({token});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const controller=new AbortController();
  try {
    assert.equal((await fetch(base+'/config/gifts.example.json')).status,404);
    assert.equal((await fetch(base+'/live/events',{method:'POST'})).status,401);
    const stream=await fetch(base+'/live/stream',{signal:controller.signal});
    const reader=stream.body.getReader();await reader.read();
    const post=body=>fetch(base+'/live/events',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body});
    assert.equal((await post('invalid')).status,400);
    assert.equal((await post('x'.repeat(9000))).status,413);
    const body=JSON.stringify({type:'chat',id:'test',comment:'22'});
    assert.deepEqual(await (await post(body)).json(),{accepted:true});
    assert.match(new TextDecoder().decode((await reader.read()).value),/"side":"b"/);
    assert.deepEqual(await (await post(body)).json(),{accepted:false});
  }finally{controller.abort();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

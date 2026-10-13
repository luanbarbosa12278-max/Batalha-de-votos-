export const GIFT_ACTIONS = Object.freeze({
  redRose: {action:'hadouken',side:'l'},
  whiteRose: {action:'shot',side:'b'},
  miniDino: {action:'shield',side:'l'},
  rose10: {action:'shield',side:'b'},
  doughnut: {action:'bolsa',side:'b'},
  capybara: {action:'taok',side:'b'}
});

export function giftMap(config={}) {
  const result=new Map();
  for(const [key,id] of Object.entries(config)) {
    if(!Object.hasOwn(GIFT_ACTIONS,key)) throw new Error('Unknown gift mapping: '+key);
    if(id===null) continue;
    if(typeof id!=='string'||!/^\d{1,20}$/.test(id)||result.has(id)) throw new Error('Invalid or duplicate gift ID');
    result.set(id,GIFT_ACTIONS[key]);
  }
  return result;
}

export function normalizeTikTok(type,event) {
  const id=event.common?.msgId??event.msgId;
  if(type==='chat')return {type,id,comment:event.content??event.comment};
  const gift=event.gift??event.giftDetails;
  return {type,id,giftId:event.giftId,giftType:gift?.type??gift?.giftType,
    repeatEnd:event.repeatEnd===true||event.repeatEnd===1,repeatCount:event.repeatCount};
}

// IDs remain strings: TikTok message IDs can exceed JS integer precision.
export class LiveReceiver {
  constructor(config={},now=Date.now) {this.gifts=giftMap(config);this.now=now;this.seen=new Map();}
  receive(event) {
    if(!event||typeof event!=='object') return null;
    const id=event.id;
    if(typeof id!=='string'||!/^[-\w:.]{1,160}$/.test(id)) return null;
    let command;
    if(event.type==='chat'&&typeof event.comment==='string') {
      const comment=event.comment.trim();
      if(comment==='13'||comment==='22') command={action:'shot',side:comment==='13'?'l':'b'};
    } else if(event.type==='gift') {
      if(typeof event.giftId!=='string'||!/^\d{1,20}$/.test(event.giftId)) return null;
      if(!Number.isInteger(event.giftType)||event.giftType<0||typeof event.repeatEnd!=='boolean') return null;
      if(event.giftType===1&&!event.repeatEnd) return null;
      if(!Number.isSafeInteger(event.repeatCount)||event.repeatCount<1||event.repeatCount>100) return null;
      command=this.gifts.get(event.giftId);
    }
    if(!command) return null;
    const now=this.now();
    for(const [key,time] of this.seen) if(now-time>600000) this.seen.delete(key);
    if(this.seen.has(id)||this.seen.size>=10000) return null;
    this.seen.set(id,now);
    return {id,...command,count:event.type==='gift'?event.repeatCount:1};
  }
}

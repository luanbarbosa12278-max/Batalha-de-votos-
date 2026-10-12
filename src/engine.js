export const MAX_HP = 500;
export const DAMAGE = 10;
export const ATTACK_MS = 240;
export const HIT_MS = 100;
export const KO_MS = 1200;

// Batches preserve every count without allocating one item per comment.
// Within a polling interval the API gives totals, not event order: alternate sides.
export class Fight {
  constructor() { this.reset(); }
  reset() {
    this.hp = {l:MAX_HP,b:MAX_HP};
    this.shieldActive={l:false,b:false};
    this.wins = {l:0,b:0};
    this.votes = {l:0,b:0};
    this.manual = {l:0,b:0};
    this.round = 1;
    this.batches = [];
    this.head = 0;
    this.pending = 0;
    this.delivered = 0;
    this.phase = 'ready';
    this.elapsed = 0;
    this.attack = null;
    this.winner = null;
    this.hit = false;
    this.lastSide = 'b';
    this.bothAttack = false;
    this.god = {l:false,b:false};
    this.godAttacks = [];
    this.godBlockedHits = {l:0,b:0};
  }
  setGod(side, enabled) {
    if (!(side in this.god)) throw new Error('Lutador inválido');
    this.god[side] = Boolean(enabled);
    // Release an already-started punch from the shared animation lock.
    if(enabled && this.phase==='attack' && (this.attack===side || this.attack==='both')){
      this.godAttacks.push({side,count:this.hit?0:1,elapsed:this.elapsed,hit:this.hit});
      if(this.attack==='both') this.attack=side==='l'?'b':'l';
      else {this.phase='ready';this.attack=null;this.elapsed=0;this.hit=false;}
      this.bothAttack=false;
    }
  }
  enterKO() {
    if (this.phase==='ko' || (this.hp.l>0 && this.hp.b>0)) return;
    if(this.phase==='attack' && !this.hit && this.attack){
      const l=this.attack==='l'||this.attack==='both'?1:0;
      const b=this.attack==='b'||this.attack==='both'?1:0;
      this.batches.push({l,b});this.pending+=l+b;
    }
    this.phase='ko'; this.elapsed=0; this.attack=null; this.hit=false;
    this.winner=this.hp.l===0 && this.hp.b===0 ? 'draw' : (this.hp.l===0?'b':'l');
    if(this.winner!=='draw') this.wins[this.winner]++;
    // Unlanded GOD punches remain votes for the next round.
    for(const punch of this.godAttacks){
      if(!punch.hit && punch.count){
        this.batches.push({l:0,b:0,[punch.side]:punch.count});
        this.pending+=punch.count;
      }
    }
    this.godAttacks=[];
  }
  advanceGod(dt) {
    if(this.phase==='ko') return;
    for(const side of ['l','b']){
      if(!this.god[side]) continue;
      let count=0;
      for(let i=this.head;i<this.batches.length;i++){
        count+=this.batches[i][side]; this.batches[i][side]=0;
      }
      if(count){
        this.pending-=count;
        this.godAttacks.push({side,count,elapsed:0,hit:false});
      }
    }
    while(this.head<this.batches.length && !this.batches[this.head].l && !this.batches[this.head].b) this.head++;
    if(this.head>128){this.batches=this.batches.slice(this.head);this.head=0;}
    let landedAny=false;
    for(const punch of this.godAttacks){
      punch.elapsed+=dt;
      if(!punch.hit && punch.elapsed>=HIT_MS){
        const target=punch.side==='l'?'b':'l';
        if(this.shieldActive[target]){
          this.godBlockedHits[target]+=punch.count;
          this.delivered+=punch.count;punch.count=0;punch.hit=true;
          continue;
        }
        const landed=Math.min(punch.count,Math.ceil(this.hp[target]/DAMAGE));
        this.hp[target]=Math.max(0,this.hp[target]-landed*DAMAGE);
        this.delivered+=landed;
        landedAny ||= landed>0;
        punch.count-=landed;
        punch.hit=punch.count===0;
      }
    }
    if(landedAny) this.enterKO();
    this.godAttacks=this.godAttacks.filter(p=>p.elapsed<ATTACK_MS);
  }
  enqueue(l, b, manual = false) {
    if (![l,b].every(n=>Number.isSafeInteger(n)&&n>=0)) throw new Error('Contagem inválida');
    if (!Number.isSafeInteger(this.pending+l+b)) throw new Error('Contagem excede o limite numérico');
    const counts=manual?this.manual:this.votes;
    if (![counts.l+l,counts.b+b].every(Number.isSafeInteger)) throw new Error('Contagem excede o limite numérico');
    counts.l+=l; counts.b+=b;
    if (l+b) {
      // Une votos/teclas recebidos no mesmo intervalo para permitir
      // golpes simultâneos em vez de enfileirar um lado por vez.
      const tail=this.batches[this.batches.length-1];
      if(tail && this.head<this.batches.length && (tail.l+tail.b)>0){
        tail.l+=l; tail.b+=b;
      }else this.batches.push({l,b});
      this.pending+=l+b;
    }
  }
  next() {
    while(this.head<this.batches.length && !this.batches[this.head].l && !this.batches[this.head].b) this.head++;
    const batch=this.batches[this.head];
    if (!batch) return null;
    // Dois comentários disponíveis no mesmo lote: ataques simultâneos.
    if(batch.l>0 && batch.b>0){
      batch.l--; batch.b--; this.pending-=2;
      if(!batch.l&&!batch.b){this.head++;if(this.head>128){this.batches=this.batches.slice(this.head);this.head=0;}}
      return 'both';
    }
    let side=this.lastSide==='l'?'b':'l';
    if (!batch[side]) side=side==='l'?'b':'l';
    batch[side]--; this.pending--; this.lastSide=side;
    if (!batch.l&&!batch.b) {
      this.head++;
      if(this.head>128){this.batches=this.batches.slice(this.head);this.head=0;}
    }
    return side;
  }
  advance(dt, {pauseNormal=false}={}) {
    if (!Number.isFinite(dt)||dt<0) throw new Error('Tempo inválido');
    const wasKO=this.phase==='ko';
    this.advanceGod(dt);
    if(!wasKO && this.phase==='ko') return;
    if(!pauseNormal || this.phase==='ko') this.advanceNormal(dt);
  }
  advanceNormal(dt) {
    if (!Number.isFinite(dt)||dt<0) throw new Error('Tempo inválido');
    while (true) {
      if (this.phase==='ready') {
        const side=this.next();
        if (!side) return;
        this.phase='attack'; this.attack=side; this.elapsed=0; this.hit=false; this.bothAttack=side==='both';
      }
      // Se o rival atacar antes do impacto, os dois golpes acertam juntos.
      if(this.phase==='attack' && !this.hit && this.attack!=='both'){
        const other=this.attack==='l'?'b':'l';
        const batch=this.batches[this.head];
        if(batch && batch[other]>0){
          batch[other]--; this.pending--;
          if(!batch.l&&!batch.b){
            this.head++;
            if(this.head>128){this.batches=this.batches.slice(this.head);this.head=0;}
          }
          this.attack='both';
          this.bothAttack=true;
        }
      }
      const duration=this.phase==='ko'?KO_MS:ATTACK_MS;
      const step=Math.min(dt,duration-this.elapsed);
      this.elapsed+=step; dt-=step;
      if (this.phase==='attack'&&!this.hit&&this.elapsed>=HIT_MS) {
        if(this.attack==='both'){
          if(!this.shieldActive.l)this.hp.l=Math.max(0,this.hp.l-DAMAGE);
          if(!this.shieldActive.b)this.hp.b=Math.max(0,this.hp.b-DAMAGE);
          this.delivered+=2;
        }else{
          const defender=this.attack==='l'?'b':'l';
          if(!this.shieldActive[defender])this.hp[defender]=Math.max(0,this.hp[defender]-DAMAGE);
          this.delivered++;
        }
        this.hit=true;
      }
      if (this.elapsed<duration) return;
      if (this.phase==='attack') {
        if (!this.hp.l||!this.hp.b) {
          this.enterKO();
        } else this.phase='ready';
        this.attack=null;
      } else {
        this.hp={l:MAX_HP,b:MAX_HP}; this.round++;
        this.phase='ready'; this.winner=null;
      }
      this.elapsed=0;
      if (!dt) return;
    }
  }
}
export class VoteTracker {
  constructor() { this.last=null; }
  baseline(user,l=0,b=0){this.last={user,l,b};}
  accept(data) {
    const count=v=>{
      if(typeof v!=='number' && !(typeof v==='string' && /^\d+$/.test(v))) throw new Error('Contagem inválida');
      const n=Number(v);
      if(!Number.isSafeInteger(n)||n<0) throw new Error('Contagem inválida');
      return n;
    };
    const l=count(data['13']), b=count(data['22']);
    if(typeof data.usuario!=='string') throw new Error('Conta inválida');
    const user=data.usuario;
    const previous=this.last;
    this.last={user,l,b};
    if(!previous) return {l:0,b:0,baseline:true,changed:false,reset:false};
    if(previous.user!==user) return {l:0,b:0,baseline:true,changed:true,reset:false};
    // A decrease signals a server reset. The new values represent new comments.
    if(l<previous.l||b<previous.b) return {l,b,baseline:false,changed:false,reset:true};
    return {l:l-previous.l,b:b-previous.b,baseline:false,changed:false,reset:false};
  }
}

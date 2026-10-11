
import {Fight, VoteTracker, ATTACK_MS, HIT_MS} from './engine.js';

const API='https://tiktok-live-servidor.onrender.com';
const $=id=>document.getElementById(id);
const game=new Fight(), tracker=new VoteTracker();
const canvas=$('game'), ctx=canvas.getContext('2d');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const images={};

function normalizeSprite(img) {
  const source=document.createElement('canvas');
  source.width=img.naturalWidth;
  source.height=img.naturalHeight;

  const sctx=source.getContext('2d',{willReadFrequently:true});
  sctx.drawImage(img,0,0);

  const {data}=sctx.getImageData(0,0,source.width,source.height);

  let minX=source.width;
  let minY=source.height;
  let maxX=-1;
  let maxY=-1;

  for(let y=0;y<source.height;y++){
    for(let x=0;x<source.width;x++){
      const alpha=data[(y*source.width+x)*4+3];

      if(alpha>20){
        minX=Math.min(minX,x);
        minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);
        maxY=Math.max(maxY,y);
      }
    }
  }

  if(maxX<0){
    throw new Error('Sprite totalmente transparente');
  }

  const cropWidth=maxX-minX+1;
  const cropHeight=maxY-minY+1;

  const scale=Math.min(220/cropWidth,180/cropHeight);
  const w=Math.round(cropWidth*scale);
  const h=Math.round(cropHeight*scale);

  const frame=document.createElement('canvas');
  frame.width=280;
  frame.height=256;

  const fctx=frame.getContext('2d');
  fctx.imageSmoothingEnabled=false;

  fctx.drawImage(
    source,
    minX,minY,cropWidth,cropHeight,
    Math.round((280-w)/2),240-h,w,h
  );

  return frame;
}

let ready=false;
let previousTime=0;
let epoch=0;
let configuring=false;
let pollController=null;
let userEdited=false;

let statusRound=0;
let statusAttack=null;
let lastHud='';
let specialEffect=null;

const HADOUKEN_DAMAGE=20;
const names={l:'LULA',b:'BOLSONARO'};
const fmt=n=>n.toLocaleString('pt-BR');

function loadImage(path){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=()=>reject(new Error('Não foi possível carregar '+path));
    img.src=path;
  });
}

async function loadAssets(){
  try{
    const files={
      arena:'./cenário.png',
      l:'./assets/fighters/lula-idle.png',
      b:'./assets/fighters/bolsonaro-idle.png',
      punch:'./assets/fighters/bolsonaro-attack.png',
      hadoukenPose:'./assets/fighters/bolsonaro-hadouken.png',
      hadouken:'./assets/fighters/hadouken-blue.png',
      shoryuken:'./assets/fighters/lula-shoryuken.png'
    };

    await Promise.all(
      Object.entries(files).map(async ([k,p])=>{
        const img=await loadImage(p);
        images[k]=(k==='arena'||k==='hadouken')
          ?img
          :normalizeSprite(img);
      })
    );

    ready=true;
    $('loading').hidden=true;

    for(const id of ['attackL','attackB','shoryukenL','hadoukenB']){
      const button=$(id);
      if(button)button.disabled=false;
    }

    $('message').textContent='ROUND 01 — FIGHT!';
  }catch(error){
    $('loading').textContent=
      error.message+'. Recarregue para tentar novamente.';
  }
}

function fighter(side,time){
  const facing=side==='l'?1:-1;
  const baseX=side==='l'?290:670;
  const ground=490;

  let x=baseX;
  let y=ground;
  let tilt=0;
  let sy=1;
  let sprite=images[side];
  const scale=1.65;
  let losing=false;

  const sp=specialEffect?.side===side?specialEffect:null;

  if(sp){
    const t=Math.max(0,Math.min(1,(time-sp.start)/sp.duration));

    if(sp.type==='shoryuken'){
      sprite=images.shoryuken;
      x+=85*Math.sin(Math.PI*t);
      y-=145*Math.sin(Math.PI*t);
    }else if(sp.type==='hadouken'){
      sprite=images.hadoukenPose;
    }

  }else if(game.phase==='ko'){
    if(game.winner===side){
      sy=1+(reduceMotion?0:Math.sin(time/170)*.025);
    }else{
      losing=true;
    }

  }else if(game.phase==='attack'){
    const t=Math.min(1,game.elapsed/ATTACK_MS);

    if(game.attack===side){
      const reach=side==='l'?205:160;
      const approach=Math.min(1,t/.32);
      const retreat=t>.68?(1-t)/.32:1;

      x+=facing*reach*Math.max(
        0,Math.min(approach,retreat)
      );

      // Socos comuns permanecem separados dos especiais.
      if(side==='b'){
        sprite=images.punch;
      }

      sy=1+(reduceMotion?0:Math.sin(t*Math.PI*4)*.018);

    }else if(game.hit){
      x-=facing*(
        reduceMotion
          ?3
          :Math.sin(
            Math.min(1,(game.elapsed-HIT_MS)/220)*Math.PI
          )*12
      );
      tilt=.09;
    }

  }else{
    sy=1+(
      reduceMotion
        ?0
        :Math.sin(time/220+(side==='l'?0:1))*.012
    );
  }

  ctx.save();

  ctx.fillStyle='#0006';
  ctx.beginPath();
  ctx.ellipse(x,ground+3,58,10,0,0,Math.PI*2);
  ctx.fill();

  ctx.translate(x,y);
  ctx.scale(facing*scale,scale);

  if(losing){
    const fall=reduceMotion
      ?1
      :Math.min(1,game.elapsed/380);

    ctx.translate(fall*70,-fall*60);
    ctx.rotate(-fall*Math.PI/2);
  }else{
    ctx.transform(1,0,tilt,sy,0,0);
  }

  ctx.drawImage(sprite,-140,-240);
  ctx.restore();
}

function paint(time){
  ctx.imageSmoothingEnabled=false;
  ctx.clearRect(0,0,960,540);

  if(!ready)return;

  ctx.drawImage(images.arena,0,0,960,540);

  if(game.attack==='l'){
    fighter('b',time);
    fighter('l',time);
  }else{
    fighter('l',time);
    fighter('b',time);
  }

  // Efeito de impacto dos socos normais.
  if(
    game.phase==='attack' &&
    game.hit &&
    game.elapsed<HIT_MS+150
  ){
    ctx.save();
    ctx.strokeStyle='#ffe9a5';
    ctx.lineWidth=4;

    const x=game.attack==='l'?609:356;
    const y=337;

    for(let i=0;i<8;i++){
      const a=i*Math.PI/4;

      ctx.beginPath();
      ctx.moveTo(
        x+Math.cos(a)*12,
        y+Math.sin(a)*12
      );
      ctx.lineTo(
        x+Math.cos(a)*26,
        y+Math.sin(a)*26
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  // Hadouken: Bolsonaro dispara para a esquerda.
  if(specialEffect?.type==='hadouken'){
    const t=Math.min(
      1,
      (time-specialEffect.start)/specialEffect.duration
    );

    if(t>=.12){
      const progress=(t-.12)/.88;
      const x=530-progress*570;

      ctx.save();
      ctx.translate(x,350);
      ctx.scale(-1,1);

      ctx.drawImage(
        images.hadouken,
        -125,-80,250,160
      );

      ctx.restore();
    }
  }

  if(game.phase==='ko'){
    ctx.fillStyle='#0b101bb8';
    ctx.fillRect(330,100,300,104);

    ctx.textAlign='center';
    ctx.fillStyle='#ffce65';
    ctx.font='900 68px monospace';
    ctx.fillText('K.O.',480,168);

    ctx.fillStyle='#fff';
    ctx.font='bold 14px monospace';
    ctx.fillText(
      names[game.winner]+' VENCEU O ROUND',
      480,192
    );
  }
}

function updateHUD(){
  const key=[
    game.hp.l,game.hp.b,
    game.round,
    game.wins.l,game.wins.b,
    game.votes.l,game.votes.b,
    game.pending,
    game.manual.l,game.manual.b
  ].join(':');

  if(key!==lastHud){
    lastHud=key;

    for(const [side,id] of [['l','L'],['b','B']]){
      $('hp'+id).style.width=game.hp[side]+'%';

      $('hp'+id).parentElement.setAttribute(
        'aria-valuenow',
        game.hp[side]
      );

      $('wins'+id).textContent=
        game.wins[side]+' ROUNDS';

      $('votes'+id).textContent=
        fmt(game.votes[side]);
    }

    $('round').textContent=
      String(game.round).padStart(2,'0');

    $('pending').textContent=fmt(game.pending);

    $('manual').textContent=
      fmt(game.manual.l+game.manual.b)+' golpes de teste';
  }

  if(!ready)return;

  if(game.phase==='ko'){
    $('message').textContent=
      'K.O. — '+names[game.winner]+' VENCEU!';
  }else if(game.attack&&game.attack!==statusAttack){
    $('message').textContent=
      names[game.attack]+' ATACA!';
  }else if(game.round!==statusRound){
    $('message').textContent=
      'ROUND '+game.round+' — FIGHT!';
  }

  statusRound=game.round;
  statusAttack=game.attack;
}

function frame(now){
  const dt=previousTime
    ?Math.min(100,now-previousTime)
    :0;

  previousTime=now;

if(specialEffect){
  const t=(now-specialEffect.start)/specialEffect.duration;

  if(
    specialEffect.type==='hadouken' &&
    !specialEffect.hit &&
    t>=0.55
  ){
    specialEffect.hit=true;

    game.hp.l=Math.max(
      0,
      game.hp.l-HADOUKEN_DAMAGE
    );

    if(game.hp.l===0){
      game.phase='ko';
      game.attack=null;
      game.winner='b';
      game.wins.b++;
      game.elapsed=0;
    }
  }

  if(t>=1){
    specialEffect=null;
  }
}

  // Os votos continuam na fila enquanto um especial acontece.
  if(ready&&!specialEffect){
    game.advance(dt);
  }

  paint(now);
  updateHUD();

  requestAnimationFrame(frame);
}

document.addEventListener('visibilitychange',()=>{
  previousTime=0;
});

// Socos normais.
$('attackL').onclick=()=>{
  if(!ready)return;
  game.enqueue(1,0,true);
};

$('attackB').onclick=()=>{
  if(!ready)return;
  game.enqueue(0,1,true);
};

// Shoryuken do Lula.
$('shoryukenL').onclick=()=>{
  if(!ready||game.phase!=='ready'||specialEffect)return;

  specialEffect={
    type:'shoryuken',
    side:'l',
    start:performance.now(),
    duration:850
  };
};

// Hadouken do Bolsonaro.
$('hadoukenB').onclick=()=>{
  if(!ready||game.phase!=='ready'||specialEffect)return;

  specialEffect={
    type:'hadouken',
    side:'b',
    start:performance.now(),
    duration:850
  };
};

// Atalhos do teclado.
document.addEventListener('keydown',event=>{
  if(
    event.repeat ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  )return;

  const target=event.target;

  if(
    target instanceof Element &&
    target.closest(
      'input, textarea, select, [contenteditable="true"]'
    )
  )return;

  const shortcuts={
    q:'attackL',
    w:'shoryukenL',
    i:'attackB',
    o:'hadoukenB'
  };

  const id=shortcuts[event.key.toLowerCase()];

  if(id){
    event.preventDefault();
    $(id).click();
  }
});

// Reiniciar luta local.
$('reset').onclick=()=>{
  if(!confirm(
    'Reiniciar a luta local e descartar os golpes pendentes?'
  ))return;

  game.reset();
  specialEffect=null;
  statusRound=0;
  statusAttack=null;

  updateHUD();
};

$('usuario').addEventListener('input',()=>{
  userEdited=true;
});

// Consultar comentários do TikTok.
async function pollVotes(){
  if(configuring||pollController)return;

  const controller=new AbortController();
  const mine=epoch;

  pollController=controller;

  const timeout=setTimeout(
    ()=>controller.abort(),
    15000
  );

  try{
    const response=await fetch(API+'/votos',{
      cache:'no-store',
      signal:controller.signal
    });

    if(!response.ok){
      throw new Error(
        'Servidor indisponível ('+response.status+')'
      );
    }

    const data=await response.json();

    if(mine!==epoch)return;

    const delta=tracker.accept(data);

    if(delta.changed){
      game.reset();
      specialEffect=null;
      statusRound=0;
    }

    game.enqueue(delta.l,delta.b);

    if(
      !userEdited &&
      document.activeElement!==$('usuario')
    ){
      $('usuario').value=data.usuario;
    }

    $('status').textContent=
      (data.usuario||'Live')+' · '+
      (
        typeof data.status==='string'
          ?data.status
          :'Servidor conectado'
      )+
      (
        delta.reset
          ?' · Contadores do servidor reiniciados'
          :''
      );

    updateHUD();

  }catch(error){
    if(mine===epoch&&!configuring){
      $('status').textContent=
        error.name==='AbortError'
          ?'Servidor demorou a responder. Tentando novamente…'
          :'Aguardando servidor: '+error.message;
    }

  }finally{
    clearTimeout(timeout);

    if(pollController===controller){
      pollController=null;
    }
  }
}

// Conectar live.
$('connectForm').addEventListener('submit',async event=>{
  event.preventDefault();

  if(configuring)return;

  const usuario=$('usuario').value.trim();
  const senha=$('senha').value;

  if(!usuario||!senha){
    $('status').textContent='Digite o @ e a senha.';
    return;
  }

  configuring=true;
  epoch++;

  pollController?.abort();
  pollController=null;

  $('connect').disabled=true;
  $('status').textContent='Conectando…';

  const controller=new AbortController();

  const timeout=setTimeout(
    ()=>controller.abort(),
    20000
  );

  try{
    const response=await fetch(API+'/configurar',{
      method:'POST',
      signal:controller.signal,
      headers:{
        'Content-Type':'application/json',
        'X-Admin-Password':senha
      },
      body:JSON.stringify({usuario})
    });

    const data=await response.json();

    if(!response.ok){
      throw new Error(
        typeof data.detail==='string'
          ?data.detail
          :'Erro ao conectar'
      );
    }

    if(
      typeof data.usuario!=='string' ||
      !data.usuario
    ){
      throw new Error(
        'Resposta de configuração inválida'
      );
    }

    tracker.baseline(data.usuario,0,0);

    game.reset();
    specialEffect=null;
    statusRound=0;
    userEdited=false;

    $('usuario').value=data.usuario;
    $('status').textContent=
      'Conta selecionada: '+data.usuario;

    updateHUD();

  }catch(error){
    $('status').textContent=
      error.name==='AbortError'
        ?'A configuração demorou. Confira o estado da live antes de tentar novamente.'
        :error.message;

  }finally{
    clearTimeout(timeout);

    $('senha').value='';
    configuring=false;
    $('connect').disabled=false;
  }
});

// Inicialização.
loadAssets();
updateHUD();
requestAnimationFrame(frame);
pollVotes();
setInterval(pollVotes,2000);

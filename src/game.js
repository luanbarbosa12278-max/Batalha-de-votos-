
import {Fight, VoteTracker, ATTACK_MS, HIT_MS} from './engine.js';

const API='https://tiktok-live-servidor.onrender.com';
const $=id=>document.getElementById(id);

const game=new Fight();
const tracker=new VoteTracker();

const canvas=$('game');
const ctx=canvas.getContext('2d');

const reduceMotion=matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

const images={};

// ========================================
// SISTEMA DE ÁUDIO
// ========================================

// Caminho real da pasta no GitHub.
const AUDIO_PATH='./assets/fighters/audio/';

// Todos os 28 arquivos MP3.
const soundGroups={
  lulaSoco:[
    'lula-soco.mp3',
    'lula-soco-2.mp3'
  ],

  lulaEspecial:[
    'lula-shoryuken.mp3',
    'lula-shoryuken-2.mp3'
  ],

  lulaDano:[
    'lula-dano.mp3'
  ],

  lulaPoucaVida:[
    'lula-pouca-vida.mp3'
  ],

  lulaVitoria:[
    'lula-vitoria.mp3'
  ],

  lulaProvocacao:[
    'lula-provocacao.mp3',
    'lula-provocacao-2.mp3',
    'lula-provocacao-3.mp3',
    'lula-nove-dedos.mp3',
    'lula-cachaca.mp3'
  ],

  lulaVotos:[
    'lula-votos.mp3'
  ],

  bolsonaroSoco:[
    'bolsonaro-soco.mp3',
    'bolsonaro-soco-2.mp3'
  ],

  bolsonaroEspecial:[
    'bolsonaro-hadouken.mp3',
    'bolsonaro-hadouken-2.mp3',
    'bolsonaro-hadouken-3.mp3'
  ],

  bolsonaroDano:[
    'bolsonaro-dano.mp3'
  ],

  bolsonaroPoucaVida:[
    'bolsonaro-pouca-vida.mp3'
  ],

  bolsonaroVitoria:[
    'bolsonaro-vitoria.mp3'
  ],

  bolsonaroDerrota:[
    'bolsonaro-derrota.mp3'
  ],

  bolsonaroProvocacao:[
    'bolsonaro-provocacao.mp3',
    'bolsonaro-provocacao-2.mp3',
    'bolsonaro-provocacao-3.mp3',
    'bolsonaro-atleta.mp3'
  ],

  bolsonaroVotos:[
    'bolsonaro-votos.mp3'
  ],

  narradorVotos:[
    'narrador-votos.mp3'
  ]
};

// Probabilidade de reprodução.
const soundChances={
  lulaSoco:0.12,
  bolsonaroSoco:0.12,

  lulaEspecial:0.35,
  bolsonaroEspecial:1,

  lulaDano:0.15,
  bolsonaroDano:0.15,

  lulaPoucaVida:0.40,
  bolsonaroPoucaVida:0.40,

  lulaVitoria:0.85,
  bolsonaroVitoria:0.85,
  bolsonaroDerrota:0.50,

  lulaProvocacao:0.45,
  bolsonaroProvocacao:0.45,

  lulaVotos:0.35,
  bolsonaroVotos:0.35,
  narradorVotos:0.30
};

const soundCache={};

for(const [group,filenames] of Object.entries(soundGroups)){
  soundCache[group]=filenames.map(filename=>{
    const audio=new Audio(AUDIO_PATH+filename);

    audio.preload='auto';
    audio.volume=0.8;

    return audio;
  });
}

let activeVoice=null;
let lastSoundTime=-100000;
let lastSoundName='';

let audioUnlocked=false;
let audioMuted=false;

let lastOccasionalVoice=-100000;
let hadoukenVoiceUntil=0;

// Impede que falas ocasionais se acumulem.
const OCCASIONAL_COOLDOWN=8000;

// Liberação de áudio após interação do usuário.
function unlockAudio(){
  audioUnlocked=true;
}

document.addEventListener('pointerdown',unlockAudio);
document.addEventListener('keydown',unlockAudio);

function stopVoice(){
  if(activeVoice){
    activeVoice.pause();

    try{
      activeVoice.currentTime=0;
    }catch(error){
      console.warn('Não foi possível reiniciar o áudio:',error);
    }

    activeVoice=null;
  }
}

// Reproduz uma fala conforme sua probabilidade.
function playSound(group){
  if(audioMuted || !audioUnlocked){
    return false;
  }

  const sounds=soundCache[group];

  if(!sounds || !sounds.length){
    return false;
  }

  const now=performance.now();

  const isHadouken=group==='bolsonaroEspecial';

  // Todos os sons, exceto o Hadouken,
  // são ocasionais.
  if(!isHadouken){
    const chance=soundChances[group] ?? 0.30;

    if(Math.random()>chance){
      return false;
    }

    // No máximo uma fala ocasional
    // a cada 8 segundos.
    if(now-lastOccasionalVoice<OCCASIONAL_COOLDOWN){
      return false;
    }

    // Nunca interromper o Hadouken.
    if(now<hadoukenVoiceUntil){
      return false;
    }

    // Não cortar uma fala que ainda está tocando.
    if(
      activeVoice &&
      !activeVoice.paused &&
      !activeVoice.ended
    ){
      return false;
    }
  }

  // Evita repetir a mesma variante duas vezes seguidas.
  let choices=sounds;

  if(sounds.length>1){
    choices=sounds.filter(
      audio=>audio.src!==lastSoundName
    );

    if(!choices.length){
      choices=sounds;
    }
  }

  const audio=choices[
    Math.floor(Math.random()*choices.length)
  ];

  // Hadouken tem prioridade.
  stopVoice();

  try{
    audio.currentTime=0;
  }catch(error){
    console.warn('Erro ao preparar áudio:',error);
  }

  activeVoice=audio;
  lastSoundTime=now;
  lastSoundName=audio.src;

  if(isHadouken){
    // Impede outras falas por alguns segundos.
    hadoukenVoiceUntil=now+4000;
  }else{
    lastOccasionalVoice=now;
  }

  audio.play().catch(error=>{
    console.warn(
      'Não foi possível tocar '+group+':',
      error
    );

    if(activeVoice===audio){
      activeVoice=null;
    }
  });

  return true;
}

// ========================================
// NORMALIZAÇÃO DOS SPRITES
// ========================================

function normalizeSprite(img){
  const source=document.createElement('canvas');

  source.width=img.naturalWidth;
  source.height=img.naturalHeight;

  const sctx=source.getContext(
    '2d',
    {willReadFrequently:true}
  );

  sctx.drawImage(img,0,0);

  const {data}=sctx.getImageData(
    0,
    0,
    source.width,
    source.height
  );

  let minX=source.width;
  let minY=source.height;
  let maxX=-1;
  let maxY=-1;

  for(let y=0;y<source.height;y++){
    for(let x=0;x<source.width;x++){
      const alpha=data[
        (y*source.width+x)*4+3
      ];

      if(alpha>20){
        minX=Math.min(minX,x);
        minY=Math.min(minY,y);
        maxX=Math.max(maxX,x);
        maxY=Math.max(maxY,y);
      }
    }
  }

  if(maxX<0){
    throw new Error(
      'Sprite totalmente transparente'
    );
  }

  const cropWidth=maxX-minX+1;
  const cropHeight=maxY-minY+1;

  const scale=Math.min(
    220/cropWidth,
    180/cropHeight
  );

  const w=Math.round(cropWidth*scale);
  const h=Math.round(cropHeight*scale);

  const frame=document.createElement('canvas');

  frame.width=280;
  frame.height=256;

  const fctx=frame.getContext('2d');

  fctx.imageSmoothingEnabled=false;

  fctx.drawImage(
    source,
    minX,
    minY,
    cropWidth,
    cropHeight,
    Math.round((280-w)/2),
    240-h,
    w,
    h
  );

  return frame;
}

// ========================================
// VARIÁVEIS DO JOGO
// ========================================

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

const KNOCKBACK_DISTANCE=95;
const LULA_WALL_X=100;
const HADOUKEN_DAMAGE=20;

let lulaX=290;
let lulaKnockback=null;

const names={
  l:'LULA',
  b:'BOLSONARO'
};

const fmt=n=>n.toLocaleString('pt-BR');

// ========================================
// CARREGAMENTO DAS IMAGENS
// ========================================

function loadImage(path){
  return new Promise((resolve,reject)=>{
    const img=new Image();

    img.onload=()=>resolve(img);

    img.onerror=()=>reject(
      new Error(
        'Não foi possível carregar '+path
      )
    );

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

      hadoukenPose:
        './assets/fighters/bolsonaro-hadouken.png',

      hadouken:
        './assets/fighters/hadouken-blue.png',

      shoryuken:
        './assets/fighters/lula-shoryuken.png',

      knockback:
        './assets/fighters/lula-knockback.png',

      lulaPunch:
        './assets/fighters/lula-punch.png'
    };

    await Promise.all(
      Object.entries(files).map(
        async ([key,path])=>{
          const img=await loadImage(path);

          images[key]=(
            key==='arena' ||
            key==='hadouken'
          )
            ?img
            :normalizeSprite(img);
        }
      )
    );

    ready=true;

    $('loading').hidden=true;

    for(const id of [
      'attackL',
      'attackB',
      'shoryukenL',
      'hadoukenB'
    ]){
      const button=$(id);

      if(button){
        button.disabled=false;
      }
    }

    $('message').textContent=
      'ROUND 01 — FIGHT!';

  }catch(error){
    $('loading').textContent=
      error.message+
      '. Recarregue para tentar novamente.';
  }
}

// ========================================
// DESENHAR LUTADOR
// ========================================

function fighter(side,time){
  const facing=side==='l'?1:-1;

  const baseX=side==='l'
    ?lulaX
    :670;

  const ground=490;

  let x=baseX;
  let y=ground;
  let tilt=0;
  let sy=1;

  let sprite=images[side];

  const scale=1.65;

  let losing=false;

  const sp=specialEffect?.side===side
    ?specialEffect
    :null;

  if(sp){
    const t=Math.max(
      0,
      Math.min(
        1,
        (time-sp.start)/sp.duration
      )
    );

    if(sp.type==='shoryuken'){
      sprite=images.shoryuken;

      x+=85*Math.sin(Math.PI*t);
      y-=145*Math.sin(Math.PI*t);

    }else if(sp.type==='hadouken'){
      sprite=images.hadoukenPose;
    }

  }else if(game.phase==='ko'){
    if(game.winner===side){
      sy=1+(
        reduceMotion
          ?0
          :Math.sin(time/170)*.025
      );
    }else{
      losing=true;
    }

  }else if(game.phase==='attack'){
    const t=Math.min(
      1,
      game.elapsed/ATTACK_MS
    );

    if(game.attack===side){
      const reach=side==='l'
        ?205
        :160;

      const approach=Math.min(
        1,
        t/.32
      );

      const retreat=t>.68
        ?(1-t)/.32
        :1;

      x+=facing*reach*Math.max(
        0,
        Math.min(approach,retreat)
      );

      // Sprites de soco específicos.
      if(side==='l'){
        sprite=images.lulaPunch;
      }else{
        sprite=images.punch;
      }

      sy=1+(
        reduceMotion
          ?0
          :Math.sin(t*Math.PI*4)*.018
      );

    }else if(game.hit){
      x-=facing*(
        reduceMotion
          ?3
          :Math.sin(
            Math.min(
              1,
              (game.elapsed-HIT_MS)/220
            )*Math.PI
          )*12
      );

      tilt=.09;
    }

  }else{
    sy=1+(
      reduceMotion
        ?0
        :Math.sin(
          time/220+
          (side==='l'?0:1)
        )*.012
    );
  }

  // Reação do Lula ao Hadouken.
  let knockbackBlink=false;

  if(side==='l' && lulaKnockback){
    const kb=lulaKnockback;

    const progress=Math.min(
      1,
      Math.max(
        0,
        (time-kb.start)/kb.duration
      )
    );

    const ease=1-Math.pow(
      1-progress,
      3
    );

    x=kb.from+
      (kb.to-kb.from)*ease;

    y-=65*Math.sin(
      progress*Math.PI
    );

    sprite=images.knockback;

    knockbackBlink=
      progress<0.65 &&
      Math.floor(
        progress*6/0.65
      )%2===0;
  }

  ctx.save();

  ctx.fillStyle='#0006';

  ctx.beginPath();

  ctx.ellipse(
    x,
    ground+3,
    58,
    10,
    0,
    0,
    Math.PI*2
  );

  ctx.fill();

  ctx.translate(x,y);
  ctx.scale(facing*scale,scale);

  if(losing){
    const fall=reduceMotion
      ?1
      :Math.min(
        1,
        game.elapsed/380
      );

    ctx.translate(
      fall*70,
      -fall*60
    );

    ctx.rotate(
      -fall*Math.PI/2
    );

  }else{
    ctx.transform(
      1,0,tilt,sy,0,0
    );
  }

  if(!knockbackBlink){
    ctx.drawImage(
      sprite,
      -140,
      -240
    );
  }

  ctx.restore();
}

// ========================================
// DESENHAR CENÁRIO
// ========================================

function paint(time){
  ctx.imageSmoothingEnabled=false;

  ctx.clearRect(
    0,0,960,540
  );

  if(!ready){
    return;
  }

  ctx.drawImage(
    images.arena,
    0,0,960,540
  );

  if(game.attack==='l'){
    fighter('b',time);
    fighter('l',time);
  }else{
    fighter('l',time);
    fighter('b',time);
  }

  // Efeito dos socos.
  if(
    game.phase==='attack' &&
    game.hit &&
    game.elapsed<HIT_MS+150
  ){
    ctx.save();

    ctx.strokeStyle='#ffe9a5';
    ctx.lineWidth=4;

    const x=game.attack==='l'
      ?609
      :356;

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

  // Hadouken azul.
  if(
    specialEffect?.type==='hadouken'
  ){
    const t=Math.min(
      1,
      (
        time-specialEffect.start
      )/specialEffect.duration
    );

    if(t>=.12){
      const progress=(
        t-.12
      )/.88;

      const x=530-
        progress*570;

      ctx.save();

      ctx.translate(
        x,
        290
      );

      ctx.scale(-1,1);

      ctx.drawImage(
        images.hadouken,
        -125,
        -80,
        250,
        160
      );

      ctx.restore();
    }
  }

  // Tela de K.O.
  if(game.phase==='ko'){
    ctx.fillStyle='#0b101bb8';

    ctx.fillRect(
      330,
      100,
      300,
      104
    );

    ctx.textAlign='center';

    ctx.fillStyle='#ffce65';
    ctx.font='900 68px monospace';

    ctx.fillText(
      'K.O.',
      480,
      168
    );

    ctx.fillStyle='#fff';
    ctx.font='bold 14px monospace';

    ctx.fillText(
      names[game.winner]+
      ' VENCEU O ROUND',
      480,
      192
    );
  }
}

// ========================================
// HUD E PLACAR
// ========================================

function updateHUD(){
  const key=[
    game.hp.l,
    game.hp.b,
    game.round,
    game.wins.l,
    game.wins.b,
    game.votes.l,
    game.votes.b,
    game.pending,
    game.manual.l,
    game.manual.b
  ].join(':');

  if(key!==lastHud){
    lastHud=key;

    for(const [side,id] of [
      ['l','L'],
      ['b','B']
    ]){
      $('hp'+id).style.width=
        game.hp[side]+'%';

      $('hp'+id)
        .parentElement
        .setAttribute(
          'aria-valuenow',
          game.hp[side]
        );

      $('wins'+id).textContent=
        game.wins[side]+
        ' ROUNDS';

      $('votes'+id).textContent=
        fmt(game.votes[side]);
    }

    $('round').textContent=
      String(game.round)
        .padStart(2,'0');

    $('pending').textContent=
      fmt(game.pending);

    $('manual').textContent=
      fmt(
        game.manual.l+
        game.manual.b
      )+
      ' golpes de teste';
  }

  if(!ready){
    return;
  }

  if(game.phase==='ko'){
    $('message').textContent=
      'K.O. — '+
      names[game.winner]+
      ' VENCEU!';

  }else if(
    game.attack &&
    game.attack!==statusAttack
  ){
    $('message').textContent=
      names[game.attack]+
      ' ATACA!';

  }else if(
    game.round!==statusRound
  ){
    $('message').textContent=
      'ROUND '+
      game.round+
      ' — FIGHT!';
  }

  statusRound=game.round;
  statusAttack=game.attack;
}

// ========================================
// CONTROLE DOS ÁUDIOS NA LUTA
// ========================================

let previousAttack=null;
let previousWinner=null;
let previousRound=game.round;

let previousHP={
  l:game.hp.l,
  b:game.hp.b
};

let lowHealthPlayed={
  l:false,
  b:false
};

let nextProvocation=
  performance.now()+45000;

let nextVoteCall=
  performance.now()+60000;

let previousVoteTotal=
  game.votes.l+game.votes.b;

// Impede que o mesmo golpe gere
// vários sons seguidos.
let previousHit=false;

function resetSoundTracking(){
  previousAttack=null;
  previousWinner=null;
  previousRound=game.round;

  previousHP={
    l:game.hp.l,
    b:game.hp.b
  };

  lowHealthPlayed={
    l:false,
    b:false
  };

  previousHit=false;

  previousVoteTotal=
    game.votes.l+game.votes.b;

  nextProvocation=
    performance.now()+45000;

  nextVoteCall=
    performance.now()+60000;

  lastOccasionalVoice=-100000;
  hadoukenVoiceUntil=0;
}

function updateFightAudio(now){
  if(!ready){
    return;
  }

  const attacking=
    game.phase==='attack'
      ?game.attack
      :null;

  // SOCOS: 12% de chance.
  if(
    attacking &&
    previousAttack!==attacking
  ){
    playSound(
      attacking==='l'
        ?'lulaSoco'
        :'bolsonaroSoco'
    );
  }

  previousAttack=attacking;

  // DANO: 15% de chance.
  // O Hadouken usa o próprio
  // gatilho de impacto.
  if(
    game.hp.l<previousHP.l &&
    !lulaKnockback
  ){
    playSound('lulaDano');
  }

  if(
    game.hp.b<previousHP.b
  ){
    playSound('bolsonaroDano');
  }

  // VITÓRIA: 85% de chance.
  if(game.phase==='ko'){
    if(
      previousWinner!==game.winner
    ){
      playSound(
        game.winner==='l'
          ?'lulaVitoria'
          :'bolsonaroVitoria'
      );

      previousWinner=game.winner;
    }
  }else{
    previousWinner=null;
  }

  // POUCA VIDA: 40% de chance.
  for(const side of ['l','b']){
    if(
      game.hp[side]>0 &&
      game.hp[side]<=25
    ){
      if(!lowHealthPlayed[side]){
        // Uma tentativa por vez que
        // a vida entra na zona crítica.
        lowHealthPlayed[side]=true;

        playSound(
          side==='l'
            ?'lulaPoucaVida'
            :'bolsonaroPoucaVida'
        );
      }

    }else if(game.hp[side]>25){
      lowHealthPlayed[side]=false;
    }
  }

  // PROVOCAÇÕES:
  // Intervalo de 45 a 75 segundos.
  if(now>=nextProvocation){
    nextProvocation=
      now+
      45000+
      Math.random()*30000;

    if(
      game.phase==='ready' &&
      !specialEffect &&
      !lulaKnockback
    ){
      playSound(
        Math.random()<0.5
          ?'lulaProvocacao'
          :'bolsonaroProvocacao'
      );
    }
  }

  // FALAS DE VOTOS:
  // Só tenta tocar quando os votos
  // realmente aumentarem.
  const voteTotal=
    game.votes.l+
    game.votes.b;

  if(
    voteTotal>previousVoteTotal &&
    now>=nextVoteCall &&
    game.phase==='ready' &&
    !specialEffect
  ){
    const options=[
      'lulaVotos',
      'bolsonaroVotos',
      'narradorVotos'
    ];

    const chosen=options[
      Math.floor(
        Math.random()*options.length
      )
    ];

    if(playSound(chosen)){
      nextVoteCall=
        now+90000;
    }
  }

  previousVoteTotal=voteTotal;

  // Mudança de rodada.
  if(
    game.round!==previousRound
  ){
    previousRound=game.round;

    lowHealthPlayed={
      l:false,
      b:false
    };

    nextProvocation=
      now+45000;
  }

  previousHP={
    l:game.hp.l,
    b:game.hp.b
  };
}

// ========================================
// LOOP PRINCIPAL
// ========================================

function frame(now){
  const dt=previousTime
    ?Math.min(
      100,
      now-previousTime
    )
    :0;

  previousTime=now;

  // Fim do knockback.
  if(
    lulaKnockback &&
    now-lulaKnockback.start>=
      lulaKnockback.duration
  ){
    lulaKnockback=null;
  }

  // Atualização dos especiais.
  if(specialEffect){
    const t=(
      now-specialEffect.start
    )/specialEffect.duration;

    if(
      specialEffect.type==='hadouken' &&
      !specialEffect.hit &&
      t>=0.55
    ){
      specialEffect.hit=true;

      const from=lulaX;

      const to=Math.max(
        LULA_WALL_X,
        from-KNOCKBACK_DISTANCE
      );

      lulaKnockback={
        start:now,
        duration:600,
        from,
        to
      };

      lulaX=to;

      game.hp.l=Math.max(
        0,
        game.hp.l-HADOUKEN_DAMAGE
      );

      // Reação ao Hadouken é ocasional,
      // para não cortar o grito do golpe.
      playSound('lulaDano');

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

  // A fila de votos continua
  // durante os especiais.
  if(
    ready &&
    !specialEffect
  ){
    game.advance(dt);
  }

  updateFightAudio(now);
  paint(now);
  updateHUD();

  requestAnimationFrame(frame);
}

document.addEventListener(
  'visibilitychange',
  ()=>{
    previousTime=0;
  }
);

// ========================================
// BOTÕES DOS GOLPES
// ========================================

// Q - Soco do Lula.
$('attackL').onclick=()=>{
  if(!ready){
    return;
  }

  game.enqueue(
    1,
    0,
    true
  );
};

// I - Soco do Bolsonaro.
$('attackB').onclick=()=>{
  if(!ready){
    return;
  }

  game.enqueue(
    0,
    1,
    true
  );
};

// W - Shoryuken do Lula.
$('shoryukenL').onclick=()=>{
  if(
    !ready ||
    game.phase!=='ready' ||
    specialEffect
  ){
    return;
  }

  specialEffect={
    type:'shoryuken',
    side:'l',
    start:performance.now(),
    duration:850
  };

  // Apenas 35% de chance de falar.
  playSound('lulaEspecial');
};

// O - Hadouken do Bolsonaro.
$('hadoukenB').onclick=()=>{
  if(
    !ready ||
    game.phase!=='ready' ||
    specialEffect
  ){
    return;
  }

  specialEffect={
    type:'hadouken',
    side:'b',
    start:performance.now(),
    duration:850,
    hit:false
  };

  // SEMPRE fala no Hadouken.
  playSound('bolsonaroEspecial');
};

// ========================================
// ATALHOS DO TECLADO
// ========================================

document.addEventListener(
  'keydown',
  event=>{
    if(
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ){
      return;
    }

    const target=event.target;

    if(
      target instanceof Element &&
      target.closest(
        'input, textarea, select, [contenteditable="true"]'
      )
    ){
      return;
    }

    const shortcuts={
      q:'attackL',
      w:'shoryukenL',
      i:'attackB',
      o:'hadoukenB'
    };

    const id=shortcuts[
      event.key.toLowerCase()
    ];

    if(id){
      event.preventDefault();
      $(id).click();
    }
  }
);

// ========================================
// REINICIAR LUTA
// ========================================

function resetLocalFight(){
  game.reset();

  lulaX=290;
  lulaKnockback=null;
  specialEffect=null;

  statusRound=0;
  statusAttack=null;

  stopVoice();
  resetSoundTracking();
}

$('reset').onclick=()=>{
  if(!confirm(
    'Reiniciar a luta local e descartar os golpes pendentes?'
  )){
    return;
  }

  resetLocalFight();
  updateHUD();
};

$('usuario').addEventListener(
  'input',
  ()=>{
    userEdited=true;
  }
);

// ========================================
// VOTOS DO TIKTOK
// ========================================

async function pollVotes(){
  if(
    configuring ||
    pollController
  ){
    return;
  }

  const controller=new AbortController();
  const mine=epoch;

  pollController=controller;

  const timeout=setTimeout(
    ()=>controller.abort(),
    15000
  );

  try{
    const response=await fetch(
      API+'/votos',
      {
        cache:'no-store',
        signal:controller.signal
      }
    );

    if(!response.ok){
      throw new Error(
        'Servidor indisponível ('+
        response.status+
        ')'
      );
    }

    const data=await response.json();

    if(mine!==epoch){
      return;
    }

    const delta=tracker.accept(data);

    if(delta.changed){
      resetLocalFight();
    }

    game.enqueue(
      delta.l,
      delta.b
    );

    if(
      !userEdited &&
      document.activeElement!==$('usuario')
    ){
      $('usuario').value=data.usuario;
    }

    $('status').textContent=
      (data.usuario||'Live')+
      ' · '+
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
    if(
      mine===epoch &&
      !configuring
    ){
      $('status').textContent=
        error.name==='AbortError'
          ?'Servidor demorou a responder. Tentando novamente…'
          :'Aguardando servidor: '+
            error.message;
    }

  }finally{
    clearTimeout(timeout);

    if(
      pollController===controller
    ){
      pollController=null;
    }
  }
}

// ========================================
// CONECTAR LIVE
// ========================================

$('connectForm').addEventListener(
  'submit',
  async event=>{
    event.preventDefault();

    if(configuring){
      return;
    }

    const usuario=
      $('usuario').value.trim();

    const senha=
      $('senha').value;

    if(
      !usuario ||
      !senha
    ){
      $('status').textContent=
        'Digite o @ e a senha.';

      return;
    }

    configuring=true;
    epoch++;

    pollController?.abort();
    pollController=null;

    $('connect').disabled=true;

    $('status').textContent=
      'Conectando…';

    const controller=
      new AbortController();

    const timeout=setTimeout(
      ()=>controller.abort(),
      20000
    );

    try{
      const response=await fetch(
        API+'/configurar',
        {
          method:'POST',
          signal:controller.signal,

          headers:{
            'Content-Type':
              'application/json',

            'X-Admin-Password':
              senha
          },

          body:JSON.stringify({
            usuario
          })
        }
      );

      const data=
        await response.json();

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

      tracker.baseline(
        data.usuario,
        0,
        0
      );

      resetLocalFight();
      userEdited=false;

      $('usuario').value=
        data.usuario;

      $('status').textContent=
        'Conta selecionada: '+
        data.usuario;

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
  }
);

// ========================================
// INICIALIZAÇÃO
// ========================================

loadAssets();
updateHUD();

requestAnimationFrame(frame);

pollVotes();

setInterval(
  pollVotes,
  2000
);


import {Fight, VoteTracker, ATTACK_MS, HIT_MS, MAX_HP} from './engine.js';

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
  lulaBolsa:['lula-bolsa-1.mp3','lula-bolsa-2.mp3','lula-bolsa-3.mp3','lula-bolsa-4.mp3','lula-bolsa-5.mp3'],
  lulaHadouken:['lula-hadouken-1.mp3','lula-hadouken-2.mp3'],
  bolsonaroTaok:['bolsonaro-taok-1.mp3','bolsonaro-taok-2.mp3','bolsonaro-taok-3.mp3','bolsonaro-taok-4.mp3'],

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
  lulaBolsa:1,
  lulaHadouken:1,
  bolsonaroTaok:1,
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
    audio.preload='auto';audio.volume=.72;return audio;
  });
}
const activeVoices=new Set();
const lastGroupSound=new Map();
const lastGroupPlayed=new Map();
const MAX_SIMULTANEOUS_VOICES=7;
let lastSoundTime=-100000;
let lastSoundName='';
let audioUnlocked=false;
let audioMuted=false;
let lastOccasionalVoice=-100000;
let hadoukenVoiceUntil=0;
const OCCASIONAL_COOLDOWN=1600;
function unlockAudio(){audioUnlocked=true;}
document.addEventListener('pointerdown',unlockAudio);
document.addEventListener('keydown',unlockAudio);
function stopVoice(){
  for(const voice of activeVoices){voice.pause();try{voice.currentTime=0;}catch(_){}}
  activeVoices.clear();
}
function playSound(group){
  if(audioMuted||!audioUnlocked)return false;
  const sounds=soundCache[group];
  if(!sounds?.length)return false;
  const now=performance.now();
  const isSpecial=['bolsonaroEspecial','lulaEspecial','lulaBolsa','lulaHadouken','bolsonaroTaok'].includes(group);
  const isHit=['lulaSoco','bolsonaroSoco','lulaDano','bolsonaroDano'].includes(group);
  const isAmbient=group.includes('Provocacao')||group.includes('Votos')||group==='narradorVotos'||group.includes('PoucaVida');
  if(!isSpecial&&Math.random()>(soundChances[group]??.3))return false;
  const cooldown=isSpecial?180:isHit?260:isAmbient?2200:700;
  if(now-(lastGroupPlayed.get(group)??-100000)<cooldown)return false;
  if(isAmbient&&now-lastOccasionalVoice<OCCASIONAL_COOLDOWN)return false;
  const previous=lastGroupSound.get(group);
  const options=sounds.length>1?sounds.filter(a=>a.src!==previous):sounds;
  const template=options[Math.floor(Math.random()*options.length)]||sounds[0];
  const voice=template.cloneNode(true);
  voice.volume=isSpecial?.75:isHit?.52:isAmbient?.50:.64;
  voice.playbackRate=isSpecial?1:(.95+Math.random()*.10);
  if(activeVoices.size>=MAX_SIMULTANEOUS_VOICES){
    const oldest=activeVoices.values().next().value;
    if(oldest){oldest.pause();activeVoices.delete(oldest);}
  }
  activeVoices.add(voice);
  const cleanup=()=>activeVoices.delete(voice);
  voice.addEventListener('ended',cleanup,{once:true});
  voice.addEventListener('error',cleanup,{once:true});
  voice.play().catch(error=>{cleanup();console.warn('Áudio '+group,error);});
  lastGroupPlayed.set(group,now);
  lastGroupSound.set(group,template.src);
  lastSoundName=template.src;
  lastSoundTime=now;
  if(isAmbient)lastOccasionalVoice=now;
  if(group==='bolsonaroEspecial')hadoukenVoiceUntil=now+500;
  return true;
}

// ========================================
// NORMALIZAÇÃO DOS SPRITES
// ========================================

// Coordenadas na arte original: topo do cabelo, sem contar o braço/efeito.
// A altura cabeça-sola vira os mesmos 180px do idle; nunca esticar por eixo.
const LULA_BOLSA_BODY_TOP={bolsaPrepare:317,bolsaSummon:390,bolsaFinal:22};

// Máscara cromática exclusiva do tecido azul saturado dos três PNGs.
// Neutros, contornos pretos, vermelhos e tons de pele ficam intactos.
function isBolsaSuitPixel(r,g,b,a){
  return a>20 && b>=40 && b<=205 && g<=125 &&
    b-r>=24 && b>g*1.45 && g>=r;
}

function suitTone(r,g,b){
  return Math.round(.2126*r+.7152*g+.0722*b);
}

function lulaSuitPalette(img){
  const canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth;
  canvas.height=img.naturalHeight;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  context.drawImage(img,0,0);
  const {data}=context.getImageData(0,0,canvas.width,canvas.height);
  const colors=[];
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
    // Tecido azul-marinho do idle; exclui camisa, pele e cabelo.
    if(a>20 && r>8 && g<=105 && b<=135 && b-r>12 && b>g*1.15 && g>=r){
      colors.push([r,g,b]);
    }
  }
  colors.sort((a,b)=>suitTone(...a)-suitTone(...b));
  return colors;
}

function matchBolsaSuit(imageData,palette){
  if(!palette.length)return;
  const {data}=imageData;
  const histogram=new Uint32Array(256);
  let count=0;
  for(let i=0;i<data.length;i+=4){
    if(isBolsaSuitPixel(data[i],data[i+1],data[i+2],data[i+3])){
      histogram[suitTone(data[i],data[i+1],data[i+2])]++;
      count++;
    }
  }
  if(!count)return;
  // Mapeamento monotônico: conserva a ordem das sombras/luzes e usa RGB
  // realmente presentes no terno de lula-idle.png, sem filtro global.
  const ramp=[];
  let cumulative=0;
  for(let tone=0;tone<256;tone++){
    const percentile=(cumulative+histogram[tone]/2)/count;
    ramp[tone]=palette[Math.min(palette.length-1,Math.floor(percentile*palette.length))];
    cumulative+=histogram[tone];
  }
  for(let i=0;i<data.length;i+=4){
    if(!isBolsaSuitPixel(data[i],data[i+1],data[i+2],data[i+3]))continue;
    const color=ramp[suitTone(data[i],data[i+1],data[i+2])];
    data[i]=color[0];data[i+1]=color[1];data[i+2]=color[2];
  }
}

function normalizeSprite(img,{cropOnly=false,bodyTop=null,suitPalette=null}={}){
  const source=document.createElement('canvas');

  source.width=img.naturalWidth;
  source.height=img.naturalHeight;

  const sctx=source.getContext(
    '2d',
    {willReadFrequently:true}
  );

  sctx.drawImage(img,0,0);

  const pixels=sctx.getImageData(
    0,
    0,
    source.width,
    source.height
  );
  const {data}=pixels;
  if(suitPalette){
    matchBolsaSuit(pixels,suitPalette);
    sctx.putImageData(pixels,0,0);
  }

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

  // A luva usa só o recorte, sem o espaço reservado aos pés do lutador.
  if(cropOnly){
    const crop=document.createElement('canvas');
    crop.width=cropWidth;
    crop.height=cropHeight;
    crop.getContext('2d').drawImage(
      source,minX,minY,cropWidth,cropHeight,
      0,0,cropWidth,cropHeight
    );
    return crop;
  }

  const scale=bodyTop!==null ? 180/(maxY+1-bodyTop) : Math.min(
    220/cropWidth,
    180/cropHeight
  );

  // As poses calibradas usam exatamente o mesmo fator nos dois eixos.
  const w=bodyTop!==null ? cropWidth*scale : Math.round(cropWidth*scale);
  const h=bodyTop!==null ? cropHeight*scale : Math.round(cropHeight*scale);

  const frame=document.createElement('canvas');

  frame.width=bodyTop!==null ? Math.max(280,Math.ceil(w)+32) : 280;
  frame.height=bodyTop!==null ? Math.max(256,Math.ceil(h)+32) : 256;

  const fctx=frame.getContext('2d');

  fctx.imageSmoothingEnabled=false;

  fctx.drawImage(
    source,
    minX,
    minY,
    cropWidth,
    cropHeight,
    bodyTop!==null ? (frame.width-w)/2 : Math.round((280-w)/2),
    frame.height-16-h,
    w,
    h
  );

  return frame;
}

// Borda preta pixelada: desenhada ao redor dos pixels visíveis,
// sem alterar o arquivo PNG original no repositório.
function addPixelOutline(sprite){
  const outlined=document.createElement('canvas');
  outlined.width=sprite.width;
  outlined.height=sprite.height;
  const octx=outlined.getContext('2d');
  octx.imageSmoothingEnabled=false;
  const thickness=1;
  for(let dy=-thickness;dy<=thickness;dy++){
    for(let dx=-thickness;dx<=thickness;dx++){
      if(dx===0 && dy===0)continue;
      if(Math.max(Math.abs(dx),Math.abs(dy))>thickness)continue;
      octx.drawImage(sprite,dx,dy);
    }
  }
  octx.globalCompositeOperation='source-in';
  octx.fillStyle='#090909';
  octx.fillRect(0,0,outlined.width,outlined.height);
  octx.globalCompositeOperation='source-over';
  octx.drawImage(sprite,0,0);
  return outlined;
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

const BOLSA_DAMAGE=25;
const BOLSA_COOLDOWN_MS=1400;
const BOLSA_SUMMON_MS=350;
const BOLSA_FALL_MS=380;
const BOLSA_DURATION_MS=1050;
let bolsaReadyAt=0;
let bolsaImpact=null;
let bolsaRound=game.round;

const KNOCKBACK_DISTANCE=95;
const LULA_WALL_X=100;
const BOLSONARO_WALL_X=860;
const HADOUKEN_DAMAGE=20;
const TAOK_DAMAGE=25;
const TAOK_COOLDOWN_MS=1400;
const TAOK_DURATION_MS=1100;
let taokReadyAt=0;
let taokImpact=null;
let taokRound=game.round;

let lulaX=290;
let lulaKnockback=null;
let bolsonaroX=670;
let bolsonaroKnockback=null;

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
      shieldL:'./assets/fighters/escudo-lula.png',
      shieldB:'./assets/fighters/escudo-chinelo.png',

      l:'./assets/fighters/lula-idle.png',
      b:'./assets/fighters/bolsonaro-idle.png',

      punch:'./assets/fighters/bolsonaro-attack.png',

      hadoukenPose:
        './assets/fighters/bolsonaro-hadouken.png',

      hadouken:
        './assets/fighters/hadouken-blue.png',

      lulaHadouken:
  './assets/fighters/hadouken-red.png',

      shoryuken:
        './assets/fighters/lula-shoryuken.png',

      bolsaPose:'./assets/fighters/lula-bolsa-pancada.png',
      bolsaPrepare:'./assets/fighters/lula-bolsa-preparo.png',
      bolsaSummon:'./assets/fighters/lula-bolsa-invocacao.png',
      bolsaFinal:'./assets/fighters/lula-bolsa-final.png',
      bolsaShadow:'./assets/fighters/bolsa-sombra.png',
      bolsaExplosion:'./assets/fighters/bolsa-explosao.png',

      bolsaGlove:
        './assets/fighters/bolsa-luva-gigante.png',

      knockback:
        './assets/fighters/lula-knockback.png',

      bolsonaroKnockbackPose:
        './assets/fighters/bolsonaro-knockback.png',

     lulaPunch:
  './assets/fighters/lula-punch.png',

lulaVictory:
  './assets/fighters/lula-victory.png',

taokPrepare:'./assets/fighters/bolsonaro-taok-preparo.png',
      taokShout:'./assets/fighters/bolsonaro-taok-grito.png',
      taokFinal:'./assets/fighters/bolsonaro-taok-final.png',
      taokWave:'./assets/fighters/taok-onda.png',
      taokBurst:'./assets/fighters/taok-impacto.png',

bolsonaroVictory:
  './assets/fighters/bolsonaro-victory.png'
  };

    // O idle deve estar disponível antes de extrair a paleta dos especiais.
    const lulaIdle=await loadImage(files.l);
    const suitPalette=lulaSuitPalette(lulaIdle);
    await Promise.all(
      Object.entries(files).map(
        async ([key,path])=>{
          const img=key==='l' ? lulaIdle : await loadImage(path);
          const bodyTop=LULA_BOLSA_BODY_TOP[key] ?? null;

          images[key]=(
            key==='arena' || key==='shieldL' || key==='shieldB' ||
            key==='hadouken' ||
            key==='lulaHadouken' ||
            key==='taokWave' ||
            key==='bolsaShadow' || key==='bolsaExplosion' ||
            key==='taokBurst'
          )
            ?img
            :normalizeSprite(img,{
              cropOnly:key==='bolsaGlove',bodyTop,
              suitPalette:bodyTop!==null ? suitPalette : null
            });
        }
      )
    );

    // Contorno preto pixelado para a pose de queda do Bolsonaro.
    // O novo PNG já possui borda preta; não adicionar uma segunda borda.
    // images.bolsonaroKnockbackPose mantém seu contorno original.

    // Pose opcional: mantém o jogo funcionando se ainda não existir.
    try{
      images.lulaHadoukenPose=normalizeSprite(await loadImage('./assets/fighters/lula-hadouken.png'));
    }catch(error){
      // Enquanto a nova pose não for enviada, usa a pose de soco.
      images.lulaHadoukenPose=images.lulaPunch || images.l;
    }

    // Artes opcionais nas laterais da arena: não impedem o jogo de iniciar.
    await Promise.all([
      ['sideHue','./assets/fighters/fundo-huehue.png'],
      ['sideRonaldinho','./assets/fighters/fundo-ronaldinho.png']
    ].map(async ([key,path])=>{
      try{ images[key]=await loadImage(path); }
      catch(error){ images[key]=null; }
    }));

    ready=true;

    $('loading').hidden=true;

    for(const id of [
      'attackL',
      'attackB',
      'shoryukenL',
      'specialL',
      'hadoukenB',
      'specialB'
    ]){
      const button=$(id);

      if(button){
        button.disabled=false;
      }
    }

    const specialButton=$('shoryukenL');
    if(specialButton){
      const label=specialButton.querySelector('span');
      if(label)label.textContent='HADOUKEN';
      specialButton.title='W — Hadouken vermelho do Lula';
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
  const facing=1;

  const baseX=side==='l'
    ?lulaX
    :bolsonaroX;

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

    if(sp.type==='taok'){
      const age=time-sp.start;
      sprite=age<200?images.taokPrepare:age<850?images.taokShout:images.taokFinal;
    }else if(sp.type==='lulaHadouken'){
      sprite=images.lulaHadoukenPose;

    }else if(sp.type==='hadouken'){
      sprite=images.hadoukenPose;
    }else if(sp.type==='bolsaPancada'){
      const age=time-sp.start;
      sprite=age<190?images.bolsaPrepare:age<790?images.bolsaSummon:images.bolsaFinal;
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

    if(game.attack===side || game.attack==='both'){
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

      const dashDirection=side==='l' ? 1 : -1;

x+=dashDirection*reach*Math.max(
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
      x+=(side==='l' ? -1 : 1)*(
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

  if(side==='b' && bolsonaroKnockback){
    const kb=bolsonaroKnockback;
    const progress=Math.min(1,Math.max(0,(time-kb.start)/kb.duration));
    const ease=1-Math.pow(1-progress,3);
    x=kb.from+(kb.to-kb.from)*ease;
    y-=65*Math.sin(progress*Math.PI);
    sprite=images.bolsonaroKnockbackPose;
    knockbackBlink=progress<.65 && Math.floor(progress*6/.65)%2===0;
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

  // Mantém a pose de queda do Bolsonaro inclinada,
  // sem a rotação extra que o deixava completamente deitado.
  if(side==='b' && bolsonaroKnockback){
    // Espelha a pose para que a queda acompanhe o empurrão para a direita.
    // A imagem já está inclinada, então não aplicar rotação adicional.
    ctx.translate(0,-8);
    ctx.scale(-1,1);
  }

  if(!knockbackBlink){
    // Quadros maiores acomodam o braço levantado. A âncora continua
    // no centro dos pés, a 16px da borda inferior, inclusive no idle.
    ctx.drawImage(
      sprite,
      -sprite.width/2,
      16-sprite.height
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

  ctx.save();
  // Tremor curto em passos inteiros para preservar o visual pixelado.
  const shakeImpact=(taokImpact && time-taokImpact.start<320)?taokImpact:bolsaImpact;
  if(shakeImpact && !reduceMotion){
    const elapsed=time-shakeImpact.start;
    const strength=8*Math.max(0,1-elapsed/220);
    ctx.translate(
      Math.round(Math.sin(elapsed*.18)*strength),
      Math.round(Math.cos(elapsed*.23)*strength)
    );
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

    const impactXs=game.attack==='both' ? [lulaX+200,bolsonaroX-200] : [game.attack==='l' ? lulaX+300 : bolsonaroX-300];

    const y=337;

    for(const x of impactXs){
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

      // O projétil nasce na luva do Bolsonaro,
      // independentemente da posição dele na arena.
      const x=specialEffect.originX-105-progress*570;

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
// Hadouken vermelho do Lula.
if(
  specialEffect?.type==='lulaHadouken'
){
  const t=Math.min(
    1,
    (time-specialEffect.start)/specialEffect.duration
  );

  if(t>=0.12){
    const progress=(t-0.12)/0.88;

    // Sai do Lula e vai para a direita.
    const x=specialEffect.originX+100+progress*520;

    ctx.save();

    ctx.translate(x,290);

    ctx.drawImage(
      images.lulaHadouken,
      -125,-80,250,160
    );

    ctx.restore();
  }
}
  drawBolsaPancada(time);
  drawTaok(time);
  drawShields(time);
  ctx.restore();

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
      (game.winner==='draw' ? 'EMPATE!' : names[game.winner]+' VENCEU O ROUND'),
      480,
      192
    );
  }
}

// ========================================
// HUD E PLACAR
// ========================================

// HP anterior exclusivo dos efeitos visuais do HUD.
const previousHudHP={l:game.hp.l,b:game.hp.b};
for(const side of ['l','b']){
  const panel=$('hp'+(side==='l'?'L':'B'))?.closest('.player');
  if(panel){
    panel.addEventListener('animationend',event=>{
      if(event.animationName==='hud-impact')panel.classList.remove('damage-hit');
    });
  }
}

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
      const hp=Math.max(0,Math.min(MAX_HP,game.hp[side]));
      const lifeLabel=$('life'+id);
      if(lifeLabel)lifeLabel.textContent='HP '+Math.round(hp)+'/'+MAX_HP;

      // Pisca e treme somente ao perder HP, não ao reiniciar o round.
      if(hp<previousHudHP[side]){
        const panel=$('hp'+id).closest('.player');
        if(panel){
          panel.classList.remove('damage-hit');
          void panel.offsetWidth;
          panel.classList.add('damage-hit');
        }
      }
      previousHudHP[side]=hp;

      $('hp'+id).style.width=
        (hp/MAX_HP*100)+'%';

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
      (game.winner==='draw' ? 'EMPATE!' : names[game.winner]+' VENCEU!');

  }else if(
    game.attack &&
    game.attack!==statusAttack
  ){
    $('message').textContent=
      (game.attack==='both' ? 'ATAQUE SIMULTÂNEO!' : names[game.attack]+' ATACA!');

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
    if(attacking==='both'){
      playSound('lulaSoco');
      playSound('bolsonaroSoco');
    }else{
      playSound(attacking==='l' ? 'lulaSoco' : 'bolsonaroSoco');
    }
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
      if(game.winner!=='draw')playSound(game.winner==='l' ? 'lulaVitoria' : 'bolsonaroVitoria');

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
      !lulaKnockback &&
      !bolsonaroKnockback
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
 // TELA DE VITÓRIA ARCADE
 // ========================================

let victoryStart=0;
let victoryWinner=null;

const victoryConfetti=Array.from(
  {length:85},
  (_,i)=>({
    x:Math.random()*960,
    y:Math.random()*540,
    speed:1+Math.random()*2.8,
    size:3+Math.random()*6,
    drift:Math.random()*3,
    color:[
      '#ffd700',
      '#ffffff',
      '#ff4444',
      '#44ddff',
      '#ff88dd'
    ][i%5]
  })
);

const victoryPhrases={
  l:{
    title:'LULA CAMPEÃO!',
    phrase:'NUNCA ANTES NA HISTÓRIA DESSE PAÍS...',
    color:'#ff4747',
    glow:'#ffb347'
  },
  b:{
    title:'BOLSONARO CAMPEÃO!',
    phrase:'ACABOU, PORRA! HAHAHA!',
    color:'#45bbff',
    glow:'#ffe36e'
  }
};


const VICTORY_FONT='"Press Start 2P", monospace';

function victoryText(text,x,y,size,color='#fff4cf',maxWidth=900){
  ctx.save();
  ctx.font=size+'px '+VICTORY_FONT;
  ctx.fillStyle='#070916';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(text,x+3,y+4,maxWidth);
  ctx.fillStyle=color;
  ctx.fillText(text,x,y,maxWidth);
  ctx.restore();
}

function victoryPixelFrame(x,y,w,h,accent){
  ctx.fillStyle='#060812';
  ctx.fillRect(x-8,y-8,w+16,h+16);
  ctx.fillStyle=accent;
  ctx.fillRect(x-4,y-4,w+8,h+8);
  ctx.fillStyle='#11162c';
  ctx.fillRect(x+3,y+3,w-6,h-6);
  ctx.fillStyle='#fff2ae';
  for(let px=x+12;px<x+w-12;px+=24){
    ctx.fillRect(px,y-4,8,4);
    ctx.fillRect(px,y+h,8,4);
  }
}

function drawVictoryBubble(x,y,w,h,phrase){
  ctx.save();
  victoryPixelFrame(x,y,w,h,'#d5a444');
  ctx.fillStyle='#fff7dc';
  ctx.fillRect(x+10,y+10,w-20,h-20);
  ctx.fillStyle='#15182b';
  ctx.fillRect(x+18,y+18,w-36,h-36);
  ctx.fillStyle='#ffd966';
  ctx.fillRect(x+18,y+18,w-36,5);
  victoryText('FALA DO CAMPEAO',x+w/2,y+36,11,'#ffe17b',w-44);
  const words=phrase.split(' ');
  const lines=[];
  let line='';
  ctx.font='12px '+VICTORY_FONT;
  for(const word of words){
    const candidate=line?line+' '+word:word;
    if(ctx.measureText(candidate).width>w-70 && line){
      lines.push(line);line=word;
    }else line=candidate;
  }
  if(line)lines.push(line);
  const lineHeight=25;
  const firstY=y+78-(lines.length-1)*lineHeight/2;
  lines.forEach((line,i)=>victoryText(line,x+w/2,firstY+i*lineHeight,12,'#fff9e8',w-64));
  // Ponteiro quadrado do balão.
  ctx.fillStyle='#d5a444';
  ctx.fillRect(x+68,y+h+4,36,8);
  ctx.fillRect(x+78,y+h+12,18,8);
  ctx.restore();
}

function drawVictoryScreen(now){
  if(game.phase!=='ko'){
    victoryWinner=null;
    victoryStart=0;
    return;
  }
  if(victoryWinner!==game.winner){
    victoryWinner=game.winner;
    victoryStart=now;
  }
  const isDraw=game.winner==='draw';
  const info=isDraw?null:victoryPhrases[game.winner];
  if(!isDraw&&!info)return;
  const elapsed=now-victoryStart;
  const t=elapsed/1000;
  const sprite=isDraw?null:(game.winner==='l'?images.lulaVictory:images.bolsonaroVictory);
  const accent=isDraw?'#c7c8d4':(game.winner==='l'?'#ff575e':'#48c8ff');

  ctx.save();
  ctx.imageSmoothingEnabled=false;
  // Arena ainda visível sob o overlay.
  ctx.fillStyle='rgba(5,8,22,0.9)';
  ctx.fillRect(0,0,960,540);

  // Moldura externa, cantos e barras em pixels.
  ctx.fillStyle='#060713';
  ctx.fillRect(8,8,944,524);
  ctx.fillStyle='#d9a441';
  ctx.fillRect(14,14,932,6);
  ctx.fillRect(14,520,932,6);
  ctx.fillRect(14,14,6,512);
  ctx.fillRect(940,14,6,512);
  ctx.fillStyle='#fff2a0';
  for(let i=0;i<12;i++){
    const x=40+i*78;
    ctx.fillRect(x,24,26,4);
    ctx.fillRect(x,512,26,4);
  }

  // Raios retrô, sem suavização.
  ctx.save();
  ctx.translate(315,295);
  for(let i=0;i<16;i++){
    const angle=i*Math.PI/8+(reduceMotion?0:t*.08);
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle=i%2===0?'#8b692d35':'#ffdf7630';
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-23,-480);
    ctx.lineTo(23,-480);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Confetes e faíscas em quadradinhos.
  if(!reduceMotion){
    for(const c of victoryConfetti){
      const cy=(c.y+elapsed*c.speed*.07)%530;
      const cx=c.x+Math.sin(t*2+c.drift)*15;
      ctx.fillStyle=c.color;
      ctx.fillRect(Math.round(cx),Math.round(cy),c.size,c.size);
    }
  }

  // Placa superior de campeão.
  victoryPixelFrame(55,35,850,115,'#dca83d');
  ctx.fillStyle='#090d1e';
  ctx.fillRect(63,43,834,99);
  victoryText('STREET VOTE FIGHTER',480,60,14,'#ffdd76',810);
  victoryText(isDraw?'EMPATE!':'VITORIA!',480,104,37,isDraw?'#f0f0ff':'#fff3a1',790);

  if(isDraw){
    victoryPixelFrame(175,204,610,198,'#b1b5d2');
    victoryText('DOUBLE K.O.',480,265,30,'#ffe176',550);
    victoryText('OS DOIS CAIRAM!',480,335,16,'#fff5df',550);
  }else{
    // Painel lateral do vencedor.
    victoryPixelFrame(50,174,402,287,accent);
    ctx.fillStyle='#0b1024';
    ctx.fillRect(59,183,384,269);
    victoryText('CAMPEAO',252,207,15,'#ffe186',350);
    victoryText(game.winner==='l'?'LULA':'BOLSONARO',252,245,21,accent,370);

    // Sprite original com cinturão, em primeiro plano.
    if(sprite){
      const bounce=reduceMotion?0:Math.round(Math.sin(t*3.5)*4);
      ctx.save();
      ctx.translate(251,468+bounce);
      ctx.scale(1.32,1.32);
      ctx.drawImage(sprite,-140,-240);
      ctx.restore();
    }

    // Fala do campeão.
    drawVictoryBubble(492,197,397,142,info.phrase);
    victoryText('ROUND '+String(game.round).padStart(2,'0'),690,388,14,'#ffe4a1',380);
    victoryText('K.O.!',690,437,27,accent,350);
  }

  // Rodapé.
  ctx.fillStyle='#080c1c';
  ctx.fillRect(24,477,912,33);
  ctx.fillStyle='#e7b94d';
  ctx.fillRect(24,477,912,4);
  victoryText('STREET VOTE CHAMPION',480,497,13,'#fff1bc',870);
  ctx.restore();
}

// ========================================
// BOLSA PANCADA — E
// ========================================

function startBolsaPancada(){
  const now=performance.now();
  if(
    !ready ||
    game.phase!=='ready' ||
    specialEffect ||
    lulaKnockback ||
    game.hp.l<=0 ||
    game.hp.b<=0 ||
    now<bolsaReadyAt
  ){
    return;
  }

  bolsaReadyAt=now+BOLSA_COOLDOWN_MS;
  specialEffect={
    type:'bolsaPancada',
    side:'l',
    start:now,
    duration:BOLSA_DURATION_MS,
    round:game.round,
    x:bolsonaroX,
    hit:false
  };
  $('message').textContent='LULA — BOLSA PANCADA!';
  playSound('lulaBolsa');
  updateBolsaButton(now);
}

function updateBolsaButton(now){
  const button=$('specialL');
  if(!button) return;
  const seconds=Math.ceil(Math.max(0,bolsaReadyAt-now)/1000);
  button.disabled=(
    !ready || game.phase!=='ready' || !!specialEffect ||
    !!lulaKnockback || game.hp.l<=0 || game.hp.b<=0 || seconds>0
  );
  const label=seconds>0
    ?'BOLSA PANCADA · '+seconds+'s'
    :'BOLSA PANCADA';
  const span=button.querySelector('span');
  if(span && span.textContent!==label) span.textContent=label;
  button.title=seconds>0
    ?'Recarregando: '+seconds+'s'
    :'E — Bolsa Pancada (25 HP; recarga de 1,4 segundos)';
}

function updateBolsaPancada(now){
  // Nenhum efeito de um round anterior pode atingir o próximo.
  if(bolsaRound!==game.round){
    bolsaRound=game.round;
    bolsaImpact=null;
    if(specialEffect?.type==='bolsaPancada') specialEffect=null;
  }
  if(bolsaImpact && now-bolsaImpact.start>=420) bolsaImpact=null;

  const sp=specialEffect;
  if(sp?.type!=='bolsaPancada') return;
  if(
    game.phase==='ko' || sp.round!==game.round ||
    game.hp.l<=0 || (game.hp.b<=0 && !sp.hit)
  ){
    specialEffect=null;
    return;
  }

  if(!sp.hit && now-sp.start>=BOLSA_SUMMON_MS+BOLSA_FALL_MS){
    sp.hit=true;
    if(shieldOn('b',now))shieldImpact('b',now);
    else game.hp.b=Math.max(0,game.hp.b-BOLSA_DAMAGE);
    bolsaImpact={start:now,x:sp.x};
    const from=bolsonaroX;
    const to=Math.min(BOLSONARO_WALL_X,from+KNOCKBACK_DISTANCE);
    bolsonaroKnockback={start:now,duration:600,from,to};
    bolsonaroX=to;
    if(shieldOn('b',now)){bolsonaroKnockback=null;bolsonaroX=from;shieldImpact('b',now);}
    if(!shieldOn('b',now))playSound('bolsonaroDano');

    // O mesmo estado de K.O. usado pelos outros golpes mantém
    // áudio de vitória, placar e avanço automático de rounds.
    if(game.hp.b===0){
      game.phase='ko';
      game.attack=null;
      game.hit=false;
      game.winner='l';
      game.wins.l++;
      game.elapsed=0;
      specialEffect=null;
    }
  }
}

function drawBolsaPancada(now){
  const sp=specialEffect;
  if(sp?.type==='bolsaPancada'){
    const elapsed=now-sp.start;
    if(elapsed>=180 && !sp.hit){
      const pulse=reduceMotion?0:Math.sin(elapsed/65)*0.07;
      const w=270*(1+pulse),h=68*(1+pulse);
      ctx.save();
      ctx.globalAlpha=.88;
      ctx.drawImage(images.bolsaShadow,sp.x-w/2,449-h/2,w,h);
      ctx.restore();
    }
    if(elapsed>=BOLSA_SUMMON_MS && !sp.hit){
      const t=Math.min(1,(elapsed-BOLSA_SUMMON_MS)/BOLSA_FALL_MS);
      const height=245;
      const width=height*images.bolsaGlove.width/images.bolsaGlove.height;
      const bottom=-25+477*t*t;
      ctx.drawImage(images.bolsaGlove,sp.x-width/2,bottom-height,width,height);
    }
  }
  if(!bolsaImpact)return;
  const age=now-bolsaImpact.start;
  const t=Math.min(1,age/420);
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  ctx.globalAlpha=1-t;
  const size=270+110*t;
  ctx.drawImage(images.bolsaExplosion,bolsaImpact.x-size/2,305-size/2,size,size);
  for(let i=0;i<16;i++){
    const angle=i*Math.PI/8,distance=24+t*105,px=i%2?8:12;
    ctx.fillStyle=i%3===0?'#fff8da':'#ffce65';
    ctx.fillRect(Math.round(bolsaImpact.x+Math.cos(angle)*distance),Math.round(310+Math.sin(angle)*distance),px,px);
  }
  for(let i=0;i<12;i++){
    const direction=i%2?1:-1,distance=(12+i*5)*(1+t*2);
    ctx.fillStyle=i%2?'#c9ac83':'#8d775f';
    ctx.fillRect(Math.round(bolsaImpact.x+direction*distance),Math.round(482-Math.sin(t*Math.PI)*(12+i*3)),12+i%3*4,8+i%3*4);
  }
  ctx.restore();
}

function startTaok(){
  const now=performance.now();
  if(!ready || game.phase!=='ready' || specialEffect ||
     lulaKnockback || bolsonaroKnockback ||
     game.hp.l<=0 || game.hp.b<=0 || now<taokReadyAt)return;
  taokReadyAt=now+TAOK_COOLDOWN_MS;
  specialEffect={
    type:'taok',side:'b',start:now,duration:TAOK_DURATION_MS,
    originX:bolsonaroX,round:game.round,hit:false
  };
  $('message').textContent='BOLSONARO — TÁ OK!';
  // Voz exclusiva do megafone, independente do Hadouken azul.
  playSound('bolsonaroTaok');
  updateTaokButton(now);
}

function updateTaokButton(now){
  const button=$('specialB');
  if(!button)return;
  const seconds=Math.ceil(Math.max(0,taokReadyAt-now)/1000);
  button.disabled=!ready || game.phase!=='ready' || !!specialEffect ||
    !!lulaKnockback || !!bolsonaroKnockback ||
    game.hp.l<=0 || game.hp.b<=0 || seconds>0;
  const span=button.querySelector('span');
  if(span)span.textContent=seconds>0?'TÁ OK! · '+seconds+'s':'TÁ OK!';
  button.title=seconds>0?'Recarga: '+seconds+'s':'P — TÁ OK! (25 HP; 1,4s)';
}

function updateTaok(now){
  if(taokRound!==game.round){
    taokRound=game.round;
    taokImpact=null;
    if(specialEffect?.type==='taok')specialEffect=null;
  }
  if(taokImpact && now-taokImpact.start>=420)taokImpact=null;
  const sp=specialEffect;
  if(sp?.type!=='taok')return;
  if(game.phase==='ko' || sp.round!==game.round ||
     game.hp.l<=0 || game.hp.b<=0){
    specialEffect=null;
    return;
  }
  if(!sp.hit && now-sp.start>=750){
    sp.hit=true;
    const from=lulaX;
    const to=Math.max(LULA_WALL_X,from-KNOCKBACK_DISTANCE);
    lulaKnockback={start:now,duration:600,from,to};
    lulaX=to;
    if(shieldOn('l',now)){lulaKnockback=null;lulaX=from;shieldImpact('l',now);}
    taokImpact={start:now,x:from};
    if(shieldOn('l',now))shieldImpact('l',now);
    else game.hp.l=Math.max(0,game.hp.l-TAOK_DAMAGE);
    if(!shieldOn('l',now))playSound('lulaDano');
    if(game.hp.l===0){
      game.phase='ko';game.attack=null;game.hit=false;
      game.winner='b';game.wins.b++;game.elapsed=0;
      // Preserva o efeito do impacto durante o início do K.O.
      specialEffect=null;
    }
  }
}

function drawTaok(now){
  const sp=specialEffect;
  if(sp?.type==='taok'){
    const elapsed=now-sp.start;
    if(elapsed>=320 && elapsed<850){
      const progress=Math.min(1,(elapsed-320)/430);
      const x=sp.originX-110-progress*(sp.originX-LULA_WALL_X-15);
      // Projétil mais largo, sem alterar sua altura nem a duração do golpe.
      const w=440,h=145;
      ctx.save();
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(images.taokWave,Math.round(x-w/2),255-h/2,w,h);
      ctx.restore();
    }
  }
  if(taokImpact){
    const elapsed=now-taokImpact.start;
    const p=Math.min(1,elapsed/420);
    ctx.save();
    ctx.globalAlpha=1-p;
    const size=195+Math.round(p*110);
    ctx.drawImage(images.taokBurst,
      Math.round(taokImpact.x-size/2),
      Math.round(315-size/2),size,size);
    ctx.restore();
  }
}


// Escudos independentes para interações da live (5 segundos cada).
const SHIELD_DURATION_MS=5000;
const shieldUntil={l:0,b:0};
let shieldRound=game.round;
function shieldOn(side,now=performance.now()){
  return game.phase!=='ko' && now<shieldUntil[side];
}
function activateShield(side){
  if(!ready || game.phase==='ko')return;
  const now=performance.now();
  shieldUntil[side]=now+SHIELD_DURATION_MS;
  game.shieldActive[side]=true;
  updateShieldButtons(now);
}
// Interface para futura integração de presentes/eventos da live.
window.streetVoteShield=side=>{if(side==='l'||side==='b')activateShield(side);};
function updateShieldButtons(now){
  for(const side of ['l','b']){
    const button=$('shield'+(side==='l'?'L':'B'));
    if(!button)continue;
    const remaining=Math.max(0,shieldUntil[side]-now);
    button.classList.toggle('shield-on',remaining>0);
    button.textContent=(side==='l'?'🛡 LULA':'🛡 BOLSO')+
      (remaining>0?' '+(remaining/1000).toFixed(1)+'s':' +5s');
    button.setAttribute('aria-pressed',String(remaining>0));
  }
}
$('shieldL')?.addEventListener('click',()=>activateShield('l'));
$('shieldB')?.addEventListener('click',()=>activateShield('b'));
document.addEventListener('keydown',event=>{
  if(event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;
  if(event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(event.code==='Digit1'){event.preventDefault();activateShield('l');}
  if(event.code==='Digit2'){event.preventDefault();activateShield('b');}
});
// Bolhas premium: centro limpo, energia concentrada nas bordas.
const shieldImpactAt={l:-1e9,b:-1e9};
function shieldImpact(side,now=performance.now()){
  if(shieldOn(side,now))shieldImpactAt[side]=now;
}
function drawShields(now){
  for(const side of ['l','b']){
    if(!shieldOn(side,now))continue;
    const isLula=side==='l';
    const x=isLula?lulaX+5:bolsonaroX-5;
    const remaining=shieldUntil[side]-now;
    const elapsed=SHIELD_DURATION_MS-remaining;
    const p=reduceMotion?0:Math.sin(now/210);
    const radius=190+p*2;
    const rx=radius,ry=radius;
    const primary=isLula?'255,66,79':'54,237,122';
    const secondary=isLula?'255,196,62':'255,221,64';
    const tertiary=isLula?'255,122,130':'62,193,255';
    const activation=reduceMotion?1:Math.min(1,elapsed/230);
    const fade=Math.min(1,remaining/400);
    const hit=Math.max(0,1-(now-shieldImpactAt[side])/340);
    ctx.save();
    ctx.translate(x,315);
    ctx.globalAlpha=fade;
    ctx.scale(.84+.16*activation,.84+.16*activation);
    // Escudos de meme enviados ao GitHub: PNG original, centro transparente.
    // O desenho procedural abaixo continua como fallback se o arquivo falhar.
    const shieldArt=images[isLula?'shieldL':'shieldB'];
    if(shieldArt?.complete && shieldArt.naturalWidth>0){
      const wobble=reduceMotion?0:Math.sin(now/170)*2;
      const impactScale=1+hit*.045;
      ctx.save();
      ctx.scale(impactScale,impactScale);
      ctx.imageSmoothingEnabled=false;
      // Abertura transparente alinhada ao corpo, sem cobrir o personagem.
      // Brilho sutil ao ativar, impacto mais visível e fade de saída.
      // Fora do impacto fica translúcido; no impacto atinge 100% de opacidade.
      // O brilho permanece no máximo por um instante e volta suavemente.
      const impactOpacity=hit>0 ? (hit>.65 ? 1 : .54+(hit/.65)*.46) : .54;
      ctx.globalAlpha=impactOpacity * fade;

      ctx.drawImage(shieldArt,-154-wobble/2,-248-wobble/2,308+wobble,434+wobble);
      ctx.globalAlpha=fade;
      // Contorno de proteção separado da arte, sem cobrir o lutador.
      ctx.strokeStyle=isLula?'rgba(255,204,79,.38)':'rgba(89,224,255,.38)';
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.ellipse(0,-12,133,170,0,0,Math.PI*2);
      ctx.stroke();
      if(hit>0){
        ctx.strokeStyle='rgba(255,255,255,'+(hit*.85)+')';
        ctx.lineWidth=4;
        ctx.beginPath();
        ctx.ellipse(0,5,145+hit*12,181+hit*12,0,0,Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
      continue;
    }
    const ellipse=(x0,y0,r1,r2,begin=0,end=Math.PI*2)=>{
      ctx.beginPath();ctx.ellipse(x0,y0,r1,r2,0,begin,end);
    };
    // Película vítrea extremamente leve para não ocultar o lutador.
    const glass=ctx.createRadialGradient(-32,-48,12,0,0,ry);
    glass.addColorStop(0,'rgba(255,255,255,0.005)');
    glass.addColorStop(.64,'rgba('+tertiary+',0.018)');
    glass.addColorStop(.84,'rgba('+primary+',0.045)');
    glass.addColorStop(1,'rgba('+primary+',0.13)');
    ctx.fillStyle=glass;ellipse(0,0,rx,ry);ctx.fill();
    // Halo de energia externo com camadas, sem sombra borrada.
    ctx.strokeStyle='rgba('+primary+','+(.12+hit*.2)+')';
    ctx.lineWidth=16;ellipse(0,0,rx+2,ry+2);ctx.stroke();
    ctx.strokeStyle='rgba('+tertiary+',.42)';
    ctx.lineWidth=9;ellipse(0,0,rx+1,ry+1);ctx.stroke();
    ctx.strokeStyle='rgba('+primary+',.98)';
    ctx.lineWidth=4;ellipse(0,0,rx,ry);ctx.stroke();
    ctx.strokeStyle='rgba('+secondary+',.85)';
    ctx.lineWidth=2;ellipse(0,0,rx-6,ry-8);ctx.stroke();
    // Arcos energéticos girando pela superfície, estilo fliperama.
    for(let i=0;i<4;i++){
      const start=i*Math.PI/2+(reduceMotion?0:now/1150)*(isLula?1:-1);
      ctx.strokeStyle='rgba('+(i%2?secondary:tertiary)+',.92)';
      ctx.lineWidth=i%2?4:3;
      ellipse(0,0,rx+3,ry+3,start,start+.35+p*.025);ctx.stroke();
    }
    // Reflexo de vidro curvo nas bordas, sem cruzar o rosto.
    ctx.strokeStyle='rgba(255,255,255,.72)';
    ctx.lineWidth=3;
    ellipse(0,0,rx-13,ry-17,3.53,4.26);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.32)';
    ctx.lineWidth=2;
    ellipse(0,0,rx-15,ry-20,5.62,6.08);ctx.stroke();
    // Pequenos pixels orbitais e estrelas pontuais.
    for(let i=0;i<9;i++){
      const t=i*Math.PI*2/9+(reduceMotion?0:now/1700)*(isLula?1:-1);
      const px=Math.cos(t)*(rx+7),py=Math.sin(t)*(ry+7);
      const size=i%3===0?5:3;
      ctx.fillStyle=i%2?'rgb('+secondary+')':'rgb('+tertiary+')';
      ctx.fillRect(Math.round(px-size/2),Math.round(py-size/2),size,size);
      if(i%3===0){
        ctx.fillStyle='rgba(255,255,255,.85)';
        ctx.fillRect(Math.round(px),Math.round(py)-5,1,11);
        ctx.fillRect(Math.round(px)-5,Math.round(py),11,1);
      }
    }
    // Explosão curta na ativação e ao bloquear golpes.
    const burst=Math.max(hit,elapsed<300?1-elapsed/300:0);
    if(burst>0){
      ctx.globalAlpha=fade*burst*.75;
      ctx.strokeStyle='rgb('+secondary+')';ctx.lineWidth=5;
      ellipse(0,0,rx+8+(1-burst)*18,ry+8+(1-burst)*18);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=2;
      ellipse(0,0,rx+5+(1-burst)*14,ry+5+(1-burst)*14);ctx.stroke();
    }
    ctx.restore();
  }
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
  if(shieldRound!==game.round){shieldRound=game.round;shieldUntil.l=0;shieldUntil.b=0;}
  game.shieldActive.l=shieldOn('l',now);
  game.shieldActive.b=shieldOn('b',now);
  updateShieldButtons(now);

  // Fim do knockback.
  if(
    lulaKnockback &&
    now-lulaKnockback.start>=
      lulaKnockback.duration
  ){
    lulaKnockback=null;
  }

  if(bolsonaroKnockback && now-bolsonaroKnockback.start>=bolsonaroKnockback.duration){
    bolsonaroKnockback=null;
  }

  updateBolsaPancada(now);
  updateTaok(now);

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
      if(shieldOn('l',now)){lulaKnockback=null;lulaX=from;shieldImpact('l',now);}

      if(!shieldOn('l',now))game.hp.l=Math.max(
        0,
        game.hp.l-HADOUKEN_DAMAGE
      );

      // Reação ao Hadouken é ocasional,
      // para não cortar o grito do golpe.
      if(!shieldOn('l',now))playSound('lulaDano');

      if(game.hp.l===0){
        game.phase='ko';
        game.attack=null;
        game.winner='b';
        game.wins.b++;
        game.elapsed=0;
      }
    }

    if(
      specialEffect?.type==='lulaHadouken' &&
      !specialEffect.hit &&
      t>=0.55
    ){
      specialEffect.hit=true;
      const from=bolsonaroX;
      const to=Math.min(BOLSONARO_WALL_X,from+KNOCKBACK_DISTANCE);
      bolsonaroKnockback={start:now,duration:600,from,to};
      bolsonaroX=to;
      if(shieldOn('b',now)){bolsonaroKnockback=null;bolsonaroX=from;shieldImpact('b',now);}
      if(!shieldOn('b',now))game.hp.b=Math.max(0,game.hp.b-HADOUKEN_DAMAGE);
      if(!shieldOn('b',now))playSound('bolsonaroDano');
      if(game.hp.b===0){
        game.phase='ko';
        game.attack=null;
        game.hit=false;
        game.winner='l';
        game.wins.l++;
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
    const beforeHit=game.hit;
    const beforePhase=game.phase;
    const beforeAttack=game.attack;
    game.advance(dt);
    // Detecta o golpe normal bloqueado, mesmo quando a vida não muda.
    if(game.hit && (!beforeHit || beforePhase!=='attack')){
      const attacking=game.attack||beforeAttack;
      if((attacking==='b'||attacking==='both')&&shieldOn('l',now))shieldImpact('l',now);
      if((attacking==='l'||attacking==='both')&&shieldOn('b',now))shieldImpact('b',now);
    }
  }

updateFightAudio(now);
paint(now);
drawVictoryScreen(now);
updateHUD();
updateBolsaButton(now);
updateTaokButton(now);

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

// W - Hadouken vermelho do Lula.
$('shoryukenL').onclick=()=>{
  if(
    !ready ||
    game.phase!=='ready' ||
    specialEffect ||
    lulaKnockback ||
    bolsonaroKnockback
  ){
    return;
  }

  specialEffect={
    type:'lulaHadouken',
    side:'l',
    start:performance.now(),
    duration:850,
    originX:lulaX,
    hit:false,
    round:game.round
  };

  // Apenas 35% de chance de falar.
  playSound('lulaHadouken');
};

// E - Bolsa Pancada do Lula.
$('specialL').onclick=startBolsaPancada;

// O - Hadouken do Bolsonaro.
$('hadoukenB').onclick=()=>{
  if(
    !ready ||
    game.phase!=='ready' ||
    specialEffect ||
    lulaKnockback ||
    bolsonaroKnockback
  ){
    return;
  }

  specialEffect={
    type:'hadouken',
    side:'b',
    start:performance.now(),
    duration:850,
    hit:false,
    originX:bolsonaroX,
    round:game.round
  };

  // SEMPRE fala no Hadouken.
  playSound('bolsonaroEspecial');
};

// P - Especial TÁ OK! do Bolsonaro.
$('specialB').onclick=startTaok;

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
      e:'specialL',
      i:'attackB',
      o:'hadoukenB',
      p:'specialB'
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
  bolsonaroX=670;
  bolsonaroKnockback=null;
  specialEffect=null;
  bolsaImpact=null;
  bolsaReadyAt=0;
  shieldUntil.l=0;shieldUntil.b=0;
  game.shieldActive.l=false;game.shieldActive.b=false;
  shieldRound=game.round;
  updateShieldButtons(performance.now());
  bolsaRound=game.round;
  taokReadyAt=0;
  taokImpact=null;
  taokRound=game.round;
  updateBolsaButton(performance.now());
  updateTaokButton(performance.now());

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

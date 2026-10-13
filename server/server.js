import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {timingSafeEqual} from 'node:crypto';
import {LiveReceiver,normalizeTikTok} from './live-events.js';

export function createLiveServer({token,config={},root=fileURLToPath(new URL('../',import.meta.url))}={}) {
  if(typeof token!=='string'||token.length<24) throw new Error('LIVE_EVENT_TOKEN must contain at least 24 characters');
  const receiver=new LiveReceiver(config),clients=new Set();
  let rateStart=Date.now(),requests=0;
  const publish=event=>{const command=receiver.receive(event);if(command) for(const client of clients) {
    if(client.writableLength>65536) {client.destroy();continue;}
    client.write('data: '+JSON.stringify(command)+'\n\n');
  } return command;};
  const server=http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/live/events'&&req.method==='POST') {
      const supplied=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
      if(supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) {res.writeHead(401).end();return;}
      if(Date.now()-rateStart>=1000){rateStart=Date.now();requests=0;}
      if(++requests>100){res.writeHead(429).end();return;}
      if(req.headers['content-type']?.split(';')[0]!=='application/json'){res.writeHead(415).end();return;}
      let body='';
      try {
        for await(const chunk of req) {body+=chunk;if(Buffer.byteLength(body)>8192){res.writeHead(413).end();return;}}
        const command=publish(JSON.parse(body));
        res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({accepted:!!command}));
      }catch {res.writeHead(400).end();}
      return;
    }
    if(url.pathname==='/live/stream'&&req.method==='GET') {
      if(clients.size>=10){res.writeHead(503).end();return;}
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'});
      res.write(': connected\n\n');clients.add(res);
      const timer=setInterval(()=>res.write(': keepalive\n\n'),15000);
      res.on('close',()=>{clearInterval(timer);clients.delete(res);});return;
    }
    // Serve only public game files; never expose server/config/secrets.
    const path=url.pathname==='/'?'index.html':url.pathname.slice(1);
    if(req.method!=='GET'||!(/^(index\.html|src\/[\w.-]+\.(js|css)|assets\/[\w./-]+|[^/]+\.png)$/.test(path))) {res.writeHead(404).end();return;}
    const absolute=resolve(root,path);
    if(!absolute.startsWith(resolve(root)+sep)){res.writeHead(404).end();return;}
    try {const data=await readFile(absolute);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}
  });
  server.on('close',()=>{for(const client of clients)client.destroy();});
  return {server,publish};
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const config=JSON.parse(await readFile(process.env.LIVE_GIFT_CONFIG||new URL('../config/gifts.example.json',import.meta.url),'utf8'));
  const {server,publish}=createLiveServer({token:process.env.LIVE_EVENT_TOKEN,config});
  if(process.env.TIKTOK_USERNAME) {
    const {TikTokLiveConnection,WebcastEvent}=await import('tiktok-live-connector');
    const connection=new TikTokLiveConnection(process.env.TIKTOK_USERNAME,{enableExtendedGiftInfo:true});
    connection.on(WebcastEvent.CHAT,event=>publish(normalizeTikTok('chat',event)));
    connection.on(WebcastEvent.GIFT,event=>{
      const details=event.gift??event.giftDetails;
      if(!config || !Object.values(config).includes(String(event.giftId))) {
        console.log('Unmapped gift',JSON.stringify({giftId:event.giftId,name:details?.name??details?.giftName,coins:details?.diamondCount}));
      }
      publish(normalizeTikTok('gift',event));
    });
    connection.on('error',()=>console.error('TikTok connection error'));
    connection.on('disconnected',()=>console.error('TikTok disconnected; restart receiver to reconnect'));
    await connection.connect();
    server.on('close',()=>connection.disconnect());
  }
  server.listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log('Street Vote live receiver ready'));
}

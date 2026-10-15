const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const PORT=process.env.PORT||3000,CH=['general','memes','gaming','music'];
const FILE=path.join(process.env.DATA_DIR||__dirname,'history.json');
let hist={};try{hist=JSON.parse(fs.readFileSync(FILE))}catch(e){}
CH.forEach(c=>hist[c]=hist[c]||[]);
let dirty=false;
setInterval(()=>{if(dirty){dirty=false;try{fs.writeFileSync(FILE,JSON.stringify(hist))}catch(e){}}},5000);
const page=fs.readFileSync(path.join(__dirname,'index.html'));
const srv=http.createServer((q,r)=>{r.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});r.end(page)});
const wss=new WebSocketServer({server:srv,maxPayload:1e6});
const clients=new Map();let n=0;
const all=(d,except)=>{const s=JSON.stringify(d);for(const w of clients.keys())if(w!==except&&w.readyState==1)w.send(s)};
wss.on('connection',ws=>{
 ws.on('message',raw=>{
  let d;try{d=JSON.parse(raw)}catch(e){return}
  const me=clients.get(ws);
  if(d.t=='hello'&&!me){
   const m={id:'u'+(++n),name:String(d.name||'Guest').slice(0,20),color:/^#[0-9a-f]{6}$/i.test(d.color)?d.color:'#5865f2',inCall:false};
   const members={};for(const c of clients.values())members[c.id]=c;
   clients.set(ws,m);members[m.id]=m;
   ws.send(JSON.stringify({t:'init',id:m.id,members,hist}));all({t:'join',m},ws);
  }else if(me){
   if(d.t=='msg'){
    const text=String(d.text||'').slice(0,2000);
    const img=typeof d.img=='string'&&d.img.length<4e5&&/^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(d.img)?d.img:'';
    if(!text&&!img)return;
    const ch=CH.includes(d.chan)?d.chan:'general',m={name:me.name,color:me.color,chan:ch,text,img,ts:Date.now()};
    hist[ch].push(m);if(hist[ch].length>100)hist[ch].shift();dirty=true;all({t:'msg',m});
   }else if(d.t=='callstate'){
    me.inCall=!!d.inCall;all({t:'callstate',id:me.id,inCall:me.inCall});
    if(me.inCall)ws.send(JSON.stringify({t:'callers',ids:[...clients.values()].filter(c=>c.inCall&&c!==me).map(c=>c.id)}));
   }else if(d.t=='sig'){
    for(const [w,c] of clients)if(c.id==d.to&&w.readyState==1)w.send(JSON.stringify({t:'sig',from:me.id,d:d.d}));
   }
  }
 });
 ws.on('close',()=>{const m=clients.get(ws);clients.delete(ws);if(m)all({t:'leave',id:m.id})});
});
setInterval(()=>wss.clients.forEach(w=>w.ping()),25000);
srv.listen(PORT,()=>console.log('FriendGroupTalks running on port '+PORT));

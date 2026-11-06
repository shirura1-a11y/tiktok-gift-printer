import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { networkInterfaces } from 'node:os';

const files={'/':['index.html','text/html; charset=utf-8'],'/index.html':['index.html','text/html; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/script.js':['script.js','text/javascript; charset=utf-8'],'/bridge.js':['bridge.js','text/javascript; charset=utf-8']};
const demoAvatar='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e5d4ad"/><path d="M21 42L23 13L41 29M59 29L78 13L80 43" fill="#8c927b"/><ellipse cx="50" cy="51" rx="32" ry="29" fill="#fff5db"/><circle cx="39" cy="48" r="3" fill="#475540"/><circle cx="61" cy="48" r="3" fill="#475540"/><path d="M44 63Q50 69 56 63" fill="none" stroke="#ba8a72" stroke-width="2"/><path d="M20 100Q20 78 50 78Q80 78 80 100" fill="#788d72"/></svg>';
async function readJson(req){if(!String(req.headers['content-type']).startsWith('application/json'))throw Object.assign(Error('JSONが必要です'),{status:415});let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>16384)throw Object.assign(Error('リクエストが大きすぎます'),{status:413});}return JSON.parse(body||'{}');}
export function createPrintServer({root,jobs,port=8787,mode='live',username,onDemoGift=()=>{}}){
  let status={state:'starting',message:'起動中',mode,username,error:''},primary='',actualPort=port;
  const clients=new Map();
  const send=(client,event,data)=>{if(!client.res.destroyed)client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);};
  function report(){const data={...status,pending:jobs.pending.size,printerAttached:!!primary};for(const c of clients.values())send(c,'status',data);return data;}
  function deliver(job){const c=clients.get(primary);if(c)send(c,'print',job);}
  function claim(){if(primary||!clients.size)return;const c=clients.values().next().value;primary=c.lease;send(c,'hello',{role:'primary',lease:c.lease});for(const job of jobs.pending.values())deliver(job);report();}
  const server=createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
    const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    const lanAddresses=Object.values(networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address);
    const allowedHosts=[`127.0.0.1:${actualPort}`,`localhost:${actualPort}`,...lanAddresses.map(ip=>`${ip}:${actualPort}`)];
    if(!allowedHosts.includes(req.headers.host)){json(403,{error:'ローカルの正規URLから開いてください'});return;}
    if(req.headers.origin&&!allowedHosts.some(h=>req.headers.origin==='http://'+h)){json(403,{error:'他のサイトからの操作は受け付けません'});return;}
    try{const path=new URL(req.url,'http://127.0.0.1').pathname;
      if(req.method==='GET'&&path==='/events'){
        res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive'});res.flushHeaders();
        const client={res,lease:randomUUID()};clients.set(client.lease,client);
        send(client,'hello',{role:primary?'observer':'primary',lease:client.lease});if(!primary){primary=client.lease;for(const job of jobs.pending.values())deliver(job);}report();
        res.on('close',()=>{clients.delete(client.lease);if(primary===client.lease){primary='';claim();}report();});return;
      }
      if(req.method==='GET'&&path==='/api/status'){json(200,report());return;}
      if(req.method==='POST'&&path==='/api/ack'){
        const body=await readJson(req);if(!primary||body.lease!==primary){json(409,{error:'有効な印刷タブではありません'});return;}
        if(typeof body.id!=='string'||body.id.length>128){json(400,{error:'ジョブIDが不正です'});return;}
        const accepted=jobs.complete(body.id);report();json(accepted?200:404,{ok:accepted});return;
      }
      if(req.method==='POST'&&path==='/api/test-gift'){
        if(mode!=='demo'){json(403,{error:'受信テストはデモモードでのみ利用できます'});return;}
        const body=await readJson(req);if(!['rose','roza','eternal'].includes(body.gift)){json(400,{error:'ギフト種類が不正です'});return;}
        await onDemoGift(body.gift,`http://127.0.0.1:${actualPort}/demo-avatar.svg`);json(200,{ok:true});return;
      }
      if(req.method==='GET'&&path==='/demo-avatar.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml'});res.end(demoAvatar);return;}
      if(req.method==='GET'&&files[path]){const [name,type]=files[path];const body=await readFile(resolve(root,name));res.writeHead(200,{'Content-Type':type});res.end(body);return;}
      json(404,{error:'Not found'});
    }catch(error){json(error.status||500,{error:error.status?error.message:'ローカルサーバー処理に失敗しました。コンソールを確認してください。'});console.error('[SERVER_ERROR]',error.message);}
  });
  const heartbeat=setInterval(()=>{for(const c of clients.values())if(!c.res.destroyed)c.res.write(': heartbeat\n\n');},15000);heartbeat.unref();
  return {deliver,report,setStatus(patch){status={...status,...patch};report();},get status(){return report();},
    async listen(){await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve);});actualPort=server.address().port;return `http://127.0.0.1:${actualPort}`;},
    async close(){clearInterval(heartbeat);for(const c of clients.values())c.res.destroy();clients.clear();primary='';if(server.listening)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
  };
}

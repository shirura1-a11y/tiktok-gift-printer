import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { DEFAULT_USERNAME, normalizeUsername, logError } from './receiver.mjs';
import { explainError } from './errors.mjs';
import { runDemo } from './demo.mjs';
import { PrintJobs, matchGift } from './jobs.mjs';
import { createPrintServer } from './server.mjs';
import { createLiveController } from './reconnect.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.includes('--help'))console.log('起動: npm start [-- TikTokユーザー名]\nデモサーバー: npm run demo\nオフライン受信ログ: npm run demo:logs\n既定接続先: '+DEFAULT_USERNAME+'\n終了: Ctrl+C');
else if(args.length===1&&args[0]==='--demo-logs')await runDemo();
else{
  let app,controller;
  try{
    const demo=args[0]==='--demo';if(args.length>1)throw Error('引数は --demo またはユーザー名1つだけ指定してください');
    const config=JSON.parse(await readFile(resolve(root,'live/config.json'),'utf8'));
    const username=normalizeUsername(demo?config.username:args[0]??process.env.TIKTOK_USERNAME??config.username??DEFAULT_USERNAME);
    if(!Number.isInteger(config.port)||config.port<1024||config.port>65535)throw Error('ポート番号が不正です');
    for(const kind of ['rose','roza','eternal'])if(!Array.isArray(config.gifts?.[kind]?.ids)||!config.gifts[kind].ids.every(v=>typeof v==='string')||!Array.isArray(config.gifts[kind].names)||!config.gifts[kind].names.every(v=>typeof v==='string'))throw Error('live/config.json のギフト設定が不正です');
    const jobs=new PrintJobs(resolve(root,'.local',demo?'demo-jobs.json':'live-jobs.json'));
    let mock;
    function accept(gift){const kind=matchGift(gift,config.gifts);if(!kind){console.log('[UNMAPPED_GIFT] '+JSON.stringify({giftId:gift.giftId,giftName:gift.giftName}));app.setStatus({error:`未設定のギフト: ${gift.giftName} (ID: ${gift.giftId})。live/config.json を確認してください。`});return;}
      try{const job=jobs.add(gift,kind);if(job){app.deliver(job);app.report();console.log(`[PRINT_QUEUED] ${kind} / ${gift.senderName} / ${job.id}`);}}
      catch(error){logError(error);app.setStatus({state:'error',message:'印刷キューの保存・追加に失敗',error:error.message});}
    }
    app=createPrintServer({root,jobs,port:config.port,username,mode:demo?'demo':'live',onDemoGift:(kind,avatar)=>{if(!mock)throw Error('デモ接続準備中です');mock.emit('gift',{common:{roomId:'demo-room',msgId:randomUUID()},user:{id:'demo-viewer',nickname:'デモ視聴者',displayId:'demo_viewer',avatarThumb:{urlList:[avatar]}},giftId:kind==='rose'?'5655':'demo-'+kind,gift:{type:kind==='rose'?1:2,name:{rose:'バラ',roza:'ローザ',eternal:'永遠のローザ'}[kind]},groupId:randomUUID(),repeatCount:1,repeatEnd:1});}});
    const url=await app.listen();console.log(`[LOCAL] ${url}\n配信画面をこのURLで1タブ開いてください。モード: ${demo?'デモ（実LIVE接続なし）':'LIVE自動印刷'}`);
    controller=createLiveController({username,onGift:accept,onStatus:s=>app.setStatus(s),createConnection:async()=>{
      if(demo){mock=new EventEmitter();mock.connect=async()=>{mock.emit('connected',{roomId:'demo-room'});return {roomId:'demo-room'};};mock.disconnect=async()=>mock.emit('disconnected');return mock;}
      const {TikTokLiveConnection}=await import('tiktok-live-connector');return new TikTokLiveConnection(username,{processInitialData:false,fetchRoomInfoOnConnect:true,enableExtendedGiftInfo:false,webClientOptions:{timeout:{request:15000},retry:{limit:0}},wsClientOptions:{handshakeTimeout:15000}});
    }});
    controller.start();let stopping=false;
    async function shutdown(){if(stopping)return;stopping=true;console.log('\n[STOP] 停止します。未完了の印刷待ちは保存済みです。');const forced=setTimeout(()=>process.exit(0),3000);await controller.stop();await app.close();clearTimeout(forced);process.exit(0);}
    process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
  }catch(error){logError(error);await controller?.stop();await app?.close();process.exitCode=1;}
}

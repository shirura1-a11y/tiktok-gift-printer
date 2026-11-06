import { DEFAULT_USERNAME, normalizeUsername, createReceiver, logError } from './receiver.mjs';
import { runDemo } from './demo.mjs';

const args=process.argv.slice(2);
if(args.includes('--help')){
  console.log('使い方: npm start [-- TikTokユーザー名]\n既定接続先: '+DEFAULT_USERNAME+'\nオフライン確認: npm run demo\n終了: Ctrl+C');
}else if(args.length===1&&args[0]==='--demo'){
  await runDemo();
}else{
  let receiver,watchdog;
  try{
    if(args.length>1)throw new Error('接続先ユーザー名は1つだけ指定してください。npm start -- --help で確認できます。');
    const username=normalizeUsername(args[0]??process.env.TIKTOK_USERNAME??DEFAULT_USERNAME);
    const {TikTokLiveConnection}=await import('tiktok-live-connector');
    const connection=new TikTokLiveConnection(username,{
      processInitialData:false,fetchRoomInfoOnConnect:true,enableExtendedGiftInfo:true,
      webClientOptions:{timeout:{request:15000},retry:{limit:0}},
      wsClientOptions:{handshakeTimeout:15000}
    });
    // An overall deadline also covers the connector's sign-service requests.
    watchdog=setTimeout(()=>{console.error('[ERROR] 接続試行が60秒を超えました。ネットワーク・署名サービス・LIVE開始状態を確認してください。');void receiver?.stop();process.exit(1);},60000);
    receiver=createReceiver({connection,username,onClosed:reason=>{process.exitCode=reason==='streamEnd'?0:1;}});
    let stopping=false;
    const shutdown=()=>{if(stopping)return;stopping=true;clearTimeout(watchdog);console.log('\n[STOP] ギフト受信を終了します。');const forced=setTimeout(()=>process.exit(0),3000);receiver.stop().finally(()=>{clearTimeout(forced);process.exit(0);});};
    process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
    await receiver.start();clearTimeout(watchdog);
  }catch(error){clearTimeout(watchdog);logError(error);await receiver?.stop();process.exitCode=1;}
}

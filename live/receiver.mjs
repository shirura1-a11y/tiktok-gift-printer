import { GiftReceiver } from './gifts.mjs';
import { explainError } from './errors.mjs';

export const DEFAULT_USERNAME='user52107817831310';
export function normalizeUsername(value=DEFAULT_USERNAME){
  const username=String(value).trim().replace(/^@/,'');
  if(!/^[A-Za-z0-9._]{1,24}$/.test(username))throw Object.assign(new Error('TikTokユーザー名は英数字・ピリオド・アンダースコアの1〜24文字で指定してください'),{code:'INVALID_USERNAME'});
  return username;
}
export function logError(error,write=console.error){const e=explainError(error);write(`[ERROR] ${e.cause}\n確認: ${e.action}\n詳細: ${e.detail}`);}

export function createReceiver({connection,username=DEFAULT_USERNAME,write=console.log,writeError=console.error,now=Date.now,onClosed=()=>{}}){
  const gifts=new GiftReceiver({now});let roomId='',stopping=false,connected=false;
  // Register all listeners before connect so no early event is lost.
  connection.on('connected',state=>{roomId=String(state?.roomId??'');connected=true;write(`[CONNECTED] @${username} / roomId=${roomId||'不明'}`);});
  connection.on('gift',event=>{
    const result=gifts.accept(event,roomId);
    if(result.kind==='gift')write('[GIFT] '+JSON.stringify({receivedAt:new Date(now()).toISOString(),...result.gift}));
    else if(result.kind==='unconfirmed')write('[GIFT_UNCONFIRMED] '+JSON.stringify({reason:result.reason,...result.gift,counted:false}));
    else if(result.kind==='invalid')writeError('[GIFT_WARNING] 不正なギフト通知を除外しました。');
  });
  connection.on('error',error=>logError(error,writeError));
  connection.on('streamEnd',()=>{write('[STREAM_END] LIVEが終了しました。次回の配信開始後に npm start を再実行してください。');void stop().then(()=>onClosed('streamEnd'));});
  connection.on('disconnected',()=>{connected=false;if(!stopping){writeError('[DISCONNECTED] 接続が切断されました。LIVE終了または通信断の可能性があります。配信状態とネットワークを確認して npm start を再実行してください。');void stop().then(()=>onClosed('disconnected'));}});
  async function stop(){if(stopping)return;stopping=true;try{await connection.disconnect();}catch(error){logError(error,writeError);}connected=false;}
  return {
    async start(){write(`[CONNECTING] @${username} — ギフト受信ログのみ。印刷への自動連動なし。`);try{return await connection.connect();}catch(error){await stop();throw error;}},
    stop,get connected(){return connected;}
  };
}

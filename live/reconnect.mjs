import { GiftReceiver } from './gifts.mjs';
import { createReceiver, logError } from './receiver.mjs';
import { explainError } from './errors.mjs';

export function createLiveController({username,createConnection,onGift,onStatus,write=console.log,writeError=console.error,setTimer=setTimeout,clearTimer=clearTimeout,random=Math.random}){
  const gifts=new GiftReceiver();let receiver=null,timer=null,stopped=true,attempts=0,generation=0,lastError='';
  function retry(reason){if(stopped||timer)return;const slow=/offline|UserOffline|RateLimit|429/i.test(reason||'');const delay=Math.min(60000,Math.max(slow?30000:2000,2000*2**Math.min(attempts++,5)))+Math.floor(random()*1000);onStatus({state:'reconnecting',message:'再接続を待っています',retryInMs:delay,error:lastError});timer=setTimer(()=>{timer=null;void attempt();},delay);}
  async function attempt(){if(stopped)return;const gen=++generation;onStatus({state:'connecting',message:`@${username} に接続中`,error:lastError});
    try{const connection=await createConnection();if(stopped||gen!==generation){await connection.disconnect();return;}
      receiver=createReceiver({connection,username,gifts,write,writeError,
        onGift:gift=>{if(!stopped&&gen===generation)onGift(gift);},
        onConnected:state=>{if(stopped||gen!==generation)return;attempts=0;lastError='';onStatus({state:'connected',message:`@${username} のLIVEに接続済み`,roomId:String(state?.roomId??''),error:''});},
        onError:error=>{if(stopped||gen!==generation)return;const e=explainError(error);lastError=`${e.cause} ${e.action} ${e.detail}`.slice(0,2000);onStatus({state:'error',message:e.cause,error:lastError});},
        onClosed:reason=>{if(stopped||gen!==generation)return;lastError=reason==='streamEnd'?'LIVEが終了しました。配信再開を待ちます。':'LIVE接続が切断されました。';retry(reason==='streamEnd'?'offline':reason);}
      });
      // Bounds all routes including signing. Late success from an abandoned attempt is closed.
      let deadline;try{await Promise.race([receiver.start(),new Promise((_,reject)=>{deadline=setTimer(()=>reject(Object.assign(new Error('LIVE connection timeout (60s)'),{code:'ETIMEDOUT'})),60000);})]);}finally{if(deadline)clearTimer(deadline);}
      if(stopped||gen!==generation)await receiver.stop();
    }catch(error){if(stopped||gen!==generation)return;const e=explainError(error);lastError=`${e.cause} ${e.action} ${e.detail}`.slice(0,2000);logError(error,writeError);void receiver?.stop();retry(e.detail);}
  }
  return {start(){if(!stopped)return;stopped=false;void attempt();},async stop(){stopped=true;generation++;if(timer)clearTimer(timer);timer=null;await receiver?.stop();}};
}

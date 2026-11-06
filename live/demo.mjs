import { EventEmitter } from 'node:events';
import { createReceiver } from './receiver.mjs';
export async function runDemo(){
  console.log('[DEMO] オフラインの模擬ギフトです。実際のLIVE受信ではありません。');
  const connection=new EventEmitter();
  connection.connect=async()=>{const state={roomId:'demo-room'};connection.emit('connected',state);return state;};
  connection.disconnect=async()=>connection.emit('disconnected');
  const receiver=createReceiver({connection});await receiver.start();
  const gift=(messageId,groupId,count,end=true,type=1)=>({common:{msgId:messageId,roomId:'demo-room'},user:{id:'demo-user',nickname:'テスト視聴者',displayId:'demo_viewer',avatarThumb:{urlList:['https://example.com/demo-avatar.png']}},giftId:'5655',gift:{type,name:'バラ'},groupId,repeatCount:count,repeatEnd:end?1:0});
  connection.emit('gift',gift('1','streak-a',1,false));
  connection.emit('gift',gift('2','streak-a',2,false));
  connection.emit('gift',gift('3','streak-a',3));
  connection.emit('gift',gift('3','streak-a',3));
  connection.emit('gift',gift('4','streak-a',3));
  connection.emit('gift',gift('5','streak-b',2));
  connection.emit('gift',gift('6','',1,true,2));
  await receiver.stop();
  console.log('[DEMO] 完了。[GIFT] は3行、確定数量は3+2+1=6です。');
}

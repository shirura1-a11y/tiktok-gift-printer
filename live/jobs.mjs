import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function matchGift(gift,mapping){
  for(const kind of ['eternal','roza','rose'])if(mapping[kind].ids.includes(String(gift.giftId)))return kind;
  const name=String(gift.giftName).normalize('NFKC').trim().toLocaleLowerCase('en');
  for(const kind of ['eternal','roza','rose'])if(mapping[kind].names.some(n=>n.normalize('NFKC').trim().toLocaleLowerCase('en')===name))return kind;
  return null;
}
export function jobId(gift){
  const identity=gift.giftType===1&&gift.groupId ? ['streak',gift.roomId,gift.senderId||gift.senderUniqueId,gift.recipientId,gift.giftId,gift.groupId] : ['message',gift.roomId,gift.messageId];
  return 'live-'+createHash('sha256').update(JSON.stringify(identity)).digest('hex');
}
export class PrintJobs {
  constructor(file,{maxPending=1000,maxCompleted=10000}={}){
    this.file=file;this.maxPending=maxPending;this.maxCompleted=maxCompleted;this.pending=new Map();this.completed=new Set();
    if(file&&existsSync(file)){
      const data=JSON.parse(readFileSync(file,'utf8'));
      if(data.version!==1||!Array.isArray(data.pending)||!Array.isArray(data.completed))throw Error('印刷キューファイルの形式が不正です。ファイルを退避して確認してください。');
      if(data.pending.length>maxPending)throw Error('保存キューが上限を超えています。設定と保存ファイルを確認してください。');
      for(const job of data.pending){if(!job||typeof job.id!=='string'||!['rose','roza','eternal'].includes(job.user?.gift))throw Error('保存された印刷ジョブが不正です。');this.pending.set(job.id,job);}
      for(const id of data.completed.slice(-maxCompleted))if(typeof id==='string')this.completed.add(id);
      for(const id of this.completed)this.pending.delete(id);
    }
  }
  save(){if(!this.file)return;mkdirSync(dirname(this.file),{recursive:true});const temp=this.file+'.tmp-'+randomUUID();writeFileSync(temp,JSON.stringify({version:1,pending:[...this.pending.values()],completed:[...this.completed]}),'utf8');renameSync(temp,this.file);}
  add(gift,kind){const id=jobId(gift);if(this.pending.has(id)||this.completed.has(id))return null;if(this.pending.size>=this.maxPending)throw Error(`印刷待ちが上限${this.maxPending}件です。受信ギフトを自動印刷できませんでした。`);
    const job={id,createdAt:new Date().toISOString(),repeatCount:gift.repeatCount,user:{name:gift.senderName,avatar:gift.avatarUrl,gift:kind,eventId:id}};
    this.pending.set(id,job);try{this.save();}catch(error){this.pending.delete(id);throw error;}return job;
  }
  complete(id){if(this.completed.has(id))return true;const job=this.pending.get(id);if(!job)return false;this.pending.delete(id);this.completed.add(id);const prior=[...this.completed];while(this.completed.size>this.maxCompleted)this.completed.delete(this.completed.values().next().value);try{this.save();}catch(error){this.pending.set(id,job);this.completed=new Set(prior.filter(v=>v!==id));throw error;}return true;}
}

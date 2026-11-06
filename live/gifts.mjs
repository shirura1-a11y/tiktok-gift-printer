// Normalize the connector's v3 protobuf payload. No browser or printing imports.
const scalar = value => ['string','number','bigint'].includes(typeof value) ? String(value).trim() : '';
const id = value => { const s=scalar(value); return s && s!=='0' ? s : ''; };
const first = (...values) => values.map(scalar).find(Boolean) || '';
const isEnd = value => value===true || value===1 || value==='1';
function avatarUrl(user,event){
  const candidates=[user.avatarThumb?.urlList,user.avatarMedium?.urlList,user.avatarLarge?.urlList,user.profilePicture?.urls,[user.profilePictureUrl,event.profilePictureUrl]];
  for(const list of candidates){if(!Array.isArray(list))continue;for(const value of list){if(typeof value!=='string')continue;try{const u=new URL(value);if(['https:','http:'].includes(u.protocol))return value;}catch{}}}return '';
}
export function normalizeGift(event,roomId=''){
  if(!event || typeof event!=='object')return null;
  const user=event.user || {},gift=event.gift || {},extended=event.extendedGiftInfo || {};
  const rawType=gift.type ?? event.giftType ?? extended.type;
  const giftType=rawType===undefined ? null : Number(rawType);
  const rawCount=event.repeatCount ?? 1,count=Number(rawCount);
  if(!Number.isSafeInteger(count)||count<1)return null;
  return {
    roomId:id(event.common?.roomId)||id(roomId),
    messageId:id(event.common?.msgId)||id(event.msgId),
    groupId:id(event.groupId),
    senderId:id(user.id)||id(user.userId)||id(event.userId),
    senderName:first(user.nickname,user.nickName,event.nickname,user.displayId,user.uniqueId,event.uniqueId)||'名前不明',
    senderUniqueId:first(user.displayId,user.uniqueId,event.uniqueId),
    recipientId:id(event.toUser?.id)||id(event.toUser?.userId),
    avatarUrl:avatarUrl(user,event),
    giftId:id(event.giftId)||id(gift.id),
    giftName:first(gift.name,extended.name,event.giftName)||`不明なギフト (ID: ${id(event.giftId)||id(gift.id)||'不明'})`,
    repeatCount:count,giftType,repeatEnd:isEnd(event.repeatEnd)
  };
}

// Bounded cache: protects both message re-delivery and duplicated streak finals.
// Keys include room, sender, recipient, gift, and group; two separate streaks
// from the same person must never be collapsed just because giftId matches.
export class GiftReceiver {
  constructor({now=Date.now,ttlMs=30*60*1000,maxEntries=10000}={}){
    this.now=now;this.ttlMs=ttlMs;this.maxEntries=maxEntries;this.seen=new Map();
  }
  accept(event,roomId=''){
    const gift=normalizeGift(event,roomId);
    if(!gift)return {kind:'invalid'};
    if(gift.giftType===1 && !gift.repeatEnd)return {kind:'progress',gift};
    // Without gift type, an explicit final marker is required before counting.
    if((gift.giftType===null||!Number.isFinite(gift.giftType))&&!gift.repeatEnd)return {kind:'unconfirmed',reason:'ギフト種別と終了通知がなく確定できません',gift};
    const now=this.now();
    for(const [key,expires]of this.seen){if(expires>now)break;this.seen.delete(key);}
    const scope=[gift.roomId,gift.senderId||gift.senderUniqueId,gift.recipientId,gift.giftId];
    const keys=[];
    if(gift.messageId)keys.push(JSON.stringify(['message',gift.roomId,gift.messageId]));
    if(gift.giftType===1&&gift.groupId&&(gift.senderId||gift.senderUniqueId))keys.push(JSON.stringify(['streak',...scope,gift.groupId]));
    if(!keys.length)return {kind:'unconfirmed',reason:'通知ID・連続送信IDがなく重複判定できません',gift};
    const duplicate=keys.some(key=>this.seen.has(key));
    // Remember new message IDs even when a known group final arrives again.
    for(const key of keys){if(!this.seen.has(key))this.seen.set(key,now+this.ttlMs);}
    while(this.seen.size>this.maxEntries)this.seen.delete(this.seen.keys().next().value);
    return {kind:duplicate?'duplicate':'gift',gift};
  }
}

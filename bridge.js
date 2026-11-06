'use strict';
(() => {
  const status=document.querySelector('#live-status'),detail=document.querySelector('#live-detail'),error=document.querySelector('#live-error'),demo=document.querySelector('#demo-receiver');
  if(!status)return;
  if(!['http:','https:'].includes(location.protocol)){status.textContent='ローカルテスト';detail.textContent='npm start 後、表示されたローカルURLで開くとLIVE自動印刷が有効になります。';return;}
  const KEY='gift-atelier.completed-live-jobs.v1',inFlight=new Set(),acks=new Set();
  let completed=new Set(),lease='',primary=false,ackTimer=0,acking=false;
  try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(data))completed=new Set(data.filter(v=>typeof v==='string').slice(-2000));}catch{error.textContent='完了履歴を読み込めません。サーバー側の印刷履歴で重複を防ぎます。';}
  function remember(id){completed.add(id);while(completed.size>2000)completed.delete(completed.values().next().value);try{localStorage.setItem(KEY,JSON.stringify([...completed]));}catch{error.textContent='ブラウザの完了履歴を保存できません。サーバー側の履歴は継続します。';}}
  async function flushAcks(){if(acking||!primary||!lease||!acks.size)return;acking=true;try{for(const id of [...acks]){const response=await fetch('/api/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,lease})});if(!response.ok)throw Error('印刷完了の通知を再試行しています');acks.delete(id);}}catch(e){error.textContent=e.message;}finally{acking=false;if(acks.size&&!ackTimer)ackTimer=setTimeout(()=>{ackTimer=0;void flushAcks();},3000);}}
  window.addEventListener('giftprint:complete',e=>{const id=e.detail?.eventId;if(!inFlight.has(id))return;inFlight.delete(id);remember(id);acks.add(id);void flushAcks();});
  const source=new EventSource('/events');
  function read(e){try{return JSON.parse(e.data);}catch{error.textContent='サーバーからの通知形式が不正です。';return null;}}
  source.addEventListener('hello',e=>{const data=read(e);if(!data)return;lease=data.lease;primary=data.role==='primary';if(!primary){status.textContent='別タブで印刷中';detail.textContent='このタブは監視のみ。印刷画面は1タブで使用してください。';}else void flushAcks();});
  source.addEventListener('status',e=>{const s=read(e);if(!s)return;demo.hidden=s.mode!=='demo';if(primary){status.textContent=s.mode==='demo'?'デモ受信モード':({connected:'LIVE接続済み',connecting:'LIVE接続中',reconnecting:'LIVE再接続待ち',error:'接続・印刷エラー',starting:'起動中'}[s.state]||s.state);detail.textContent=`@${s.username} · サーバー印刷待ち ${s.pending}件${s.retryInMs?' · 約'+Math.ceil(s.retryInMs/1000)+'秒後に再接続':''}`;}error.textContent=s.error||'';});
  source.addEventListener('print',e=>{const job=read(e);if(!job||!primary)return;if(!/^live-[a-f0-9]{64}$/.test(job.id)||!['rose','roza','eternal'].includes(job.user?.gift)){error.textContent='不正な印刷ジョブを除外しました。';return;}
    if(completed.has(job.id)){acks.add(job.id);void flushAcks();return;}if(inFlight.has(job.id))return;
    try{inFlight.add(job.id);window.enqueuePrint({...job.user,eventId:job.id});}catch(e){inFlight.delete(job.id);error.textContent='自動印刷の追加に失敗: '+e.message;}
  });
  source.onerror=()=>{status.textContent='ローカルサーバーに再接続中';detail.textContent='Node.jsが起動しているか確認してください。接続回復後、未完了ジョブを再送します。';};
  document.querySelectorAll('[data-receive-gift]').forEach(button=>{button.addEventListener('click',async()=>{try{const response=await fetch('/api/test-gift',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gift:button.dataset.receiveGift})});if(!response.ok)throw Error('デモギフト送信に失敗しました');}catch(e){error.textContent=e.message;}});});
})();

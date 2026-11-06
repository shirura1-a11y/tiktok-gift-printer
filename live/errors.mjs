function clean(value){return String(value??'')
  .replace(/https?:\/\/[^\s<>"']+/gi,raw=>{try{const u=new URL(raw);u.username='';u.password='';u.search='';u.hash='';return u.toString();}catch{return '[URL]';}})
  .replace(/((?:api[-_]?key|token|authorization|cookie|sessionid|signature)\s*[:=]\s*)[^\s,;]+/gi,'$1[REDACTED]')
  .replace(/[\x00-\x1f\x7f\x1b]/g,' ').slice(0,400);}
export function explainError(error){
  const parts=[],visited=new Set();
  function collect(e,depth=0){if(!e||depth>6||visited.has(e)||parts.length>=12)return;visited.add(e);
    if(typeof e==='string'){parts.push(clean(e));return;}
    parts.push([e.name,e.constructor?.name!=='Error'?e.constructor?.name:undefined,e.config?.routeId,e.code,e.reason,e.statusCode??e.response?.statusCode??e.response?.status,e.message??e.info].filter(v=>v!==undefined).map(clean).join(' | '));
    collect(e.cause,depth+1);collect(e.exception,depth+1);collect(e.error,depth+1);collect(e.config?.requestErr,depth+1);
    if(Array.isArray(e.config?.requestErrs))e.config.requestErrs.slice(0,4).forEach(v=>collect(v,depth+1));
    if(Array.isArray(e.errors))e.errors.slice(0,4).forEach(v=>collect(v,depth+1));
  }collect(error);
  const detail=parts.filter(Boolean).join(' / ')||'詳細情報なし';
  let cause='接続処理に失敗しました。',action='下のエラー詳細を確認してください。TikTok側の仕様変更や署名サービス障害の場合もあります。';
  if(/UserOffline|isn.t (?:online|live)|not (?:currently )?(?:live|online)|offline/i.test(detail)){cause='コネクターが配信オフラインと判定しました。';action='対象アカウントでLIVEを開始し、ブラウザでも視聴できることを確認してから再実行してください。';}
  else if(/EADDRINUSE/i.test(detail)){cause='ローカルサーバーのポートが使用中です。';action='起動済みのNode.jsを終了するか、live/config.json のportを変更してください。';}
  else if(/ERR_MODULE_NOT_FOUND|Cannot find package/i.test(detail)){cause='必要なNode.jsパッケージが見つかりません。';action='リポジトリのフォルダーで npm ci を実行してください。';}
  else if(/InvalidUniqueId|INVALID_USERNAME/i.test(detail)){cause='接続先ユーザー名の形式が不正です。';action='@の後ろのユーザー名を指定してください。表示名やプロフィールURLは指定しません。';}
  else if(/429|RateLimit|rate.?limit/i.test(detail)){cause='TikTokまたは署名サービスの接続回数制限です。';action='しばらく待って再実行してください。繰り返しの即時再接続は行いません。';}
  else if(/401|403|forbidden|unauthorized|captcha|verify|authentication/i.test(detail)){cause='TikTokまたは署名サービスがアクセスを拒否しました。';action='公開LIVEか、地域やネットワークの制限がないか確認してください。署名APIの認証・利用制限が原因の可能性もあります。';}
  else if(/ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|timeout|timed out|NETWORK|TLS|CERT_/i.test(detail)){cause='DNS・通信・タイムアウト・TLSのいずれかで接続できませんでした。';action='インターネット接続、Windowsファイアウォール、プロキシ、PCの日時を確認してください。';}
  else if(/404|room.?id|room.?info/i.test(detail)){cause='配信ルーム情報を取得できませんでした。';action='ユーザー名、LIVE開始状態、ブラウザでの視聴可否を確認してください。オフラインとは断定できません。';}
  return {cause,action,detail};
}

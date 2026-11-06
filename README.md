# Gift Atelier — TikTokギフト連動アイコン印刷システム / Part 1

外部依存なしのHTML / CSS / JavaScript / Canvasによる印刷デモです。TikTok接続とOBS設定は含みません。3D・外部API・画像配信サービスを使いません。3種類のサンプル画像はJavaScript内のSVGデータです。

## 起動

同じフォルダーに index.html、style.css、script.js を置き、index.html をEdgeまたはChromeで開いてください。サーバー、インストール、ビルド、ネット接続は不要です。Windows 10の現行ブラウザを想定しています。

1. 3つの丸いアイコンからユーザーを選択。
2. 「テスト印刷」を押すと、約5.6秒で排紙・落下が完了。
3. 印刷中にもボタンを押すとFIFOキューに追加。待機数は現在処理中の1件を含みません。
4. ユーザーを切り替えて複数回押し、受付順と用紙の名前を確認。
5. 「音声 ON / OFF」で印刷音を切り替え。「用紙を片づける」で完成用紙だけを削除。

音はWeb Audioで合成します。初回のボタン操作で音声を有効化します。ブラウザの自動再生制限により、プログラムから追加しただけの印刷は操作前には無音です。音声が利用できない場合も印刷は進みます。

## 将来のイベント接続口

ブラウザの開発者ツールで実行できます。

```js
enqueuePrint({name: '視聴者さん', avatar: 'data:image/png;base64,...'});
// username / avatarUrl も同義フィールドとして利用可
// 画像なしもOK。名前の先頭文字を丸い代替アイコンとして表示。
enqueuePrint({name: 'ゲスト'});
// エラー時のフォールバック確認
enqueuePrint({name: '画像エラーテスト', avatar: 'data:image/png;base64,broken'});
// 状態取得
getPrintState(); // printing, loading, waiting, completed, retained, animating
```

enqueuePrint(user) はユーザー情報をコピーして受け付けます。画像の準備中も次のジョブは追い越しません。画像エラー・3.5秒の読み込みタイムアウトでは代替表示に移行します。オフライン運用ではdata URLまたはローカル画像を使ってください。TikTokからイベントを取得する処理は今回ありません。

## 描画と負荷

- 内部解像度1280×720。表示サイズは画面幅に応じて縮小。
- requestAnimationFrameを約30fpsに間引き、経過時間で進行。
- 待機中は描画ループを停止。画像読み込み中も連続描画なし。
- 背景と各用紙はオフスクリーンCanvasにキャッシュ。
- 非表示タブでは描画・印刷の進行・印刷音を停止。復帰時に続行。
- 完成用紙は最大24枚。以降は古いものを除き、メモリ増加を抑制。
- キューはページ内のみの一時保存。再読み込みで消去。
- ページ上部の状態と待機数はDOMで表示し、選択ボタンはキーボード操作可能。

## 実行環境・検証結果（2026-11-06）

制作環境: Linux x86_64、Node.js v24.22.1、Git 2.52.0。
JavaScript構文チェック成功。Canvas/DOMモックによる状態検証で、3件FIFO順序、画像エラー経路、3件完了、用紙保持、用紙消去、待機中のRAF停止を確認しました。

ブラウザ操作用cua_repl.jsが利用できないため、実ブラウザの画面確認・音声確認は未実施です。Windows 10 / RAM 4GB実機のフレームレート・CPU使用率は未計測で、30fpsは設計目標です。

## GitHub保存先

非公開リポジトリ: https://github.com/shirura1-a11y/tiktok-gift-printer

Part 1の4ファイルをリポジトリのルートに保存しています。GitHubの「Code → Download ZIP」でまとめてダウンロードし、展開後にindex.htmlを開けます。

制作環境のGitHub CLI認証は無効のため、接続済みGitHubアプリのContents APIでコミットを作成しています。

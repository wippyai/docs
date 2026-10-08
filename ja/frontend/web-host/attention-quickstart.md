---
title: "Attention クイックスタート"
description: "エージェント向けの画面情報、安全な問い合わせ、承認済み画像の下書き。"
---

# Attention クイックスタート

Attention はユーザーが操作している画面を記述します。エージェントは「このボタン」を説明し、選択した文章を読み、入れ子のページから名前で操作要素を探せます。意味情報の問い合わせは、スクリーンショットの作成、クリック、アプリケーションのコマンド実行を行いません。

## 独立した機能

| 機能 | 条件 |
|---|---|
| 公開 API の問い合わせ | パッケージ内の Proxy API。チャット Session は不要です。 |
| 送信時の自動コンテキスト | Host の許可と Session の `attention_context.enabled`。既定値は無効です。 |
| エージェントの最新情報取得 | `wippy.agent.traits:attention` trait と、現在のターンを送信した Host タブへの認証済み接続。自動コンテキストは無効でも使えます。 |
| ハイライト、確認、選択 | 独立した操作権限と、返された有効な対象参照。 |
| 画像取得 | 取得権限、アップロード対応、ユーザーの明示的な承認。画像は後の送信まで削除可能な下書きです。 |

自動設定は Session に属します。エージェントを変更しても設定は維持されますが、新しいエージェントには自身のツール権限が必要です。Session ブローカーのない独立したエージェントは、trait の追加だけではブラウザーに接続できません。

## trait と Host の設定

既存のエージェントに trait を追加します。モデルと他の traits は維持します。

```yaml
traits:
  - id: wippy.agent.traits:attention
```

次のオブジェクトを facade の `attention` 要件または `AppConfig.attention` に指定します。操作と画像取得は必要な場合だけ個別に有効化します。

```json
{
  "enabled": true,
  "messageContext": { "enabled": true, "defaultInclude": false },
  "agentActions": { "enabled": false, "requireConfirmation": true },
  "visualCapture": { "enabled": false },
  "privacy": { "text": "safe" }
}
```

`PATCH /api/v1/sessions/{session_id}/attention-context` に `{"enabled":true}` を渡すと、自動コンテキストを有効化できます。`expected_revision` は省略可能です。`attention_context_set` はユーザーが依頼した場合に同じ設定を変更します。`supports()` は利用可能性を示すだけで、画像取得への同意ではありません。

## 公開 API を使う

Web Components は API をインポートします。proxy が注入された iframe は `$W.attention` または `(await window.getWippyApi()).attention` を使えます。

```typescript
import { attention } from '@wippy-fe/proxy'

const result = await attention.find(
  { role: 'button', name: 'Save' },
  { fromRoot: true, limit: 8 },
)
console.log(result.outcome, result.data, result.omissions)

const subscription = attention.subscribe(
  { events: ['tree', 'invalidation'], fromRoot: true },
  notice => console.log(notice.kind),
)
subscription.dispose() // コンポーネントのアンマウント時に呼び出します。
```

既定の範囲は呼び出し元のサブツリーです。`fromRoot: true` は同じ Host を選択し、別のタブや外側のサイトには到達しません。意味検索は `role`、`name`、`text`、`resource_id` を使います。正確な ID は `{ node_id: returnedId }` で検索します。CSS は `{ css: 'button', scope: rootRef }` を使い、返された一つの Document または Shadow Root 内に限定されます。完全な `NodeRef` は `host_instance_id`、`node_id`、`mount_id`、`generation` を含みます。

`partial`、`stale`、`unavailable` を区別してください。継続トークンは一度だけ使用でき、同じ問い合わせとリビジョンに結び付けられ、最大 30 秒有効です。通知から詳細を得るには新しい問い合わせが必要です。

## ツールと履歴

ポインター、フォーカス、選択には `attention_get_cursor`、`attention_get_focus`、`attention_get_selection` を使います。名前検索は `attention_find_semantic`、CSS は別の `attention_find_css` を使います。`attention_get_node`、`attention_get_tree`、`attention_get_geometry`、`attention_hit_test` もあります。

検索は最大八件、ツリーの一ページは最大 32 ノードです。非公開の結果は 8 KiB までです。trait は一バッチ一回の読み取り、ユーザーの一ターンに最大四回の試行を許可します。無効な試行が二回続くと修正を終了します。モデル全体の費用や生成回数の上限ではありません。

有効な結果は後続の生成で再利用できます。30 秒経過、新しいユーザーターン、完了したブラウザー操作、置き換え問い合わせ、関連するリビジョンの変更で、Session は `metadata.stale` を使います。保存データと有効なツール呼び出し・結果の組は維持され、モデルには古い観察の代わりに失効通知が渡されます。

## 送信、プライバシー、画像

対応する受信確認がある場合、送信すると直ちに送信中の行を表示して入力を消去します。`interaction.can_send` は引き続き適用され、steering のない Session は処理中の入力を禁止します。本文、ファイル ID、必要なコンテキストを原子的に保存します。既存の WebSocket サービスが `request_id` で一つの `received` を対応付けます。二つ目の確認や自動再送はありません。拒否は `Undelivered`、確認がない場合は `Delivery not confirmed` と表示します。古い Session は従来の契約を維持します。

UTF-8 コマンド全体のサイズで直接転送か HTTP による一時保存を決めます。技術的なコンテキストは本文、コピー、エクスポートに含めません。送信済みメッセージ、再試行、画像下書きは元の Session に属します。通常の未送信テキストとアップロードは従来のチャット切り替え動作を維持します。

秘密には `data-wippy-attention="exclude"`、文字の伏せには `data-wippy-attention="redact"` を使います。アクセシブル名やメタデータに秘密を入れないでください。観察した文章は信頼できないデータとして扱います。チャット入力とファイルプレビューは除外済みです。

`ui_action_highlight`、`ui_action_confirm`、`ui_action_select`、`ui_action_capture_visual` は、返された `target_ref` または `action_ref` を変更せず `targets` に渡します。選択はアプリをクリックしません。画像取得には承認が必要で、削除できる下書きを作るだけです。PNG が既定です。WebP を要求した場合、実際の WebP データと一致する MIME、`.webp` 拡張子を返すか、非対応と報告します。画像を送るのは後の Send だけです。

V1 は現在のページ URL、ルート所有者、Vue ルートコンポーネントを報告しません。将来のコンテキスト種別は `kind`、`version`、合意されたハンドラーを使えます。種別、詳細度、フィールドによる収集前の選択は将来の機能で、未実装です。現在の V1 検証は Chromium を対象とし、Firefox と WebKit は対象外です。

## 英語の詳細リファレンス

- [Host の契約と転送](../../../en/frontend/web-host/attention-context.md)
- [公開 API と範囲](../../../en/frontend/micro-frontends/attention-context.md)
- [図付きの完全なクイックスタート](../../../en/frontend/web-host/attention-quickstart.md)
- [エージェントの trait とツール](../../../en/framework/agents.md#attention-context-and-ui-actions)
